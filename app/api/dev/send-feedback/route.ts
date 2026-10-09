import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveDemoEvents } from '@/lib/dev/state';
import { isDevOverlayAuthorized, isDevOverlayEnabled } from '@/lib/dev-overlay-auth';
import { sendFeedbackPostLive, sendFeedbackPostLiveHost } from '@/lib/email/templates';

/**
 * Déclenchement manuel des emails de feedback post-live pour l'event démo
 * (`resolveDemoEvents`), en dehors du cron `/api/cron/send-feedback-emails`
 * (désactivé hors production, cf ARCHITECTURE.md § Crons). Utile pour la
 * démo : ignore la fenêtre de date (`feedback_days_after`) et la garde
 * d'idempotence (`feedback_sent`) puisqu'il n'y a rien à protéger en dev/démo.
 *
 * `overrideEmail`, si fourni, redirige TOUS les envois (hôtes + visiteurs)
 * vers cette adresse — pratique pour recevoir les emails dans une vraie boîte
 * pendant une démo, tout en gardant les liens de token réels (le lien renvoie
 * bien vers le contact_request / host_activation d'origine, donc soumettre le
 * formulaire remplit correctement /admin/feedback).
 */
export async function POST(req: NextRequest) {
  if (!isDevOverlayEnabled()) {
    return new NextResponse(null, { status: 404 });
  }
  if (!isDevOverlayAuthorized(req)) {
    return NextResponse.json({ error: 'Secret invalide.' }, { status: 403 });
  }

  const { overrideEmail } = await req.json().catch(() => ({}));

  const supabase = createServiceClient();
  const { demoLiveEvent } = await resolveDemoEvents(supabase);

  const { data: activations } = await supabase
    .from('host_activations')
    .select('id, host_profiles!inner(id, email, first_name)')
    .eq('event_id', demoLiveEvent.id);

  if (!activations?.length) {
    return NextResponse.json({ error: 'Aucun hôte activé pour cet event.' }, { status: 400 });
  }

  const activationIds = activations.map((a) => a.id);

  const { data: allContacts } = await supabase
    .from('contact_requests')
    .select('id, visitor_email, visitor_first_name, visitor_token, host_activation_id')
    .eq('status', 'accepted')
    .in('host_activation_id', activationIds);

  // Un lien de feedback déjà soumis affiche "Vous avez déjà donné votre avis"
  // au lieu d'un formulaire vide (contrainte live_feedbacks_unique) — pour une
  // démo où on veut cliquer le lien reçu et remplir le formulaire en direct,
  // on exclut les couples déjà notés plutôt que d'envoyer un lien mort.
  const { data: existingVisitorFeedback } = allContacts?.length
    ? await supabase
        .from('live_feedbacks')
        .select('contact_request_id')
        .in('contact_request_id', allContacts.map((c) => c.id))
    : { data: [] as { contact_request_id: string | null }[] };
  const feedbackedContactIds = new Set((existingVisitorFeedback ?? []).map((f) => f.contact_request_id));
  const contacts = allContacts?.filter((c) => !feedbackedContactIds.has(c.id));

  const hostProfileIds = activations
    .map((a) => (Array.isArray(a.host_profiles) ? a.host_profiles[0] : a.host_profiles)?.id)
    .filter(Boolean);
  const { data: existingHostFeedback } = hostProfileIds.length
    ? await supabase
        .from('live_feedbacks')
        .select('host_profile_id')
        .eq('direction', 'host_to_visitor')
        .in('host_profile_id', hostProfileIds)
    : { data: [] as { host_profile_id: string | null }[] };
  const feedbackedHostProfileIds = new Set((existingHostFeedback ?? []).map((f) => f.host_profile_id));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  let visitorsSent = 0;
  let hostsSent = 0;
  const errors: string[] = [];

  if (contacts?.length) {
    const results = await Promise.allSettled(
      contacts.map((c) =>
        sendFeedbackPostLive(
          overrideEmail || c.visitor_email,
          c.visitor_first_name,
          demoLiveEvent.title,
          `${appUrl}/feedback/${c.visitor_token}`
        )
      )
    );
    results.forEach((r) => {
      if (r.status === 'fulfilled') visitorsSent += 1;
      else errors.push(`visiteur: ${r.reason}`);
    });
  }

  const activationsWithContacts = activations.filter((a) => {
    const hp = Array.isArray(a.host_profiles) ? a.host_profiles[0] : a.host_profiles;
    if (hp?.id && feedbackedHostProfileIds.has(hp.id)) return false;
    return contacts?.some((c) => c.host_activation_id === a.id);
  });

  if (activationsWithContacts.length) {
    const results = await Promise.allSettled(
      activationsWithContacts.map((a) => {
        const hp = Array.isArray(a.host_profiles) ? a.host_profiles[0] : a.host_profiles;
        if (!hp) return Promise.resolve();
        return sendFeedbackPostLiveHost(
          overrideEmail || hp.email,
          hp.first_name,
          demoLiveEvent.title,
          `${appUrl}/feedback/host/${a.id}`
        );
      })
    );
    results.forEach((r) => {
      if (r.status === 'fulfilled') hostsSent += 1;
      else errors.push(`hôte: ${r.reason}`);
    });
  }

  return NextResponse.json({
    event: demoLiveEvent.title,
    visitorsSent,
    hostsSent,
    errors: errors.length ? errors : undefined,
  });
}

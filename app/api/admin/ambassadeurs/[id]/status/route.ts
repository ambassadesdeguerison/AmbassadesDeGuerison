import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { sendValidationFinale, sendNouvelleActivationAdmin, sendRefusCandidature } from '@/lib/email/templates';
import { FEATURES } from '@/config/features';
import { isDossierComplet } from '@/lib/host-profile';

interface Props {
  params: Promise<{ id: string }>;
}

const VALID_ACTIONS = ['validated', 'validated_bypass', 'rejected', 'suspended', 'reactiver'] as const;
type Action = typeof VALID_ACTIONS[number];
type CandidateEmail = 'sent' | 'failed' | 'none';

const ACTION_STATUS: Record<Exclude<Action, 'reactiver'>, string> = {
  validated: 'validated',
  validated_bypass: 'validated',
  rejected: 'rejected',
  suspended: 'suspended',
};

export async function POST(req: NextRequest, { params }: Props) {
  const ctx = await requireAdmin(req);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const body = await req.json();
  const { action, notes } = body;

  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  const { supabase, user } = ctx;

  const { data: profile } = await supabase
    .from('host_profiles')
    .select('id, status, first_name, user_id, city, country, profile_photo_url, room_photo_urls')
    .eq('id', id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Ambassadeur introuvable' }, { status: 404 });
  }

  // L'action standard 'validated' n'est permise que depuis enrichment_pending
  if (action === 'validated' && profile.status !== 'enrichment_pending') {
    return NextResponse.json(
      { error: 'Le candidat doit d\'abord remplir le questionnaire. Utilisez validated_bypass si nécessaire.' },
      { status: 400 }
    );
  }

  // 'reactiver' (depuis suspended ou rejected) ne doit jamais sauter l'enrichissement :
  // un candidat refusé avant d'avoir complété son questionnaire (photos) n'a pas de dossier
  // à restaurer. Si le dossier est complet → validated direct (comme une ré-activation réelle).
  // Sinon → renvoyé à enrichment_pending, pas d'email (rien à annoncer, le dossier reste à finir).
  const dossierComplet = isDossierComplet(profile.profile_photo_url, profile.room_photo_urls);
  const newStatus = action === 'reactiver'
    ? (dossierComplet ? 'validated' : 'enrichment_pending')
    : ACTION_STATUS[action as Exclude<Action, 'reactiver'>];

  const { error } = await supabase
    .from('host_profiles')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('moderation_log').insert({
    action_type: `ambassador_${action}`,
    target_id: id,
    admin_id: user.id,
    notes: action === 'validated_bypass'
      ? `bypass_enrichment${notes?.trim() ? ` — ${notes.trim()}` : ''}`
      : (notes?.trim() || null),
  });

  // Issue de l'e-mail au candidat, remontée à l'écran admin pour qu'il confirme
  // (ou non) l'envoi :
  //  - 'sent'   : l'e-mail est parti ;
  //  - 'failed' : il devait partir et n'est pas parti (échec d'envoi, ou aucune
  //               adresse trouvée) — l'action, elle, a bien eu lieu ;
  //  - 'none'   : cette action n'envoie rien au candidat (suspension, réintégration
  //               d'un dossier incomplet), ou les e-mails sont désactivés.
  let candidateEmail: CandidateEmail = 'none';

  const emailsCandidate =
    action === 'validated' || action === 'validated_bypass' || action === 'rejected' ||
    (action === 'reactiver' && newStatus === 'validated');

  if (FEATURES.EMAIL_NOTIFICATIONS && emailsCandidate) {
    const email = profile.user_id
      ? (await supabase.auth.admin.getUserById(profile.user_id)).data?.user?.email
      : undefined;

    if (!email) {
      console.error('[admin/status] e-mail candidat non envoyé : aucune adresse', { profileId: id, action });
      candidateEmail = 'failed';
    } else if (action === 'rejected') {
      const [refus] = await Promise.allSettled([
        sendRefusCandidature(email, profile.first_name, notes?.trim() || undefined),
      ]);
      candidateEmail = refus.status === 'fulfilled' ? 'sent' : 'failed';
    } else {
      // sendNouvelleActivationAdmin était défini dans templates.ts mais
      // jamais appelé (trouvé par /qa, 2026-07-29) — documenté comme envoyé
      // ici dans CLAUDE.md et la checklist QA manuelle, mais code mort.
      // Son échec ne change rien pour l'admin qui valide : seul l'e-mail au
      // candidat est rapporté.
      const [bienvenue] = await Promise.allSettled([
        sendValidationFinale(email, profile.first_name),
        sendNouvelleActivationAdmin(profile.first_name, profile.city, profile.country),
      ]);
      candidateEmail = bienvenue.status === 'fulfilled' ? 'sent' : 'failed';
    }
  }

  return NextResponse.json({ success: true, status: newStatus, candidateEmail });
}

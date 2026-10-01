import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/server';
import { sendNewContactRequestHost } from '@/lib/email/templates';
import { FEATURES } from '@/config/features';

function getAnonClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} } }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Honeypot — bots fill the hidden "website" field
  if (body.website) return NextResponse.json({}, { status: 200 });

  const { event_id, host_profile_id, nb_personnes, message, consent } = body;

  if (!event_id || !host_profile_id) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ error: 'Consentement requis' }, { status: 400 });
  }

  // Phase 3 PR3 : la demande se fait désormais depuis un compte visiteur
  // authentifié (écran /mon-espace/creer) — plus de création silencieuse de
  // profil ici (faille corrigée : un email non authentifié ne peut plus
  // écraser le profil d'un visiteur existant, cf /plan-eng-review, Codex).
  const { data: { user } } = await getAnonClient(req).auth.getUser();
  if (!user || user.user_metadata?.role !== 'visitor') {
    return NextResponse.json({ error: 'Compte visiteur requis' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: visitorProfile } = await supabase
    .from('visitor_profiles')
    .select('id, first_name, email, phone, photo_url')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!visitorProfile) {
    return NextResponse.json({ error: 'Profil visiteur introuvable' }, { status: 404 });
  }

  const emailLower = visitorProfile.email;
  const phoneTrimmed = visitorProfile.phone ?? '';
  const firstNameTrimmed = visitorProfile.first_name;

  // Blacklist — refus honnête (403) sans dévoiler le mécanisme.
  // Choix éthique : pas de shadow-ban (faux 201). David est pasteur, le produit
  // ne ment pas à ses utilisateurs, même problématiques. Le message reste neutre
  // pour ne pas confirmer au visiteur qu'il est blacklisté ; une voie de recours
  // est offerte si c'est une erreur.
  // Vérifie à la fois le blocage global (host_profile_id NULL, /admin/blacklist)
  // et le blocage par-ambassadeur (Phase 3 PR3, déclenché depuis le feedback
  // post-live) — un visiteur bloqué par un hôte reste libre de contacter
  // les autres.
  const blacklistFilter = phoneTrimmed
    ? `email.eq.${emailLower},phone.eq.${phoneTrimmed}`
    : `email.eq.${emailLower}`;
  const { data: blockRows } = await supabase
    .from('blacklist')
    .select('host_profile_id')
    .or(blacklistFilter);
  const blocked = (blockRows ?? []).some(
    (r) => r.host_profile_id === null || r.host_profile_id === host_profile_id
  );
  if (blocked) {
    return NextResponse.json(
      { error: "Votre demande ne peut pas être prise en compte. Si vous pensez qu'il s'agit d'une erreur, contactez l'équipe." },
      { status: 403 },
    );
  }

  // Vérifier que l'event existe et que les inscriptions ne sont pas fermées.
  // Pas de gate d'ouverture : dès qu'une fiche d'ambassade est visible, l'inscription
  // est possible. La fermeture (registration_closes_at) est posée automatiquement
  // par le trigger DB à event_date.
  const now = new Date().toISOString();
  const { data: event } = await supabase
    .from('events')
    .select('id, registration_closes_at')
    .eq('id', event_id)
    .single();

  if (!event) {
    return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 });
  }
  if (event.registration_closes_at && now > event.registration_closes_at) {
    return NextResponse.json({ error: 'Les inscriptions sont fermées' }, { status: 400 });
  }

  // Vérifier que l'ambassade est activée pour ce live
  const { data: act } = await supabase
    .from('host_activations')
    .select('id, is_active, is_full')
    .eq('host_profile_id', host_profile_id)
    .eq('event_id', event_id)
    .maybeSingle();

  if (!act) {
    return NextResponse.json({ error: "Ambassade non disponible pour ce live" }, { status: 404 });
  }
  if (!act.is_active) {
    return NextResponse.json({ error: "Cette ambassade n'a pas encore ouvert ses portes pour ce live" }, { status: 410 });
  }
  if (act.is_full) {
    return NextResponse.json({ error: 'Cette ambassade est complète' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('contact_requests')
    .insert({
      host_activation_id: act.id,
      visitor_first_name: firstNameTrimmed,
      visitor_email: emailLower,
      visitor_phone: phoneTrimmed,
      visitor_profile_id: visitorProfile.id,
      nb_personnes: Math.max(1, parseInt(String(nb_personnes)) || 1),
      visitor_message: message?.trim() || null,
    })
    .select('id, action_token')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Vous avez déjà fait une demande pour cette ambassade' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (FEATURES.EMAIL_NOTIFICATIONS) {
    const { data: host } = await supabase
      .from('host_profiles')
      .select('email, first_name, whatsapp_group_url')
      .eq('id', host_profile_id)
      .single();

    if (host) {
      const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accueillir/${data.action_token}`;
      const declineUrl = `${process.env.NEXT_PUBLIC_APP_URL}/refuser/${data.action_token}`;
      const dashboardUrl = visitorProfile.photo_url ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard` : null;
      // Fire-and-forget intentionnel — ne jamais faire attendre le visiteur
      // sur l'envoi de la notification à l'hôte (Cross-Model Perspective du
      // design doc). Le bug corrigé ici (Phase 3 PR2) n'est pas l'absence de
      // blocage, mais l'absence de `.catch()` : un échec d'envoi était
      // auparavant silencieux, jamais visible dans les logs Vercel.
      Promise.allSettled([
        sendNewContactRequestHost(
          host.email,
          host.first_name,
          firstNameTrimmed,
          emailLower,
          message?.trim() || null,
          acceptUrl,
          declineUrl,
          dashboardUrl,
        ),
      ]).catch((err) => console.error('[visit-requests] host notification failed', err));
    }
  }

  return NextResponse.json({ id: data.id, action_token: data.action_token }, { status: 201 });
}

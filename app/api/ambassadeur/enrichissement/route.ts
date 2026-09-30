import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/server';
import { FEATURES } from '@/config/features';
import { sendEnrichissementRecu } from '@/lib/email/templates';
import { sanitizeQuestionnaire } from '@/lib/questionnaire/sanitize';

export async function PATCH(req: NextRequest) {
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from('host_profiles')
    .select('id, status, first_name, profile_photo_url, room_photo_urls')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
  if (profile.status !== 'pre_approved') {
    return NextResponse.json(
      { error: 'Le questionnaire n\'est accessible que pour les candidats pré-approuvés' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  // `draft: true` = enregistrement automatique pendant la saisie : on sauvegarde les
  // champs texte/cases sans exiger les photos et sans changer le statut, pour que
  // le candidat puisse reprendre plus tard (même depuis un autre appareil).
  const isDraft = body?.draft === true;
  const updates: Record<string, unknown> = sanitizeQuestionnaire(body);

  if (!isDraft) {
    // Vérifier qu'une photo de profil a bien été uploadée avant soumission
    if (!profile.profile_photo_url) {
      return NextResponse.json(
        { error: 'Une photo de profil est requise pour soumettre votre profil.' },
        { status: 400 }
      );
    }

    // Vérifier qu'au moins une photo du lieu a bien été uploadée avant soumission
    if (!profile.room_photo_urls || profile.room_photo_urls.length === 0) {
      return NextResponse.json(
        { error: 'Au moins une photo du lieu d\'accueil est requise pour soumettre votre profil.' },
        { status: 400 }
      );
    }

    updates.status = 'enrichment_pending';
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ success: true, draft: isDraft });

  const { error } = await supabase
    .from('host_profiles')
    .update(updates)
    .eq('id', profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (isDraft) return NextResponse.json({ success: true, draft: true });

  if (FEATURES.EMAIL_NOTIFICATIONS) {
    const adminEmail = process.env.RESEND_ADMIN_EMAIL;
    if (adminEmail) {
      Promise.allSettled([
        sendEnrichissementRecu(adminEmail, profile.first_name),
      ]);
    }
  }

  return NextResponse.json({ success: true });
}

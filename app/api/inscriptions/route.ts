import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthUsersByEmail } from '@/lib/auth/list-all-users';
import { normalizeEmail, verifyEmailProof } from '@/lib/auth/email-proof';
import { sendRegistrationConfirmation, sendNouvelleInscriptionAdmin } from '@/lib/email/templates';
import { FEATURES } from '@/config/features';

function humanizeDbError(msg: string): string {
  if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
    return 'Un compte ambassadeur existe déjà avec cet e-mail. Connecte-toi depuis la page de connexion.';
  }
  return msg;
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Honeypot
  if (body.website) return NextResponse.json({}, { status: 200 });

  // L'adresse doit avoir été confirmée par e-mail AVANT toute création (compte, profil, rôle,
  // notification à l'équipe) : la preuve signée est émise par /api/inscriptions/verify-email.
  const email = verifyEmailProof(body.email_proof, 'inscription');
  if (!email || email !== normalizeEmail(String(body.email ?? ''))) {
    return NextResponse.json(
      { error: "Votre adresse e-mail n'est pas confirmée. Reprenez l'inscription depuis le début.", code: 'email_not_verified' },
      { status: 403 },
    );
  }

  const {
    first_name,
    last_name,
    phone,
    city,
    country,
    type,
    capacity,
    address_private,
    whatsapp_group_url,
    consignes,
    lat,
    lng,
    lat_precise,
    lng_precise,
    quartier,
    is_women_only,
  } = body;

  if (!email || !first_name || !last_name || !phone?.trim() || !city || !country || !address_private || lat == null || lng == null) {
    return NextResponse.json({ error: 'Champs obligatoires manquants.' }, { status: 400 });
  }

  if (lat !== undefined && lat !== null) {
    const latNum = Number(lat);
    if (Number.isNaN(latNum) || latNum < -90 || latNum > 90) {
      return NextResponse.json({ error: 'Latitude invalide (doit être entre -90 et 90).' }, { status: 400 });
    }
  }
  if (lng !== undefined && lng !== null) {
    const lngNum = Number(lng);
    if (Number.isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      return NextResponse.json({ error: 'Longitude invalide (doit être entre -180 et 180).' }, { status: 400 });
    }
  }
  if ((lat == null) !== (lng == null)) {
    return NextResponse.json({ error: 'lat et lng doivent être fournis ensemble.' }, { status: 400 });
  }

  // lat_precise/lng_precise : optionnelles (adresse non géocodable en zone rurale
  // ne doit jamais bloquer l'inscription), mais validées si fournies.
  if ((lat_precise == null) !== (lng_precise == null)) {
    return NextResponse.json({ error: 'lat_precise et lng_precise doivent être fournis ensemble.' }, { status: 400 });
  }
  if (lat_precise != null) {
    const v = Number(lat_precise);
    if (Number.isNaN(v) || v < -90 || v > 90) {
      return NextResponse.json({ error: 'Latitude précise invalide.' }, { status: 400 });
    }
  }
  if (lng_precise != null) {
    const v = Number(lng_precise);
    if (Number.isNaN(v) || v < -180 || v > 180) {
      return NextResponse.json({ error: 'Longitude précise invalide.' }, { status: 400 });
    }
  }

  const supabase = createServiceClient();

  // 1. Résoudre l'user_id Supabase Auth
  // createUser + email_confirm: true crée le compte sans envoyer d'email via Supabase Auth.
  // Évite le rate limit (~2-4/h) de inviteUserByEmail. La confirmation passe par Resend ci-dessous.
  // Si l'email existe déjà dans Auth (visiteur antérieur, inscription échouée…), on récupère
  // l'user existant au lieu d'échouer.
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: 'host' },
  });

  let userId: string | undefined = authData?.user?.id;

  if (authError) {
    if (!authError.message.toLowerCase().includes('already')) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
    // Paginé : `listUsers()` seul s'arrête à 50 comptes. Sur une base plus
    // grande, le compte existant (qui vient pourtant de provoquer l'erreur
    // « already registered ») restait introuvable et `userId` nul — le profil
    // ambassadeur était alors créé orphelin, sans compte auth rattaché
    // (trouvé 2026-08-07).
    const byEmail = await getAuthUsersByEmail(supabase);
    const existingUser = byEmail.get(email.toLowerCase());
    userId = existingUser?.id;

    // Cas visiteur devenant ambassadeur avec le même e-mail (trouvé par /qa,
    // 2026-07-29) : le compte auth.users existant garde son role metadata
    // d'origine ('visitor'), ce qui verrouille silencieusement l'accès à
    // /dashboard pour toujours (redirection permanente vers /mon-espace, cf
    // app/dashboard/page.tsx qui checke le role avant même de regarder s'il
    // existe un host_profile). Ne jamais rétrograder un compte 'admin'.
    if (existingUser && existingUser.user_metadata?.role !== 'admin') {
      await supabase.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { ...existingUser.user_metadata, role: 'host' },
      });
    }
  }

  if (!userId) return NextResponse.json({ error: 'Erreur création utilisateur.' }, { status: 500 });

  // 2. Insérer le profil ambassadeur (un seul endroit, source de vérité unique)
  const { data: profileData, error: profileError } = await supabase
    .from('host_profiles')
    .insert({
      user_id: userId,
      email,
      first_name,
      last_name,
      city,
      country,
      host_type: type ?? 'individual',
      capacity: capacity ?? 10,
      address_private,
      whatsapp_group_url: whatsapp_group_url || null,
      consignes: consignes || null,
      phone: phone.trim(),
      lat: lat ?? null,
      lng: lng ?? null,
      lat_precise: lat_precise ?? null,
      lng_precise: lng_precise ?? null,
      quartier: quartier || null,
      is_women_only: (type ?? 'individual') === 'individual' ? Boolean(is_women_only) : false,
      status: 'pending_review',
    })
    .select('id')
    .single();

  if (profileError) {
    return NextResponse.json({ error: humanizeDbError(profileError.message) }, { status: 400 });
  }

  const profileId = profileData?.id;

  // EXCEPTION documentée à « ne jamais renvoyer un token_hash » (CLAUDE.md § Formulaire
  // d'inscription) : l'adresse a été prouvée à l'étape 0 (`email_proof` vérifié plus haut), donc
  // le droit de se connecter avec est le même que celui d'un lien magique reçu par e-mail. Le
  // navigateur échange ce jeton à usage unique contre une session et enchaîne sur /dashboard.
  // Un seul OTP magiclink est actif par utilisateur : ce jeton est consommé côté navigateur, donc
  // l'e-mail n'en porte pas (repli /dashboard, puis /auth depuis un autre appareil).
  // Best-effort : sans jeton, l'écran de succès propose « Me connecter pour continuer ».
  let login: { token_hash: string; type: string } | undefined;
  try {
    const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkError || !link?.properties) throw linkError ?? new Error('lien absent');
    login = {
      token_hash: link.properties.hashed_token,
      type: link.properties.verification_type ?? 'magiclink',
    };
  } catch (e) {
    console.error('[inscriptions] Lien de connexion non généré, repli sur /dashboard:', e);
  }

  if (FEATURES.EMAIL_NOTIFICATIONS) {
    await sendRegistrationConfirmation(email, first_name).catch((e) => {
      console.error('[inscriptions] Échec envoi confirmation candidat:', e);
    });
    await sendNouvelleInscriptionAdmin(first_name, city, country).catch((e) => {
      console.error('[inscriptions] Échec envoi notification admin:', e);
    });
  }

  return NextResponse.json({ success: true, id: profileId, login }, { status: 201 });
}

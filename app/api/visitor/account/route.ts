import { NextRequest, NextResponse } from 'next/server';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { createServiceClient } from '@/lib/supabase/server';
import { classifyVisitorEmail } from '@/lib/visitor/classify-email';
import { compressAmbassadorPhoto } from '@/lib/image/compress-photo';
import { sendVisitorCompteCree } from '@/lib/email/templates';
import { buildConfirmUrl } from '@/lib/auth/confirm-url';
import { safeRedirect } from '@/lib/auth/safe-redirect';

const BUCKET = 'visitor-photos';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo
// Mitigation "decompression bomb" — une image prétendument petite (poids
// fichier) mais aux dimensions énormes peut saturer la mémoire au moment du
// décodage, avant même la compression (cf /plan-eng-review, modèle d'abus).
const MAX_DIMENSION_PX = 8000;

// Écran de compte explicite (Phase 3 PR3, /plan-eng-review) — remplace la
// création silencieuse de createOrUpdateVisitorProfile() dans
// /api/visit-requests, qui acceptait n'importe quel email non authentifié
// pour écraser le profil d'un visiteur existant (faille trouvée par Codex).
// Ici : email/host/admin en collision → 409, jamais de création croisée.
export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const firstName = (formData.get('first_name') as string | null)?.trim();
  const emailRaw = (formData.get('email') as string | null)?.trim();
  const phone = (formData.get('phone') as string | null)?.trim();
  const file = formData.get('file') as File | null;

  if (!firstName || !emailRaw || !emailRaw.includes('@')) {
    return NextResponse.json({ error: 'Prénom et e-mail requis' }, { status: 400 });
  }
  if (!phone || !isValidPhoneNumber(phone)) {
    return NextResponse.json({ error: 'Numéro de téléphone invalide' }, { status: 400 });
  }
  if (file) {
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Seules les images sont acceptées' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Photo trop volumineuse (max 5 Mo)' }, { status: 400 });
    }
  }

  const email = emailRaw.toLowerCase();
  const supabase = createServiceClient();

  // Revalidation serveur — la vérification au blur (/api/visitor/check-email)
  // peut avoir été contournée ou périmée (compte créé entre-temps).
  const classification = await classifyVisitorEmail(supabase, email);
  if (classification === 'visitor_existing') {
    return NextResponse.json(
      { error: 'Un compte existe déjà avec cet e-mail.', type: 'visitor_exists' },
      { status: 409 },
    );
  }
  if (classification === 'collision') {
    return NextResponse.json(
      { error: 'Cet e-mail est déjà utilisé pour un autre type de compte.', type: 'collision' },
      { status: 409 },
    );
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { role: 'visitor' },
  });

  if (authError || !authData?.user) {
    console.error('[visitor/account] createUser failed', authError);
    return NextResponse.json({ error: "Impossible de créer le compte" }, { status: 500 });
  }

  const userId = authData.user.id;

  // Photo optionnelle — un échec ici ne doit jamais bloquer la création de
  // compte (cf Success Criteria du design doc). sharp() décode réellement le
  // contenu de l'image (validation par magic bytes, pas seulement le
  // Content-Type déclaré par le client) et échoue proprement sur un fichier
  // renommé/corrompu.
  let photoPath: string | null = null;
  let photoError = false;

  if (file) {
    try {
      const rawBuffer = Buffer.from(await file.arrayBuffer());
      const sharp = (await import('sharp')).default;
      const metadata = await sharp(rawBuffer).metadata();
      if ((metadata.width ?? 0) > MAX_DIMENSION_PX || (metadata.height ?? 0) > MAX_DIMENSION_PX) {
        throw new Error('Dimensions trop grandes');
      }
      const buffer = await compressAmbassadorPhoto(rawBuffer, 'profile');
      const path = `${userId}/profile-${Date.now()}.webp`;
      // Un Buffer Node passé tel quel au fetch() interne du SDK Storage se fait
      // corrompre (octets non-UTF-8-safe remplacés par U+FFFD) sous Next.js 16 /
      // Turbopack dev — repro'd en /qa. Envelopper en Blob force un chemin de
      // sérialisation binaire-safe.
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, new Blob([new Uint8Array(buffer)], { type: 'image/webp' }), { contentType: 'image/webp', upsert: true });
      if (uploadError) throw uploadError;
      photoPath = path;
    } catch (err) {
      console.error('[visitor/account] photo processing failed', err);
      photoError = true;
    }
  }

  const { error: profileError } = await supabase
    .from('visitor_profiles')
    .insert({ user_id: userId, first_name: firstName, email, phone, photo_url: photoPath });

  if (profileError) {
    console.error('[visitor/account] visitor_profiles insert failed', profileError);
    return NextResponse.json({ error: 'Impossible de créer le profil' }, { status: 500 });
  }

  // Vérification réelle de l'adresse : la session ne s'ouvre QUE par le clic sur
  // le lien reçu par e-mail. Le jeton n'est jamais renvoyé au navigateur — sinon
  // n'importe qui pourrait créer un compte avec l'adresse d'un tiers, puis
  // recevoir l'adresse d'une maison à cet e-mail une fois sa demande acceptée.
  // Un seul generateLink reste actif, donc plus de course entre deux jetons.
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkError || !linkData) {
    console.error('[visitor/account] generateLink failed', linkError);
    return NextResponse.json({ error: "Compte créé mais l'envoi du lien a échoué. Réessayez de vous connecter." }, { status: 500 });
  }

  // Le visiteur n'a que ce lien pour continuer : on attend l'envoi, et on le
  // signale s'il échoue (il pourra demander un nouveau lien depuis l'écran).
  const confirmUrl = buildConfirmUrl(linkData.properties, safeRedirect(formData.get('redirect')) ?? '/mon-espace');
  try {
    await sendVisitorCompteCree(email, firstName, confirmUrl);
  } catch (err) {
    console.error('[visitor/account] confirmation email send failed', err);
    return NextResponse.json({ error: "Compte créé, mais l'e-mail n'a pas pu partir. Validez à nouveau le formulaire : vous pourrez demander un nouveau lien." }, { status: 502 });
  }

  return NextResponse.json({ status: 'verify_email', photo_error: photoError }, { status: 201 });
}

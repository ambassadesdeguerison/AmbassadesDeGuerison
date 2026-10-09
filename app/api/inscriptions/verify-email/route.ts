import { NextRequest, NextResponse } from 'next/server';
import { createEmailProof, normalizeEmail, verifyEmailProof } from '@/lib/auth/email-proof';
import { sendInscriptionEmailVerification } from '@/lib/email/templates';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST : envoie le lien de confirmation. Aucun compte, aucun profil n'est créé ici.
// La réponse est la même que l'adresse soit connue ou non (pas d'énumération de comptes).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Honeypot — les robots remplissent le champ caché « website »
  if (body?.website) return NextResponse.json({ sent: true }, { status: 200 });

  const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : '';
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Merci de saisir une adresse e-mail valide.' }, { status: 400 });
  }

  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/inscription?verify=${encodeURIComponent(createEmailProof(email, 'inscription'))}`;
  try {
    await sendInscriptionEmailVerification(email, verifyUrl);
  } catch (err) {
    console.error('[inscriptions/verify-email] envoi du lien en échec', err);
    return NextResponse.json({ error: "L'e-mail n'a pas pu partir. Réessayez dans un instant." }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}

// GET ?token= : la page d'inscription vérifie le lien reçu avant d'ouvrir le formulaire, pour ne
// pas laisser remplir trois écrans avec un lien périmé ou falsifié.
export async function GET(req: NextRequest) {
  const email = verifyEmailProof(new URL(req.url).searchParams.get('token'), 'inscription');
  if (!email) {
    return NextResponse.json({ error: 'invalid_or_expired' }, { status: 400 });
  }
  return NextResponse.json({ email });
}

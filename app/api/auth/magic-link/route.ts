import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthUsersByEmail } from '@/lib/auth/list-all-users';
import { buildConfirmUrl } from '@/lib/auth/confirm-url';
import { sendMagicLink } from '@/lib/email/templates';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email) {
    return NextResponse.json({ error: 'E-mail requis.' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // `generateLink` CRÉE le compte quand l'adresse est inconnue : la page de connexion
  // fabriquait ainsi des comptes vides (ni profil ambassadeur, ni profil visiteur) pour
  // n'importe quelle saisie, avec un lien qui de surcroît échouait (jeton de type
  // `signup`, voir lib/auth/confirm-url.ts). On ne connecte donc que des comptes
  // existants ; un nouveau venu est guidé vers l'inscription (retour 404 `no_account`).
  const accounts = await getAuthUsersByEmail(supabase);
  if (!accounts.has(email)) {
    return NextResponse.json(
      { error: 'no_account', message: 'Aucun compte n’est associé à cette adresse.' },
      { status: 404 }
    );
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // On envoie un lien vers notre propre app, pas vers supabase.co/auth/v1/verify.
  // Les scanners email (Gmail, Outlook…) pré-fetchen les URLs et consommeraient
  // le token à usage unique avant que l'utilisateur clique.
  // Notre page /auth/confirm est un Client Component : les scanners voient du HTML,
  // n'exécutent pas le JS, et ne consomment pas le token.
  await sendMagicLink(email, buildConfirmUrl(data.properties));

  return NextResponse.json({ success: true });
}

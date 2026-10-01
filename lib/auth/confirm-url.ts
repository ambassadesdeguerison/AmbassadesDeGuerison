// Construit le lien /auth/confirm envoyé par e-mail à partir d'un `generateLink` Supabase.
//
// Le type de vérification doit être celui que Supabase a réellement mis dans le jeton
// (`properties.verification_type`), pas un `magiclink` écrit en dur : pour une adresse
// encore inconnue, `generateLink({ type: 'magiclink' })` crée le compte et émet un jeton
// de type `signup`. `verifyOtp({ type: 'magiclink' })` le refuse alors avec « Email link is
// invalid or has expired » — la page « Ce lien ne fonctionne plus » (reproduit 2026-10-01).

export type GeneratedLinkProperties = {
  hashed_token: string;
  verification_type?: string;
};

/**
 * @param redirect chemin relatif de destination après connexion (ex : `/dashboard`).
 *                 /auth/confirm refuse tout ce qui ne commence pas par un seul `/`.
 */
export function buildConfirmUrl(properties: GeneratedLinkProperties, redirect?: string): string {
  const params = new URLSearchParams({
    token_hash: properties.hashed_token,
    type: properties.verification_type ?? 'magiclink',
  });
  if (redirect) params.set('redirect', redirect);
  return `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/auth/confirm?${params.toString()}`;
}

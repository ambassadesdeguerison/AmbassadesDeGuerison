import { createHmac, timingSafeEqual } from 'crypto';

// Preuve qu'une adresse e-mail appartient bien à qui remplit un formulaire, SANS créer de compte
// ni stocker quoi que ce soit : un jeton signé (HMAC) contenant l'adresse, sa finalité et une
// échéance, envoyé par e-mail sous forme de lien. Le formulaire d'inscription ambassadeur le
// renvoie à l'enregistrement, et la route refuse tout ce qui n'est pas signé pour cette adresse.
//
// Sans cette étape, n'importe qui pouvait inscrire l'adresse d'un tiers : profil candidat rattaché
// à son compte, rôle d'un compte visiteur existant basculé en « host », et notification à l'équipe.

export const EMAIL_PROOF_TTL_MS = 24 * 60 * 60 * 1000;

export type EmailProofPurpose = 'inscription';

function secret(): string {
  const key = process.env.EMAIL_PROOF_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('EMAIL_PROOF_SECRET ou SUPABASE_SERVICE_ROLE_KEY requis pour signer une preuve e-mail');
  return key;
}

function sign(payload: string): string {
  return createHmac('sha256', `email-proof:${secret()}`).update(payload).digest('base64url');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createEmailProof(email: string, purpose: EmailProofPurpose, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ e: normalizeEmail(email), p: purpose, x: now + EMAIL_PROOF_TTL_MS }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** L'adresse prouvée (en minuscules), ou `null` si le jeton est absent, falsifié, expiré ou d'une autre finalité. */
export function verifyEmailProof(token: unknown, purpose: EmailProofPurpose, now = Date.now()): string | null {
  if (typeof token !== 'string') return null;
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { e?: unknown; p?: unknown; x?: unknown };
    if (typeof data.e !== 'string' || data.p !== purpose || typeof data.x !== 'number' || data.x < now) return null;
    return data.e;
  } catch {
    return null;
  }
}

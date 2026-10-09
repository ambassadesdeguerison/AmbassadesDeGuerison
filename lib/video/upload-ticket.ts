import { createHmac, timingSafeEqual } from 'crypto';

// Billet signé remis au navigateur à l'ouverture d'un envoi de vidéo : il lie l'identifiant
// d'envoi pCloud à UN candidat et à un nom de fichier. Sans lui, un candidat pourrait écrire dans
// l'envoi d'un autre (les identifiants pCloud sont des entiers devinables). Sans état : rien à stocker.

export const UPLOAD_TICKET_TTL_MS = 2 * 60 * 60 * 1000;

export interface UploadTicket {
  profileId: string;
  uploadId: number;
  fileName: string;
}

function sign(payload: string): string {
  const key = process.env.EMAIL_PROOF_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('EMAIL_PROOF_SECRET ou SUPABASE_SERVICE_ROLE_KEY requis pour signer un billet d’envoi');
  return createHmac('sha256', `video-upload:${key}`).update(payload).digest('base64url');
}

export function createUploadTicket(ticket: UploadTicket, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ...ticket, x: now + UPLOAD_TICKET_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Le billet s'il est authentique, non expiré et émis pour ce candidat ; sinon `null`. */
export function verifyUploadTicket(token: unknown, profileId: string, now = Date.now()): UploadTicket | null {
  if (typeof token !== 'string') return null;
  const [payload, signature, ...rest] = token.split('.');
  if (!payload || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (
      d.profileId !== profileId ||
      typeof d.uploadId !== 'number' ||
      typeof d.fileName !== 'string' ||
      typeof d.x !== 'number' ||
      d.x < now
    ) {
      return null;
    }
    return { profileId, uploadId: d.uploadId, fileName: d.fileName };
  } catch {
    return null;
  }
}

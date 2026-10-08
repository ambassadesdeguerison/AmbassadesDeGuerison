import { createClient } from '@/lib/supabase/browser';

// Envoi de la vidéo de présentation depuis le navigateur (Client Components).
// Séparé du composant VideoAsk. Le serveur choisit le stockage (pCloud, ou Supabase en
// repli) et répond à POST /api/ambassadeur/video par les instructions d'envoi.

const BUCKET = 'ambassador-videos';
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // ~90 s de vidéo pèsent 15 Mo : large marge pour un fichier choisi

export async function uploadIntroVideo(blob: Blob, mimeType: string): Promise<void> {
  if (blob.size > MAX_VIDEO_BYTES) {
    throw new Error('Cette vidéo est trop volumineuse (200 Mo maximum). Enregistrez-en une plus courte.');
  }
  const mime = mimeType.split(';')[0].trim().toLowerCase();

  const prepare = await fetch('/api/ambassadeur/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mime }),
  });
  const prepared = await prepare.json().catch(() => ({}));
  if (!prepare.ok) throw new Error(prepared.error ?? 'Impossible de préparer l’envoi.');

  let confirmation: Record<string, unknown>;

  if (prepared.provider === 'pcloud') {
    // La vidéo passe par notre serveur, morceau par morceau (limite de 4,5 Mo par requête).
    const chunkSize: number = prepared.chunkSize;
    for (let offset = 0; offset < blob.size; offset += chunkSize) {
      await sendChunk(prepared.ticket, offset, blob.slice(offset, offset + chunkSize));
    }
    confirmation = { provider: 'pcloud', ticket: prepared.ticket, size: blob.size, mime };
  } else {
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: mime });
    if (uploadError) throw new Error('L’envoi de la vidéo a échoué. Vérifiez votre connexion et réessayez.');
    confirmation = { provider: 'supabase', path: prepared.path, mime };
  }

  const confirm = await fetch('/api/ambassadeur/video', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(confirmation),
  });
  if (!confirm.ok) {
    const data = await confirm.json().catch(() => ({}));
    throw new Error(data.error ?? 'La vidéo n’a pas pu être enregistrée. Réessayez.');
  }
}

// Un morceau qui échoue (réseau mobile instable) est retenté : réécrire la même position est sans danger.
async function sendChunk(ticket: string, offset: number, chunk: Blob): Promise<void> {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch('/api/ambassadeur/video', {
        method: 'PUT',
        headers: { 'X-Upload-Ticket': ticket, 'X-Upload-Offset': String(offset) },
        body: chunk,
      });
      if (res.ok) return;
    } catch {
      /* réseau coupé : on retente */
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, 800 * attempt));
  }
  throw new Error('L’envoi de la vidéo a échoué. Vérifiez votre connexion et réessayez.');
}

import { createClient } from '@/lib/supabase/browser';

// Envoi de la vidéo de présentation depuis le navigateur (Client Components).
// Séparé du composant VideoAsk : le jour où le stockage passe à pCloud, seule cette
// fonction (et les routes /api/ambassadeur/video) change.

const BUCKET = 'ambassador-videos';
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // plafond de fichier du plan gratuit Supabase

export async function uploadIntroVideo(blob: Blob, mimeType: string): Promise<void> {
  if (blob.size > MAX_VIDEO_BYTES) {
    throw new Error('Cette vidéo est trop volumineuse (50 Mo maximum). Enregistrez-en une plus courte.');
  }
  const mime = mimeType.split(';')[0].trim().toLowerCase();

  const prepare = await fetch('/api/ambassadeur/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mime }),
  });
  const prepared = await prepare.json().catch(() => ({}));
  if (!prepare.ok) throw new Error(prepared.error ?? 'Impossible de préparer l’envoi.');

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: mime });
  if (uploadError) throw new Error('L’envoi de la vidéo a échoué. Vérifiez votre connexion et réessayez.');

  const confirm = await fetch('/api/ambassadeur/video', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: prepared.path, mime }),
  });
  if (!confirm.ok) {
    const data = await confirm.json().catch(() => ({}));
    throw new Error(data.error ?? 'La vidéo n’a pas pu être enregistrée. Réessayez.');
  }
}

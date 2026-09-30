import { createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'ambassador-videos';

export type AdminVideoUrls = { playUrl: string; downloadUrl: string };

// Lecture admin d'une vidéo de présentation : deux URLs signées (1h). La seconde force
// le téléchargement (Content-Disposition) — filet de sécurité quand le navigateur de
// l'admin ne sait pas lire le format (ex : WebM sur un Safari ancien).
export async function getAdminVideoUrls(path: string, downloadName: string): Promise<AdminVideoUrls | null> {
  if (!path) return null;
  const supabase = createServiceClient();
  const [play, download] = await Promise.all([
    supabase.storage.from(BUCKET).createSignedUrl(path, 3600),
    supabase.storage.from(BUCKET).createSignedUrl(path, 3600, { download: downloadName }),
  ]);
  if (play.error || download.error) return null;
  return { playUrl: play.data.signedUrl, downloadUrl: download.data.signedUrl };
}

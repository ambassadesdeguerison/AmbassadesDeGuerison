import { createServiceClient } from '@/lib/supabase/server';
import { getPcloudFileUrl, parsePcloudRef } from '@/lib/video/pcloud';

const BUCKET = 'ambassador-videos';

export type AdminVideoUrls = { playUrl: string; downloadUrl: string };

// Lecture admin d'une vidéo de présentation : deux URLs temporaires. La seconde force le
// téléchargement — filet de sécurité quand le navigateur de l'admin ne sait pas lire le
// format (ex : WebM sur un Safari ancien). `pcloud:<fileid>` → pCloud, sinon bucket Supabase.
export async function getAdminVideoUrls(path: string, downloadName: string): Promise<AdminVideoUrls | null> {
  if (!path) return null;

  const pcloudId = parsePcloudRef(path);
  if (pcloudId) {
    const [playUrl, downloadUrl] = await Promise.all([
      getPcloudFileUrl(pcloudId, false),
      getPcloudFileUrl(pcloudId, true),
    ]);
    return playUrl && downloadUrl ? { playUrl, downloadUrl } : null;
  }

  const supabase = createServiceClient();
  const [play, download] = await Promise.all([
    supabase.storage.from(BUCKET).createSignedUrl(path, 3600),
    supabase.storage.from(BUCKET).createSignedUrl(path, 3600, { download: downloadName }),
  ]);
  if (play.error || download.error) return null;
  return { playUrl: play.data.signedUrl, downloadUrl: download.data.signedUrl };
}

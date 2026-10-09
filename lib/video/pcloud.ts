// Client pCloud côté serveur uniquement : le jeton d'accès ne doit jamais atteindre le
// navigateur. pCloud refuse les « liens d'envoi » (createuploadlink) avec un jeton OAuth, et
// l'exposer au navigateur donnerait à tout candidat l'accès à toutes les vidéos. La vidéo passe
// donc par nos routes, en morceaux (les fonctions Vercel plafonnent à 4,5 Mo par requête) :
// upload_create → upload_write (× n) → upload_save.
//
// Variables : PCLOUD_ACCESS_TOKEN, PCLOUD_API_HOST (eapi.pcloud.com = Europe,
// api.pcloud.com = États-Unis), obtenues par `node scripts/pcloud-token.js`.

export const PCLOUD_PREFIX = 'pcloud:';
const ROOT_FOLDER = '/Presentations';

export function isPcloudConfigured(): boolean {
  return Boolean(process.env.PCLOUD_ACCESS_TOKEN && process.env.PCLOUD_API_HOST);
}

/** `pcloud:12345` → 12345 ; tout autre chemin (ancien stockage Supabase) → null. */
export function parsePcloudRef(path: string | null | undefined): number | null {
  if (!path?.startsWith(PCLOUD_PREFIX)) return null;
  const id = Number(path.slice(PCLOUD_PREFIX.length));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function pcloudRef(fileId: number): string {
  return `${PCLOUD_PREFIX}${fileId}`;
}

function url(method: string, params: Record<string, string | number> = {}): string {
  const qs = new URLSearchParams({
    access_token: process.env.PCLOUD_ACCESS_TOKEN!,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  return `https://${process.env.PCLOUD_API_HOST}/${method}?${qs}`;
}

async function parse<T>(method: string, res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { result?: number; error?: string } & T;
  if (!res.ok || data.result !== 0) {
    // Ne jamais logguer l'URL : elle contient le jeton.
    throw new Error(`pCloud ${method} : ${data.error ?? `HTTP ${res.status}`} (result ${data.result ?? '?'})`);
  }
  return data;
}

async function call<T = Record<string, unknown>>(method: string, params: Record<string, string | number> = {}): Promise<T> {
  return parse<T>(method, await fetch(url(method, params), { cache: 'no-store' }));
}

/** Ouvre un envoi par morceaux : renvoie l'identifiant à présenter pour chaque morceau. */
export async function createUpload(): Promise<number> {
  const data = await call<{ uploadid: number }>('upload_create');
  return data.uploadid;
}

/** Écrit un morceau à la position donnée (réécrire la même position est sans danger : nouvelle tentative). */
export async function writeChunk(uploadId: number, offset: number, chunk: ArrayBuffer): Promise<void> {
  const res = await fetch(url('upload_write', { uploadid: uploadId, uploadoffset: offset }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: chunk,
    cache: 'no-store',
  });
  await parse('upload_write', res);
}

/** Dossier année/mois (créé de proche en proche : pCloud ne crée pas les parents). */
async function ensureMonthFolder(): Promise<number> {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  let current = '';
  let folderId = 0;
  for (const part of [ROOT_FOLDER.slice(1), String(now.getUTCFullYear()), month]) {
    current += `/${part}`;
    const data = await call<{ metadata: { folderid: number } }>('createfolderifnotexists', { path: current });
    folderId = data.metadata.folderid;
  }
  return folderId;
}

/** Termine l'envoi : le fichier apparaît dans pCloud. Renvoie son identifiant et sa taille réelle. */
export async function saveUpload(uploadId: number, fileName: string): Promise<{ fileId: number; size: number }> {
  const folderId = await ensureMonthFolder();
  const data = await call<{ metadata: { fileid: number; size: number } }>('upload_save', {
    uploadid: uploadId,
    name: fileName,
    folderid: folderId,
    nopartial: 1,
  });
  return { fileId: data.metadata.fileid, size: data.metadata.size };
}

export async function deletePcloudFile(fileId: number): Promise<void> {
  await call('deletefile', { fileid: fileId }).catch(() => {});
}

/** Adresse de lecture/téléchargement temporaire (quelques heures) pour l'admin. */
export async function getPcloudFileUrl(fileId: number, forceDownload: boolean): Promise<string | null> {
  try {
    const data = await call<{ hosts: string[]; path: string }>('getfilelink', {
      fileid: fileId,
      forcedownload: forceDownload ? 1 : 0,
    });
    return `https://${data.hosts[0]}${data.path}`;
  } catch {
    return null;
  }
}

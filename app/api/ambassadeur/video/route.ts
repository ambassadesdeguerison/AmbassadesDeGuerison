import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/server';
import { extensionForMime, MAX_VIDEO_BYTES } from '@/lib/video/recorder-support';
import { pcloudFileName } from '@/lib/video/filename';
import {
  createUpload,
  deletePcloudFile,
  isPcloudConfigured,
  parsePcloudRef,
  pcloudRef,
  saveUpload,
  writeChunk,
} from '@/lib/video/pcloud';
import { createUploadTicket, verifyUploadTicket } from '@/lib/video/upload-ticket';

// Vidéo de présentation d'un candidat (questionnaire enrichi). Le navigateur envoie
// directement vers le stockage (une vidéo dépasse la limite de 4,5 Mo des fonctions Vercel).
// Stockage : pCloud si PCLOUD_ACCESS_TOKEN est configuré, sinon bucket privé Supabase
// `ambassador-videos` (repli). `intro_video_path` vaut `pcloud:<fileid>` ou un chemin Supabase.
//
//   POST  { mime }  → pCloud : { provider, ticket, chunkSize }   ouvre un envoi par morceaux
//                     Supabase : { provider, path, token }
//   PUT   (en-têtes X-Upload-Ticket, X-Upload-Offset ; corps = un morceau) → pCloud uniquement.
//         Le jeton pCloud ne quitte jamais le serveur, et la vidéo passe par nos routes en
//         morceaux de 3 Mo (limite de 4,5 Mo par requête sur Vercel).
//   PATCH { provider, mime, … } termine l'envoi, enregistre la vidéo en base, supprime l'ancienne

const BUCKET = 'ambassador-videos';
const ALLOWED_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const CHUNK_BYTES = 3 * 1024 * 1024;
const MAX_CHUNK_BYTES = 4 * 1024 * 1024;

function baseMime(mime: unknown): string {
  return typeof mime === 'string' ? mime.split(';')[0].trim().toLowerCase() : '';
}

async function getCandidate(req: NextRequest) {
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('host_profiles')
    .select('id, status, first_name, last_name, intro_video_path')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!profile) return { error: NextResponse.json({ error: 'Profil introuvable' }, { status: 404 }) };
  if (profile.status !== 'pre_approved') {
    return {
      error: NextResponse.json(
        { error: 'La vidéo se dépose pendant la présentation, avant la validation.' },
        { status: 403 }
      ),
    };
  }
  return { supabase, profile };
}

export async function POST(req: NextRequest) {
  const ctx = await getCandidate(req);
  if ('error' in ctx) return ctx.error;

  const body = await req.json().catch(() => ({}));
  const mime = baseMime(body?.mime);
  if (!ALLOWED_MIMES.has(mime)) {
    return NextResponse.json({ error: 'Format vidéo non accepté (MP4, WebM ou MOV).' }, { status: 400 });
  }

  if (isPcloudConfigured()) {
    try {
      const uploadId = await createUpload();
      const fileName = pcloudFileName(ctx.profile, extensionForMime(mime));
      const ticket = createUploadTicket({ profileId: ctx.profile.id, uploadId, fileName });
      return NextResponse.json({ provider: 'pcloud', ticket, chunkSize: CHUNK_BYTES });
    } catch (err) {
      console.error('[video] pCloud createUpload', err instanceof Error ? err.message : err);
      return NextResponse.json({ error: 'Impossible de préparer l’envoi.' }, { status: 502 });
    }
  }

  // Nom unique par envoi : l'ancien fichier reste lisible jusqu'à la confirmation.
  const path = `${ctx.profile.id}/intro-${Date.now()}.${extensionForMime(mime)}`;
  const { data, error } = await ctx.supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: 'Impossible de préparer l’envoi.' }, { status: 500 });
  }
  return NextResponse.json({ provider: 'supabase', path, token: data.token });
}

export async function PUT(req: NextRequest) {
  const ctx = await getCandidate(req);
  if ('error' in ctx) return ctx.error;

  const ticket = verifyUploadTicket(req.headers.get('x-upload-ticket'), ctx.profile.id);
  const offset = Number(req.headers.get('x-upload-offset'));
  if (!isPcloudConfigured() || !ticket || !Number.isSafeInteger(offset) || offset < 0) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  const chunk = await req.arrayBuffer();
  if (chunk.byteLength === 0 || chunk.byteLength > MAX_CHUNK_BYTES || offset + chunk.byteLength > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: 'Morceau de vidéo invalide.' }, { status: 400 });
  }

  try {
    await writeChunk(ticket.uploadId, offset, chunk);
  } catch (err) {
    console.error('[video] pCloud writeChunk', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'L’envoi de la vidéo a échoué. Réessayez.' }, { status: 502 });
  }
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getCandidate(req);
  if ('error' in ctx) return ctx.error;

  const body = await req.json().catch(() => ({}));
  const mime = baseMime(body?.mime);
  if (!ALLOWED_MIMES.has(mime)) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  let newPath: string;

  if (body?.provider === 'pcloud') {
    const ticket = verifyUploadTicket(body?.ticket, ctx.profile.id);
    const size = Number(body?.size);
    if (!isPcloudConfigured() || !ticket || !Number.isSafeInteger(size) || size <= 0) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }
    try {
      const saved = await saveUpload(ticket.uploadId, ticket.fileName);
      // Un morceau perdu donnerait une vidéo tronquée : on refuse plutôt que d'enregistrer.
      if (saved.size !== size) {
        await deletePcloudFile(saved.fileId);
        return NextResponse.json({ error: 'La vidéo est arrivée incomplète, veuillez réessayer l’envoi.' }, { status: 400 });
      }
      newPath = pcloudRef(saved.fileId);
    } catch (err) {
      console.error('[video] pCloud saveUpload', err instanceof Error ? err.message : err);
      return NextResponse.json({ error: 'La vidéo n’a pas pu être enregistrée. Réessayez.' }, { status: 502 });
    }
  } else {
    const path = typeof body?.path === 'string' ? body.path : '';
    // Ownership : le chemin doit être dans le dossier de ce candidat.
    if (!path.startsWith(`${ctx.profile.id}/`) || path.includes('..')) {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }
    // Le fichier doit avoir réellement été déposé (on n'enregistre pas un chemin fantôme).
    const fileName = path.slice(ctx.profile.id.length + 1);
    const { data: files, error: listError } = await ctx.supabase.storage
      .from(BUCKET)
      .list(ctx.profile.id, { search: fileName });
    if (listError || !files?.some((f) => f.name === fileName)) {
      return NextResponse.json({ error: 'Vidéo introuvable, veuillez réessayer l’envoi.' }, { status: 400 });
    }
    newPath = path;
  }

  const { error } = await ctx.supabase
    .from('host_profiles')
    .update({ intro_video_path: newPath, intro_video_mime: mime })
    .eq('id', ctx.profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Une seule vidéo par candidat : l'ancienne est supprimée une fois la nouvelle enregistrée.
  const previous = ctx.profile.intro_video_path;
  if (previous && previous !== newPath) {
    const previousPcloud = parsePcloudRef(previous);
    if (previousPcloud) {
      await deletePcloudFile(previousPcloud);
    } else if (previous.startsWith(`${ctx.profile.id}/`)) {
      await ctx.supabase.storage.from(BUCKET).remove([previous]);
    }
  }

  return NextResponse.json({ success: true });
}

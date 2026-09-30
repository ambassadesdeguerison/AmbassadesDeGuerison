import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/server';
import { extensionForMime } from '@/lib/video/recorder-support';

// Vidéo de présentation d'un candidat (questionnaire enrichi). Stockage provisoire
// dans le bucket privé `ambassador-videos` ; le navigateur envoie directement vers
// Supabase via une URL signée (une vidéo dépasse la limite de 4,5 Mo des fonctions
// Vercel). Prévu pour être remplacé par pCloud sans changer le composant VideoAsk.
//
//   POST  { mime }  → { path, token }   URL signée d'envoi (l'ambassadeur uploade ensuite)
//   PATCH { path, mime }                enregistre la vidéo en base, supprime l'ancienne

const BUCKET = 'ambassador-videos';
const ALLOWED_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

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
    .select('id, status, intro_video_path')
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

  // Nom unique par envoi : l'ancien fichier reste lisible jusqu'à la confirmation.
  const path = `${ctx.profile.id}/intro-${Date.now()}.${extensionForMime(mime)}`;
  const { data, error } = await ctx.supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: 'Impossible de préparer l’envoi.' }, { status: 500 });
  }
  return NextResponse.json({ path, token: data.token });
}

export async function PATCH(req: NextRequest) {
  const ctx = await getCandidate(req);
  if ('error' in ctx) return ctx.error;

  const body = await req.json().catch(() => ({}));
  const path = typeof body?.path === 'string' ? body.path : '';
  const mime = baseMime(body?.mime);

  // Ownership : le chemin doit être dans le dossier de ce candidat.
  if (!path.startsWith(`${ctx.profile.id}/`) || path.includes('..') || !ALLOWED_MIMES.has(mime)) {
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

  const { error } = await ctx.supabase
    .from('host_profiles')
    .update({ intro_video_path: path, intro_video_mime: mime })
    .eq('id', ctx.profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Une seule vidéo par candidat : l'ancienne est supprimée une fois la nouvelle enregistrée.
  const previous = ctx.profile.intro_video_path;
  if (previous && previous !== path && previous.startsWith(`${ctx.profile.id}/`)) {
    await ctx.supabase.storage.from(BUCKET).remove([previous]);
  }

  return NextResponse.json({ success: true });
}

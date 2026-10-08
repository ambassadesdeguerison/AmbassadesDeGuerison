// Détection du support d'enregistrement vidéo natif (MediaRecorder).
// Pas de bibliothèque : elles s'appuient toutes sur MediaRecorder, donc n'ajoutent
// aucune compatibilité (Safari < 18.4 ne sait produire que du MP4, Chrome préfère WebM).

// MP4 en premier : lisible partout côté admin. WebM ensuite, du plus au moins précis.
export const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const;

type RecorderLike = { isTypeSupported?: (type: string) => boolean };

/**
 * Premier type MIME supporté par le navigateur, ou `undefined` si aucun n'est reconnu
 * (le navigateur choisira alors son format par défaut — `recorder.mimeType` le dit après coup).
 */
export function pickMimeType(recorder: RecorderLike | undefined): string | undefined {
  if (!recorder?.isTypeSupported) return undefined;
  return MIME_CANDIDATES.find((type) => recorder.isTypeSupported!(type));
}

/** Extension de fichier correspondant à un type MIME vidéo (sans le point). */
export function extensionForMime(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase();
  if (base === 'video/mp4') return 'mp4';
  if (base === 'video/webm') return 'webm';
  if (base === 'video/quicktime') return 'mov';
  return 'mp4';
}

/** L'enregistrement dans la page est-il possible ? Sinon on retombe sur `<input capture>`. */
export function canRecordInBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/** mm:ss */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Poids maximal d'une vidéo (client et serveur). ~15 Mo suffisent pour 90 s enregistrées dans l'app. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** « 3 min 20 s » — pour les messages, plus lisible que mm:ss pour tout public. */
export function spokenDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  if (min === 0) return `${sec} s`;
  return sec === 0 ? `${min} min` : `${min} min ${sec} s`;
}

/** Durée d'une vidéo lue depuis ses métadonnées, ou `null` si le navigateur ne la donne pas (WebM sans durée, format inconnu…). */
export function readVideoDuration(file: Blob, timeoutMs = 4000): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement('video');
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      el.removeAttribute('src');
      el.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => finish(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null);
    el.onerror = () => finish(null);
    el.src = url;
  });
}

const TOLERANCE_SECONDS = 3;

/**
 * Message à afficher quand un fichier choisi (ou filmé avec l'appareil) est trop long ou trop lourd,
 * ou `null` s'il convient. Ton volontairement simple, avec LA marche à suivre la plus facile :
 * l'enregistrement dans la page, qui borne durée et poids tout seul.
 */
export function describePickedVideoProblem(opts: {
  durationSeconds: number | null;
  bytes: number;
  maxSeconds: number;
  maxBytes: number;
  canRecord: boolean;
}): string | null {
  const { durationSeconds, bytes, maxSeconds, maxBytes, canRecord } = opts;
  const tooLong = durationSeconds !== null && durationSeconds > maxSeconds + TOLERANCE_SECONDS;
  const tooHeavy = bytes > maxBytes;
  if (!tooLong && !tooHeavy) return null;

  const what = tooLong
    ? `Cette vidéo dure ${spokenDuration(durationSeconds!)}, et le maximum est ${spokenDuration(maxSeconds)}.`
    : `Cette vidéo est trop lourde (${Math.round(bytes / (1024 * 1024))} Mo).`;
  const how = canRecord
    ? 'Le plus simple : appuyez sur « Ouvrir la caméra » et présentez-vous directement ici, sans rien régler.'
    : `Le plus simple : appuyez sur « Filmer avec mon appareil » et filmez une vidéo de moins de ${spokenDuration(maxSeconds)}.`;
  return `${what} ${how}`;
}

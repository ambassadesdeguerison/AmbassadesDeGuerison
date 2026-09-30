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

'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CheckCircle2, Loader2, RotateCcw, Square, Video } from 'lucide-react';
import { canRecordInBrowser, formatDuration, pickMimeType } from '@/lib/video/recorder-support';

// Pistes provisoires : le texte définitif est à faire valider par David.
const DEFAULT_PROMPTS = [
  'Qui êtes-vous ? (votre prénom, votre ville, votre famille…)',
  'Pourquoi souhaitez-vous ouvrir votre maison pour prier ?',
  'Qu’est-ce qui vous a conduit à la prière pour la guérison ?',
];

type Phase = 'idle' | 'ready' | 'recording' | 'review' | 'uploading' | 'done';

interface Props {
  /** Envoie la vidéo. Doit rejeter avec un message lisible en cas d'échec. */
  onSubmit: (video: Blob, mimeType: string) => Promise<void>;
  prompts?: string[];
  /** Durée maximale d'enregistrement (l'arrêt est automatique). */
  maxSeconds?: number;
  /** Une vidéo est déjà enregistrée côté serveur : affiche directement l'état « envoyée ». */
  alreadyUploaded?: boolean;
  notesStorageKey?: string;
  /** Sans cadre de carte : pour l'insérer dans une carte existante. */
  embedded?: boolean;
}

const btnBase =
  'inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 w-full sm:w-auto';
const btnPrimary = `${btnBase} bg-indigo-600 text-white hover:bg-indigo-700`;
const btnNeutral = `${btnBase} border border-slate-200 text-slate-700 bg-white hover:bg-slate-50`;
const btnStop = `${btnBase} bg-slate-800 text-white hover:bg-slate-900`;
const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white';

export default function VideoAsk({
  onSubmit,
  prompts = DEFAULT_PROMPTS,
  maxSeconds = 90,
  alreadyUploaded = false,
  notesStorageKey = 'videoask-notes',
  embedded = false,
}: Props) {
  const [phase, setPhase] = useState<Phase>(alreadyUploaded ? 'done' : 'idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [video, setVideo] = useState<{ blob: Blob; url: string; mime: string } | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const pickInputRef = useRef<HTMLInputElement>(null);

  // Détection côté client uniquement (window/navigator absents au rendu serveur) :
  // le snapshot serveur vaut `false`, React réconcilie ensuite sans erreur d'hydratation.
  const canRecord = useSyncExternalStore(
    () => () => {},
    canRecordInBrowser,
    () => false
  );

  // Les notes restent sur l'appareil (jamais envoyées) — localStorage peut lever
  // une exception (Safari mode privé) : on continue sans persistance.
  // Textarea non contrôlé : on le remplit via la ref, sans setState dans l'effet.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(notesStorageKey);
      if (saved && notesRef.current) notesRef.current.value = saved;
    } catch {
      /* pas de persistance */
    }
  }, [notesStorageKey]);

  function saveNotes(value: string) {
    try {
      localStorage.setItem(notesStorageKey, value);
    } catch {
      /* pas de persistance */
    }
  }

  // Branche le flux caméra sur l'élément <video> dès qu'il est monté.
  useEffect(() => {
    if ((phase === 'ready' || phase === 'recording') && liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  // Libère l'URL d'aperçu quand la vidéo change ou à la fermeture.
  useEffect(() => {
    return () => {
      if (video) URL.revokeObjectURL(video.url);
    };
  }, [video]);

  // Coupe caméra, micro et minuteur si l'utilisateur quitte la page en cours de route.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function showReview(blob: Blob, mime: string) {
    setVideo({ blob, mime, url: URL.createObjectURL(blob) });
    setPhase('review');
  }

  async function openCamera() {
    setError('');
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      setPhase('ready');
      setNotesOpen(true); // les notes doivent être sous les yeux pendant l'enregistrement
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setError(
          'L’accès à la caméra ou au micro a été refusé. Autorisez-le dans votre navigateur, ou choisissez une vidéo depuis votre appareil.'
        );
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setError('Aucune caméra ou aucun micro détecté. Vous pouvez choisir une vidéo depuis votre appareil.');
      } else {
        setError('Impossible d’ouvrir la caméra. Vous pouvez choisir une vidéo depuis votre appareil.');
      }
    }
  }

  function cancelCamera() {
    stopStream();
    setPhase('idle');
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    setError('');

    const mimeType = pickMimeType(window.MediaRecorder);
    // Débits modérés : ~15 Mo pour 90 s, largement acceptable côté envoi.
    const options: MediaRecorderOptions = { videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 64_000 };
    if (mimeType) options.mimeType = mimeType;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch {
      recorder = new MediaRecorder(stream);
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onerror = () => {
      clearTimer();
      stopStream();
      setError('L’enregistrement a été interrompu. Réessayez, ou choisissez une vidéo depuis votre appareil.');
      setPhase('idle');
    };
    recorder.onstop = () => {
      clearTimer();
      const type = recorder.mimeType || mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      stopStream();
      showReview(blob, type);
    };

    recorderRef.current = recorder;
    recorder.start();
    setElapsed(0);
    setPhase('recording');

    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      setElapsed(seconds);
      if (seconds >= maxSeconds) stopRecording();
    }, 250);
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Choisissez un fichier vidéo.');
      return;
    }
    setError('');
    stopStream();
    showReview(file, file.type);
  }

  function redo() {
    setVideo(null);
    setElapsed(0);
    setError('');
    setPhase('idle');
  }

  async function send() {
    if (!video) return;
    setError('');
    setPhase('uploading');
    try {
      await onSubmit(video.blob, video.mime);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'L’envoi a échoué. Réessayez.');
      setPhase('review');
    }
  }

  const showCamera = phase === 'ready' || phase === 'recording';

  return (
    <section
      className={
        embedded
          ? 'border-t border-slate-100 pt-5 space-y-4'
          : 'bg-white rounded-2xl border border-slate-100 p-5 space-y-4'
      }
    >
      <div>
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-800">Votre vidéo de présentation</h3>
          <span className="text-xs text-slate-500">— facultative</span>
        </div>
        <p className="text-sm text-slate-500 mt-1.5">
          Présentez-vous en quelques mots, comme si vous parliez à David. Durée maximale :{' '}
          {formatDuration(maxSeconds)}.
        </p>
      </div>

      {phase !== 'done' && (
        <details
          open={notesOpen}
          onToggle={(e) => setNotesOpen(e.currentTarget.open)}
          className="rounded-xl border border-slate-100 bg-slate-50 px-4 pb-4"
        >
          <summary className="min-h-[44px] flex items-center text-sm font-medium text-slate-700 cursor-pointer">
            Préparer mes notes (pistes pour vous aider)
          </summary>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
            {prompts.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <label htmlFor="videoask-notes" className="block text-xs font-medium text-slate-600 mt-4 mb-1.5">
            Mes notes
          </label>
          <textarea
            id="videoask-notes"
            ref={notesRef}
            onChange={(e) => saveNotes(e.target.value)}
            rows={4}
            placeholder="Notez ici ce que vous voulez dire…"
            className={inputCls}
          />
          <p className="text-xs text-slate-500 mt-2">
            Ces notes restent sur votre appareil : elles ne sont pas envoyées et personne d&apos;autre ne les voit.
          </p>
        </details>
      )}

      {showCamera && (
        <div className="relative">
          <video
            ref={liveVideoRef}
            muted
            playsInline
            autoPlay
            className="w-full aspect-video rounded-xl bg-slate-900 object-cover -scale-x-100"
          />
          {phase === 'recording' && (
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs text-white">
              <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
              <span className="tabular-nums" aria-label="Durée enregistrée">
                {formatDuration(elapsed)} / {formatDuration(maxSeconds)}
              </span>
            </div>
          )}
        </div>
      )}

      {(phase === 'review' || phase === 'uploading') && video && (
        <video
          src={video.url}
          controls
          playsInline
          className="w-full aspect-video rounded-xl bg-slate-900"
        />
      )}

      {phase === 'done' && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Votre vidéo est enregistrée.
        </div>
      )}

      {error && (
        <p role="alert" className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        {phase === 'idle' && (
          <>
            {canRecord ? (
              <button type="button" onClick={openCamera} className={btnPrimary}>
                <Video className="w-4 h-4" /> Ouvrir la caméra
              </button>
            ) : (
              <button type="button" onClick={() => captureInputRef.current?.click()} className={btnPrimary}>
                <Video className="w-4 h-4" /> Filmer avec mon appareil
              </button>
            )}
            <button type="button" onClick={() => pickInputRef.current?.click()} className={btnNeutral}>
              Choisir une vidéo existante
            </button>
          </>
        )}

        {phase === 'ready' && (
          <>
            <button type="button" onClick={startRecording} className={btnPrimary}>
              Démarrer l&apos;enregistrement
            </button>
            <button type="button" onClick={cancelCamera} className={btnNeutral}>
              Annuler
            </button>
          </>
        )}

        {phase === 'recording' && (
          <button type="button" onClick={stopRecording} className={btnStop}>
            <Square className="w-4 h-4" /> Arrêter l&apos;enregistrement
          </button>
        )}

        {(phase === 'review' || phase === 'uploading') && (
          <>
            <button type="button" onClick={send} disabled={phase === 'uploading'} className={btnPrimary}>
              {phase === 'uploading' && <Loader2 className="w-4 h-4 animate-spin" />}
              {phase === 'uploading' ? 'Envoi en cours…' : 'Envoyer cette vidéo'}
            </button>
            <button type="button" onClick={redo} disabled={phase === 'uploading'} className={btnNeutral}>
              <RotateCcw className="w-4 h-4" /> Refaire
            </button>
          </>
        )}

        {phase === 'done' && (
          <button type="button" onClick={redo} className={btnNeutral}>
            <RotateCcw className="w-4 h-4" /> Enregistrer une nouvelle vidéo
          </button>
        )}
      </div>

      <input
        ref={captureInputRef}
        type="file"
        accept="video/*"
        capture="user"
        onChange={handleFile}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={pickInputRef}
        type="file"
        accept="video/*"
        onChange={handleFile}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      <p className="text-xs text-slate-500">
        Cette vidéo aide l&apos;équipe de David à mieux vous connaître avant de valider votre ambassade. Elle est vue
        uniquement par les administrateurs et n&apos;est jamais publiée.
      </p>
    </section>
  );
}

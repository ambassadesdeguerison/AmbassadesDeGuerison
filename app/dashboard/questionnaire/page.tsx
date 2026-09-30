'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/browser';
import { ArrowLeft, Camera, CheckCircle2, Loader2 } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import Dropzone from '@/components/ui/Dropzone';
import ChipGroup from '@/components/ui/ChipGroup';
import YesNoField from '@/components/ui/YesNoField';
import VideoAsk from '@/components/ui/VideoAsk';
import { BOOKS, TRAININGS } from '@/lib/questionnaire/catalog';
import { uploadIntroVideo } from '@/lib/video/upload-client';

const CHURCH_ATTENDANCE_OPTIONS = [
  { value: 'regular', label: 'Régulièrement (chaque semaine ou presque)' },
  { value: 'occasional', label: 'Occasionnellement (quelques fois par an)' },
  { value: 'none', label: 'Je ne fréquente pas une église actuellement' },
];

type FormState = {
  trainings_done: string[];
  books_read: string[];
  livres_lus: string; // « autres » livres ou formations, hors catalogue
  conferences_assistees: boolean;
  church_attendance: string;
  denomination: string;
  parcours_spirituel: string;
  has_seen_healings: boolean | null;
  has_leadership_role: boolean | null;
  leadership_role: string;
};

const EMPTY_FORM: FormState = {
  trainings_done: [],
  books_read: [],
  livres_lus: '',
  conferences_assistees: false,
  church_attendance: '',
  denomination: '',
  parcours_spirituel: '',
  has_seen_healings: null,
  has_leadership_role: null,
  leadership_role: '',
};

export default function QuestionnairePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [hasVideo, setHasVideo] = useState(false);

  // Enregistrement automatique : le candidat peut quitter et reprendre plus tard,
  // même depuis un autre appareil (les réponses sont écrites en base, pas en local).
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const dirtyRef = useRef(false);
  const formRef = useRef(form);

  // Suivi des photos (chemin stocké en DB → signed URL pour aperçu)
  const [profilePhotoPath, setProfilePhotoPath] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profileUploading, setProfileUploading] = useState(false);

  // Photos du lieu (max 5)
  const [roomPhotoPaths, setRoomPhotoPaths] = useState<string[]>([]);
  const [roomPhotoUrls, setRoomPhotoUrls] = useState<Record<string, string>>({});
  const [roomUploading, setRoomUploading] = useState(false);

  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth'); return; }

      const { data: profile } = await supabase
        .from('host_profiles')
        .select(
          'status, profile_photo_url, room_photo_urls, healing_challenge_done, conferences_assistees, church_attendance, denomination, parcours_spirituel, livres_lus, books_read, trainings_done, has_seen_healings, has_leadership_role, leadership_role, intro_video_path'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) { router.replace('/inscription'); return; }
      if (profile.status !== 'pre_approved') { setAccessDenied(true); setLoading(false); return; }

      // Reprend les réponses déjà enregistrées (brouillon ou soumission précédente)
      const trainings: string[] = profile.trainings_done ?? [];
      setForm({
        trainings_done:
          profile.healing_challenge_done && !trainings.includes('defi_guerison')
            ? [...trainings, 'defi_guerison']
            : trainings,
        books_read: profile.books_read ?? [],
        livres_lus: profile.livres_lus ?? '',
        conferences_assistees: profile.conferences_assistees ?? false,
        church_attendance: profile.church_attendance ?? '',
        denomination: profile.denomination ?? '',
        parcours_spirituel: profile.parcours_spirituel ?? '',
        has_seen_healings: profile.has_seen_healings ?? null,
        has_leadership_role: profile.has_leadership_role ?? null,
        leadership_role: profile.leadership_role ?? '',
      });
      setHasVideo(Boolean(profile.intro_video_path));

      // Charge la photo de profil existante
      if (profile.profile_photo_url) {
        const path = profile.profile_photo_url;
        setProfilePhotoPath(path);
        if (path.startsWith('http')) {
          setProfilePhotoUrl(path);
        } else {
          const { data } = await supabase.storage.from('ambassador-photos').createSignedUrl(path, 900);
          setProfilePhotoUrl(data?.signedUrl ?? null);
        }
      }

      // Charge les photos du lieu existantes
      const roomPaths: string[] = profile.room_photo_urls ?? [];
      if (roomPaths.length > 0) {
        setRoomPhotoPaths(roomPaths);
        const entries = await Promise.all(
          roomPaths.map(async (p) => {
            if (p.startsWith('http')) return [p, p] as const;
            const { data } = await supabase.storage.from('ambassador-photos').createSignedUrl(p, 900);
            return [p, data?.signedUrl ?? ''] as const;
          })
        );
        setRoomPhotoUrls(Object.fromEntries(entries.filter(([, url]) => url)));
      }

      setLoading(false);
    })();
  }, [router, supabase]);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    dirtyRef.current = true;
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveDraft(values: FormState, keepalive: boolean) {
    if (!dirtyRef.current) return;
    setSaveState('saving');
    try {
      const res = await fetch('/api/ambassadeur/enrichissement', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, draft: true }),
        keepalive,
      });
      if (!res.ok) throw new Error();
      setSaveState('saved');
      setSavedAt(new Date());
    } catch {
      setSaveState('error');
    }
  }

  async function uploadProfilePhoto(file: File) {
    setProfileUploading(true);
    setPhotoError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', 'profile');
    const res = await fetch('/api/upload/ambassador-photo', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      setPhotoError(data.error ?? 'Erreur lors de l\'upload.');
    } else {
      setProfilePhotoPath(data.path);
      setProfilePhotoUrl(data.url);
    }
    setProfileUploading(false);
  }

  async function removeProfilePhoto() {
    if (!profilePhotoPath) return;
    setProfileUploading(true);
    setPhotoError('');
    const res = await fetch('/api/upload/ambassador-photo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: profilePhotoPath, type: 'profile' }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPhotoError(data.error ?? 'Erreur lors de la suppression.');
    } else {
      setProfilePhotoPath(null);
      setProfilePhotoUrl(null);
    }
    setProfileUploading(false);
  }

  async function uploadRoomPhoto(file: File) {
    setRoomUploading(true);
    setPhotoError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', 'room');
    const res = await fetch('/api/upload/ambassador-photo', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      setPhotoError(data.error ?? 'Erreur lors de l\'upload.');
    } else {
      setRoomPhotoPaths((prev) => [...prev, data.path]);
      setRoomPhotoUrls((prev) => ({ ...prev, [data.path]: data.url }));
    }
    setRoomUploading(false);
  }

  async function removeRoomPhoto(path: string) {
    setRoomUploading(true);
    setPhotoError('');
    const res = await fetch('/api/upload/ambassador-photo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, type: 'room' }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPhotoError(data.error ?? 'Erreur lors de la suppression.');
    } else {
      setRoomPhotoPaths((prev) => prev.filter((p) => p !== path));
      setRoomPhotoUrls((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
    }
    setRoomUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profilePhotoPath) {
      setError('Une photo de profil est requise avant d\'envoyer votre profil.');
      return;
    }
    if (roomPhotoPaths.length === 0) {
      setError('Au moins une photo du lieu d\'accueil est requise avant d\'envoyer votre profil.');
      return;
    }
    setSubmitting(true);
    setError('');
    dirtyRef.current = false; // la soumission finale remplace tout brouillon en attente

    const res = await fetch('/api/ambassadeur/enrichissement', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? 'Une erreur est survenue.');
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  // Garde la dernière valeur du formulaire accessible aux écouteurs d'événements.
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  // Sauvegarde différée 1,2 s après la dernière frappe. Tant que rien n'a été modifié
  // (chargement initial), on n'écrit rien.
  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = setTimeout(() => saveDraft(form, false), 1200);
    return () => clearTimeout(timer);
  }, [form]);

  // Onglet masqué ou fermé pendant qu'une saisie attend d'être sauvegardée : on l'envoie tout de suite.
  useEffect(() => {
    function flush() {
      if (document.visibilityState === 'hidden' && dirtyRef.current) saveDraft(formRef.current, true);
    }
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
      </main>
    );
  }

  if (accessDenied) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 bg-slate-50 px-4 py-16">
          <div className="max-w-sm mx-auto text-center">
            <p className="text-slate-500 text-sm mb-4">
              Cette page s&apos;ouvre après la vidéo et votre engagement.
            </p>
            <Link href="/dashboard" className="text-indigo-600 text-sm hover:underline">
              Retour à mon espace
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (submitted) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 bg-slate-50 px-4 py-16">
          <div className="max-w-sm mx-auto text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h1 className="text-lg font-semibold text-slate-800 mb-2">Présentation envoyée !</h1>
            <p className="text-sm text-slate-500 mb-6">
              Votre présentation a été transmise à l&apos;équipe.
              Vous serez informé par e-mail dès que David aura répondu.
            </p>
            <Link href="/dashboard" className="text-indigo-600 text-sm hover:underline">
              Retour à mon espace
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="flex-1 bg-slate-50 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Mon espace
          </Link>

          <h1 className="text-xl font-semibold text-slate-800 mb-1">Parlez-nous de vous</h1>
          <p className="text-sm text-slate-500 mb-6">
            Aidez David à mieux vous connaître avant sa réponse.
            Ces informations restent confidentielles.
          </p>
          <p className="text-sm text-indigo-700 bg-indigo-50 rounded-xl px-4 py-3 mb-6">
            Seules les deux photos sont obligatoires, tout le reste est facultatif. Vos réponses s&apos;enregistrent
            automatiquement : vous pouvez reprendre plus tard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Formations et livres */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-5">
              <h2 className="text-base font-semibold text-slate-800">Formations et livres</h2>

              <ChipGroup
                legend="Formations gratuites en ligne que vous avez suivies"
                items={TRAININGS}
                selected={form.trainings_done}
                onChange={(v) => set('trainings_done', v)}
              />

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.conferences_assistees}
                  onChange={(e) => set('conferences_assistees', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">
                  J&apos;ai déjà assisté à une <strong>conférence de David Théry</strong>
                </span>
              </label>

              <ChipGroup
                legend="Livres de David que vous avez lus"
                items={BOOKS}
                selected={form.books_read}
                onChange={(v) => set('books_read', v)}
              />

              <Field label="Autres livres ou formations qui vous ont marqué">
                <textarea
                  value={form.livres_lus}
                  onChange={(e) => set('livres_lus', e.target.value)}
                  rows={2}
                  className={inputCls}
                />
              </Field>
              <p className="text-xs text-slate-500 -mt-3">
                Ces réponses aident David à situer votre parcours. Elles ne sont vues que par l&apos;équipe.
              </p>
            </div>

            {/* Pratique ecclésiale */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Pratique ecclésiale</h2>
              <Field label="Fréquentation d'une église">
                <select
                  value={form.church_attendance}
                  onChange={(e) => set('church_attendance', e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Sélectionner —</option>
                  {CHURCH_ATTENDANCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Dénomination ou courant">
                <input
                  type="text"
                  value={form.denomination}
                  onChange={(e) => set('denomination', e.target.value)}
                  placeholder="Ex : catholique, évangélique, pentecôtiste…"
                  className={inputCls}
                />
              </Field>
              <YesNoField
                label="Avez-vous une fonction de responsabilité dans un groupe ou une église ?"
                value={form.has_leadership_role}
                onChange={(v) => set('has_leadership_role', v)}
              />
              {form.has_leadership_role && (
                <Field label="Laquelle ?">
                  <input
                    type="text"
                    value={form.leadership_role}
                    onChange={(e) => set('leadership_role', e.target.value)}
                    placeholder="Ex : responsable d'un groupe de maison, diacre, pasteur…"
                    className={inputCls}
                  />
                </Field>
              )}
            </div>

            {/* Parcours personnel + vidéo */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-5">
              <h2 className="text-base font-semibold text-slate-800">Parcours personnel</h2>
              <Field label="Votre parcours spirituel (en quelques lignes)">
                <textarea
                  value={form.parcours_spirituel}
                  onChange={(e) => set('parcours_spirituel', e.target.value)}
                  rows={4}
                  placeholder="Comment en êtes-vous arrivé à vouloir ouvrir votre foyer ? Qu'est-ce qui vous a conduit à la prière pour la guérison ?"
                  className={inputCls}
                />
              </Field>
              <YesNoField
                label="Avez-vous déjà vu des personnes guéries lors d'une prière ?"
                value={form.has_seen_healings}
                onChange={(v) => set('has_seen_healings', v)}
              />
              <p className="text-xs text-slate-500 -mt-3">
                Ces réponses aident David à mieux vous connaître avant de valider votre ambassade. Elles ne sont
                vues que par l&apos;équipe.
              </p>

              <VideoAsk embedded onSubmit={uploadIntroVideo} alreadyUploaded={hasVideo} />
            </div>

            {/* Photos de l'ambassade */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-5">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-800">Photos de votre ambassade</h2>
              </div>

              {photoError && (
                <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{photoError}</p>
              )}

              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-600 mb-1.5">Quelques conseils pour de bonnes photos</p>
                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-500">
                  <li>Prenez-les avec votre téléphone : c&apos;est largement suffisant.</li>
                  <li>
                    Privilégiez la lumière du jour : placez-vous face à une fenêtre plutôt qu&apos;à contre-jour, ou
                    allumez les lampes de la pièce.
                  </li>
                  <li>Profil : votre visage bien visible et de face, sur un fond simple.</li>
                  <li>
                    Lieu : tenez le téléphone à l&apos;horizontale et reculez pour montrer toute la pièce où vous
                    regarderez le live (sièges, écran).
                  </li>
                  <li>Rangez un peu avant, sans rien changer à votre intérieur.</li>
                  <li>Évitez de photographier d&apos;autres personnes, surtout des enfants, ou des documents personnels.</li>
                </ul>
              </div>

              {/* Photo de profil (obligatoire) */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Photo de profil <RequiredBadge />
                </p>
                {profileUploading ? (
                  <div className="flex items-center justify-center h-32 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                ) : (
                  <Dropzone
                    onFile={uploadProfilePhoto}
                    preview={profilePhotoUrl}
                    onRemove={profilePhotoUrl ? removeProfilePhoto : undefined}
                    label="Photo de profil — vue par David pour valider votre ambassade, puis affichée en petit sur la carte publique quand votre ambassade est active"
                  />
                )}
              </div>

              {/* Photos du lieu (requises, max 5) */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Photos du lieu d&apos;accueil <RequiredBadge />
                  <span className="font-normal text-slate-500 normal-case ml-1">
                    (max 5, {roomPhotoPaths.length}/5)
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Aidez David à se faire une idée de l&apos;espace où vous accueillerez les visiteurs (salon, salle de prière, etc).
                </p>

                {roomPhotoPaths.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {roomPhotoPaths.map((path) => (
                      <div key={path} className="relative group rounded-lg overflow-hidden border border-slate-100">
                        <img src={roomPhotoUrls[path] ?? ''} alt="Lieu d'accueil" className="w-full h-24 object-cover" />
                        <button
                          type="button"
                          onClick={() => removeRoomPhoto(path)}
                          disabled={roomUploading}
                          className="absolute top-1 right-1 w-5 h-5 bg-white/90 rounded-full flex items-center justify-center text-slate-500 hover:text-red-600 shadow text-xs disabled:opacity-50"
                          aria-label="Supprimer cette photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {roomPhotoPaths.length < 5 && (
                  roomUploading ? (
                    <div className="flex items-center justify-center h-24 rounded-xl border border-slate-200 bg-slate-50">
                      <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <Dropzone
                      onFile={uploadRoomPhoto}
                      label="Ajouter une photo du lieu d'accueil"
                    />
                  )
                )}
              </div>
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            {(!profilePhotoPath || roomPhotoPaths.length === 0) && (
              <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg" role="status">
                Pour envoyer, il manque :{' '}
                {[
                  !profilePhotoPath && 'la photo de profil',
                  roomPhotoPaths.length === 0 && 'une photo du lieu d\u2019accueil',
                ]
                  .filter(Boolean)
                  .join(' et ')}
                .
              </p>
            )}

            <p className="text-xs text-slate-500 text-center" role="status" aria-live="polite">
              {saveState === 'saving' && 'Enregistrement…'}
              {saveState === 'saved' &&
                savedAt &&
                `Brouillon enregistré à ${savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
              {saveState === 'error' &&
                'Enregistrement automatique impossible pour le moment. Vos réponses restent à l\u2019écran.'}
            </p>

            <button
              type="submit"
              disabled={submitting || !profilePhotoPath || roomPhotoPaths.length === 0}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Envoyer ma présentation à David
            </button>
          </form>
        </div>
      </main>
    </>
  );
}

// Pastille « Obligatoire » : le rouge est réservé aux actions destructives (DESIGN.md).
function RequiredBadge() {
  return (
    <span className="ml-1.5 normal-case tracking-normal bg-amber-50 text-amber-700 text-[11px] font-medium px-1.5 py-0.5 rounded-full">
      Obligatoire
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white';

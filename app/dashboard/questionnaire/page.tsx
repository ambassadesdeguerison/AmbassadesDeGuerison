'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/browser';
import { ArrowLeft, Camera, CheckCircle2, Loader2 } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import Dropzone from '@/components/ui/Dropzone';

const CHURCH_ATTENDANCE_OPTIONS = [
  { value: 'regular', label: 'Régulièrement (chaque semaine ou presque)' },
  { value: 'occasional', label: 'Occasionnellement (quelques fois par an)' },
  { value: 'none', label: 'Je ne fréquente pas une église actuellement' },
];

export default function QuestionnairePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  const [form, setForm] = useState({
    healing_challenge_done: false,
    conferences_assistees: false,
    church_attendance: '',
    denomination: '',
    parcours_spirituel: '',
    livres_lus: '',
  });

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
        .select('status, profile_photo_url, room_photo_urls')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) { router.replace('/inscription'); return; }
      if (profile.status !== 'pre_approved') { setAccessDenied(true); setLoading(false); return; }

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

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
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
              Cette page s'ouvre après la vidéo et votre engagement.
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
              Votre présentation a été transmise à l'équipe.
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
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Mon espace
          </Link>

          <h1 className="text-xl font-semibold text-slate-800 mb-1">Parlez-nous de vous</h1>
          <p className="text-sm text-slate-500 mb-6">
            Aidez David à mieux vous connaître avant sa réponse.
            Ces informations restent confidentielles.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Défi guérison */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <p className="text-sm font-medium text-slate-700 mb-3">Formation</p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.healing_challenge_done}
                  onChange={(e) => set('healing_challenge_done', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">
                  J'ai suivi le <strong>Défi Guérison</strong>
                  <span className="block text-xs text-slate-400 mt-0.5">(formation gratuite en ligne sur la prière pour la guérison)</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer mt-4">
                <input
                  type="checkbox"
                  checked={form.conferences_assistees}
                  onChange={(e) => set('conferences_assistees', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-700">
                  J'ai déjà assisté à une <strong>conférence de David Théry</strong>
                </span>
              </label>
            </div>

            {/* Pratique ecclésiale */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
              <p className="text-sm font-medium text-slate-700">Pratique ecclésiale</p>
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
            </div>

            {/* Parcours spirituel */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
              <p className="text-sm font-medium text-slate-700">Parcours personnel</p>
              <Field label="Votre parcours spirituel (en quelques lignes)">
                <textarea
                  value={form.parcours_spirituel}
                  onChange={(e) => set('parcours_spirituel', e.target.value)}
                  rows={4}
                  placeholder="Comment en êtes-vous arrivé à vouloir ouvrir votre foyer ? Qu'est-ce qui vous a conduit à la prière pour la guérison ?"
                  className={inputCls}
                />
              </Field>
              <Field label="Livres ou formations qui vous ont marqué">
                <textarea
                  value={form.livres_lus}
                  onChange={(e) => set('livres_lus', e.target.value)}
                  rows={2}
                  placeholder="Ex : Guérir les malades, Défi Guérison, Vraiment Libre…"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Photos de l'ambassade */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-5">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-500" />
                <p className="text-sm font-medium text-slate-700">Photos de votre ambassade</p>
              </div>

              {photoError && (
                <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{photoError}</p>
              )}

              {/* Photo de profil (obligatoire) */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Photo de profil <span className="text-red-500 normal-case font-normal">— requise</span>
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
                    label="Photo de profil — privée, vue uniquement par David pour valider votre ambassade"
                  />
                )}
              </div>

              {/* Photos du lieu (requises, max 5) */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Photos du lieu d&apos;accueil <span className="text-red-500 normal-case font-normal">— requises</span>
                  <span className="font-normal text-slate-400 normal-case ml-1">
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
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                Une photo de profil et au moins une photo du lieu d&apos;accueil sont requises pour envoyer votre présentation.
              </p>
            )}

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white';

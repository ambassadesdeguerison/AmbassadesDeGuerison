'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/browser';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import Dropzone from '@/components/ui/Dropzone';
import YesNoField from '@/components/ui/YesNoField';
import VideoAsk from '@/components/ui/VideoAsk';
import CheckboxCombobox, { type ComboGroup } from '@/components/ui/CheckboxCombobox';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import { BOOKS, TRAININGS } from '@/lib/questionnaire/catalog';
import { PRESENTATION_MESSAGE_MAX } from '@/lib/questionnaire/sanitize';
import {
  missingFields,
  missingBySection,
  joinLabels,
  type SectionId,
} from '@/lib/questionnaire/completeness';
import { MAX_VIDEO_BYTES, uploadIntroVideo } from '@/lib/video/upload-client';

const CHURCH_ATTENDANCE_OPTIONS = [
  { value: 'regular', label: 'Régulièrement (chaque semaine ou presque)' },
  { value: 'occasional', label: 'Occasionnellement (quelques fois par an)' },
  { value: 'none', label: 'Je ne fréquente pas une église actuellement' },
];

// Liste « formations et livres » : formations en haut, livres ensuite. Les identifiants sont préfixés
// (t: formation, b: livre) pour ne pas confondre un livre et une formation homonymes.
// La conférence et « autres livres » ne sont PAS dans la liste : trop loin en bas, ils s'oubliaient.
// Ce sont deux cases visibles sous la liste.
const LIBRARY_GROUPS: ComboGroup[] = [
  { label: 'Formations gratuites', options: TRAININGS.map((t) => ({ id: `t:${t.slug}`, label: t.label })) },
  { label: 'Livres de David', options: BOOKS.map((b) => ({ id: `b:${b.slug}`, label: b.label })) },
];

type FormState = {
  trainings_done: string[];
  books_read: string[];
  livres_lus: string; // « autres » livres ou formations, hors catalogue
  conferences_assistees: boolean;
  church_attendance: string;
  denomination: string;
  parcours_spirituel: string; // secours écrit si la vidéo pose problème
  has_seen_healings: boolean | null;
  has_leadership_role: boolean | null;
  leadership_role: string;
  presentation_message: string; // public : popup de la carte, à côté de la photo de profil
  live_screen: string; // appareil sur lequel le live sera regardé (aide David à juger si la demande est réaliste)
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
  presentation_message: '',
  live_screen: '',
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
  // Les notes du VideoAsk restent sur l'appareil : clé propre à chaque profil, pour qu'un autre candidat
  // qui utilise le même navigateur ne retrouve pas les notes de la personne précédente.
  const [profileId, setProfileId] = useState('');
  // « Autres livres ou formations » coché : c'est seulement alors que le champ de saisie s'affiche.
  const [otherChecked, setOtherChecked] = useState(false);
  // Parcours écrit : affiché en secours quand la vidéo pose problème, ou à la demande du candidat.
  const [showWritten, setShowWritten] = useState(false);

  // Sections repliables : seule la première est ouverte au départ, l'en-tête de chacune dit ce qui reste à remplir.
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    formations: true,
    pratique: false,
    parcours: false,
    photos: false,
  });

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
          'id, status, profile_photo_url, room_photo_urls, healing_challenge_done, conferences_assistees, church_attendance, denomination, parcours_spirituel, livres_lus, books_read, trainings_done, has_seen_healings, has_leadership_role, leadership_role, presentation_message, live_screen, intro_video_path'
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
        presentation_message: profile.presentation_message ?? '',
        live_screen: profile.live_screen ?? '',
      });
      setOtherChecked(Boolean(profile.livres_lus));
      setShowWritten(Boolean(profile.parcours_spirituel));
      setHasVideo(Boolean(profile.intro_video_path));
      setProfileId(profile.id);

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

  // La liste déroulante porte formations et livres : on les redistribue dans leurs deux colonnes.
  function onLibraryChange(next: string[]) {
    dirtyRef.current = true;
    setForm((prev) => ({
      ...prev,
      trainings_done: next.filter((id) => id.startsWith('t:')).map((id) => id.slice(2)),
      books_read: next.filter((id) => id.startsWith('b:')).map((id) => id.slice(2)),
    }));
  }

  // Décocher « autres » efface ce qui avait été saisi (sinon l'admin le verrait sans que le candidat s'en souvienne).
  function onOtherToggle(checked: boolean) {
    dirtyRef.current = true;
    setOtherChecked(checked);
    if (!checked) setForm((prev) => ({ ...prev, livres_lus: '' }));
  }

  const librarySelection = [
    ...form.trainings_done.map((slug) => `t:${slug}`),
    ...form.books_read.map((slug) => `b:${slug}`),
  ];

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

  // Tous les champs sont obligatoires, sauf la vidéo et la liste formations/livres (cf lib/questionnaire/completeness.ts).
  const missing = missingFields(form, { hasProfilePhoto: Boolean(profilePhotoPath), roomPhotoCount: roomPhotoPaths.length });
  const missingIn = missingBySection(missing);

  function toggleSection(id: SectionId) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missing.length > 0) {
      // On ouvre les sections concernées et on amène la première sous les yeux.
      setOpenSections((prev) => {
        const next = { ...prev };
        for (const item of missing) next[item.section] = true;
        return next;
      });
      setError(`Il manque : ${joinLabels(missing.map((m) => m.label))}.`);
      const first = missing[0].section;
      setTimeout(() => document.getElementById(`section-${first}`)?.scrollIntoView({ block: 'start' }), 50);
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
          {/* Finalité et destinataire dits ici une seule fois, pour tout le formulaire (même usage pour tous les champs). */}
          <p className="text-sm text-slate-500">
            Aidez David à mieux vous connaître avant de valider votre ambassade.
            Seule l&apos;équipe voit vos réponses.
          </p>
          <p className="text-xs text-slate-500 mt-2 mb-5">
            Merci de remplir tous les champs. Vos réponses s&apos;enregistrent automatiquement.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>

            {/* Formations et livres : non bloquant à l'envoi (cf completeness.ts), mais jamais présenté comme facultatif à l'écran */}
            <CollapsibleSection
              title="Formations suivies et livres lus"
              sectionId="section-formations"
              open={openSections.formations}
              onToggle={() => toggleSection('formations')}
            >
              <CheckboxCombobox
                label="Formations suivies et livres lus"
                groups={LIBRARY_GROUPS}
                selected={librarySelection}
                onChange={onLibraryChange}
                placeholder="Choisissez dans la liste"
                searchPlaceholder="Rechercher une formation ou un livre"
              />
              <div className="space-y-2">
                <CheckRow
                  checked={form.conferences_assistees}
                  onChange={(v) => set('conferences_assistees', v)}
                >
                  J&apos;ai assisté à une conférence de David Théry
                </CheckRow>
                <CheckRow checked={otherChecked} onChange={onOtherToggle}>
                  D&apos;autres livres ou formations m&apos;ont marqué
                </CheckRow>
              </div>
              {otherChecked && (
                <Field label="Quels autres livres ou formations vous ont marqué ?">
                  <input
                    type="text"
                    value={form.livres_lus}
                    onChange={(e) => set('livres_lus', e.target.value)}
                    className={inputCls}
                  />
                </Field>
              )}
            </CollapsibleSection>

            {/* Pratique ecclésiale */}
            <CollapsibleSection
              title="Pratique ecclésiale"
              sectionId="section-pratique"
              open={openSections.pratique}
              onToggle={() => toggleSection('pratique')}
              remaining={missingIn.pratique.length}
            >
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
              <Field label="Dénomination ou famille d’église">
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
                    placeholder="Ex : responsable d'un groupe de maison, diacre, pasteur, prêtre…"
                    className={inputCls}
                  />
                </Field>
              )}
            </CollapsibleSection>

            {/* Parcours personnel : guérisons vues + vidéo (le parcours écrit n'est qu'un secours) */}
            <CollapsibleSection
              title="Parcours personnel"
              sectionId="section-parcours"
              open={openSections.parcours}
              onToggle={() => toggleSection('parcours')}
              remaining={missingIn.parcours.length}
            >
              <YesNoField
                label="Avez-vous déjà vu des personnes guéries suite à votre prière ?"
                value={form.has_seen_healings}
                onChange={(v) => set('has_seen_healings', v)}
              />
              <VideoAsk
                embedded
                onSubmit={uploadIntroVideo}
                maxBytes={MAX_VIDEO_BYTES}
                alreadyUploaded={hasVideo}
                notesStorageKey={`videoask-notes:${profileId}`}
                onProblem={() => setShowWritten(true)}
              />

              {showWritten ? (
                <Field label="Votre parcours spirituel (en quelques lignes)">
                  <textarea
                    value={form.parcours_spirituel}
                    onChange={(e) => set('parcours_spirituel', e.target.value)}
                    rows={4}
                    placeholder="Comment en êtes-vous arrivé à vouloir ouvrir votre foyer ? Qu'est-ce qui vous a conduit à la prière pour la guérison ?"
                    className={inputCls}
                  />
                </Field>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowWritten(true)}
                  className="min-h-[44px] text-sm text-indigo-600 hover:text-indigo-700 hover:underline text-left"
                >
                  Un souci avec la vidéo ? Écrire mon parcours à la place
                </button>
              )}
            </CollapsibleSection>

            {/* Photos de l'ambassade */}
            <CollapsibleSection
              title="Photos et message d’accueil"
              sectionId="section-photos"
              open={openSections.photos}
              onToggle={() => toggleSection('photos')}
              remaining={missingIn.photos.length}
            >
              {photoError && (
                <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{photoError}</p>
              )}

              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-700 mb-1.5">Pour de bonnes photos</p>
                <ul className="list-disc pl-4 space-y-1 text-sm text-slate-600">
                  <li>Avec votre téléphone, en lumière du jour (face à une fenêtre, pas à contre-jour).</li>
                  <li>Profil : votre visage bien visible et de face, sur un fond simple.</li>
                  <li>
                    Lieu : téléphone à l&apos;horizontale, reculez pour montrer la pièce où vous regarderez le live.
                  </li>
                  <li>Essuyez l&apos;objectif de votre téléphone et vérifiez que la photo est nette avant de l&apos;envoyer.</li>
                </ul>
              </div>

              {/* Photo de profil */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Photo de profil</p>
                <p className="text-xs text-slate-500">
                  Vue par David pour valider votre ambassade, puis affichée en petit sur la carte publique quand votre
                  ambassade est active.
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
                    label="Ajouter ma photo de profil"
                  />
                )}
              </div>

              {/* Message d'accueil : public, affiché sur la carte à côté de la photo de profil */}
              <div className="space-y-1.5">
                <label htmlFor="presentation-message" className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Votre message d&apos;accueil
                </label>
                <p className="text-xs text-slate-500">
                  Une ou deux phrases, affichées sur la carte à côté de votre photo. Dites qui vous êtes et
                  ce que les visiteurs vivront chez vous.
                </p>
                <textarea
                  id="presentation-message"
                  value={form.presentation_message}
                  onChange={(e) => set('presentation_message', e.target.value.slice(0, PRESENTATION_MESSAGE_MAX))}
                  rows={3}
                  maxLength={PRESENTATION_MESSAGE_MAX}
                  placeholder="Ex. : Je m'appelle Marie, maman de trois enfants. Chez nous, c'est simple et chaleureux : on prie ensemble avant le live autour d'un café."
                  className={inputCls}
                />
                <p className="text-xs text-slate-500">
                  {form.presentation_message.length}/{PRESENTATION_MESSAGE_MAX}
                </p>
              </div>

              {/* Photos du lieu (au moins une, max 5) */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Photos du lieu d&apos;accueil
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

              <Field label="Sur quoi allez-vous regarder le live ?">
                <input
                  type="text"
                  value={form.live_screen}
                  onChange={(e) => set('live_screen', e.target.value)}
                  placeholder="Ex : télévision, ordinateur, vidéoprojecteur…"
                  className={inputCls}
                />
              </Field>
            </CollapsibleSection>

            {error && (
              <p role="alert" className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <p className="text-xs text-slate-500 text-center" role="status" aria-live="polite">
              {saveState === 'saving' && 'Enregistrement…'}
              {saveState === 'saved' &&
                savedAt &&
                `Brouillon enregistré à ${savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
              {saveState === 'error' &&
                'Enregistrement automatique impossible pour le moment. Vos réponses restent à l’écran.'}
            </p>

            <button
              type="submit"
              disabled={submitting}
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

// Case à cocher dans une ligne de 44 px (cible tactile confortable), visible en permanence.
function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer min-h-[44px] rounded-xl border border-slate-200 px-3.5 py-2 hover:bg-slate-50 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span className="text-sm text-slate-700">{children}</span>
    </label>
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

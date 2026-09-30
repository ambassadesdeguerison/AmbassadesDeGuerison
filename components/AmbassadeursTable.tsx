'use client';

import React, { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, ChevronUp, User, Flower2, X, ChevronLeft, ChevronRight, AlertCircle, Info } from 'lucide-react';
import { apiCall } from '@/lib/admin/api-call';
import { questionnaireGaps, type QuestionnaireGaps } from '@/lib/admin/questionnaire-gaps';
import { BOOKS, TRAININGS, labelsFor } from '@/lib/questionnaire/catalog';
import ErrorMessage from '@/components/admin/ErrorMessage';
import ConfirmDialog, { type ConfirmSpec } from '@/components/admin/ConfirmDialog';

interface Ambassadeur {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  city: string;
  country: string;
  host_type: string;
  status: string;
  capacity: number | null;
  created_at: string;
  phone: string | null;
  healing_challenge_done: boolean | null;
  conferences_assistees: boolean | null;
  church_attendance: string | null;
  denomination: string | null;
  parcours_spirituel: string | null;
  livres_lus: string | null;
  books_read: string[] | null;
  trainings_done: string[] | null;
  has_seen_healings: boolean | null;
  has_leadership_role: boolean | null;
  leadership_role: string | null;
  intro_video_path: string | null;
  intro_video_mime: string | null;
  intro_video_play_url: string | null;
  intro_video_download_url: string | null;
  profile_photo_signed_url: string | null;
  room_photo_signed_urls: string[];
  is_women_only: boolean | null;
}

interface Props {
  ambassadeurs: Ambassadeur[];
  total: number;
  page: number;
  pageSize: number;
  searchQ: string;
  filterStatus: string;
}

// Audit admin 2026-08-07 (2.6) : « Inscrit » et « Questionnaire » ne disaient
// ni ce qu'on attend, ni de qui. Un nouvel admin ne pouvait pas deviner que
// pour `pending_review` la balle est dans le camp du candidat (transition
// self-service), tandis que `enrichment_pending` attend une décision de sa part.
const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  validated:          { label: 'Validé',                 className: 'bg-emerald-50 text-emerald-700' },
  pending_review:     { label: 'En attente du candidat', className: 'bg-amber-50 text-amber-700'    },
  pre_approved:       { label: 'Présentation en cours', className: 'bg-blue-50 text-blue-700'      },
  enrichment_pending: { label: 'À valider',              className: 'bg-purple-50 text-purple-700'  },
  suspended:          { label: 'Suspendu',               className: 'bg-red-50 text-red-700'        },
  rejected:           { label: 'Refusé',                 className: 'bg-slate-100 text-slate-500'   },
};

// La transition pending_review → pre_approved est self-service (le candidat l'effectue depuis /dashboard).
// L'admin valide depuis enrichment_pending (questionnaire complet, photo de profil obligatoire).
// L'API conserve `validated_bypass` comme escape hatch pour les cas exceptionnels (script SQL, support).
// enrichment_pending est volontairement absent d'ici : Valider/Refuser vivent uniquement dans le
// panneau déplié (sticky en bas), pour éviter de trancher sur un dossier photos/questionnaire non lu.
const STATUS_ACTIONS: Record<string, { action: string; label: string; className: string }[]> = {
  pending_review:     [{ action: 'rejected', label: 'Refuser', className: 'bg-red-50 text-red-700 hover:bg-red-100' }],
  pre_approved:       [{ action: 'rejected', label: 'Refuser', className: 'bg-red-50 text-red-700 hover:bg-red-100' }],
  validated:          [{ action: 'suspended',       label: 'Suspendre',          className: 'bg-red-50 text-red-700 hover:bg-red-100' }],
  suspended:          [{ action: 'reactiver',       label: 'Réactiver',          className: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' }],
  rejected:           [{ action: 'reactiver',       label: 'Réintégrer',         className: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' }],
};

const HOST_TYPE_LABELS: Record<string, string> = {
  individual: 'Domicile',
  church:     'Église',
};

const CHURCH_ATTENDANCE_LABELS: Record<string, string> = {
  regular:    'Régulièrement',
  occasional: 'Occasionnellement',
  none:       'Pas d\'église',
};

const FILTERS = [
  { value: 'all',                label: 'Tous'                  },
  { value: 'enrichment_pending', label: 'À valider'             },
  { value: 'pending_review',     label: 'En attente du candidat' },
  { value: 'pre_approved',       label: 'Présentation en cours' },
  { value: 'validated',          label: 'Validés'               },
  { value: 'suspended',          label: 'Suspendus'             },
  { value: 'rejected',           label: 'Refusés'               },
];

// Signal pastoral : ce que Camille regarde en premier pour juger l'engagement spirituel du candidat.
function PastoralSignals({ a }: { a: Ambassadeur }) {
  const trainingLabels = labelsFor(TRAININGS, a.trainings_done);
  const bookLabels = labelsFor(BOOKS, a.books_read);
  return (
    <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4">
      <p className="text-xs font-medium text-indigo-700 uppercase tracking-wide mb-3">Engagement spirituel</p>
      <div className="flex gap-6 mb-3">
        <div>
          <p className="text-slate-400 text-xs mb-0.5">Défi Guérison</p>
          <p className={`text-sm font-medium ${a.healing_challenge_done ? 'text-emerald-700' : 'text-slate-500'}`}>
            {a.healing_challenge_done ? 'Oui' : 'Non'}
          </p>
        </div>
        <div>
          <p className="text-slate-400 text-xs mb-0.5">Conférence DT</p>
          <p className={`text-sm font-medium ${a.conferences_assistees ? 'text-emerald-700' : 'text-slate-500'}`}>
            {a.conferences_assistees ? 'Oui' : 'Non'}
          </p>
        </div>
        {a.church_attendance && (
          <div>
            <p className="text-slate-400 text-xs mb-0.5">Fréquentation église</p>
            <p className="text-sm font-medium text-slate-700">
              {CHURCH_ATTENDANCE_LABELS[a.church_attendance] ?? a.church_attendance}
            </p>
          </div>
        )}
      </div>
      {a.parcours_spirituel && (
        <div className="mb-3">
          <p className="text-slate-400 text-xs mb-0.5">Parcours spirituel</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.parcours_spirituel}</p>
        </div>
      )}
      <div className="flex gap-6 mb-3">
        <div>
          <p className="text-slate-400 text-xs mb-0.5">A déjà vu des guérisons</p>
          <p className={`text-sm font-medium ${a.has_seen_healings ? 'text-emerald-700' : 'text-slate-500'}`}>
            {a.has_seen_healings == null ? 'Non renseigné' : a.has_seen_healings ? 'Oui' : 'Non'}
          </p>
        </div>
        <div>
          <p className="text-slate-400 text-xs mb-0.5">Fonction de responsabilité</p>
          <p className={`text-sm font-medium ${a.has_leadership_role ? 'text-emerald-700' : 'text-slate-500'}`}>
            {a.has_leadership_role == null
              ? 'Non renseigné'
              : a.has_leadership_role
                ? `Oui${a.leadership_role ? ` — ${a.leadership_role}` : ''}`
                : 'Non'}
          </p>
        </div>
      </div>
      {(trainingLabels.length > 0 || bookLabels.length > 0 || a.livres_lus) && (
        <div className="mb-3 space-y-2">
          <p className="text-slate-400 text-xs">Formations et livres</p>
          {trainingLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {trainingLabels.map((l) => (
                <span key={l} className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full">{l}</span>
              ))}
            </div>
          )}
          {bookLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {bookLabels.map((l) => (
                <span key={l} className="bg-white border border-indigo-100 text-slate-700 text-xs px-2 py-0.5 rounded-full">{l}</span>
              ))}
            </div>
          )}
          {a.livres_lus && <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.livres_lus}</p>}
        </div>
      )}
      {a.intro_video_path && (
        <div>
          <p className="text-slate-400 text-xs mb-1">Vidéo de présentation</p>
          {a.intro_video_play_url ? (
            <>
              <video controls preload="metadata" playsInline className="w-full max-w-md rounded-lg bg-slate-900">
                <source src={a.intro_video_play_url} type={a.intro_video_mime ?? undefined} />
              </video>
              <p className="text-xs text-slate-500 mt-1.5">
                La vidéo ne s&apos;affiche pas ?{' '}
                <a href={a.intro_video_download_url ?? a.intro_video_play_url} download className="text-indigo-600 hover:underline">
                  Télécharger le fichier
                </a>
              </p>
            </>
          ) : (
            <p className="text-xs text-red-600">Vidéo introuvable dans le stockage.</p>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionnairPanel({ a }: { a: Ambassadeur }) {
  const hasQuestionnaire = a.parcours_spirituel || a.church_attendance || a.denomination || a.livres_lus || a.books_read?.length || a.trainings_done?.length || a.has_seen_healings != null || a.has_leadership_role != null || a.intro_video_path || a.healing_challenge_done || a.conferences_assistees || a.phone;

  if (!hasQuestionnaire) {
    return (
      <p className="text-xs text-slate-400 italic">Présentation pas encore remplie.</p>
    );
  }

  return (
    <div className="space-y-4">
      <PastoralSignals a={a} />
      {(a.phone || a.denomination) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {a.phone && (
            <div>
              <p className="text-slate-400 mb-0.5">Téléphone</p>
              <p className="text-slate-700">{a.phone}</p>
            </div>
          )}
          {a.denomination && (
            <div>
              <p className="text-slate-400 mb-0.5">Dénomination</p>
              <p className="text-slate-700">{a.denomination}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Badge de complétude — rouge si le dossier ne peut pas être validé en l'état,
// gris si l'information manquante est seulement utile au discernement.
// Logique dans lib/admin/questionnaire-gaps.ts (testée unitairement).
function GapsBadge({ gaps }: { gaps: QuestionnaireGaps }) {
  if (gaps.blocking.length > 0) {
    return (
      <span
        title={`Validation impossible : ${gaps.blocking.join(', ')}`}
        className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-red-100"
      >
        <AlertCircle className="w-2.5 h-2.5" />
        {gaps.blocking.length} photo{gaps.blocking.length > 1 ? 's' : ''} manquante{gaps.blocking.length > 1 ? 's' : ''}
      </span>
    );
  }
  if (gaps.informational.length > 0) {
    return (
      <span
        title={gaps.informational.join(', ')}
        className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
      >
        <Info className="w-2.5 h-2.5" />
        Parcours non renseigné
      </span>
    );
  }
  return null;
}

// Lightbox : navigation clavier + clic-hors-zone, pas de lib externe pour une seule vue.
function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: { url: string; label: string }[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNavigate((index + 1) % photos.length);
      if (e.key === 'ArrowLeft') onNavigate((index - 1 + photos.length) % photos.length);
    },
    [index, photos.length, onClose, onNavigate]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const photo = photos[index];

  return (
    <div
      className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={photo.label}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        aria-label="Fermer"
      >
        <X className="w-6 h-6" />
      </button>
      {photos.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((index - 1 + photos.length) % photos.length);
          }}
          className="absolute left-4 text-white/70 hover:text-white transition-colors"
          aria-label="Photo précédente"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.label}
        className="max-w-full max-h-[85vh] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {photos.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((index + 1) % photos.length);
          }}
          className="absolute right-4 text-white/70 hover:text-white transition-colors"
          aria-label="Photo suivante"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
      <p className="absolute bottom-4 text-white/70 text-xs">{photo.label} — {index + 1}/{photos.length}</p>
    </div>
  );
}

// Card mobile : le <table> à 9 colonnes ne rentre jamais sous 640px, même avec overflow-x-auto
// (Camille doit scroller horizontalement pour voir le statut/l'action). Card empilée = même contenu,
// zéro scroll horizontal. Desktop garde le tableau (plus dense, mieux pour scanner 20 lignes).
function AmbassadeurCard({
  a,
  displayStatus,
  isExpanded,
  isLoading,
  onToggleExpand,
  onAction,
  onOpenLightbox,
  error,
  notice,
}: {
  a: Ambassadeur;
  displayStatus: string;
  isExpanded: boolean;
  isLoading: boolean;
  onToggleExpand: () => void;
  onAction: (action: string) => void;
  onOpenLightbox: (photos: { url: string; label: string }[], index: number) => void;
  error?: string;
  notice?: string;
}) {
  const s = STATUS_LABELS[displayStatus] ?? { label: displayStatus, className: 'bg-slate-50 text-slate-600' };
  const gaps = questionnaireGaps(a);
  const photos = [
    ...(a.profile_photo_signed_url ? [{ url: a.profile_photo_signed_url, label: 'Photo de profil' }] : []),
    ...a.room_photo_signed_urls.map((url, idx) => ({ url, label: `Vue ${idx + 1} du lieu d'accueil` })),
  ];

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        aria-label={isExpanded ? 'Réduire' : 'Voir le profil'}
      >
        {a.profile_photo_signed_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.profile_photo_signed_url}
            alt={`${a.first_name} ${a.last_name}`}
            className="w-10 h-10 rounded-full object-cover bg-slate-100 shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-slate-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-slate-800 text-sm truncate">{a.first_name} {a.last_name}</span>
            {a.is_women_only && (
              <span
                title="Groupe femmes uniquement"
                className="inline-flex items-center gap-1 bg-pink-50 text-pink-600 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-pink-100 shrink-0"
              >
                <Flower2 className="w-2.5 h-2.5" />
                Femmes
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs truncate">{a.city}, {a.country} · {HOST_TYPE_LABELS[a.host_type] ?? a.host_type}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
              {s.label}
            </span>
            {displayStatus === 'enrichment_pending' && <GapsBadge gaps={gaps} />}
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-5 pt-1 bg-slate-50/60 space-y-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <div>
              <p className="text-slate-400 mb-0.5">E-mail</p>
              <p className="text-slate-700 break-all">{a.email}</p>
            </div>
            <div>
              <p className="text-slate-400 mb-0.5">Capacité</p>
              <p className="text-slate-700">{a.capacity ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 mb-0.5">Inscription</p>
              <p className="text-slate-700">{new Date(a.created_at).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          {photos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Photos</p>
              <div className="flex flex-wrap gap-3">
                {photos.map((photo, idx) => (
                  <button
                    key={photo.url}
                    type="button"
                    onClick={() => onOpenLightbox(photos, idx)}
                    className="block group text-left"
                    title={`${photo.label} — agrandir`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.label}
                      className={`w-24 h-24 rounded-lg object-cover bg-slate-100 transition ${
                        idx === 0 ? 'ring-2 ring-indigo-200 group-hover:ring-indigo-400' : 'ring-1 ring-slate-200 group-hover:ring-indigo-400'
                      }`}
                    />
                    <p className="text-[10px] text-slate-400 mt-1 text-center">
                      {photo.label === 'Photo de profil' ? 'Profil' : photo.label.replace(" du lieu d'accueil", '')}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Présentation de l&apos;ambassadeur</p>
            <QuestionnairPanel a={a} />
          </div>

          {displayStatus === 'enrichment_pending' && (
            <div className="sticky bottom-0 pt-4 border-t border-slate-100 bg-slate-50/95 backdrop-blur-sm space-y-2">
              {gaps.blocking.length > 0 && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                  Validation impossible : {gaps.blocking.join(', ')}. Le candidat doit compléter son questionnaire.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => onAction('validated')}
                  disabled={isLoading || gaps.blocking.length > 0}
                  className="px-4 py-2.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors font-medium"
                >
                  {isLoading ? '…' : 'Valider le dossier'}
                </button>
                <button
                  onClick={() => onAction('rejected')}
                  disabled={isLoading}
                  className="px-4 py-2.5 bg-red-50 text-red-700 text-xs rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors font-medium"
                >
                  {isLoading ? '…' : 'Refuser'}
                </button>
              </div>
              {/* Audit 2.3 : rien n'indiquait qu'une validation ou un refus
                  envoie un e-mail au candidat. */}
              <p className="text-[11px] text-slate-400">Ces deux actions envoient un e-mail au candidat.</p>
            </div>
          )}

          {(STATUS_ACTIONS[displayStatus] ?? []).length > 0 && (
            <div className="flex gap-1.5 flex-wrap pt-4 border-t border-slate-100">
              {(STATUS_ACTIONS[displayStatus] ?? []).map((act) => (
                <button
                  key={act.action}
                  onClick={() => onAction(act.action)}
                  disabled={isLoading}
                  className={`text-xs px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${act.className}`}
                >
                  {isLoading ? '…' : act.label}
                </button>
              ))}
            </div>
          )}

          {error && <ErrorMessage>{error}</ErrorMessage>}
          {notice && (
            <p className="text-sm text-slate-700 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg">{notice}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AmbassadeursTable({
  ambassadeurs: initial,
  total,
  page,
  pageSize,
  searchQ,
  filterStatus,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [search, setSearch] = useState(searchQ);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: { url: string; label: string }[]; index: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notices, setNotices] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  function navigate(updates: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (!v || v === 'all') sp.delete(k);
      else sp.set(k, v);
    }
    startTransition(() => {
      router.push(`/admin/ambassadeurs?${sp.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ q: search, page: '1' });
  }

  async function runAction(a: Ambassadeur, action: string) {
    setActionLoading(a.id);
    setErrors((e) => ({ ...e, [a.id]: '' }));
    setNotices((n) => ({ ...n, [a.id]: '' }));

    const res = await apiCall<{ status: string }>(`/api/admin/ambassadeurs/${a.id}/status`, {
      body: { action },
    });

    if (res.ok) {
      setStatusOverrides((prev) => ({ ...prev, [a.id]: res.data.status }));
      // Audit 2.8 : l'override local seul laissait la liste désynchronisée du
      // filtre actif (une ligne validée restait affichée sous « À valider »).
      // `router.refresh()` conserve l'URL — donc le filtre et la page.
      startTransition(() => router.refresh());

      // Audit 2.4 : « Réactiver » a deux comportements silencieusement
      // différents selon la complétude du dossier. L'admin s'attendait à
      // remettre l'ambassadeur sur la carte et obtenait un statut « À valider »
      // sans explication.
      if (action === 'reactiver') {
        setNotices((n) => ({
          ...n,
          [a.id]: res.data.status === 'validated'
            ? `${a.first_name} est de nouveau visible sur la carte. Un e-mail de confirmation lui a été envoyé.`
            : `Dossier incomplet : ${a.first_name} doit d'abord compléter son questionnaire (photos). Aucun e-mail envoyé.`,
        }));
      }
    } else {
      // Audit 2.1 : l'échec était avalé. L'API refuse pourtant `validated` hors
      // `enrichment_pending` avec un message explicite qui n'était jamais montré.
      setErrors((e) => ({ ...e, [a.id]: res.error }));
    }
    setActionLoading(null);
  }

  // Les actions visibles publiquement ou envoyant un e-mail passent par une
  // confirmation (audit 2.2, 2.3, T.1 et T.3). « Valider » en est exempt :
  // c'est l'issue attendue d'un dossier examiné, et elle reste réversible via
  // « Suspendre ».
  function handleAction(a: Ambassadeur, action: string) {
    const name = `${a.first_name} ${a.last_name}`;

    if (action === 'rejected') {
      setConfirm({
        title: `Refuser la candidature de ${name} ?`,
        body: 'Le dossier passera au statut « Refusé ». Vous pourrez le réintégrer plus tard depuis le filtre « Refusés ».',
        emailNotice: `Un e-mail de refus sera envoyé à ${a.email}. Cet envoi est immédiat et irréversible.`,
        confirmLabel: 'Refuser la candidature',
        onConfirm: async () => {
          setConfirmBusy(true);
          await runAction(a, action);
          setConfirmBusy(false);
          setConfirm(null);
        },
      });
      return;
    }

    if (action === 'suspended') {
      setConfirm({
        title: `Suspendre l'ambassade de ${name} ?`,
        body: 'Elle disparaîtra immédiatement de la carte publique et ne recevra plus de demandes de visite.',
        confirmLabel: 'Suspendre',
        onConfirm: async () => {
          setConfirmBusy(true);
          await runAction(a, action);
          setConfirmBusy(false);
          setConfirm(null);
        },
      });
      return;
    }

    if (action === 'reactiver') {
      const complete = !!a.profile_photo_signed_url && a.room_photo_signed_urls.length > 0;
      setConfirm({
        title: `Réintégrer ${name} ?`,
        body: complete
          ? 'Le dossier est complet : l\'ambassade redeviendra visible sur la carte au prochain live.'
          : 'Le dossier est incomplet (photos manquantes). Le candidat sera renvoyé vers sa présentation, pas vers la carte.',
        emailNotice: complete ? `Un e-mail de bienvenue sera envoyé à ${a.email}.` : undefined,
        tone: 'primary',
        confirmLabel: 'Réintégrer',
        onConfirm: async () => {
          setConfirmBusy(true);
          await runAction(a, action);
          setConfirmBusy(false);
          setConfirm(null);
        },
      });
      return;
    }

    void runAction(a, action);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <input
          type="search"
          placeholder="Rechercher par nom, e-mail, ville…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent bg-white"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors"
        >
          Rechercher
        </button>
      </form>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => navigate({ status: f.value, page: '1' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === f.value
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400 self-center">
          {total} ambassadeur{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Audit 2.6 : un nouvel admin ne pouvait pas deviner quelles étapes du
          pipeline demandent une action de sa part et lesquelles avancent seules. */}
      <p className="flex items-start gap-2 text-xs text-slate-500 bg-slate-100/70 px-3 py-2 rounded-lg">
        <Info className="w-3.5 h-3.5 mt-px shrink-0 text-slate-400" />
        <span>
          Le candidat avance seul jusqu&apos;au statut <strong className="font-medium">« À valider »</strong> : il valide
          son engagement, puis remplit sa présentation. C&apos;est à ce moment seulement que vous examinez son dossier et
          décidez.
        </span>
      </p>

      {initial.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">Aucun ambassadeur dans cette catégorie.</p>
      ) : (
        <>
          {/* Mobile (<640px) : cards empilées — un <table> à 9 colonnes force un scroll horizontal
              qui cache le statut et l'action, cf QA 2026-08-07. */}
          <div className={`sm:hidden bg-white rounded-xl border border-slate-100 overflow-hidden transition-opacity ${isPending ? 'opacity-60' : ''}`}>
            {initial.map((a) => {
              const displayStatus = statusOverrides[a.id] ?? a.status;
              return (
                <AmbassadeurCard
                  key={a.id}
                  a={a}
                  displayStatus={displayStatus}
                  isExpanded={expandedId === a.id}
                  isLoading={actionLoading === a.id}
                  onToggleExpand={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  onAction={(action) => handleAction(a, action)}
                  error={errors[a.id]}
                  notice={notices[a.id]}
                  onOpenLightbox={(photos, index) => setLightbox({ photos, index })}
                />
              );
            })}
          </div>

        <div className={`hidden sm:block bg-white rounded-xl border border-slate-100 overflow-hidden transition-opacity ${isPending ? 'opacity-60' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium w-6"></th>
                  <th className="text-left px-4 py-3 font-medium">Nom</th>
                  <th className="text-left px-4 py-3 font-medium">E-mail</th>
                  <th className="text-left px-4 py-3 font-medium">Ville / Pays</th>
                  {/* Type, capacité et date d'inscription restent lisibles dans
                      le panneau déplié — les masquer sous 1280px garde la
                      colonne « Action » à l'écran sans scroll horizontal
                      (constaté sur un portable 1056px : 290px de débordement,
                      l'action se retrouvait hors champ). */}
                  <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Cap.</th>
                  <th className="text-left px-4 py-3 font-medium">Statut</th>
                  <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Inscription</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {initial.map((a) => {
                  const displayStatus = statusOverrides[a.id] ?? a.status;
                  const s = STATUS_LABELS[displayStatus] ?? { label: displayStatus, className: 'bg-slate-50 text-slate-600' };
                  const isLoading = actionLoading === a.id;
                  const isExpanded = expandedId === a.id;
                  const gaps = questionnaireGaps(a);
                  return (
                    <React.Fragment key={a.id}>
                      <tr className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : a.id)}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                            aria-label={isExpanded ? 'Réduire' : 'Voir le profil'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            {a.profile_photo_signed_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={a.profile_photo_signed_url}
                                alt={`${a.first_name} ${a.last_name}`}
                                className="w-8 h-8 rounded-full object-cover bg-slate-100 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <span>{a.first_name} {a.last_name}</span>
                            {a.is_women_only && (
                              <span
                                title="Groupe femmes uniquement"
                                className="inline-flex items-center gap-1 bg-pink-50 text-pink-600 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-pink-100"
                              >
                                <Flower2 className="w-2.5 h-2.5" />
                                Femmes
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{a.email}</td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{a.city}, {a.country}</td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap hidden xl:table-cell">{HOST_TYPE_LABELS[a.host_type] ?? a.host_type}</td>
                        <td className="px-4 py-3 text-slate-500 hidden xl:table-cell">{a.capacity ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
                              {s.label}
                            </span>
                            {displayStatus === 'enrichment_pending' && <GapsBadge gaps={gaps} />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap hidden xl:table-cell">
                          {new Date(a.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {displayStatus === 'enrichment_pending' ? (
                              // Audit 2.7 : « Voir ↓ » ne se lisait pas comme une
                              // action, alors que c'est la seule ligne de la
                              // colonne « Action » qui en demande vraiment une.
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : a.id)}
                                className="text-xs px-2.5 py-1 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors whitespace-nowrap font-medium"
                              >
                                {isExpanded ? 'Réduire' : 'Examiner le dossier'}
                              </button>
                            ) : (
                              (STATUS_ACTIONS[displayStatus] ?? []).map((act) => (
                                <button
                                  key={act.action}
                                  onClick={() => handleAction(a, act.action)}
                                  disabled={isLoading}
                                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap ${act.className}`}
                                >
                                  {isLoading ? '…' : act.label}
                                </button>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Une action de ligne (Suspendre, Réintégrer) peut échouer
                          sans que le panneau soit déplié — l'erreur doit rester
                          visible dans ce cas aussi (audit 2.1). */}
                      {!isExpanded && (errors[a.id] || notices[a.id]) && (
                        <tr>
                          <td colSpan={9} className="px-4 pb-3 bg-slate-50/60">
                            {errors[a.id] && <ErrorMessage>{errors[a.id]}</ErrorMessage>}
                            {notices[a.id] && (
                              <p className="text-sm text-slate-700 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg">
                                {notices[a.id]}
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="px-6 pb-5 pt-3 bg-slate-50/60 border-b border-slate-100">
                            <div className="max-w-2xl space-y-5">
                              {(() => {
                                const photos = [
                                  ...(a.profile_photo_signed_url ? [{ url: a.profile_photo_signed_url, label: 'Photo de profil' }] : []),
                                  ...a.room_photo_signed_urls.map((url, idx) => ({ url, label: `Vue ${idx + 1} du lieu d'accueil` })),
                                ];
                                if (photos.length === 0) return null;
                                return (
                                  <div>
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Photos</p>
                                    <div className="flex flex-wrap gap-3">
                                      {photos.map((photo, idx) => (
                                        <button
                                          key={photo.url}
                                          type="button"
                                          onClick={() => setLightbox({ photos, index: idx })}
                                          className="block group text-left"
                                          title={`${photo.label} — agrandir`}
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={photo.url}
                                            alt={photo.label}
                                            className={`w-32 h-32 rounded-lg object-cover bg-slate-100 transition ${
                                              idx === 0 ? 'ring-2 ring-indigo-200 group-hover:ring-indigo-400' : 'ring-1 ring-slate-200 group-hover:ring-indigo-400'
                                            }`}
                                          />
                                          <p className="text-[10px] text-slate-400 mt-1 text-center">
                                            {photo.label === 'Photo de profil' ? 'Profil' : photo.label.replace(" du lieu d'accueil", '')}
                                          </p>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                              <div>
                                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Présentation de l&apos;ambassadeur</p>
                                <QuestionnairPanel a={a} />
                              </div>
                              {displayStatus === 'enrichment_pending' && (
                                <div className="sticky bottom-0 mt-4 pt-4 border-t border-slate-100 bg-slate-50/95 backdrop-blur-sm space-y-2">
                                  {gaps.blocking.length > 0 && (
                                    <p className="text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                                      Validation impossible : {gaps.blocking.join(', ')}. Le candidat doit compléter son questionnaire.
                                    </p>
                                  )}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleAction(a, 'validated')}
                                      disabled={isLoading || gaps.blocking.length > 0}
                                      className="px-4 py-2 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors font-medium"
                                    >
                                      {isLoading ? '…' : 'Valider le dossier'}
                                    </button>
                                    <button
                                      onClick={() => handleAction(a, 'rejected')}
                                      disabled={isLoading}
                                      className="px-4 py-2 bg-red-50 text-red-700 text-xs rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors font-medium"
                                    >
                                      {isLoading ? '…' : 'Refuser'}
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-slate-400">Ces deux actions envoient un e-mail au candidat.</p>
                                </div>
                              )}

                              {errors[a.id] && <ErrorMessage>{errors[a.id]}</ErrorMessage>}
                              {notices[a.id] && (
                                <p className="text-sm text-slate-700 bg-slate-100 border border-slate-200 px-3 py-2 rounded-lg">
                                  {notices[a.id]}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate({ page: String(page - 1) })}
            disabled={page <= 1 || isPending}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            Précédent
          </button>
          <span className="text-xs text-slate-500">Page {page} / {totalPages}</span>
          <button
            onClick={() => navigate({ page: String(page + 1) })}
            disabled={page >= totalPages || isPending}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            Suivant
          </button>
        </div>
      )}

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(index) => setLightbox((prev) => (prev ? { ...prev, index } : prev))}
        />
      )}

      <ConfirmDialog spec={confirm} onCancel={() => setConfirm(null)} pending={confirmBusy} />
    </div>
  );
}

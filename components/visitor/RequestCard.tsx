import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { de } from '@/lib/elision';
import { FROM_MON_ESPACE } from '@/components/visitor/BackToRequests';
import {
  displayStatus,
  requestAction,
  type RequestAction,
  type RequestStatus,
  type VisitorRequest,
} from '@/lib/visitor/group-requests';

export const STATUS: Record<RequestStatus, { label: string; detail: string; icon: typeof Clock; classes: string }> = {
  pending: {
    label: 'En attente de réponse',
    detail: "L'ambassadeur a reçu votre demande.",
    icon: Clock,
    classes: 'bg-amber-50 text-amber-700',
  },
  accepted: {
    label: 'Acceptée',
    detail: "Vous avez reçu l'adresse et les coordonnées par e-mail.",
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-700',
  },
  declined: {
    label: 'Non retenue cette fois',
    detail: "D'autres ambassades sont peut-être disponibles près de chez vous.",
    icon: XCircle,
    classes: 'bg-slate-100 text-slate-600',
  },
  cancelled_no_response: {
    label: 'Sans réponse',
    detail: "L'ambassadeur n'a pas pu répondre à temps. Vous pouvez en contacter une autre.",
    icon: XCircle,
    classes: 'bg-slate-100 text-slate-600',
  },
};

const ACTION_LABEL: Record<Exclude<RequestAction, null>, string> = {
  track: 'Suivre ma demande',
  details: 'Voir les détails',
  feedback: 'Donner mon avis',
  find_other: 'Chercher une autre ambassade',
};

// Date du live dans le fuseau du NAVIGATEUR (un visiteur d'Abidjan ou de Montréal ne lit pas
// l'heure de La Réunion). `tzLabel` vient de useBrowserTimezone (« heure de Paris »).
export function formatLiveDate(iso: string, tzLabel: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} à ${time} · ${tzLabel}`;
}

interface Props {
  request: VisitorRequest;
  now: Date;
  tzLabel: string;
  // « history » : version resserrée (une ligne de contexte, pas de phrase d'explication).
  variant: 'active' | 'history';
}

function hrefFor(action: Exclude<RequestAction, null>, token: string): string {
  switch (action) {
    case 'feedback':
      return `/feedback/${token}?from=${FROM_MON_ESPACE}`;
    case 'find_other':
      return '/';
    default:
      return `/visitor/${token}?from=${FROM_MON_ESPACE}`;
  }
}

export default function RequestCard({ request: r, now, tzLabel, variant }: Props) {
  const status = displayStatus(r, now);
  const s = STATUS[status] ?? STATUS.pending;
  const Icon = s.icon;
  const action = requestAction(r, now);
  const place = [r.host_city, r.host_country].filter(Boolean).join(', ');
  const when = r.event_date ? formatLiveDate(r.event_date, tzLabel) : null;
  const isActive = variant === 'active';
  const primary = action === 'feedback';

  // Après un live, une acceptée n'a plus rien à « détailler » : on invite à donner son avis.
  const detail =
    action === 'feedback' ? 'Le live est passé. Votre avis nous intéresse.' : s.detail;

  return (
    <li className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${isActive ? 'p-4' : 'p-3.5'}`}>
      <p className="text-sm font-medium text-slate-800">
        {r.host_first_name ? `Ambassade ${de(r.host_first_name)}` : 'Ambassade'}
      </p>
      {(place || when) && (
        <p className="text-xs text-slate-500 mt-0.5">
          {[place, when].filter(Boolean).join(' — ')}
        </p>
      )}

      <p className={`inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.classes}`}>
        <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {s.label}
      </p>
      {isActive && <p className="text-xs text-slate-500 mt-2">{detail}</p>}

      {action && (
        <Link
          href={hrefFor(action, r.visitor_token)}
          className={`mt-3 flex w-fit items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl text-sm font-medium transition-colors ${
            primary
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {ACTION_LABEL[action]}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      )}
    </li>
  );
}

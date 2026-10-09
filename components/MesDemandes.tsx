'use client';

import { useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Loader2, MapPin } from 'lucide-react';
import RequestCard from '@/components/visitor/RequestCard';
import { useBrowserTimezone } from '@/lib/hooks/use-browser-timezone';
import { groupRequests, type VisitorRequest } from '@/lib/visitor/group-requests';

const HISTORY_PAGE = 5;

interface Props {
  // null = chargement en cours. Le chargement vit dans la page (le badge de l'onglet en a besoin).
  requests: VisitorRequest[] | null;
  failed: boolean;
  onOpenGuide?: () => void;
}

// Onglet « Demandes » de /mon-espace : d'abord ce qui demande encore l'attention du visiteur
// (live à venir, en attente ou acceptée), puis un historique replié.
export default function MesDemandes({ requests, failed, onOpenGuide }: Props) {
  const tzLabel = useBrowserTimezone();
  const historyId = useId();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyShown, setHistoryShown] = useState(HISTORY_PAGE);
  // Figé au premier rendu : un live ne bascule pas « terminé » sous les yeux du visiteur.
  const [now] = useState(() => new Date());

  const grouped = useMemo(() => (requests ? groupRequests(requests, now) : null), [requests, now]);

  if (failed) {
    return (
      <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        Vos demandes ne peuvent pas être affichées pour le moment. Réessayez dans un instant.
      </p>
    );
  }

  if (!grouped) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" aria-label="Chargement de vos demandes" />
      </div>
    );
  }

  if (requests?.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
        <p className="text-sm text-slate-500">Vous n&apos;avez pas encore fait de demande.</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <MapPin className="w-4 h-4" aria-hidden="true" /> Voir la carte
        </Link>
        {onOpenGuide && (
          <p className="text-xs text-slate-500">
            Pas sûr de comment ça se passe ?{' '}
            <button type="button" onClick={onOpenGuide} className="text-indigo-600 hover:text-indigo-700 font-medium underline underline-offset-2">
              Lire le guide
            </button>
          </p>
        )}
      </div>
    );
  }

  const { active, history, pendingCount, acceptedCount } = grouped;
  const visibleHistory = history.slice(0, historyShown);
  const remaining = history.length - visibleHistory.length;

  return (
    <div className="space-y-6">
      <section aria-labelledby="demandes-en-cours-title" className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h2 id="demandes-en-cours-title" className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
            En cours
          </h2>
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
              {pendingCount} en attente
            </span>
          )}
          {acceptedCount > 0 && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
              {acceptedCount} {acceptedCount > 1 ? 'acceptées' : 'acceptée'}
            </span>
          )}
        </div>

        {active.length > 0 ? (
          <ul className="space-y-3">
            {active.map((r) => (
              <RequestCard key={r.id} request={r} now={now} tzLabel={tzLabel} variant="active" />
            ))}
          </ul>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">
            <p className="text-sm text-slate-500">Aucune demande en cours.</p>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <MapPin className="w-4 h-4" aria-hidden="true" /> Voir la carte
            </Link>
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section aria-label="Historique des demandes">
          <button
            type="button"
            aria-expanded={historyOpen}
            aria-controls={historyId}
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-3 min-h-[44px] px-4 bg-white rounded-2xl border border-slate-100 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span>Historique ({history.length})</span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          <div id={historyId} hidden={!historyOpen} className="mt-3 space-y-3">
            <ul className="space-y-3">
              {visibleHistory.map((r) => (
                <RequestCard key={r.id} request={r} now={now} tzLabel={tzLabel} variant="history" />
              ))}
            </ul>
            {remaining > 0 && (
              <button
                type="button"
                onClick={() => setHistoryShown((n) => n + HISTORY_PAGE)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Voir plus ({remaining})
              </button>
            )}
          </div>
        </section>
      )}

      <p className="text-xs text-slate-500">
        Un souci avec une demande ?{' '}
        <Link href="/contact-equipe" className="text-indigo-600 hover:text-indigo-700 font-medium underline underline-offset-2">
          Écrire à l&apos;équipe
        </Link>
      </p>
    </div>
  );
}

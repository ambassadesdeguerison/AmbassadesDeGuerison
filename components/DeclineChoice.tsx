'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  visitorName: string;
  /** Un envoi est en cours : `permanent` dit lequel des deux boutons tourne. */
  loading: false | { permanent: boolean };
  onDecline: (permanent: boolean) => void;
}

// Les deux façons de dire non à une demande de visite, en mots simples :
//  - « Pas disponible cette fois » : la personne peut redemander pour un autre live ;
//  - « Ne plus accueillir cette personne » : plus aucune demande chez cette ambassade,
//    jamais. Irréversible, donc une confirmation avant d'envoyer.
export default function DeclineChoice({ visitorName, loading, onDecline }: Props) {
  const [confirming, setConfirming] = useState(false);
  const busy = loading !== false;

  if (confirming) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-left">
        <p className="text-sm font-medium text-red-800 mb-1">Êtes-vous sûr(e) ?</p>
        <p className="text-sm text-red-700 leading-relaxed mb-4">
          {visitorName} ne pourra plus jamais vous envoyer de demande. Cette décision ne peut pas être annulée.
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onDecline(true)}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading !== false && loading.permanent && <Loader2 className="w-4 h-4 animate-spin" />}
            Oui, ne plus l&apos;accueillir
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="w-full border border-slate-200 bg-white text-slate-600 py-3 rounded-xl font-medium text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Non, revenir en arrière
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      <div>
        <button
          type="button"
          onClick={() => onDecline(false)}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-700 py-3 rounded-xl font-medium text-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {loading !== false && !loading.permanent && <Loader2 className="w-4 h-4 animate-spin" />}
          Pas disponible cette fois
        </button>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          {visitorName} pourra vous écrire de nouveau pour un autre live.
        </p>
      </div>
      <div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          className="w-full bg-red-50 text-red-700 py-3 rounded-xl font-medium text-sm hover:bg-red-100 disabled:opacity-50 transition-colors"
        >
          Ne plus accueillir cette personne
        </button>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          {visitorName} ne pourra plus jamais vous envoyer de demande.
        </p>
      </div>
    </div>
  );
}

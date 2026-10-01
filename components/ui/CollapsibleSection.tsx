'use client';

import { useId } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';

interface Props {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Nombre de champs obligatoires restants ; 0 = section complète. `undefined` = aucun état à montrer. */
  remaining?: number;
  /** Mention discrète dans l'en-tête quand `remaining` est absent (ex : « Facultatif »). */
  hint?: string;
  /** Ancre pour faire défiler jusqu'à la section. */
  sectionId?: string;
  children: React.ReactNode;
}

// Carte repliable : l'en-tête reste visible (titre + état de complétude), le contenu se replie.
// Le contenu reste monté (attribut `hidden`) : une photo en cours d'envoi, une vidéo enregistrée ou
// une saisie ne sont jamais perdues en refermant la section.
export default function CollapsibleSection({ title, open, onToggle, remaining, hint, sectionId, children }: Props) {
  const panelId = useId();

  return (
    <section id={sectionId} className="bg-white rounded-2xl border border-slate-100 scroll-mt-20">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="w-full min-h-[56px] flex items-center gap-3 px-5 py-4 text-left rounded-2xl hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
        >
          <span className="flex-1 text-base font-semibold text-slate-800">{title}</span>
          {remaining === undefined && hint && <span className="text-xs text-slate-500">{hint}</span>}
          {remaining === 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Complété
            </span>
          )}
          {remaining !== undefined && remaining > 0 && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
              {remaining} à remplir
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="px-5 pb-5 space-y-5">
        {children}
      </div>
    </section>
  );
}

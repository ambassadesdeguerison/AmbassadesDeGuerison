'use client';

import { useId } from 'react';
import { Check } from 'lucide-react';

interface Props {
  legend: string;
  items: readonly { slug: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

// Sélection multiple en « pastilles » : plus rapide à parcourir au pouce qu'une
// liste de cases à cocher. Chaque pastille est un vrai <button aria-pressed> (44px
// de haut minimum, cf DESIGN.md § Touch targets), navigable au clavier.
export default function ChipGroup({ legend, items, selected, onChange }: Props) {
  const legendId = useId();

  function toggle(slug: string) {
    onChange(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug]);
  }

  return (
    <div role="group" aria-labelledby={legendId}>
      <p id={legendId} className="text-sm text-slate-700 mb-2">
        {legend}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const on = selected.includes(item.slug);
          return (
            <button
              key={item.slug}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(item.slug)}
              className={`inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-full border text-sm transition-colors ${
                on
                  ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-medium'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {on && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

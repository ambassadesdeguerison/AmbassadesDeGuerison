'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export type ComboOption = { id: string; label: string };
export type ComboGroup = { label: string; options: ComboOption[] };

interface Props {
  /** Nom accessible du champ (lu par les lecteurs d'écran). */
  label: string;
  groups: ComboGroup[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}

// Insensible à la casse et aux accents : « ecoute » trouve « À l'écoute de Dieu ».
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Liste déroulante à choix multiples avec recherche et cases à cocher. Plus compacte qu'un
// nuage de pastilles : une seule ligne fermée, la liste ne s'ouvre qu'à la demande.
// Clavier : ↓ ↑ pour parcourir, Entrée pour cocher/décocher, Échap pour fermer.
export default function CheckboxCombobox({
  label,
  groups,
  selected,
  onChange,
  placeholder = 'Sélectionner…',
  searchPlaceholder = 'Rechercher…',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const visibleGroups = useMemo(() => {
    const q = normalizeSearch(query);
    return groups
      .map((g) => ({ ...g, options: g.options.filter((o) => !q || normalizeSearch(o.label).includes(q)) }))
      .filter((g) => g.options.length > 0);
  }, [groups, query]);

  const flat = useMemo(() => visibleGroups.flatMap((g) => g.options), [visibleGroups]);
  // Position de chaque option dans la liste filtrée (pour l'option active au clavier).
  const indexById = useMemo(() => new Map(flat.map((o, i) => [o.id, i])), [flat]);
  const labelById = useMemo(
    () => new Map(groups.flatMap((g) => g.options).map((o) => [o.id, o.label])),
    [groups]
  );
  const selectedLabels = selected.map((id) => labelById.get(id)).filter((l): l is string => Boolean(l));

  // Ferme au clic en dehors.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // À l'ouverture, le curseur est dans le champ de recherche.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  function close() {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
    triggerRef.current?.focus();
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = flat[activeIndex];
      if (option) toggle(option.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  const summary =
    selectedLabels.length === 0
      ? null
      : selectedLabels.length <= 2
        ? selectedLabels.join(', ')
        : `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2}`;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-[44px] flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-left bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
      >
        <span className={`flex-1 truncate ${summary ? 'text-slate-800' : 'text-slate-500'}`}>
          {summary ?? placeholder}
        </span>
        {selectedLabels.length > 0 && (
          <span className="shrink-0 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-0.5">
            {selectedLabels.length}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg">
          <div className="flex items-center gap-2 px-3 border-b border-slate-100">
            <Search className="w-4 h-4 shrink-0 text-slate-500" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={flat[activeIndex] ? `${listboxId}-${flat[activeIndex].id}` : undefined}
              aria-label="Rechercher dans la liste"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder={searchPlaceholder}
              className="w-full py-3 text-sm text-slate-800 placeholder-slate-500 focus:outline-none bg-transparent"
            />
          </div>

          <div id={listboxId} role="listbox" aria-multiselectable="true" aria-label={label} className="max-h-72 overflow-y-auto py-1">
            {flat.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Aucun résultat.</p>}
            {visibleGroups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label}>
                <p className="px-4 pt-3 pb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">{group.label}</p>
                {group.options.map((option) => {
                  const index = indexById.get(option.id) ?? 0;
                  const checked = selected.includes(option.id);
                  return (
                    <div
                      key={option.id}
                      id={`${listboxId}-${option.id}`}
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(option.id)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex items-center gap-3 min-h-[44px] px-4 py-2 cursor-pointer text-sm text-slate-700 ${
                        index === activeIndex ? 'bg-slate-50' : ''
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-5 h-5 shrink-0 rounded border flex items-center justify-center ${
                          checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span>{option.label}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-slate-100">
            <span className="text-xs text-slate-500">
              {selectedLabels.length === 0 ? 'Aucun choix' : `${selectedLabels.length} choisi${selectedLabels.length > 1 ? 's' : ''}`}
            </span>
            <button
              type="button"
              onClick={close}
              className="min-h-[44px] px-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Terminer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

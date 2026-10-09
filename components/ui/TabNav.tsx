'use client';

import { useRef } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon: LucideIcon;
  // Compteur affiché en pastille ambre (ex : demandes en attente). Masqué à 0.
  badge?: number;
  // Précise la pastille pour les lecteurs d'écran (ex : « en attente »).
  badgeLabel?: string;
}

interface Props<T extends string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  ariaLabel: string;
  // Préfixe des id ARIA : le panneau actif doit porter `tabPanelId(idPrefix, id)` et
  // `aria-labelledby={tabButtonId(idPrefix, id)}`.
  idPrefix: string;
  // Position sticky de la barre en desktop, sous l'en-tête de la page. Classe Tailwind littérale
  // (ex : `sm:top-[52px]`) pour que Tailwind la voie dans le code source.
  desktopTopClassName?: string;
}

export const tabButtonId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const tabPanelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

// Barre d'onglets partagée (dashboard ambassadeur, /mon-espace). Mobile : barre fixe en bas,
// pattern natif des apps ; desktop : onglets horizontaux sticky sous l'en-tête. Un seul <nav>
// et un seul jeu de boutons — pas d'id en double, un seul arrêt de tabulation (roving tabindex).
export default function TabNav<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  ariaLabel,
  idPrefix,
  desktopTopClassName = 'sm:top-[52px]',
}: Props<T>) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function select(id: T) {
    onTabChange(id);
    buttonRefs.current[id]?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === -1) return;
    e.preventDefault();
    select(tabs[next].id);
  }

  return (
    <nav
      aria-label={ariaLabel}
      className={`fixed bottom-0 left-0 right-0 z-30 flex bg-white border-t border-slate-100 sm:bottom-auto sm:left-auto sm:right-auto sm:sticky ${desktopTopClassName} sm:z-20 sm:border-t-0 sm:border-b sm:gap-1 sm:px-1`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div role="tablist" className="flex flex-1 sm:flex-none sm:gap-1">
        {tabs.map(({ id, label, icon: Icon, badge, badgeLabel }, index) => {
          const isActive = activeTab === id;
          const count = badge ?? 0;
          return (
            <button
              key={id}
              ref={(el) => { buttonRefs.current[id] = el; }}
              type="button"
              role="tab"
              id={tabButtonId(idPrefix, id)}
              aria-selected={isActive}
              aria-controls={tabPanelId(idPrefix, id)}
              aria-label={count > 0 ? `${label}, ${count}${badgeLabel ? ` ${badgeLabel}` : ''}` : undefined}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-2.5 sm:px-4 sm:py-3 min-h-[44px] relative transition-colors sm:text-sm sm:font-medium sm:border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                isActive
                  ? 'text-indigo-600 sm:border-indigo-600'
                  : 'text-slate-400 sm:text-slate-500 sm:border-transparent sm:hover:text-slate-700'
              }`}
            >
              <span className="relative">
                <Icon className="w-5 h-5 sm:w-4 sm:h-4" aria-hidden="true" />
                {count > 0 && (
                  <span
                    aria-hidden="true"
                    className="sm:hidden absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center bg-amber-500 text-white text-[10px] font-semibold rounded-full"
                  >
                    {count}
                  </span>
                )}
              </span>
              <span className="text-[10px] sm:text-sm font-medium">{label}</span>
              {count > 0 && (
                <span
                  aria-hidden="true"
                  className="hidden sm:flex min-w-[18px] h-[18px] px-1 items-center justify-center bg-amber-500 text-white text-[10px] font-semibold rounded-full"
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

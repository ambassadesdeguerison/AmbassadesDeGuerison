'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import {
  addToast,
  removeToast,
  toastDuration,
  type ToastItem,
  type ToastTone,
} from '@/lib/toast/state';

// Système de notifications de l'application : un message bref, hors du flux de
// la page, qui confirme qu'une action a abouti (ou dit franchement qu'elle a
// échoué).
//
//   const toast = useToast();
//   toast.success('Ambassade validée', { description: 'Un e-mail a été envoyé à …' });
//   toast.warning('Validée, mais e-mail non parti', { description: '…' });
//   toast.error(res.error);
//
// Règles d'usage :
// - Dire ce qui s'est réellement passé. Ne jamais annoncer un e-mail « envoyé »
//   sans que le serveur l'ait confirmé (voir `emailSent` dans les routes API).
// - Une erreur reste aussi affichée près du champ ou du bouton concerné : le
//   message disparaît, l'erreur contextuelle non.
// - Une action dont le résultat se voit déjà à l'écran (une ligne qui change de
//   couleur) n'a pas besoin de notification ; une action dont le résultat est
//   invisible (e-mail parti, ligne qui quitte le filtre actif) en a besoin.
//
// Le fournisseur est monté dans le layout racine : la file survit à
// `router.refresh()` et aux navigations côté client.

type ToastOptions = { description?: string };

export interface ToastApi {
  success: (title: string, options?: ToastOptions) => string;
  error: (title: string, options?: ToastOptions) => string;
  warning: (title: string, options?: ToastOptions) => string;
  info: (title: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast doit être utilisé sous <ToastProvider> (monté dans app/layout.tsx).');
  }
  return api;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((list) => removeToast(list, id));
  }, []);

  const push = useCallback((tone: ToastTone, title: string, options?: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    const description = options?.description;
    setToasts((list) =>
      addToast(list, { id, tone, title, description, duration: toastDuration(tone, title, description) })
    );
    return id;
  }, []);

  // Objet stable : peut figurer dans les dépendances d'un effet (abonnement
  // temps réel, par exemple) sans le relancer à chaque rendu.
  const api = useMemo<ToastApi>(
    () => ({
      success: (title, options) => push('success', title, options),
      error: (title, options) => push('error', title, options),
      warning: (title, options) => push('warning', title, options),
      info: (title, options) => push('info', title, options),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const TONES: Record<
  ToastTone,
  { wrap: string; icon: string; Icon: typeof Info }
> = {
  success: { wrap: 'bg-emerald-50 border-emerald-200 text-emerald-900', icon: 'text-emerald-600', Icon: CircleCheck },
  error:   { wrap: 'bg-red-50 border-red-200 text-red-900',             icon: 'text-red-600',     Icon: CircleAlert },
  warning: { wrap: 'bg-amber-50 border-amber-200 text-amber-900',       icon: 'text-amber-500',   Icon: TriangleAlert },
  info:    { wrap: 'bg-white border-slate-200 text-slate-800',          icon: 'text-indigo-600',  Icon: Info },
};

// La zone est toujours rendue (même vide) : un lecteur d'écran n'annonce de
// façon fiable que le contenu inséré dans une région `aria-live` déjà présente.
// `pointer-events-none` sur la zone, `auto` sur chaque message : la pile ne
// bloque jamais un clic sur la page en dessous.
function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[100] flex flex-col gap-2 pointer-events-none sm:inset-x-auto sm:right-4 sm:w-96"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const { wrap, icon, Icon } = TONES[item.tone];
  const [hovered, setHovered] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const paused = hovered || tabHidden;

  // Le délai ne court pas quand la personne lit (souris ou focus sur le message)
  // ni quand l'onglet est en arrière-plan : elle reviendrait sur un message déjà
  // disparu. Le temps restant est conservé d'une pause à l'autre.
  const remaining = useRef(item.duration);
  useEffect(() => {
    if (paused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => onDismiss(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, item.id, onDismiss]);

  useEffect(() => {
    function onVisibility() {
      setTabHidden(document.visibilityState === 'hidden');
    }
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div
      // Une erreur est annoncée tout de suite ; le reste attend la fin de la phrase en cours.
      role={item.tone === 'error' ? 'alert' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg ${wrap}`}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{item.title}</p>
        {item.description && (
          <p className="text-sm leading-relaxed opacity-90 mt-0.5">{item.description}</p>
        )}
      </div>
      {/* Zone de toucher de 44 px (règle du design system) sans agrandir l'icône. */}
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Fermer la notification"
        className="-my-2 -mr-3 w-11 h-11 shrink-0 flex items-center justify-center rounded-xl opacity-60 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-opacity"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

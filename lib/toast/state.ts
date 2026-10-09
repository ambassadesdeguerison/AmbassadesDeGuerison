// Logique pure du système de notifications (voir components/ui/Toast.tsx).
//
// Séparée du composant pour être testée sans DOM : file d'attente, doublons,
// plafond et durée d'affichage.

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Durée d'affichage en ms. */
  duration: number;
}

/** Au-delà, la plus ancienne disparaît : une pile de 6 messages ne se lit plus. */
export const MAX_TOASTS = 4;

const MIN_DURATION_MS: Record<ToastTone, number> = {
  success: 6_000,
  info: 6_000,
  // Un message qui demande d'agir (e-mail non parti, action refusée) doit
  // rester assez longtemps pour être lu, puis compris, puis recopié si besoin.
  warning: 10_000,
  error: 10_000,
};
const MAX_DURATION_MS = 20_000;
const MS_PER_CHAR = 55;

/**
 * Durée proportionnelle à la longueur du texte : « Ambassade validée » se lit
 * en un coup d'œil, trois phrases d'explication demandent bien plus. Le public
 * de l'app n'est pas toujours à l'aise avec le numérique — mieux vaut un
 * message qui reste que un message lu à moitié.
 */
export function toastDuration(tone: ToastTone, title: string, description?: string): number {
  const chars = title.length + (description?.length ?? 0);
  const reading = 3_000 + chars * MS_PER_CHAR;
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS[tone], reading));
}

function isSame(a: ToastItem, b: ToastItem): boolean {
  return a.tone === b.tone && a.title === b.title && a.description === b.description;
}

/**
 * Ajoute un message en fin de file. Un message identique à un message déjà
 * affiché le remplace (double clic, nouvelle tentative) au lieu de s'empiler,
 * et son délai repart de zéro. Au-delà de MAX_TOASTS, les plus anciens partent.
 */
export function addToast(list: ToastItem[], item: ToastItem): ToastItem[] {
  const next = [...list.filter((t) => !isSame(t, item)), item];
  return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
}

export function removeToast(list: ToastItem[], id: string): ToastItem[] {
  return list.some((t) => t.id === id) ? list.filter((t) => t.id !== id) : list;
}

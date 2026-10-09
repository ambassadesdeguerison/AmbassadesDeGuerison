// Nettoyage du corps envoyé par le questionnaire enrichi (brouillon auto-enregistré
// comme soumission finale). Ne garde que les champs connus, avec le bon type : un
// client ne doit pas pouvoir écrire une colonne arbitraire (`status`, `admin_notes`…)
// ni des slugs inventés dans les listes.

import { BOOK_SLUGS, TRAINING_SLUGS } from './catalog';

export const PRESENTATION_MESSAGE_MAX = 240;
export const LIVE_SCREEN_MAX = 200;

function cleanSlugs(value: unknown, allowed: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === 'string' && allowed.has(v)))];
}

export function sanitizeQuestionnaire(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (b.books_read !== undefined) updates.books_read = cleanSlugs(b.books_read, BOOK_SLUGS);

  if (b.trainings_done !== undefined) {
    const trainings = cleanSlugs(b.trainings_done, TRAINING_SLUGS);
    updates.trainings_done = trainings;
    // Colonne historique lue ailleurs (dashboard, admin) : reste alignée.
    updates.healing_challenge_done = trainings.includes('defi_guerison');
  }

  for (const field of ['conferences_assistees', 'has_seen_healings', 'has_leadership_role'] as const) {
    if (typeof b[field] === 'boolean') updates[field] = b[field];
  }

  for (const field of ['church_attendance', 'denomination', 'parcours_spirituel', 'livres_lus'] as const) {
    if (typeof b[field] === 'string') updates[field] = b[field];
  }

  // Texte public (popup de la carte) : même plafond que `PATCH /api/ambassadeur/profile`.
  if (typeof b.presentation_message === 'string') {
    updates.presentation_message = b.presentation_message.trim().slice(0, PRESENTATION_MESSAGE_MAX) || null;
  }

  if (typeof b.live_screen === 'string') updates.live_screen = b.live_screen.trim().slice(0, LIVE_SCREEN_MAX) || null;

  if (typeof b.leadership_role === 'string') updates.leadership_role = b.leadership_role.trim() || null;
  // Répondre « non » efface la fonction saisie plus tôt (sinon elle resterait affichée à l'admin).
  if (updates.has_leadership_role === false) updates.leadership_role = null;

  return updates;
}

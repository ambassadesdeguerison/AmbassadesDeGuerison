// Catalogue des livres et formations proposés dans le questionnaire enrichi.
//
// Source : https://davidthery.com/en/collections/all (2026-09-30). Une même œuvre
// existe en papier, ebook et livre audio sur la boutique : on ne garde que le
// titre — l'ambassadeur dit « j'ai lu ce livre », pas dans quel format.
//
// Les slugs sont stockés en base (`host_profiles.books_read` / `trainings_done`) :
// ne jamais les renommer, seulement en ajouter. Le libellé, lui, peut évoluer.

export type CatalogItem = { slug: string; label: string };

export const BOOKS: readonly CatalogItem[] = [
  { slug: 'dans-les-bras-du-pere', label: 'Dans les bras du Père' },
  { slug: 'montre-nous-le-pere', label: 'Montre-nous le Père' },
  { slug: 'apprendre-a-jeuner', label: 'Apprendre à jeûner' },
  { slug: 'a-l-ecoute-de-dieu', label: 'À l’écoute de Dieu' },
  { slug: '21-jours-a-l-ecoute-de-dieu', label: '21 jours à l’écoute de Dieu' },
  { slug: 'guerir-les-malades', label: 'Guérir les malades' },
  { slug: 'defi-guerison', label: 'Défi Guérison' },
  { slug: 'rencontre-avec-le-saint-esprit', label: 'Rencontre avec le Saint-Esprit' },
  { slug: 'baptises-dans-le-saint-esprit', label: 'Baptisés dans le Saint-Esprit' },
  { slug: 'joie-surnaturelle', label: 'Joie surnaturelle' },
  { slug: 'vraiment-libre', label: 'Vraiment Libre' },
];

// Formations gratuites en ligne. `defi_guerison` reste aussi reflété dans la colonne
// historique `healing_challenge_done` (lue par le dashboard et l'admin).
export const TRAININGS: readonly CatalogItem[] = [
  { slug: 'defi_guerison', label: 'Défi Guérison (21 jours)' },
  { slug: 'vraiment_libre', label: 'Vraiment Libre (14 jours)' },
];

export const BOOK_SLUGS: ReadonlySet<string> = new Set(BOOKS.map((b) => b.slug));
export const TRAINING_SLUGS: ReadonlySet<string> = new Set(TRAININGS.map((t) => t.slug));

export function labelsFor(items: readonly CatalogItem[], slugs: readonly string[] | null | undefined): string[] {
  if (!slugs?.length) return [];
  const byslug = new Map(items.map((i) => [i.slug, i.label]));
  return slugs.map((s) => byslug.get(s)).filter((l): l is string => Boolean(l));
}

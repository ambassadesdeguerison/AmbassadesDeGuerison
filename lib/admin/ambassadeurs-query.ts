// Tri et préfiltres de /admin/ambassadeurs, pilotés par l'URL (?sort=&dir=&parcours=).
// Tout est liste blanche : une valeur inconnue retombe sur le défaut, jamais dans la requête.

export const SORT_COLUMNS = {
  nom: 'last_name',
  email: 'email',
  ville: 'city',
  inscription: 'created_at',
} as const;

export type SortKey = keyof typeof SORT_COLUMNS;
export type SortDir = 'asc' | 'desc';

export const DEFAULT_SORT: SortKey = 'inscription';
export const DEFAULT_DIR: SortDir = 'desc';

export function parseSort(sort: string | undefined, dir: string | undefined): { sort: SortKey; dir: SortDir } {
  const key = sort && sort in SORT_COLUMNS ? (sort as SortKey) : DEFAULT_SORT;
  // Sans direction explicite, la date démarre par le plus récent, le texte par A→Z.
  const fallback: SortDir = key === DEFAULT_SORT ? DEFAULT_DIR : 'asc';
  return { sort: key, dir: dir === 'asc' || dir === 'desc' ? dir : fallback };
}

// Clic sur un en-tête : même colonne → on inverse, autre colonne → direction naturelle.
export function nextSort(current: { sort: SortKey; dir: SortDir }, clicked: SortKey): { sort: SortKey; dir: SortDir } {
  if (current.sort === clicked) return { sort: clicked, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { sort: clicked, dir: clicked === DEFAULT_SORT ? 'desc' : 'asc' };
}

// Préfiltres « parcours de guérison », cumulables : un candidat est retenu s'il
// correspond à AU MOINS UNE case cochée (OU). Les slugs viennent de
// lib/questionnaire/catalog.ts (jamais renommés). `healing_challenge_done` est la
// colonne historique du Défi Guérison.
export const PARCOURS_OPTIONS = [
  {
    value: 'defi',
    label: 'Défi Guérison (formation ou livre)',
    conditions: ['trainings_done.cs.{defi_guerison}', 'healing_challenge_done.eq.true', 'books_read.cs.{defi-guerison}'],
  },
  { value: 'guerir', label: 'Livre « Guérir les malades »', conditions: ['books_read.cs.{guerir-les-malades}'] },
  {
    value: 'libre',
    label: 'Vraiment Libre (formation ou livre)',
    conditions: ['trainings_done.cs.{vraiment_libre}', 'books_read.cs.{vraiment-libre}'],
  },
  { value: 'vues', label: 'A déjà vu des guérisons', conditions: ['has_seen_healings.eq.true'] },
] as const;

export type ParcoursValue = (typeof PARCOURS_OPTIONS)[number]['value'];

// URL : ?parcours=defi,guerir. Les valeurs inconnues et les doublons sont ignorés.
export function parseParcours(value: string | undefined): ParcoursValue[] {
  const asked = new Set((value ?? '').split(','));
  return PARCOURS_OPTIONS.filter((o) => asked.has(o.value)).map((o) => o.value);
}

// Valeur du paramètre `or=` PostgREST (conditions reliées par OU), ou null si rien n'est coché.
export function parcoursOrFilter(values: readonly ParcoursValue[]): string | null {
  const conditions = PARCOURS_OPTIONS.filter((o) => values.includes(o.value)).flatMap((o) => o.conditions);
  return conditions.length ? conditions.join(',') : null;
}

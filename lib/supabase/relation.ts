/**
 * Une jointure PostgREST (`events(...)`, `host_profiles(...)`) renvoie un objet quand la
 * relation est « vers un », mais les types inférés par supabase-js la décrivent comme un
 * tableau dès qu'ils ne peuvent pas déduire la cardinalité. On normalise : premier élément
 * si tableau, sinon la valeur telle quelle.
 */
export function firstRow<T>(relation: T | T[] | null | undefined): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation ?? null;
}

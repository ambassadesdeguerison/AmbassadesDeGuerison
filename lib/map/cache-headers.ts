// En-têtes de cache de la carte publique (GET /api/host-activations).
//
// La carte se rafraîchit toutes les 5 s chez chaque visiteur ; sans cache, chaque rafraîchissement réveille le
// serveur et la base (cf docs/estimation-couts.md). `s-maxage` ne vaut que pour le CDN de Vercel : le navigateur
// n'a pas de `max-age`, il redemande donc toujours, mais au CDN et non à Supabase.
//
// Durée = MAP_CACHE_SECONDS (0 ou absente = aucun cache). Elle reste à 0 pendant la phase de conception : le
// DevOverlay modifie la base, et un cache de 30 s ferait voir la carte avec 30 à 60 s de retard.
// À mettre à 30 sur Vercel au lancement. Réponses réussies uniquement, jamais les erreurs.

export function mapCacheSeconds(raw: string | undefined = process.env.MAP_CACHE_SECONDS): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 300) : 0;
}

export function mapCacheHeaders(raw?: string): Record<string, string> {
  const seconds = mapCacheSeconds(raw);
  if (seconds === 0) return {};
  return { 'Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}` };
}

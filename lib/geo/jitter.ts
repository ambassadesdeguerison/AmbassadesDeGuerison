// Décalage visuel des pins de la carte publique — voir docs/ARCHITECTURE.md
// § Jitter décoratif carte publique (retour David 2026-09-27).
//
// Ne porte AUCUNE information de localisation réelle : dérivé uniquement de
// host_id (jamais de lat_precise/lng_precise, jamais d'appel /api/distance).
// But unique : éviter que plusieurs ambassadeurs d'une même ville, géocodés au
// même point exact (cf. scripts/seed.js — 6 ambassadeurs Paris partagent des
// coordonnées identiques), s'affichent littéralement empilés au même pixel à
// tous les niveaux de zoom. Un second avis (sous-agent, cf. session
// office-hours) a écarté l'alternative "jitter dérivé de l'adresse réelle,
// façon Airbnb" : elle aurait transformé /api/distance en oracle de
// triangulation amplifié (le point public flouté sert d'ancrage pour raffiner
// localement au lieu de chercher à l'aveugle sur toute une ville) — un risque
// réel pour une app dont le public cible inclut des hôtes en zone rurale à
// faible densité de bâti, où même un rayon de flou de 500m-1km laisse peu de
// candidats plausibles.
//
// Stable entre deux appels (même host_id → même offset) : le pin ne doit
// jamais "sauter" au refresh de la carte publique (MapPublique.tsx recharge
// les pins toutes les 5s via polling).

/** FNV-1a 32 bits — rapide, déterministe, distribution suffisante pour un usage décoratif (pas cryptographique). */
function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hash01(str: string): number {
  return hash32(str) / 0xffffffff;
}

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Décale (lat, lng) d'un offset pseudo-aléatoire mais déterministe, dérivé de
 * `seed` (host_id). Rayon échantillonné en r = R·√u plutôt que r = R·u : à
 * usage décoratif, ça évite que les offsets se concentrent visuellement près
 * du centre (répartition uniforme sur le disque), donc une meilleure
 * séparation visuelle entre plusieurs pins d'une même ville — l'objectif ici,
 * contrairement à un jitter de vie privée, est purement esthétique.
 *
 * @param radiusMeters Rayon maximum du décalage (défaut 250m — assez pour
 *   séparer visuellement des pins à l'échelle d'un quartier, sans jamais
 *   sortir la ville).
 */
export function jitterCoordinates(
  lat: number,
  lng: number,
  seed: string,
  radiusMeters = 250
): { lat: number; lng: number } {
  const angle = hash01(`${seed}:angle`) * 2 * Math.PI;
  const radius = radiusMeters * Math.sqrt(hash01(`${seed}:radius`));
  const dLat = (radius * Math.cos(angle)) / METERS_PER_DEGREE_LAT;
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  // Garde-fou pôles (cos(lat)=0) — n'arrivera jamais en pratique pour une
  // ambassade, mais évite une division par zéro silencieuse (NaN qui ferait
  // disparaître le pin de la carte sans aucune erreur visible).
  const dLng = metersPerDegreeLng !== 0 ? (radius * Math.sin(angle)) / metersPerDegreeLng : 0;
  return { lat: lat + dLat, lng: lng + dLng };
}

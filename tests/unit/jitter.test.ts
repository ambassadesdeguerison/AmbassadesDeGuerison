import { describe, it, expect } from 'vitest';
import { jitterCoordinates } from '@/lib/geo/jitter';

// Distance réelle en mètres (pas l'arrondi au km de haversineKm, trop grossier
// pour vérifier un rayon de quelques centaines de mètres).
function meters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

describe('jitterCoordinates', () => {
  const PARIS = { lat: 48.8698, lng: 2.3315 };

  it('est déterministe : même seed → même offset à chaque appel', () => {
    const a = jitterCoordinates(PARIS.lat, PARIS.lng, 'host-1');
    const b = jitterCoordinates(PARIS.lat, PARIS.lng, 'host-1');
    expect(a).toEqual(b);
  });

  it('produit un offset différent pour deux seeds différents', () => {
    const a = jitterCoordinates(PARIS.lat, PARIS.lng, 'host-1');
    const b = jitterCoordinates(PARIS.lat, PARIS.lng, 'host-2');
    expect(a).not.toEqual(b);
  });

  it('reste dans le rayon demandé (jamais au-delà, marge de flottant incluse)', () => {
    // 20 seeds distincts pour couvrir la distribution, pas juste un point de chance.
    for (let i = 0; i < 20; i++) {
      const { lat, lng } = jitterCoordinates(PARIS.lat, PARIS.lng, `host-${i}`, 250);
      const d = meters(PARIS.lat, PARIS.lng, lat, lng);
      expect(d).toBeLessThanOrEqual(250 + 0.01);
    }
  });

  it('ne retourne jamais un offset nul (le point bouge vraiment)', () => {
    // hash01 pourrait en théorie tomber sur radius=0 (u=0) — extrêmement
    // improbable en pratique (1 chance sur 2^32) mais on vérifie sur un
    // échantillon que ça ne dégénère pas silencieusement pour des seeds réels.
    for (let i = 0; i < 20; i++) {
      const { lat, lng } = jitterCoordinates(PARIS.lat, PARIS.lng, `host-${i}`);
      expect(lat !== PARIS.lat || lng !== PARIS.lng).toBe(true);
    }
  });

  it('sépare visuellement plusieurs hôtes de la même ville (cas seed Paris)', () => {
    // Reproduit le cas réel de scripts/seed.js : 6 ambassadeurs Paris avec des
    // lat/lng identiques avant jitter — après jitter, aucune paire ne doit
    // retomber sur des coordonnées identiques.
    const ids = ['marie', 'lucas', 'paris-3e', 'paris-7e', 'paris-11e', 'paris-20e'];
    const jittered = ids.map((id) => jitterCoordinates(PARIS.lat, PARIS.lng, id));
    const unique = new Set(jittered.map((p) => `${p.lat},${p.lng}`));
    expect(unique.size).toBe(ids.length);
  });

  it("n'explose pas près des pôles (garde-fou cos(lat)=0)", () => {
    const { lat, lng } = jitterCoordinates(90, 0, 'pole-host');
    expect(Number.isFinite(lat)).toBe(true);
    expect(Number.isFinite(lng)).toBe(true);
  });

  it('respecte un rayon custom plus petit', () => {
    for (let i = 0; i < 10; i++) {
      const { lat, lng } = jitterCoordinates(PARIS.lat, PARIS.lng, `tight-${i}`, 50);
      const d = meters(PARIS.lat, PARIS.lng, lat, lng);
      expect(d).toBeLessThanOrEqual(50 + 0.01);
    }
  });
});

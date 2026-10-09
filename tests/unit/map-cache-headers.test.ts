import { describe, it, expect } from 'vitest';
import { mapCacheSeconds, mapCacheHeaders } from '@/lib/map/cache-headers';

describe('cache de la carte publique', () => {
  it('est désactivé par défaut (absent, vide, 0, négatif, illisible)', () => {
    for (const raw of [undefined, '', '0', '-5', 'abc', 'NaN']) {
      expect(mapCacheSeconds(raw)).toBe(0);
      expect(mapCacheHeaders(raw)).toEqual({});
    }
  });

  it('produit s-maxage et stale-while-revalidate, sans max-age navigateur', () => {
    const h = mapCacheHeaders('30');
    expect(h['Cache-Control']).toBe('public, s-maxage=30, stale-while-revalidate=60');
    expect(h['Cache-Control']).not.toMatch(/(^|[ ,])max-age/);
  });

  it('plafonne à 300 s et arrondit à l\'entier', () => {
    expect(mapCacheSeconds('99999')).toBe(300);
    expect(mapCacheSeconds('12.9')).toBe(12);
  });
});

import { describe, it, expect } from 'vitest';
import { parseSort, nextSort, parseParcours, parcoursOrFilter } from '@/lib/admin/ambassadeurs-query';

describe('parseSort', () => {
  it('retombe sur les inscriptions récentes par défaut', () => {
    expect(parseSort(undefined, undefined)).toEqual({ sort: 'inscription', dir: 'desc' });
  });
  it('ignore une colonne ou une direction inconnue', () => {
    expect(parseSort('password; drop', 'sideways')).toEqual({ sort: 'inscription', dir: 'desc' });
  });
  it('trie le texte de A à Z sans direction explicite', () => {
    expect(parseSort('nom', undefined)).toEqual({ sort: 'nom', dir: 'asc' });
  });
});

describe('nextSort', () => {
  it('inverse la direction sur la même colonne', () => {
    expect(nextSort({ sort: 'nom', dir: 'asc' }, 'nom')).toEqual({ sort: 'nom', dir: 'desc' });
  });
  it('prend la direction naturelle sur une autre colonne', () => {
    expect(nextSort({ sort: 'nom', dir: 'desc' }, 'inscription')).toEqual({ sort: 'inscription', dir: 'desc' });
    expect(nextSort({ sort: 'inscription', dir: 'desc' }, 'ville')).toEqual({ sort: 'ville', dir: 'asc' });
  });
});

describe('parcours', () => {
  it('ignore les valeurs inconnues et les doublons', () => {
    expect(parseParcours('x,defi,defi')).toEqual(['defi']);
    expect(parcoursOrFilter([])).toBeNull();
  });
  it('le Défi Guérison couvre formation, colonne historique et livre', () => {
    const f = parcoursOrFilter(['defi'])!;
    expect(f).toContain('trainings_done.cs.{defi_guerison}');
    expect(f).toContain('healing_challenge_done.eq.true');
    expect(f).toContain('books_read.cs.{defi-guerison}');
  });
  it('Vraiment Libre couvre la formation et le livre', () => {
    const f = parcoursOrFilter(['libre'])!;
    expect(f).toContain('trainings_done.cs.{vraiment_libre}');
    expect(f).toContain('books_read.cs.{vraiment-libre}');
  });
  it('plusieurs cases cochées se cumulent en OU', () => {
    const f = parcoursOrFilter(['defi', 'guerir'])!;
    expect(f).toContain('defi_guerison');
    expect(f).toContain('guerir-les-malades');
    expect(f).not.toContain('has_seen_healings');
  });
});

import { describe, it, expect } from 'vitest';
import { sanitizeQuestionnaire } from '@/lib/questionnaire/sanitize';
import { BOOKS, TRAININGS, labelsFor } from '@/lib/questionnaire/catalog';

describe('sanitizeQuestionnaire', () => {
  it('ignore tout champ inconnu (status, admin_notes…)', () => {
    const out = sanitizeQuestionnaire({ status: 'validated', admin_notes: 'x', denomination: 'baptiste' });
    expect(out).toEqual({ denomination: 'baptiste' });
  });

  it('filtre les slugs inconnus et dédoublonne', () => {
    const out = sanitizeQuestionnaire({
      books_read: ['guerir-les-malades', 'guerir-les-malades', 'inventé', 42],
    });
    expect(out.books_read).toEqual(['guerir-les-malades']);
  });

  it('aligne healing_challenge_done sur la formation Défi Guérison', () => {
    expect(sanitizeQuestionnaire({ trainings_done: ['defi_guerison', 'vraiment_libre'] })).toMatchObject({
      trainings_done: ['defi_guerison', 'vraiment_libre'],
      healing_challenge_done: true,
    });
    expect(sanitizeQuestionnaire({ trainings_done: ['vraiment_libre'] })).toMatchObject({
      healing_challenge_done: false,
    });
  });

  it('ne touche pas healing_challenge_done si trainings_done est absent', () => {
    expect(sanitizeQuestionnaire({ denomination: 'x' })).not.toHaveProperty('healing_challenge_done');
  });

  it('n’accepte que de vrais booléens', () => {
    const out = sanitizeQuestionnaire({ has_seen_healings: 'true', has_leadership_role: true });
    expect(out).toEqual({ has_leadership_role: true });
  });

  it('« non » à la responsabilité efface la fonction saisie', () => {
    expect(sanitizeQuestionnaire({ has_leadership_role: false, leadership_role: 'Diacre' })).toMatchObject({
      has_leadership_role: false,
      leadership_role: null,
    });
  });

  it('une fonction vide devient null', () => {
    expect(sanitizeQuestionnaire({ leadership_role: '   ' })).toEqual({ leadership_role: null });
  });

  it('corps invalide → aucune mise à jour', () => {
    expect(sanitizeQuestionnaire(null)).toEqual({});
    expect(sanitizeQuestionnaire('x')).toEqual({});
  });
});

describe('catalogue', () => {
  it('slugs uniques dans chaque liste', () => {
    for (const list of [BOOKS, TRAININGS]) {
      expect(new Set(list.map((i) => i.slug)).size).toBe(list.length);
    }
  });

  it('labelsFor ignore les slugs retirés du catalogue', () => {
    expect(labelsFor(BOOKS, ['guerir-les-malades', 'obsolete'])).toEqual(['Guérir les malades']);
    expect(labelsFor(BOOKS, null)).toEqual([]);
  });
});

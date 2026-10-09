import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BackToRequests, { cameFromMonEspace } from '@/components/visitor/BackToRequests';

// Régression (QA 2026-10-09) : depuis /mon-espace, un clic sur « Suivre ma demande » menait à
// /visitor/[token] sans barre d'onglets ni lien de retour — le visiteur perdait sa liste.
// Les pages à jeton s'ouvrent aussi depuis un e-mail (sans session) : le lien de retour ne doit
// apparaître que si le visiteur vient de /mon-espace.

describe('cameFromMonEspace', () => {
  it('vrai uniquement pour ?from=mon-espace', () => {
    expect(cameFromMonEspace('mon-espace')).toBe(true);
    expect(cameFromMonEspace(undefined)).toBe(false);
    expect(cameFromMonEspace('autre')).toBe(false);
    expect(cameFromMonEspace(['mon-espace', 'x'])).toBe(false);
  });
});

describe('BackToRequests', () => {
  it('ramène à l’onglet Demandes', () => {
    render(<BackToRequests />);
    expect(screen.getByRole('link', { name: /mes demandes/i }).getAttribute('href')).toBe('/mon-espace?onglet=demandes');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import InscriptionSuccess from '@/components/InscriptionSuccess';

// Régression (2026-10-01) : après le formulaire « Devenir ambassadeur », l'écran de confirmation
// demandait « Appuyez sur le bouton pour vous connecter » même quand la personne était déjà connectée
// avec cette adresse.

describe('InscriptionSuccess', () => {
  it('connecté : ne demande pas de se connecter et enchaîne sur /dashboard', () => {
    render(<InscriptionSuccess email="jean@example.com" connected />);

    expect(screen.queryByText(/pour vous connecter/i)).toBeNull();
    const cta = screen.getByRole('link', { name: /continuer mon inscription/i });
    expect(cta.getAttribute('href')).toBe('/dashboard');
    expect(screen.getByText(/regarder la courte vidéo de formation/i)).toBeTruthy();
  });

  it('non connecté : renvoie vers /auth et invite à se connecter', () => {
    render(<InscriptionSuccess email="jean@example.com" connected={false} />);

    expect(screen.getByText(/appuyez sur le bouton dans ce message pour vous connecter/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /me connecter pour continuer/i }).getAttribute('href')).toBe('/auth');
  });

  it("mentionne l'adresse e-mail dans les deux cas", () => {
    const { unmount } = render(<InscriptionSuccess email="jean@example.com" connected />);
    expect(screen.getByText('jean@example.com')).toBeTruthy();
    unmount();
    render(<InscriptionSuccess email="jean@example.com" connected={false} />);
    expect(screen.getByText('jean@example.com')).toBeTruthy();
  });
});

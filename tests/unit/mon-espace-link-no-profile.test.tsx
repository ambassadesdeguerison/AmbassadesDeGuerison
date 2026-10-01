import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Régression (2026-10-01) : un compte connecté SANS profil (compte créé par une connexion sans
// inscription, ou profil supprimé) était traité comme un ambassadeur : requête
// host_profiles.single() -> PGRST116 (0 ligne), avatar « ? », bouton « Devenir ambassadeur » masqué,
// et le clic menait à /dashboard qui renvoyait silencieusement vers /auth.

const { mockGetUser, mockMaybeSingle } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockMaybeSingle: vi.fn(),
}));

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }),
    storage: { from: () => ({ createSignedUrl: vi.fn().mockResolvedValue({ data: null }) }) },
  }),
}));

import MonEspaceLink from '@/components/MonEspaceLink';

describe('MonEspaceLink — compte connecté sans profil', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockMaybeSingle.mockReset();
  });

  it("signale le rôle « none », pointe vers /auth et n'affiche pas d'avatar « ? »", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'tagne@example.com', user_metadata: { role: 'host' } } } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const onRoleResolved = vi.fn();

    render(<MonEspaceLink onRoleResolved={onRoleResolved} />);

    await waitFor(() => expect(onRoleResolved).toHaveBeenCalledWith('none'));
    expect(onRoleResolved).not.toHaveBeenCalledWith('host');

    const link = screen.getByRole('link', { name: /mon compte/i });
    expect(link.getAttribute('href')).toBe('/auth');
    expect(link.textContent).toContain('T'); // initiale de l'e-mail, jamais « ? »
    expect(link.textContent).not.toContain('?');
  });

  it("un ambassadeur avec profil reste « host » et pointe vers /dashboard", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u2', email: 'a@example.com', user_metadata: { role: 'host' } } } });
    mockMaybeSingle.mockResolvedValue({ data: { first_name: 'Marie', profile_photo_url: null }, error: null });
    const onRoleResolved = vi.fn();

    render(<MonEspaceLink onRoleResolved={onRoleResolved} />);

    await waitFor(() => expect(onRoleResolved).toHaveBeenCalledWith('host'));
    expect(screen.getByRole('link', { name: /mon espace/i }).getAttribute('href')).toBe('/dashboard');
  });

  it('sans session : rien à afficher, rôle null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const onRoleResolved = vi.fn();

    const { container } = render(<MonEspaceLink onRoleResolved={onRoleResolved} />);

    await waitFor(() => expect(onRoleResolved).toHaveBeenCalledWith(null));
    expect(container.querySelector('a')).toBeNull();
  });
});

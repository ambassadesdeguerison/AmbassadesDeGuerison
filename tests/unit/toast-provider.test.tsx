import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, useToast } from '@/components/ui/Toast';

// Composant de test : un bouton par type de notification.
function Demo() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Ambassade validée', { description: 'E-mail envoyé à camille@example.com.' })}>
        succès
      </button>
      <button onClick={() => toast.error('Échec')}>erreur</button>
      <button onClick={() => toast.warning('Validée, mais l’e-mail n’est pas parti')}>avertissement</button>
    </div>
  );
}

function setup() {
  return render(
    <ToastProvider>
      <Demo />
    </ToastProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ToastProvider / useToast', () => {
  it("rend la zone de notifications dès le départ, vide, pour que l'annonce vocale fonctionne", () => {
    setup();
    const region = screen.getByLabelText('Notifications');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.children).toHaveLength(0);
  });

  it('affiche le titre et la description', () => {
    setup();
    fireEvent.click(screen.getByText('succès'));
    expect(screen.getByText('Ambassade validée')).toBeTruthy();
    expect(screen.getByText('E-mail envoyé à camille@example.com.')).toBeTruthy();
  });

  it('annonce une erreur comme alerte, pas un succès', () => {
    setup();
    fireEvent.click(screen.getByText('erreur'));
    expect(screen.getByRole('alert').textContent).toContain('Échec');

    cleanup();
    setup();
    fireEvent.click(screen.getByText('succès'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('se ferme au clic sur le bouton de fermeture', () => {
    setup();
    fireEvent.click(screen.getByText('succès'));
    fireEvent.click(screen.getByRole('button', { name: 'Fermer la notification' }));
    expect(screen.queryByText('Ambassade validée')).toBeNull();
  });

  it('un double clic ne produit pas deux messages identiques', () => {
    setup();
    fireEvent.click(screen.getByText('succès'));
    fireEvent.click(screen.getByText('succès'));
    expect(screen.getAllByText('Ambassade validée')).toHaveLength(1);
  });

  it('disparaît seul au bout du délai', () => {
    vi.useFakeTimers();
    setup();
    fireEvent.click(screen.getByText('succès'));
    expect(screen.getByText('Ambassade validée')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.queryByText('Ambassade validée')).toBeNull();
  });

  it('un avertissement reste plus longtemps qu’un succès court', () => {
    vi.useFakeTimers();
    setup();
    fireEvent.click(screen.getByText('avertissement'));

    act(() => { vi.advanceTimersByTime(8_000); });
    expect(screen.getByText(/mais l’e-mail n’est pas parti/)).toBeTruthy();

    act(() => { vi.advanceTimersByTime(8_000); });
    expect(screen.queryByText(/mais l’e-mail n’est pas parti/)).toBeNull();
  });

  it('ne disparaît pas tant que la souris est dessus, puis reprend', () => {
    vi.useFakeTimers();
    setup();
    fireEvent.click(screen.getByText('erreur'));
    const card = screen.getByRole('alert');

    fireEvent.mouseEnter(card);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByText('Échec')).toBeTruthy();

    fireEvent.mouseLeave(card);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.queryByText('Échec')).toBeNull();
  });

  it('useToast hors fournisseur échoue avec un message explicite', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Demo />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

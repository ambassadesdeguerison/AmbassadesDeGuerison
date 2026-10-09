import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import MesDemandes from '@/components/MesDemandes';
import type { VisitorRequest } from '@/lib/visitor/group-requests';

const H = 3_600_000;
const iso = (offsetHours: number) => new Date(Date.now() + offsetHours * H).toISOString();

function req(overrides: Partial<VisitorRequest> & { id: string }): VisitorRequest {
  return {
    status: 'pending',
    nb_personnes: 1,
    created_at: iso(-100),
    event_id: 'ev1',
    event_title: 'Live',
    event_date: iso(72),
    event_closed_at: null,
    visitor_token: `tok-${overrides.id}`,
    host_first_name: 'Marie',
    host_city: 'Nantes',
    host_country: 'France',
    ...overrides,
  };
}

describe('MesDemandes', () => {
  it('chargement : pas de liste', () => {
    render(<MesDemandes requests={null} failed={false} />);
    expect(screen.getByLabelText(/chargement de vos demandes/i)).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('échec : message sans détail technique', () => {
    render(<MesDemandes requests={null} failed />);
    expect(screen.getByText(/ne peuvent pas être affichées/i)).toBeTruthy();
  });

  it('aucune demande : renvoie vers la carte et vers le guide', () => {
    const onOpenGuide = vi.fn();
    render(<MesDemandes requests={[]} failed={false} onOpenGuide={onOpenGuide} />);
    expect(screen.getByText(/pas encore fait de demande/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /voir la carte/i }).getAttribute('href')).toBe('/');
    fireEvent.click(screen.getByRole('button', { name: /lire le guide/i }));
    expect(onOpenGuide).toHaveBeenCalled();
  });

  it('en cours : résumé, suivi d’une demande en attente, détails d’une acceptée', () => {
    render(
      <MesDemandes
        requests={[
          req({ id: 'p', status: 'pending', host_first_name: 'Paul', event_date: iso(96) }),
          req({ id: 'a', status: 'accepted', host_first_name: 'Anne', event_date: iso(48) }),
        ]}
        failed={false}
      />,
    );
    expect(screen.getByText('1 en attente')).toBeTruthy();
    expect(screen.getByText('1 acceptée')).toBeTruthy();
    expect(screen.getByRole('link', { name: /suivre ma demande/i }).getAttribute('href')).toBe('/visitor/tok-p');
    expect(screen.getByRole('link', { name: /voir les détails/i }).getAttribute('href')).toBe('/visitor/tok-a');
    // l'acceptée (live le plus proche) passe en premier
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Anne');
    expect(items[1].textContent).toContain('Paul');
  });

  it('sans demande en cours : le dit, et garde l’historique replié', () => {
    render(
      <MesDemandes
        requests={[req({ id: 'old', status: 'declined', event_date: iso(-500) })]}
        failed={false}
      />,
    );
    expect(screen.getByText(/aucune demande en cours/i)).toBeTruthy();
    const toggle = screen.getByRole('button', { name: /historique \(1\)/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)?.hidden).toBe(true);
  });

  it('historique : se déplie, puis « Voir plus » par paquets de 5', () => {
    const past = Array.from({ length: 7 }, (_, i) =>
      req({ id: `h${i}`, status: 'declined', event_date: iso(-100 - i * 24), host_first_name: `H${i}` }),
    );
    render(<MesDemandes requests={past} failed={false} />);

    fireEvent.click(screen.getByRole('button', { name: /historique \(7\)/i }));
    const panel = document.getElementById(
      screen.getByRole('button', { name: /historique \(7\)/i }).getAttribute('aria-controls')!,
    )!;
    expect(panel.hidden).toBe(false);
    expect(within(panel).getAllByRole('listitem')).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: /voir plus \(2\)/i }));
    expect(within(panel).getAllByRole('listitem')).toHaveLength(7);
    expect(screen.queryByRole('button', { name: /voir plus/i })).toBeNull();
  });

  it('acceptée dont le live est passé : propose de donner son avis (feedback)', () => {
    render(
      <MesDemandes
        requests={[req({ id: 'f', status: 'accepted', event_date: iso(-72) })]}
        failed={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /historique/i }));
    expect(screen.getByRole('link', { name: /donner mon avis/i }).getAttribute('href')).toBe('/feedback/tok-f');
  });

  it('refusée pour un live à venir : propose une autre ambassade', () => {
    render(
      <MesDemandes
        requests={[req({ id: 'd', status: 'declined', event_date: iso(48) })]}
        failed={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /historique/i }));
    expect(screen.getByRole('link', { name: /chercher une autre ambassade/i }).getAttribute('href')).toBe('/');
  });

  it('une demande restée en attente après le live s’affiche « Sans réponse »', () => {
    render(
      <MesDemandes
        requests={[req({ id: 'z', status: 'pending', event_date: iso(-72) })]}
        failed={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /historique/i }));
    expect(screen.getByText('Sans réponse')).toBeTruthy();
    expect(screen.queryByText('En attente de réponse')).toBeNull();
  });

  it('le lien d’aide à l’équipe est toujours présent', () => {
    render(<MesDemandes requests={[req({ id: 'x' })]} failed={false} />);
    expect(screen.getByRole('link', { name: /écrire à l.équipe/i }).getAttribute('href')).toBe('/contact-equipe');
  });
});

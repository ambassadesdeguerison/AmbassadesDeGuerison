import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Home, MessageSquare, UserCircle } from 'lucide-react';
import TabNav, { tabButtonId, tabPanelId, type TabItem } from '@/components/ui/TabNav';

type Id = 'a' | 'b' | 'c';

const tabs: TabItem<Id>[] = [
  { id: 'a', label: 'Accueil', icon: Home },
  { id: 'b', label: 'Demandes', icon: MessageSquare, badge: 2, badgeLabel: 'en attente' },
  { id: 'c', label: 'Profil', icon: UserCircle },
];

function setup(activeTab: Id = 'a') {
  const onTabChange = vi.fn();
  render(<TabNav tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} ariaLabel="Navigation test" idPrefix="t" />);
  return onTabChange;
}

describe('TabNav', () => {
  it('expose une liste d’onglets avec l’onglet actif sélectionné', () => {
    setup('b');
    expect(screen.getByRole('tablist')).toBeTruthy();
    const all = screen.getAllByRole('tab');
    expect(all).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /^Accueil$/ }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: /Demandes/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('relie chaque onglet à son panneau par des id uniques', () => {
    setup();
    const tab = screen.getByRole('tab', { name: /^Accueil$/ });
    expect(tab.id).toBe(tabButtonId('t', 'a'));
    expect(tab.getAttribute('aria-controls')).toBe(tabPanelId('t', 'a'));
    const ids = screen.getAllByRole('tab').map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('annonce la pastille aux lecteurs d’écran', () => {
    setup();
    expect(screen.getByRole('tab', { name: 'Demandes, 2 en attente' })).toBeTruthy();
  });

  it('pas de pastille à 0', () => {
    render(
      <TabNav
        tabs={[{ id: 'a', label: 'Demandes', icon: Home, badge: 0, badgeLabel: 'en attente' }]}
        activeTab="a"
        onTabChange={() => {}}
        ariaLabel="x"
        idPrefix="z"
      />,
    );
    expect(screen.getByRole('tab', { name: 'Demandes' })).toBeTruthy();
  });

  it('un clic change d’onglet', () => {
    const onTabChange = setup('a');
    fireEvent.click(screen.getByRole('tab', { name: /Profil/ }));
    expect(onTabChange).toHaveBeenCalledWith('c');
  });

  it('un seul arrêt de tabulation : l’onglet actif', () => {
    setup('b');
    const focusable = screen.getAllByRole('tab').filter((t) => t.tabIndex === 0);
    expect(focusable).toHaveLength(1);
    expect(focusable[0].id).toBe(tabButtonId('t', 'b'));
  });

  it('les flèches, Début et Fin naviguent entre les onglets', () => {
    const onTabChange = setup('a');
    const first = screen.getByRole('tab', { name: /^Accueil$/ });
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(onTabChange).toHaveBeenLastCalledWith('b');
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(onTabChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(first, { key: 'End' });
    expect(onTabChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(screen.getByRole('tab', { name: /Profil/ }), { key: 'Home' });
    expect(onTabChange).toHaveBeenLastCalledWith('a');
  });
});

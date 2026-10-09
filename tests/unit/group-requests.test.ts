import { describe, it, expect } from 'vitest';
import {
  displayStatus,
  groupRequests,
  isLiveOver,
  requestAction,
  type VisitorRequest,
} from '@/lib/visitor/group-requests';

const NOW = new Date('2026-10-09T12:00:00Z');
const H = 3_600_000;

function iso(offsetHours: number): string {
  return new Date(NOW.getTime() + offsetHours * H).toISOString();
}

function req(overrides: Partial<VisitorRequest> & { id: string }): VisitorRequest {
  return {
    status: 'pending',
    nb_personnes: 1,
    created_at: iso(-48),
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

describe('isLiveOver', () => {
  it('un live à venir n’est pas terminé', () => {
    expect(isLiveOver({ event_date: iso(2), event_closed_at: null }, NOW, 4)).toBe(false);
  });

  it('un live commencé depuis moins de la fenêtre est encore en cours', () => {
    expect(isLiveOver({ event_date: iso(-3), event_closed_at: null }, NOW, 4)).toBe(false);
  });

  it('un live dont la fenêtre est écoulée est terminé', () => {
    expect(isLiveOver({ event_date: iso(-5), event_closed_at: null }, NOW, 4)).toBe(true);
  });

  it('un live clôturé est terminé même dans sa fenêtre horaire', () => {
    expect(isLiveOver({ event_date: iso(-1), event_closed_at: iso(-0.5) }, NOW, 4)).toBe(true);
  });

  it('sans date de live on range avec le passé', () => {
    expect(isLiveOver({ event_date: null, event_closed_at: null }, NOW, 4)).toBe(true);
  });
});

describe('groupRequests', () => {
  it('liste vide', () => {
    expect(groupRequests([], NOW, 4)).toEqual({ active: [], history: [], pendingCount: 0, acceptedCount: 0 });
  });

  it('range en cours / historique selon statut et date du live', () => {
    const g = groupRequests(
      [
        req({ id: 'pending-future', status: 'pending', event_date: iso(48) }),
        req({ id: 'accepted-future', status: 'accepted', event_date: iso(24) }),
        req({ id: 'declined-future', status: 'declined', event_date: iso(24) }),
        req({ id: 'accepted-past', status: 'accepted', event_date: iso(-72) }),
        req({ id: 'pending-past', status: 'pending', event_date: iso(-72) }),
        req({ id: 'closed', status: 'accepted', event_date: iso(-1), event_closed_at: iso(-0.5) }),
      ],
      NOW,
      4,
    );
    expect(g.active.map((r) => r.id)).toEqual(['accepted-future', 'pending-future']);
    expect(g.history.map((r) => r.id).sort()).toEqual(
      ['accepted-past', 'closed', 'declined-future', 'pending-past'].sort(),
    );
    expect(g.pendingCount).toBe(1);
    expect(g.acceptedCount).toBe(1);
  });

  it('en cours : le live le plus proche d’abord, l’acceptée avant l’en-attente à date égale', () => {
    const g = groupRequests(
      [
        req({ id: 'late', status: 'accepted', event_date: iso(200) }),
        req({ id: 'same-pending', status: 'pending', event_date: iso(24) }),
        req({ id: 'same-accepted', status: 'accepted', event_date: iso(24) }),
        req({ id: 'soon', status: 'pending', event_date: iso(2) }),
      ],
      NOW,
      4,
    );
    expect(g.active.map((r) => r.id)).toEqual(['soon', 'same-accepted', 'same-pending', 'late']);
  });

  it('historique : le plus récent d’abord', () => {
    const g = groupRequests(
      [
        req({ id: 'old', status: 'declined', event_date: iso(-1000) }),
        req({ id: 'recent', status: 'declined', event_date: iso(-100) }),
        req({ id: 'middle', status: 'cancelled_no_response', event_date: iso(-500) }),
      ],
      NOW,
      4,
    );
    expect(g.history.map((r) => r.id)).toEqual(['recent', 'middle', 'old']);
  });

  it('le badge ne compte pas une demande en attente d’un live déjà passé', () => {
    const g = groupRequests([req({ id: 'dead', status: 'pending', event_date: iso(-72) })], NOW, 4);
    expect(g.pendingCount).toBe(0);
  });
});

describe('displayStatus', () => {
  it('une demande restée en attente après le live s’affiche « sans réponse »', () => {
    expect(displayStatus(req({ id: 'a', status: 'pending', event_date: iso(-72) }), NOW, 4)).toBe('cancelled_no_response');
  });

  it('une demande en attente pour un live à venir reste en attente', () => {
    expect(displayStatus(req({ id: 'a', status: 'pending', event_date: iso(24) }), NOW, 4)).toBe('pending');
  });

  it('les autres statuts ne changent pas', () => {
    expect(displayStatus(req({ id: 'a', status: 'accepted', event_date: iso(-72) }), NOW, 4)).toBe('accepted');
    expect(displayStatus(req({ id: 'a', status: 'declined', event_date: iso(-72) }), NOW, 4)).toBe('declined');
  });
});

describe('requestAction', () => {
  it('en attente, live à venir : suivre la demande', () => {
    expect(requestAction(req({ id: 'a', status: 'pending' }), NOW, 4)).toBe('track');
  });

  it('acceptée, live à venir : voir les détails', () => {
    expect(requestAction(req({ id: 'a', status: 'accepted' }), NOW, 4)).toBe('details');
  });

  it('acceptée, live passé : donner son avis', () => {
    expect(requestAction(req({ id: 'a', status: 'accepted', event_date: iso(-72) }), NOW, 4)).toBe('feedback');
  });

  it('refusée ou sans réponse, live à venir : chercher une autre ambassade', () => {
    expect(requestAction(req({ id: 'a', status: 'declined' }), NOW, 4)).toBe('find_other');
    expect(requestAction(req({ id: 'b', status: 'cancelled_no_response' }), NOW, 4)).toBe('find_other');
  });

  it('refusée ou en attente, live passé : aucune action', () => {
    expect(requestAction(req({ id: 'a', status: 'declined', event_date: iso(-72) }), NOW, 4)).toBeNull();
    expect(requestAction(req({ id: 'b', status: 'pending', event_date: iso(-72) }), NOW, 4)).toBeNull();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// GET /api/visitor/requests alimente « Demandes » dans /mon-espace. Il renvoie `visitor_token`
// (jeton du visiteur : suivi et avis, aucun pouvoir d'acceptation) mais jamais `action_token`
// (jeton de l'hôte) ni `declined_permanently`, même si la ligne en base les porte.

const HOST_TOKEN = 'host-action-token';

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  }),
}));

const requestRow = {
  id: 'r1',
  status: 'declined',
  nb_personnes: 2,
  created_at: '2026-10-01T10:00:00Z',
  visitor_token: 'visitor-token-1',
  action_token: HOST_TOKEN,
  declined_permanently: true,
  host_activations: {
    events: { id: 'ev1', title: 'Live', event_date: '2026-10-20T18:00:00Z', closed_at: null },
    host_profiles: { first_name: 'Marie', city: 'Nantes', country: 'France' },
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order', 'limit']) q[m] = () => q;
      q.maybeSingle = async () => ({ data: table === 'visitor_profiles' ? { id: 'vp1' } : null, error: null });
      q.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: table === 'contact_requests' ? [requestRow] : null, error: null });
      return q;
    },
  }),
}));

import { GET } from '@/app/api/visitor/requests/route';

describe('GET /api/visitor/requests', () => {
  it('renvoie visitor_token, event_id et event_closed_at, jamais action_token', async () => {
    const res = await GET(new NextRequest('http://localhost/api/visitor/requests'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toHaveLength(1);

    const r = body.requests[0];
    expect(r.visitor_token).toBe('visitor-token-1');
    expect(r.event_id).toBe('ev1');
    expect(r.event_closed_at).toBeNull();
    expect(r.status).toBe('declined');

    expect(r).not.toHaveProperty('action_token');
    expect(r).not.toHaveProperty('declined_permanently');
    expect(JSON.stringify(body)).not.toContain(HOST_TOKEN);
  });
});

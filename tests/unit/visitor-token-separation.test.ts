import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';

// `action_token` autorise l'acceptation d'une demande (POST /accept n'a pas d'auth) : il ne doit
// jamais atteindre le visiteur. Le visiteur reçoit `visitor_token`, qui ne donne aucun pouvoir.

const HOST_TOKEN = 'host-action-token';
const VISITOR_TOKEN = 'visitor-token';

const sendAcceptationVisite = vi.fn().mockResolvedValue({});
const sendNewContactRequestHost = vi.fn().mockResolvedValue({});

vi.mock('@/lib/email/templates', () => ({
  sendAcceptationVisite: (...a: unknown[]) => sendAcceptationVisite(...a),
  sendNewContactRequestHost: (...a: unknown[]) => sendNewContactRequestHost(...a),
}));
vi.mock('@/config/features', () => ({ FEATURES: { EMAIL_NOTIFICATIONS: true } }));
vi.mock('@/lib/timing-config', () => ({ getTimingConfig: async () => ({ max_requests_per_visitor_per_event: 3 }) }));
vi.mock('@/lib/visitor/request-limit', () => ({
  countActiveRequests: async () => 0,
  requestLimitMessage: () => 'limite',
}));
vi.mock('@/lib/visitor/declined-by-host', () => ({
  wasDeclinedByHost: async () => false,
  DECLINED_BY_HOST_MESSAGE: 'refusé',
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1', user_metadata: { role: 'visitor' } } } }) },
  }),
}));

// Faux client Supabase : chaque table répond par une ligne fixe, quelle que soit la chaîne d'appels.
const rows: Record<string, unknown> = {
  visitor_profiles: { id: 'vp1', first_name: 'Marie', email: 'marie@example.com', phone: '+33612345678', photo_url: null },
  blacklist: [],
  events: { id: 'ev1', registration_closes_at: null },
  host_activations: { id: 'act1', is_active: true, is_full: false },
  contact_requests: {
    id: 'req-1',
    status: 'pending',
    visitor_first_name: 'Marie',
    visitor_email: 'marie@example.com',
    action_token: HOST_TOKEN,
    visitor_token: VISITOR_TOKEN,
    host_activations: {
      host_profiles: { first_name: 'Paul', address_private: '1 rue X', email: 'paul@example.com', phone: null, whatsapp_group_url: null },
      events: { title: 'Live', event_date: '2026-11-15T18:00:00Z' },
    },
  },
  host_profiles: { email: 'paul@example.com', first_name: 'Paul', whatsapp_group_url: null },
};

function table(name: string) {
  const result = { data: rows[name], error: null };
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'or', 'insert', 'update']) q[m] = () => q;
  q.single = async () => result;
  q.maybeSingle = async () => result;
  q.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return q;
}
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => ({ from: (name: string) => table(name) }) }));

import { POST as createRequest } from '@/app/api/visit-requests/route';
import { POST as accept } from '@/app/api/visit-requests/[token]/accept/route';

beforeEach(() => {
  sendAcceptationVisite.mockClear();
  sendNewContactRequestHost.mockClear();
});

describe('POST /api/visit-requests', () => {
  it('renvoie visitor_token au visiteur, jamais action_token', async () => {
    const res = await createRequest(
      new NextRequest('http://localhost/api/visit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: 'ev1', host_profile_id: 'hp1', nb_personnes: 1, consent: true }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.visitor_token).toBe(VISITOR_TOKEN);
    expect(JSON.stringify(body)).not.toContain(HOST_TOKEN);
    expect(body).not.toHaveProperty('action_token');
  });

  it('les liens d’acceptation/refus partent à l’hôte avec action_token', async () => {
    await createRequest(
      new NextRequest('http://localhost/api/visit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: 'ev1', host_profile_id: 'hp1', nb_personnes: 1, consent: true }),
      }),
    );
    const [, , , , , acceptUrl, declineUrl] = sendNewContactRequestHost.mock.calls[0];
    expect(acceptUrl).toContain(`/accueillir/${HOST_TOKEN}`);
    expect(declineUrl).toContain(`/refuser/${HOST_TOKEN}`);
  });
});

describe('POST /api/visit-requests/[token]/accept', () => {
  it('l’e-mail envoyé au visiteur ne contient pas action_token', async () => {
    const res = await accept(
      new NextRequest(`http://localhost/api/visit-requests/${HOST_TOKEN}/accept`, { method: 'POST' }),
      { params: Promise.resolve({ token: HOST_TOKEN }) },
    );
    expect(res.status).toBe(200);
    expect(sendAcceptationVisite).toHaveBeenCalledTimes(1);
    const args = sendAcceptationVisite.mock.calls[0];
    expect(JSON.stringify(args)).not.toContain(HOST_TOKEN);
    expect(args[7]).toContain(`/contact-equipe?token=${VISITOR_TOKEN}`);
  });
});

// Garde statique : ces fichiers fabriquent des liens ou réponses destinés au visiteur.
describe('pas d’action_token côté visiteur', () => {
  const files = [
    'app/api/cron/send-feedback-emails/route.ts',
    'app/api/dev/send-feedback/route.ts',
    'app/visitor/[token]/page.tsx',
    'app/feedback/[token]/page.tsx',
    'app/ambassade/[id]/ContactForm.tsx',
    'app/live/[event_id]/ambassade/[host_id]/VisitRequestForm.tsx',
    'app/api/visitor/requests/route.ts',
  ];
  it.each(files)('%s', (file) => {
    const src = readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(src).not.toMatch(/\.eq\('action_token'|\.action_token|action_token,|, action_token/);
  });
});

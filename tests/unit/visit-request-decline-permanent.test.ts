import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Deux façons de refuser une demande : « pas disponible cette fois » (la personne peut
// redemander pour un autre live) et « ne plus accueillir cette personne » (définitif).

const updates: Array<Record<string, unknown>> = [];
const sendRefusVisite = vi.fn().mockResolvedValue({});

vi.mock('@/lib/email/templates', () => ({ sendRefusVisite: (...a: unknown[]) => sendRefusVisite(...a) }));
vi.mock('@/config/features', () => ({ FEATURES: { EMAIL_NOTIFICATIONS: true } }));
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'req-1',
              status: 'pending',
              visitor_first_name: 'Marie',
              visitor_email: 'marie@example.com',
              host_activations: { host_profiles: { first_name: 'Paul' } },
            },
          }),
        }),
      }),
      update: (values: Record<string, unknown>) => {
        updates.push(values);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

import { POST } from '@/app/api/visit-requests/[token]/decline/route';

function call(body?: unknown) {
  const req = new NextRequest('http://localhost/api/visit-requests/tok/decline', {
    method: 'POST',
    ...(body !== undefined && { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  });
  return POST(req, { params: Promise.resolve({ token: 'tok' }) });
}

describe('POST /api/visit-requests/[token]/decline', () => {
  beforeEach(() => {
    updates.length = 0;
    sendRefusVisite.mockClear();
  });

  it('« pas disponible cette fois » : refus simple, la personne pourra redemander', async () => {
    const res = await call({ permanent: false });
    expect(res.status).toBe(200);
    expect(updates).toEqual([{ status: 'declined', declined_permanently: false }]);
    expect(sendRefusVisite).toHaveBeenCalledWith('marie@example.com', 'Marie', 'Paul', false);
  });

  it('« ne plus accueillir cette personne » : refus définitif', async () => {
    const res = await call({ permanent: true });
    expect(res.status).toBe(200);
    expect(updates).toEqual([{ status: 'declined', declined_permanently: true }]);
    expect(sendRefusVisite).toHaveBeenCalledWith('marie@example.com', 'Marie', 'Paul', true);
  });

  it('sans corps de requête (ancien client) : refus simple, jamais définitif par défaut', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(updates).toEqual([{ status: 'declined', declined_permanently: false }]);
  });

  it('n’accepte que `true` pour le refus définitif (pas "true" ni 1)', async () => {
    await call({ permanent: 'true' });
    await call({ permanent: 1 });
    expect(updates.every((u) => u.declined_permanently === false)).toBe(true);
  });
});

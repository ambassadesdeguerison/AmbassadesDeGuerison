import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { countActiveRequests, requestLimitMessage, COUNTED_STATUSES } from '@/lib/visitor/request-limit';

// Plafond de demandes par visiteur et par live : seules les demandes en cours comptent.

function fakeClient(result: { count: number | null; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in']) {
    chain[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return m === 'in' ? Promise.resolve(result) : chain;
    };
  }
  return { client: { from: () => chain } as unknown as SupabaseClient, calls };
}

describe('countActiveRequests', () => {
  it('ne compte que les demandes en attente ou acceptées, pour ce visiteur et ce live', async () => {
    const { client, calls } = fakeClient({ count: 2, error: null });
    expect(await countActiveRequests(client, 'visitor-1', 'event-1')).toBe(2);

    expect(calls).toContainEqual(['eq', 'visitor_profile_id', 'visitor-1']);
    expect(calls).toContainEqual(['eq', 'host_activations.event_id', 'event-1']);
    expect(calls).toContainEqual(['in', 'status', ['pending', 'accepted']]);
  });

  it('une demande refusée ou restée sans réponse ne compte pas', () => {
    expect(COUNTED_STATUSES).not.toContain('declined');
    expect(COUNTED_STATUSES).not.toContain('cancelled_no_response');
  });

  it('renvoie 0 quand il n’y a aucune ligne', async () => {
    const { client } = fakeClient({ count: null, error: null });
    expect(await countActiveRequests(client, 'v', 'e')).toBe(0);
  });

  it('renvoie null si la lecture échoue (l’appelant refuse plutôt que de laisser passer)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = fakeClient({ count: null, error: { message: 'boom' } });
    expect(await countActiveRequests(client, 'v', 'e')).toBeNull();
    spy.mockRestore();
  });
});

describe('requestLimitMessage', () => {
  it('accorde au pluriel et au singulier', () => {
    expect(requestLimitMessage(3)).toContain('3 demandes en cours');
    expect(requestLimitMessage(1)).toContain('1 demande en cours');
  });
});

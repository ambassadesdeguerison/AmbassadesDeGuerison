import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { wasDeclinedByHost, DECLINED_BY_HOST_MESSAGE } from '@/lib/visitor/declined-by-host';

// Un visiteur refusé par une ambassade ne peut plus lui redemander, pour aucun live.

function fakeClient(result: { count: number | null; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) {
    chain[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      // `declined_permanently` est le dernier filtre : c'est lui qui rend la main avec le résultat.
      return m === 'eq' && args[0] === 'declined_permanently' ? Promise.resolve(result) : chain;
    };
  }
  return { client: { from: () => chain } as unknown as SupabaseClient, calls };
}

describe('wasDeclinedByHost', () => {
  it('cherche un refus définitif de ce visiteur par cette ambassade, tous lives confondus', async () => {
    const { client, calls } = fakeClient({ count: 1, error: null });
    expect(await wasDeclinedByHost(client, 'visitor-1', 'host-1')).toBe(true);

    expect(calls).toContainEqual(['eq', 'visitor_profile_id', 'visitor-1']);
    expect(calls).toContainEqual(['eq', 'host_activations.host_profile_id', 'host-1']);
    expect(calls).toContainEqual(['eq', 'declined_permanently', true]);
    // Un refus simple (« pas disponible cette fois ») ne bloque pas : on ne filtre pas sur `status`.
    expect(calls.some(([, col]) => col === 'status')).toBe(false);
    // Pas de filtre sur le live : le refus vaut pour tous.
    expect(calls.some(([, col]) => col === 'host_activations.event_id')).toBe(false);
  });

  it('renvoie false quand aucun refus n’existe', async () => {
    const { client } = fakeClient({ count: 0, error: null });
    expect(await wasDeclinedByHost(client, 'v', 'h')).toBe(false);
    const { client: client2 } = fakeClient({ count: null, error: null });
    expect(await wasDeclinedByHost(client2, 'v', 'h')).toBe(false);
  });

  it('renvoie null si la lecture échoue (l’appelant refuse plutôt que de laisser passer)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = fakeClient({ count: null, error: { message: 'boom' } });
    expect(await wasDeclinedByHost(client, 'v', 'h')).toBeNull();
    spy.mockRestore();
  });
});

describe('DECLINED_BY_HOST_MESSAGE', () => {
  it('reste honnête : dit que la porte est fermée ici et ouverte ailleurs', () => {
    expect(DECLINED_BY_HOST_MESSAGE).toMatch(/une autre/);
  });
});

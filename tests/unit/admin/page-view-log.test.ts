import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logPageView } from '@/lib/admin/page-view-log';

describe('logPageView', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('écrit une ligne JSON sur stdout avec tous les champs attendus', () => {
    logPageView('admin-uuid-1', '/admin/stats');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const arg = logSpy.mock.calls[0][0];
    expect(typeof arg).toBe('string');
    const parsed = JSON.parse(arg as string);
    expect(parsed.event).toBe('admin_page_view');
    expect(parsed.admin_id).toBe('admin-uuid-1');
    expect(parsed.path).toBe('/admin/stats');
    expect(typeof parsed.ts).toBe('string');
    expect(() => new Date(parsed.ts)).not.toThrow();
  });

  it('avale silencieusement les erreurs stdout', () => {
    logSpy.mockImplementation(() => {
      throw new Error('stdout closed');
    });

    expect(() => logPageView('admin', '/admin/stats')).not.toThrow();
  });

  it('ne throw jamais sur input dégénéré', () => {
    expect(() => logPageView('', '')).not.toThrow();
    expect(() => logPageView(null as unknown as string, undefined as unknown as string)).not.toThrow();
  });
});

import { vi } from 'vitest';

// Helper builder pattern pour mocker @/lib/supabase/server dans les tests unitaires.
// Évite la duplication de boilerplate dans tests/unit/admin/*.
//
// Usage :
//   const sb = createMockSupabase();
//   sb.fromTable('events').selectReturns([{ id: '1', title: 'Live', event_date: '...' }]);
//   sb.fromTable('events').countReturns(7);
//   ...
//   vi.mocked(createServiceClient).mockReturnValue(sb.client);

type MockResult = {
  data: unknown;
  count?: number | null;
  error: unknown;
};

class TableBuilder {
  private result: MockResult = { data: [], count: null, error: null };

  selectReturns(data: unknown) {
    this.result.data = data;
    return this;
  }

  countReturns(n: number) {
    this.result.count = n;
    return this;
  }

  errorReturns(err: unknown) {
    this.result.error = err;
    return this;
  }

  build() {
    return this.result;
  }
}

export function createMockSupabase() {
  const tables = new Map<string, TableBuilder>();

  const fromTable = (name: string) => {
    if (!tables.has(name)) tables.set(name, new TableBuilder());
    return tables.get(name)!;
  };

  // PostgREST chainable query builder mock — toutes les méthodes retournent `this`
  // sauf le terminus (await ou .single() / .maybeSingle()).
  // Objet chaînable : chaque méthode renvoie l'objet lui-même (`then` fait office de terminus).
  type Chainable = { [method: string]: unknown };
  const makeQueryBuilder = (tableName: string): Chainable => {
    const builder = tables.get(tableName);
    const result = builder ? builder.build() : { data: [], count: null, error: null };

    const chainable: Chainable = {
      select: vi.fn(() => chainable),
      eq: vi.fn(() => chainable),
      neq: vi.fn(() => chainable),
      lt: vi.fn(() => chainable),
      lte: vi.fn(() => chainable),
      gt: vi.fn(() => chainable),
      gte: vi.fn(() => chainable),
      in: vi.fn(() => chainable),
      is: vi.fn(() => chainable),
      order: vi.fn(() => chainable),
      limit: vi.fn(() => chainable),
      single: vi.fn(() => Promise.resolve({ ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data })),
      maybeSingle: vi.fn(() => Promise.resolve({ ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data })),
      then: (resolve: (value: MockResult) => unknown) => Promise.resolve(result).then(resolve),
    };
    return chainable;
  };

  const client = {
    from: vi.fn((tableName: string) => makeQueryBuilder(tableName)),
  };

  return {
    client,
    fromTable,
  };
}

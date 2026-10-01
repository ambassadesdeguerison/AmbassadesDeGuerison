import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeRedirect } from '@/lib/auth/safe-redirect';

// Vérification réelle de l'adresse (2026-10-01) : /api/visitor/account créait le compte avec
// l'e-mail pré-confirmé et renvoyait le jeton au navigateur, qui ouvrait la session aussitôt.
// N'importe qui pouvait donc créer un compte avec l'adresse d'un tiers, puis recevoir l'adresse
// d'une maison à cet e-mail. La session ne doit désormais s'ouvrir que par le lien envoyé par e-mail.

const { mockSendVisitorCompteCree, mockGenerateLink, mockCreateUser, mockInsert } = vi.hoisted(() => ({
  mockSendVisitorCompteCree: vi.fn(),
  mockGenerateLink: vi.fn(),
  mockCreateUser: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock('@/lib/email/templates', () => ({ sendVisitorCompteCree: mockSendVisitorCompteCree }));
vi.mock('@/lib/visitor/classify-email', () => ({ classifyVisitorEmail: vi.fn().mockResolvedValue('new') }));
vi.mock('@/lib/image/compress-photo', () => ({ compressAmbassadorPhoto: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    auth: { admin: { createUser: mockCreateUser, generateLink: mockGenerateLink } },
    from: () => ({ insert: mockInsert }),
  }),
}));

function post(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  return new Request('http://localhost/api/visitor/account', { method: 'POST', body }) as unknown as import('next/server').NextRequest;
}

const valid = { first_name: 'Marie', email: 'Marie@Example.com', phone: '+33612345678' };

describe('safeRedirect', () => {
  it('accepte un chemin relatif', () => {
    expect(safeRedirect('/ambassade/abc')).toBe('/ambassade/abc');
  });
  it.each(['https://evil.com', '//evil.com', '/\\evil.com', 'ambassade', '', 42, null, undefined])(
    'refuse %s',
    (value) => {
      expect(safeRedirect(value)).toBeUndefined();
    },
  );
});

describe('POST /api/visitor/account — vérification de l’e-mail', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
    mockSendVisitorCompteCree.mockReset().mockResolvedValue(undefined);
    mockGenerateLink.mockReset().mockResolvedValue({
      data: { properties: { hashed_token: 'tok', verification_type: 'magiclink' } },
      error: null,
    });
    mockCreateUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockInsert.mockReset().mockResolvedValue({ error: null });
  });

  it('ne renvoie jamais le jeton au navigateur : seul l’e-mail permet d’ouvrir la session', async () => {
    const { POST } = await import('@/app/api/visitor/account/route');
    const res = await POST(post({ ...valid, redirect: '/ambassade/abc' }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.status).toBe('verify_email');
    expect(JSON.stringify(data)).not.toContain('tok');
    expect(data).not.toHaveProperty('token_hash');
  });

  it('envoie le lien par e-mail avec la page d’origine, construit avec le type réel du jeton', async () => {
    const { POST } = await import('@/app/api/visitor/account/route');
    await POST(post({ ...valid, redirect: '/ambassade/abc' }));

    expect(mockSendVisitorCompteCree).toHaveBeenCalledWith(
      'marie@example.com',
      'Marie',
      'https://app.example/auth/confirm?token_hash=tok&type=magiclink&redirect=%2Fambassade%2Fabc',
    );
  });

  it('ignore une redirection externe et retombe sur /mon-espace', async () => {
    const { POST } = await import('@/app/api/visitor/account/route');
    await POST(post({ ...valid, redirect: 'https://evil.com' }));

    expect(mockSendVisitorCompteCree.mock.calls[0][2]).toContain('redirect=%2Fmon-espace');
  });

  it('e-mail impossible à envoyer : 502, pour que le visiteur ne reste pas bloqué sans lien', async () => {
    mockSendVisitorCompteCree.mockRejectedValue(new Error('smtp down'));
    const { POST } = await import('@/app/api/visitor/account/route');
    const res = await POST(post(valid));

    expect(res.status).toBe(502);
  });
});

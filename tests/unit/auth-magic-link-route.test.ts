import { describe, it, expect, vi, beforeEach } from 'vitest';

// Régression (2026-10-01) : /api/auth/magic-link appelait generateLink pour N'IMPORTE QUELLE adresse.
// Supabase crée alors le compte (sans profil) et émet un jeton `signup` que /auth/confirm refusait :
// le nouvel utilisateur recevait un lien mort, et la base se remplissait de comptes vides
// (61 comptes sur 84 n'avaient aucun profil).

const { mockSendMagicLink, mockGenerateLink } = vi.hoisted(() => ({
  mockSendMagicLink: vi.fn().mockResolvedValue(undefined),
  mockGenerateLink: vi.fn(),
}));

vi.mock('@/lib/email/templates', () => ({ sendMagicLink: mockSendMagicLink }));

function post(body: unknown) {
  return new Request('http://localhost/api/auth/magic-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

async function loadRoute(knownEmails: string[]) {
  vi.resetModules();
  vi.doMock('@/lib/supabase/server', () => ({
    createServiceClient: () => ({ auth: { admin: { generateLink: mockGenerateLink } } }),
  }));
  vi.doMock('@/lib/auth/list-all-users', () => ({
    getAuthUsersByEmail: vi.fn().mockResolvedValue(new Map(knownEmails.map((e) => [e, { id: `id-${e}` }]))),
  }));
  return (await import('@/app/api/auth/magic-link/route')).POST;
}

describe('POST /api/auth/magic-link', () => {
  beforeEach(() => {
    mockSendMagicLink.mockClear();
    mockGenerateLink.mockReset();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
  });

  it('adresse inconnue : 404 no_account, aucun compte créé, aucun e-mail', async () => {
    const POST = await loadRoute(['connu@example.com']);
    const res = await POST(post({ email: 'inconnu@example.com' }));

    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('no_account');
    expect(mockGenerateLink).not.toHaveBeenCalled();
    expect(mockSendMagicLink).not.toHaveBeenCalled();
  });

  it('adresse connue : envoie un lien dont le type est celui du jeton', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'tok', verification_type: 'magiclink' } },
      error: null,
    });
    const POST = await loadRoute(['connu@example.com']);
    const res = await POST(post({ email: 'connu@example.com' }));

    expect(res.status).toBe(200);
    expect(mockGenerateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'connu@example.com' });
    expect(mockSendMagicLink).toHaveBeenCalledWith(
      'connu@example.com',
      'https://app.example/auth/confirm?token_hash=tok&type=magiclink'
    );
  });

  it('un compte non confirmé (jeton signup) reçoit un lien type=signup, pas magiclink', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'tok2', verification_type: 'signup' } },
      error: null,
    });
    const POST = await loadRoute(['connu@example.com']);
    await POST(post({ email: 'connu@example.com' }));

    expect(mockSendMagicLink.mock.calls[0][1]).toContain('type=signup');
  });

  it('normalise l’adresse (espaces, majuscules) avant de chercher le compte', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'tok', verification_type: 'magiclink' } },
      error: null,
    });
    const POST = await loadRoute(['connu@example.com']);
    const res = await POST(post({ email: '  Connu@Example.com ' }));

    expect(res.status).toBe(200);
    expect(mockGenerateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'connu@example.com' });
  });

  it('e-mail manquant : 400', async () => {
    const POST = await loadRoute([]);
    expect((await POST(post({}))).status).toBe(400);
    expect((await POST(post({ email: 42 }))).status).toBe(400);
  });
});

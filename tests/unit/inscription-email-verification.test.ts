import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmailProof } from '@/lib/auth/email-proof';

// L'adresse de l'ambassadeur doit être confirmée par e-mail AVANT toute création : compte auth,
// profil candidat, bascule de rôle d'un compte existant, notification à l'équipe.

const { mockSendVerification, mockSendConfirmation, mockSendAdmin, mockCreateUser, mockInsert } = vi.hoisted(() => ({
  mockSendVerification: vi.fn(),
  mockSendConfirmation: vi.fn().mockResolvedValue(undefined),
  mockSendAdmin: vi.fn().mockResolvedValue(undefined),
  mockCreateUser: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock('@/lib/email/templates', () => ({
  sendInscriptionEmailVerification: mockSendVerification,
  sendRegistrationConfirmation: mockSendConfirmation,
  sendNouvelleInscriptionAdmin: mockSendAdmin,
}));
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    auth: { admin: { createUser: mockCreateUser, generateLink: vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } }) } },
    from: () => ({ insert: mockInsert }),
  }),
}));

const json = (url: string, body: unknown) =>
  new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) as unknown as import('next/server').NextRequest;

const form = {
  first_name: 'Jean', last_name: 'Dupont', phone: '+33612345678', city: 'Paris', country: 'France',
  address_private: '12 rue de la Paix', lat: 48.85, lng: 2.35,
};

describe('POST /api/inscriptions — adresse confirmée obligatoire', () => {
  beforeEach(() => {
    process.env.EMAIL_PROOF_SECRET = 'test-secret';
    mockCreateUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockInsert.mockReset().mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'p1' }, error: null }) }) });
    mockSendAdmin.mockClear();
  });

  async function post(body: unknown) {
    const { POST } = await import('@/app/api/inscriptions/route');
    return POST(json('http://localhost/api/inscriptions', body));
  }

  it('sans preuve : 403 et RIEN n’est créé (ni compte, ni profil, ni notification à l’équipe)', async () => {
    const res = await post({ ...form, email: 'marie@example.com' });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('email_not_verified');
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockSendAdmin).not.toHaveBeenCalled();
  });

  it('preuve émise pour une autre adresse : 403 (impossible d’inscrire l’adresse d’un tiers)', async () => {
    const res = await post({ ...form, email: 'victime@example.com', email_proof: createEmailProof('attaquant@example.com', 'inscription') });
    expect(res.status).toBe(403);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('preuve falsifiée ou expirée : 403', async () => {
    const expired = createEmailProof('marie@example.com', 'inscription', Date.now() - 25 * 3600 * 1000);
    expect((await post({ ...form, email: 'marie@example.com', email_proof: expired })).status).toBe(403);
    expect((await post({ ...form, email: 'marie@example.com', email_proof: 'n-importe.quoi' })).status).toBe(403);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('preuve valide : l’inscription passe, l’adresse est enregistrée en minuscules', async () => {
    const res = await post({ ...form, email: 'Marie@Example.com', email_proof: createEmailProof('marie@example.com', 'inscription') });
    expect(res.status).toBe(201);
    expect(mockCreateUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'marie@example.com' }));
  });
});

describe('/api/inscriptions/verify-email', () => {
  beforeEach(() => {
    process.env.EMAIL_PROOF_SECRET = 'test-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
    mockSendVerification.mockReset().mockResolvedValue(undefined);
    mockCreateUser.mockClear();
  });

  it('POST envoie un lien /inscription?verify=… à l’adresse normalisée, sans créer de compte', async () => {
    const { POST } = await import('@/app/api/inscriptions/verify-email/route');
    const res = await POST(json('http://localhost/api/inscriptions/verify-email', { email: '  Marie@Example.com ' }));

    expect(res.status).toBe(200);
    expect(mockSendVerification).toHaveBeenCalledTimes(1);
    const [to, url] = mockSendVerification.mock.calls[0] as [string, string];
    expect(to).toBe('marie@example.com');
    expect(url.startsWith('https://app.example/inscription?verify=')).toBe(true);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it('le lien envoyé est accepté par GET et renvoie l’adresse prouvée', async () => {
    const { POST, GET } = await import('@/app/api/inscriptions/verify-email/route');
    await POST(json('http://localhost/api/inscriptions/verify-email', { email: 'marie@example.com' }));
    const token = new URL(mockSendVerification.mock.calls[0][1] as string).searchParams.get('verify')!;

    const ok = await GET(new Request(`http://localhost/api/inscriptions/verify-email?token=${encodeURIComponent(token)}`) as never);
    expect(ok.status).toBe(200);
    expect((await ok.json()).email).toBe('marie@example.com');

    const bad = await GET(new Request('http://localhost/api/inscriptions/verify-email?token=faux') as never);
    expect(bad.status).toBe(400);
  });

  it('adresse invalide : 400, aucun e-mail', async () => {
    const { POST } = await import('@/app/api/inscriptions/verify-email/route');
    const res = await POST(json('http://localhost/api/inscriptions/verify-email', { email: 'pas-une-adresse' }));
    expect(res.status).toBe(400);
    expect(mockSendVerification).not.toHaveBeenCalled();
  });

  it('robot (honeypot rempli) : réponse neutre, aucun e-mail', async () => {
    const { POST } = await import('@/app/api/inscriptions/verify-email/route');
    const res = await POST(json('http://localhost/api/inscriptions/verify-email', { email: 'marie@example.com', website: 'spam' }));
    expect(res.status).toBe(200);
    expect(mockSendVerification).not.toHaveBeenCalled();
  });

  it('envoi impossible : 502 (la personne doit pouvoir réessayer)', async () => {
    mockSendVerification.mockRejectedValue(new Error('smtp down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { POST } = await import('@/app/api/inscriptions/verify-email/route');
    const res = await POST(json('http://localhost/api/inscriptions/verify-email', { email: 'marie@example.com' }));
    expect(res.status).toBe(502);
    spy.mockRestore();
  });
});

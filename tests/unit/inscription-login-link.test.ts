import { describe, it, expect, vi, beforeEach } from 'vitest';

// Demande de David (2026-10-01) : après le formulaire « devenir ambassadeur », l'e-mail
// « Continuer mon inscription » doit contenir un vrai lien de connexion (/auth/confirm), pas un
// simple /dashboard qui renvoie le candidat vers l'écran de connexion.

const { mockSendConfirmation, mockSendAdmin, mockGenerateLink } = vi.hoisted(() => ({
  mockSendConfirmation: vi.fn().mockResolvedValue(undefined),
  mockSendAdmin: vi.fn().mockResolvedValue(undefined),
  mockGenerateLink: vi.fn(),
}));

vi.mock('@/lib/email/templates', () => ({
  sendRegistrationConfirmation: mockSendConfirmation,
  sendNouvelleInscriptionAdmin: mockSendAdmin,
}));

import { createEmailProof } from '@/lib/auth/email-proof';

process.env.EMAIL_PROOF_SECRET = 'test-secret';

const payload = {
  email: 'nouveau@example.com',
  email_proof: createEmailProof('nouveau@example.com', 'inscription'),
  first_name: 'Jean',
  last_name: 'Dupont',
  phone: '+33612345678',
  city: 'Paris',
  country: 'France',
  address_private: '12 rue de la Paix',
  lat: 48.8566,
  lng: 2.3522,
};

function supabaseMock() {
  return {
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
        generateLink: mockGenerateLink,
      },
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'profile-1' }, error: null }),
        }),
      }),
    }),
  };
}

async function submit() {
  vi.resetModules();
  vi.doMock('@/lib/supabase/server', () => ({ createServiceClient: () => supabaseMock() }));
  const { POST } = await import('@/app/api/inscriptions/route');
  const req = new Request('http://localhost/api/inscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return POST(req as unknown as import('next/server').NextRequest);
}

describe('POST /api/inscriptions — lien de l’e-mail de confirmation', () => {
  beforeEach(() => {
    mockSendConfirmation.mockClear();
    mockGenerateLink.mockReset();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
  });

  it('envoie un lien de connexion qui redirige vers /dashboard', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'tok', verification_type: 'magiclink' } },
      error: null,
    });
    const res = await submit();

    expect(res.status).toBe(201);
    expect(mockGenerateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'nouveau@example.com' });
    const url = mockSendConfirmation.mock.calls[0][2] as string;
    expect(url).toContain('/auth/confirm?');
    expect(new URL(url).searchParams.get('token_hash')).toBe('tok');
    expect(new URL(url).searchParams.get('redirect')).toBe('/dashboard');
  });

  it('si le lien ne peut pas être généré : l’inscription réussit quand même (repli /dashboard)', async () => {
    mockGenerateLink.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await submit();

    expect(res.status).toBe(201);
    expect(mockSendConfirmation).toHaveBeenCalledTimes(1);
    expect(mockSendConfirmation.mock.calls[0][2]).toBeUndefined();
  });
});

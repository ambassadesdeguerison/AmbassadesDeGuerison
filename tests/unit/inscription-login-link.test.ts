import { describe, it, expect, vi, beforeEach } from 'vitest';

// Après le formulaire « devenir ambassadeur » (adresse déjà prouvée à l'étape 0), la réponse porte un
// jeton à usage unique que le navigateur échange contre une session (exception documentée à
// « jamais de token_hash dans une réponse », CLAUDE.md § Formulaire d'inscription). Ce jeton
// étant consommé là, l'e-mail n'a plus de lien de connexion propre (repli /dashboard).

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

  it('remet au navigateur un jeton de connexion, un seul, et ne le met pas dans l’e-mail', async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'tok', verification_type: 'signup' } },
      error: null,
    });
    const res = await submit();
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'nouveau@example.com' });
    expect(body.login).toEqual({ token_hash: 'tok', type: 'signup' });
    expect(mockSendConfirmation.mock.calls[0][2]).toBeUndefined();
  });

  it('si le jeton ne peut pas être généré : l’inscription réussit quand même, sans login', async () => {
    mockGenerateLink.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await submit();
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.login).toBeUndefined();
    expect(mockSendConfirmation).toHaveBeenCalledTimes(1);
  });
});

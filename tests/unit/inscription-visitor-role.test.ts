import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression: un visiteur avec un compte auth.users existant (créé via
// /api/visitor/account) qui s'inscrit ensuite comme ambassadeur avec le
// même e-mail gardait user_metadata.role = 'visitor' pour toujours — ce qui
// verrouillait silencieusement l'accès à /dashboard (redirection permanente
// vers /mon-espace, cf app/dashboard/page.tsx qui checke le role avant même
// de regarder s'il existe un host_profile).
// Found by /qa on 2026-07-29
// Report: .gstack/qa-reports/qa-report-localhost-2026-07-29.md
import { createEmailProof } from '@/lib/auth/email-proof';

vi.mock('@/lib/email/templates', () => ({
  sendRegistrationConfirmation: vi.fn().mockResolvedValue(undefined),
  sendNouvelleInscriptionAdmin: vi.fn().mockResolvedValue(undefined),
}));

const EXISTING_VISITOR = {
  id: 'user-123',
  email: 'visiteur@example.com',
  user_metadata: { email_verified: true, role: 'visitor' },
};

const EXISTING_ADMIN = {
  id: 'user-admin',
  email: 'admin@example.com',
  user_metadata: { email_verified: true, role: 'admin' },
};

function buildSupabaseMock(existingUser: typeof EXISTING_VISITOR | typeof EXISTING_ADMIN) {
  const updateUserById = vi.fn().mockResolvedValue({ data: {}, error: null });
  const createUser = vi.fn().mockResolvedValue({
    data: null,
    error: { message: 'A user with this email address has already been registered' },
  });
  const listUsers = vi.fn().mockResolvedValue({ data: { users: [existingUser] }, error: null });

  const insert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'profile-1' }, error: null }),
    }),
  });

  return {
    auth: { admin: { createUser, listUsers, updateUserById } },
    from: vi.fn().mockReturnValue({ insert }),
    __mocks: { createUser, listUsers, updateUserById, insert },
  };
}

process.env.EMAIL_PROOF_SECRET = 'test-secret';

const basePayload = {
  email: 'visiteur@example.com',
  email_proof: createEmailProof('visiteur@example.com', 'inscription'),
  first_name: 'Jean',
  last_name: 'Dupont',
  phone: '+33612345678',
  city: 'Paris',
  country: 'France',
  address_private: '12 rue de la Paix',
  lat: 48.8566,
  lng: 2.3522,
};

describe('POST /api/inscriptions — visiteur devenant ambassadeur', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("fait évoluer le role 'visitor' vers 'host' quand le compte auth existant est réutilisé", async () => {
    const mockSupabase = buildSupabaseMock(EXISTING_VISITOR);
    vi.doMock('@/lib/supabase/server', () => ({ createServiceClient: () => mockSupabase }));

    const { POST } = await import('@/app/api/inscriptions/route');
    const req = new Request('http://localhost/api/inscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basePayload),
    });

    const res = await POST(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(201);

    expect(mockSupabase.__mocks.updateUserById).toHaveBeenCalledWith(
      'user-123',
      { user_metadata: { email_verified: true, role: 'host' } },
    );
  });

  it("ne rétrograde jamais un compte 'admin' vers 'host'", async () => {
    const mockSupabase = buildSupabaseMock(EXISTING_ADMIN);
    vi.doMock('@/lib/supabase/server', () => ({ createServiceClient: () => mockSupabase }));

    const { POST } = await import('@/app/api/inscriptions/route');
    const req = new Request('http://localhost/api/inscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, email: 'admin@example.com', email_proof: createEmailProof('admin@example.com', 'inscription') }),
    });

    const res = await POST(req as unknown as import('next/server').NextRequest);
    expect(res.status).toBe(201);
    expect(mockSupabase.__mocks.updateUserById).not.toHaveBeenCalled();
  });
});

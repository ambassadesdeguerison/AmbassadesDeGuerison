import { describe, it, expect, vi, beforeEach } from 'vitest';

// POST /api/admin/ambassadeurs/[id]/status doit rapporter l'issue de l'e-mail au
// candidat (`candidateEmail`) pour que l'écran admin confirme — ou non — l'envoi.
// Avant, les e-mails partaient en `Promise.allSettled` non attendu : la route
// répondait « succès » sans savoir si le candidat avait été prévenu.

const mocks = vi.hoisted(() => ({
  sendValidationFinale: vi.fn(),
  sendNouvelleActivationAdmin: vi.fn(),
  sendRefusCandidature: vi.fn(),
  state: {
    profile: {} as Record<string, unknown>,
    authEmail: 'camille@example.com' as string | undefined,
  },
}));

vi.mock('@/lib/email/templates', () => ({
  sendValidationFinale: mocks.sendValidationFinale,
  sendNouvelleActivationAdmin: mocks.sendNouvelleActivationAdmin,
  sendRefusCandidature: mocks.sendRefusCandidature,
}));

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockImplementation(async () => ({
    user: { id: 'admin-1' },
    supabase: {
      from: (table: string) => {
        if (table === 'host_profiles') {
          return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.state.profile, error: null }) }) }),
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        if (table === 'moderation_log') return { insert: async () => ({ error: null }) };
        throw new Error(`unexpected table ${table}`);
      },
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: mocks.state.authEmail ? { email: mocks.state.authEmail } : null } }),
        },
      },
    },
  })),
}));

async function call(action: string, notes?: string) {
  const { POST } = await import('@/app/api/admin/ambassadeurs/[id]/status/route');
  const res = await POST(
    new Request('http://localhost/api/admin/ambassadeurs/p1/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes }),
    }) as unknown as import('next/server').NextRequest,
    { params: Promise.resolve({ id: 'p1' }) }
  );
  return { status: res.status, body: await res.json() };
}

const PROFILE = {
  id: 'p1',
  status: 'enrichment_pending',
  first_name: 'Camille',
  user_id: 'user-1',
  city: 'Lyon',
  country: 'France',
  profile_photo_url: 'ambassador-photos/p1/profil.webp',
  room_photo_urls: ['ambassador-photos/p1/lieu.webp'],
};

describe('status route — issue de l’e-mail au candidat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendValidationFinale.mockResolvedValue(undefined);
    mocks.sendNouvelleActivationAdmin.mockResolvedValue(undefined);
    mocks.sendRefusCandidature.mockResolvedValue(undefined);
    mocks.state.profile = { ...PROFILE };
    mocks.state.authEmail = 'camille@example.com';
  });

  it('validation : e-mail parti → candidateEmail = sent', async () => {
    const r = await call('validated');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, status: 'validated', candidateEmail: 'sent' });
  });

  it('validation : e-mail au candidat en échec → la validation réussit, candidateEmail = failed', async () => {
    mocks.sendValidationFinale.mockRejectedValue(new Error('Resend 500'));
    const r = await call('validated');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, status: 'validated', candidateEmail: 'failed' });
  });

  it('validation : seule la notification admin échoue → le candidat, lui, a bien reçu son e-mail', async () => {
    mocks.sendNouvelleActivationAdmin.mockRejectedValue(new Error('adresse admin absente'));
    const r = await call('validated');
    expect(r.body.candidateEmail).toBe('sent');
  });

  it('validation : aucune adresse trouvée pour le compte → failed (le candidat n’est pas prévenu)', async () => {
    mocks.state.authEmail = undefined;
    const r = await call('validated');
    expect(r.status).toBe(200);
    expect(r.body.candidateEmail).toBe('failed');
    expect(mocks.sendValidationFinale).not.toHaveBeenCalled();
  });

  it('validation : profil sans compte rattaché → failed', async () => {
    mocks.state.profile = { ...PROFILE, user_id: null };
    const r = await call('validated');
    expect(r.body.candidateEmail).toBe('failed');
  });

  it('refus : e-mail parti → sent', async () => {
    const r = await call('rejected', 'dossier incomplet');
    expect(r.body).toMatchObject({ status: 'rejected', candidateEmail: 'sent' });
    expect(mocks.sendRefusCandidature).toHaveBeenCalledWith('camille@example.com', 'Camille', 'dossier incomplet');
  });

  it('refus : e-mail en échec → failed', async () => {
    mocks.sendRefusCandidature.mockRejectedValue(new Error('Resend 500'));
    const r = await call('rejected');
    expect(r.body).toMatchObject({ status: 'rejected', candidateEmail: 'failed' });
  });

  it('suspension : aucun e-mail concerné → none', async () => {
    mocks.state.profile = { ...PROFILE, status: 'validated' };
    const r = await call('suspended');
    expect(r.body).toMatchObject({ status: 'suspended', candidateEmail: 'none' });
    expect(mocks.sendValidationFinale).not.toHaveBeenCalled();
    expect(mocks.sendRefusCandidature).not.toHaveBeenCalled();
  });

  it('réintégration d’un dossier complet : e-mail envoyé → sent', async () => {
    mocks.state.profile = { ...PROFILE, status: 'suspended' };
    const r = await call('reactiver');
    expect(r.body).toMatchObject({ status: 'validated', candidateEmail: 'sent' });
  });

  it('réintégration d’un dossier incomplet : renvoyé au questionnaire, aucun e-mail → none', async () => {
    mocks.state.profile = { ...PROFILE, status: 'rejected', profile_photo_url: null, room_photo_urls: [] };
    const r = await call('reactiver');
    expect(r.body).toMatchObject({ status: 'enrichment_pending', candidateEmail: 'none' });
    expect(mocks.sendValidationFinale).not.toHaveBeenCalled();
  });
});

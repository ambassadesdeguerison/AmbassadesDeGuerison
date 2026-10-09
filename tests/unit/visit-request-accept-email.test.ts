import { describe, it, expect, vi, beforeEach } from 'vitest';

// POST /api/visit-requests/[token]/accept et /decline remontent `emailSent` :
// l'ambassadeur qui accepte doit savoir si le visiteur a réellement reçu son
// adresse. Avant, l'envoi n'était pas attendu et la réponse ne disait rien.

const mocks = vi.hoisted(() => ({
  sendAcceptationVisite: vi.fn(),
  sendRefusVisite: vi.fn(),
  contact: null as Record<string, unknown> | null,
}));

vi.mock('@/lib/email/templates', () => ({
  sendAcceptationVisite: mocks.sendAcceptationVisite,
  sendRefusVisite: mocks.sendRefusVisite,
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.contact, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

const CONTACT = {
  id: 'c1',
  status: 'pending',
  visitor_first_name: 'Marie',
  visitor_email: 'marie@example.com',
  visitor_token: 'vt',
  host_activations: {
    event_id: 'e1',
    host_profiles: { first_name: 'Jean', address_private: '1 rue X', email: 'jean@example.com', phone: null, whatsapp_group_url: null },
    events: { title: 'Live', event_date: '2026-11-15T18:00:00Z' },
  },
};

async function accept() {
  const { POST } = await import('@/app/api/visit-requests/[token]/accept/route');
  const res = await POST({} as import('next/server').NextRequest, { params: Promise.resolve({ token: 't' }) });
  return { status: res.status, body: await res.json() };
}

async function decline(permanent = false) {
  const { POST } = await import('@/app/api/visit-requests/[token]/decline/route');
  const res = await POST(
    new Request('http://localhost/x', { method: 'POST', body: JSON.stringify({ permanent }) }) as unknown as import('next/server').NextRequest,
    { params: Promise.resolve({ token: 't' }) }
  );
  return { status: res.status, body: await res.json() };
}

describe('accept — issue de l’e-mail au visiteur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendAcceptationVisite.mockResolvedValue(undefined);
    mocks.sendRefusVisite.mockResolvedValue(undefined);
    mocks.contact = structuredClone(CONTACT);
  });

  it('e-mail parti → emailSent = true', async () => {
    const r = await accept();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, emailSent: true });
  });

  it('e-mail en échec → la demande est acceptée quand même, emailSent = false', async () => {
    mocks.sendAcceptationVisite.mockRejectedValue(new Error('Resend 500'));
    const r = await accept();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, emailSent: false });
  });

  it('données hôte/live manquantes → rien n’est parti, emailSent = false', async () => {
    mocks.contact = { ...CONTACT, host_activations: { event_id: 'e1', host_profiles: null, events: null } };
    const r = await accept();
    expect(r.body.emailSent).toBe(false);
    expect(mocks.sendAcceptationVisite).not.toHaveBeenCalled();
  });

  it('demande déjà traitée → ne renvoie pas d’e-mail et signale le statut réel', async () => {
    mocks.contact = { ...CONTACT, status: 'declined' };
    const r = await accept();
    expect(r.body).toMatchObject({ message: 'Demande déjà traitée', status: 'declined' });
    expect(mocks.sendAcceptationVisite).not.toHaveBeenCalled();
  });
});

describe('decline — issue de l’e-mail au visiteur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendAcceptationVisite.mockResolvedValue(undefined);
    mocks.sendRefusVisite.mockResolvedValue(undefined);
    mocks.contact = structuredClone(CONTACT);
  });

  it('e-mail parti → emailSent = true', async () => {
    const r = await decline();
    expect(r.body).toEqual({ success: true, emailSent: true });
    expect(mocks.sendRefusVisite).toHaveBeenCalledWith('marie@example.com', 'Marie', 'Jean', false);
  });

  it('refus définitif : le drapeau est transmis à l’e-mail', async () => {
    await decline(true);
    expect(mocks.sendRefusVisite).toHaveBeenCalledWith('marie@example.com', 'Marie', 'Jean', true);
  });

  it('e-mail en échec → emailSent = false, le refus est enregistré', async () => {
    mocks.sendRefusVisite.mockRejectedValue(new Error('Resend 500'));
    const r = await decline();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, emailSent: false });
  });
});

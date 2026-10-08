import { describe, it, expect, vi, beforeEach } from 'vitest';

// Revue des effets de bord du questionnaire v2 (2026-10-01) : « tous les champs sont obligatoires »
// n'était vérifié que dans le formulaire. Un appel direct à PATCH /api/ambassadeur/enrichissement (ou un
// ancien onglet) passait le dossier à « À valider » avec des réponses manquantes.

const { mockUpdate, mockEq } = vi.hoisted(() => ({ mockUpdate: vi.fn(), mockEq: vi.fn() }));

vi.mock('@/lib/email/templates', () => ({ sendEnrichissementRecu: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) } }),
}));

const STORED_COMPLETE = {
  id: 'profile-1',
  status: 'pre_approved',
  first_name: 'Jean',
  profile_photo_url: 'p/profil.webp',
  room_photo_urls: ['p/lieu.webp'],
  church_attendance: 'regular',
  denomination: 'évangélique',
  has_leadership_role: false,
  leadership_role: null,
  has_seen_healings: true,
  live_screen: 'Télévision',
};

async function call(stored: Record<string, unknown>, body: Record<string, unknown>) {
  vi.resetModules();
  mockUpdate.mockReset();
  mockEq.mockReset().mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });
  vi.doMock('@/lib/supabase/server', () => ({
    createServiceClient: () => ({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...STORED_COMPLETE, ...stored } }) }) }),
        update: mockUpdate,
      }),
    }),
  }));
  const { PATCH } = await import('@/app/api/ambassadeur/enrichissement/route');
  const req = new Request('http://localhost/api/ambassadeur/enrichissement', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return PATCH(req as unknown as import('next/server').NextRequest);
}

describe('PATCH /api/ambassadeur/enrichissement — champs obligatoires côté serveur', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dossier complet : 200 et statut enrichment_pending', async () => {
    const res = await call({}, {});
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'enrichment_pending' }));
  });

  it('réponses manquantes : 400 qui dit lesquelles, rien n’est écrit', async () => {
    const res = await call({ church_attendance: null, denomination: null, has_seen_healings: null }, {});
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('la fréquentation d’une église');
    expect(data.error).toContain('les guérisons vues');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('complète les réponses déjà enregistrées (brouillon) avec celles de l’envoi', async () => {
    const res = await call({ has_seen_healings: null }, { has_seen_healings: false });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ has_seen_healings: false, status: 'enrichment_pending' }));
  });

  it('« oui » à la responsabilité sans la fonction : 400', async () => {
    const res = await call({}, { has_leadership_role: true, leadership_role: '  ' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('la fonction que vous exercez');
  });

  it('sans église, la dénomination n’est pas exigée', async () => {
    const res = await call({ church_attendance: 'none', denomination: null }, {});
    expect(res.status).toBe(200);
  });

  it('un brouillon n’exige rien et ne change pas le statut', async () => {
    const res = await call({ church_attendance: null, denomination: null }, { draft: true, denomination: 'catho' });
    expect(res.status).toBe(200);
    const written = mockUpdate.mock.calls[0][0];
    expect(written).toEqual({ denomination: 'catho' });
    expect(written).not.toHaveProperty('status');
  });

  it('la vidéo, la liste formations/livres et le parcours écrit restent facultatifs', async () => {
    const res = await call({}, { books_read: [], trainings_done: [], parcours_spirituel: '' });
    expect(res.status).toBe(200);
  });

  it('photo manquante : message photo dédié, avant les champs', async () => {
    const res = await call({ room_photo_urls: [], church_attendance: null }, {});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('photo du lieu');
  });
});

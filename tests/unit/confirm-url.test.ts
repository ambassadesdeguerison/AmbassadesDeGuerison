import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildConfirmUrl } from '@/lib/auth/confirm-url';

// Régression : le lien envoyé imposait `type=magiclink`. Pour une adresse inconnue, Supabase
// émet un jeton de type `signup` ; verifyOtp({ type: 'magiclink' }) l'échoue (« Email link is
// invalid or has expired ») et l'utilisateur arrivait sur « Ce lien ne fonctionne plus ».
// Reproduit le 2026-10-01 avec generateLink sur une adresse jetable.

describe('buildConfirmUrl', () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = previous;
  });

  it('reprend le type de vérification réellement porté par le jeton (signup)', () => {
    const url = buildConfirmUrl({ hashed_token: 'abc123', verification_type: 'signup' });
    expect(url).toBe('https://app.example/auth/confirm?token_hash=abc123&type=signup');
  });

  it('reprend aussi magiclink pour un compte existant', () => {
    const url = new URL(buildConfirmUrl({ hashed_token: 'abc123', verification_type: 'magiclink' }));
    expect(url.searchParams.get('type')).toBe('magiclink');
  });

  it('retombe sur magiclink si Supabase ne précise pas le type', () => {
    const url = new URL(buildConfirmUrl({ hashed_token: 'abc123' }));
    expect(url.searchParams.get('type')).toBe('magiclink');
  });

  it('encode la redirection (chemin relatif)', () => {
    const url = buildConfirmUrl({ hashed_token: 't', verification_type: 'magiclink' }, '/dashboard');
    expect(url).toContain('redirect=%2Fdashboard');
    expect(new URL(url).searchParams.get('redirect')).toBe('/dashboard');
  });

  it('n’ajoute pas de redirection quand elle est absente', () => {
    expect(buildConfirmUrl({ hashed_token: 't' })).not.toContain('redirect');
  });
});

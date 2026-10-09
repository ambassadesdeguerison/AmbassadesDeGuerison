import { describe, it, expect, beforeEach } from 'vitest';
import { createEmailProof, verifyEmailProof, EMAIL_PROOF_TTL_MS } from '@/lib/auth/email-proof';

// Preuve d'adresse e-mail sans état : un jeton signé, jamais stocké.

describe('email-proof', () => {
  beforeEach(() => {
    process.env.EMAIL_PROOF_SECRET = 'secret-a';
  });

  it('un jeton valide renvoie l’adresse, normalisée en minuscules', () => {
    const token = createEmailProof('  Marie@Example.COM ', 'inscription');
    expect(verifyEmailProof(token, 'inscription')).toBe('marie@example.com');
  });

  it('refuse un jeton falsifié (adresse modifiée sous la même signature)', () => {
    const token = createEmailProof('marie@example.com', 'inscription');
    const [, signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ e: 'victime@example.com', p: 'inscription', x: Date.now() + 1000 })).toString('base64url');
    expect(verifyEmailProof(`${forged}.${signature}`, 'inscription')).toBeNull();
  });

  it('refuse un jeton signé avec un autre secret', () => {
    const token = createEmailProof('marie@example.com', 'inscription');
    process.env.EMAIL_PROOF_SECRET = 'secret-b';
    expect(verifyEmailProof(token, 'inscription')).toBeNull();
  });

  it('refuse un jeton expiré (24 h)', () => {
    const now = Date.now();
    const token = createEmailProof('marie@example.com', 'inscription', now);
    expect(verifyEmailProof(token, 'inscription', now + EMAIL_PROOF_TTL_MS - 1000)).toBe('marie@example.com');
    expect(verifyEmailProof(token, 'inscription', now + EMAIL_PROOF_TTL_MS + 1000)).toBeNull();
  });

  it('refuse une autre finalité', () => {
    const token = createEmailProof('marie@example.com', 'inscription');
    // @ts-expect-error — finalité inconnue, volontairement hors du type
    expect(verifyEmailProof(token, 'autre')).toBeNull();
  });

  it.each([undefined, null, 42, '', 'abc', 'a.b.c', '.', 'x.'])('refuse %s sans lever d’exception', (value) => {
    expect(verifyEmailProof(value, 'inscription')).toBeNull();
  });
});

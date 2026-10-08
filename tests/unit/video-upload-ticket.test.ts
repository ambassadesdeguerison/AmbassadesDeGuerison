import { describe, it, expect, beforeAll } from 'vitest';
import { createUploadTicket, verifyUploadTicket, UPLOAD_TICKET_TTL_MS } from '@/lib/video/upload-ticket';

const ticket = { profileId: 'p1', uploadId: 42, fileName: 'p1-1.mp4' };

describe('billet d’envoi de vidéo', () => {
  beforeAll(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret';
  });

  it('accepte un billet authentique pour son candidat', () => {
    expect(verifyUploadTicket(createUploadTicket(ticket), 'p1')).toEqual(ticket);
  });

  it('refuse le billet d’un autre candidat', () => {
    expect(verifyUploadTicket(createUploadTicket(ticket), 'p2')).toBeNull();
  });

  it('refuse un billet expiré ou falsifié', () => {
    const old = createUploadTicket(ticket, Date.now() - UPLOAD_TICKET_TTL_MS - 1000);
    expect(verifyUploadTicket(old, 'p1')).toBeNull();
    const [payload, sig] = createUploadTicket(ticket).split('.');
    const forged = Buffer.from(JSON.stringify({ ...ticket, uploadId: 43, x: Date.now() + 1e6 })).toString('base64url');
    expect(verifyUploadTicket(`${forged}.${sig}`, 'p1')).toBeNull();
    expect(verifyUploadTicket(payload, 'p1')).toBeNull();
    expect(verifyUploadTicket(undefined, 'p1')).toBeNull();
  });
});

import { pcloudFileName } from '@/lib/video/filename';

describe('nom de fichier pCloud', () => {
  it('commence par le prénom et le nom, sans accent', () => {
    const name = pcloudFileName(
      { id: 'abcdef12-0000', first_name: 'Marie-Hélène', last_name: 'Dupont' },
      'mp4',
      new Date('2026-10-08T15:30:45Z')
    );
    expect(name).toBe('marie-helene-dupont-2026-10-08-1530-abcdef12.mp4');
  });

  it('retombe sur « ambassadeur » sans nom', () => {
    expect(pcloudFileName({ id: 'abcdef12-0000' }, 'webm', new Date('2026-10-08T15:30:00Z'))).toMatch(/^ambassadeur-/);
  });
});

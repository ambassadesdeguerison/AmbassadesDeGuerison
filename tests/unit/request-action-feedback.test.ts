import { describe, it, expect } from 'vitest';
import { requestActionFeedback } from '@/lib/dashboard/request-action-feedback';

describe('requestActionFeedback — accepter', () => {
  it('e-mail parti : confirme que le visiteur a reçu l’adresse', () => {
    const f = requestActionFeedback({ action: 'accept', emailSent: true, visitorFirstName: 'Marie' });
    expect(f.tone).toBe('success');
    expect(f.title).toBe('Demande de Marie acceptée');
    expect(f.description).toMatch(/Marie vient de recevoir un e-mail/);
  });

  it('e-mail non parti : avertit que le visiteur n’a pas l’adresse et dit quoi faire', () => {
    const f = requestActionFeedback({ action: 'accept', emailSent: false, visitorFirstName: 'Marie' });
    expect(f.tone).toBe('warning');
    expect(f.title).toContain("l'e-mail n'est pas parti");
    expect(f.description).toMatch(/n'a pas reçu votre adresse/);
    expect(f.description).toMatch(/Écrivez-lui|prévenez l'équipe/);
  });

  it('e-mails désactivés (null) : n’affirme rien sur un e-mail', () => {
    const f = requestActionFeedback({ action: 'accept', emailSent: null, visitorFirstName: 'Marie' });
    expect(f.tone).toBe('success');
    expect(f.description).toBeUndefined();
  });

  it('champ absent (ancienne réponse API) : même comportement que null', () => {
    const f = requestActionFeedback({ action: 'accept', emailSent: undefined, visitorFirstName: 'Marie' });
    expect(f.description).toBeUndefined();
  });

  it('élide devant une voyelle', () => {
    const f = requestActionFeedback({ action: 'accept', emailSent: null, visitorFirstName: 'Étienne' });
    expect(f.title).toBe("Demande d'Étienne acceptée");
  });

  it('sans prénom : pas de « de » orphelin', () => {
    const f = requestActionFeedback({ action: 'accept', emailSent: true, visitorFirstName: '  ' });
    expect(f.title).toBe('Demande acceptée');
    expect(f.description).toMatch(/^Le visiteur vient de recevoir/);
  });
});

describe('requestActionFeedback — décliner', () => {
  it('refus simple : la personne pourra redemander', () => {
    const f = requestActionFeedback({ action: 'decline', emailSent: true, visitorFirstName: 'Paul' });
    expect(f.tone).toBe('success');
    expect(f.title).toBe('Demande de Paul déclinée');
    expect(f.description).toMatch(/pourra redemander/);
  });

  it('refus simple, e-mail non parti : avertissement', () => {
    const f = requestActionFeedback({ action: 'decline', emailSent: false, visitorFirstName: 'Paul' });
    expect(f.tone).toBe('warning');
    expect(f.description).toMatch(/pas été prévenu/);
  });

  it('refus définitif : rappelle que c’est définitif et que les autres ambassades restent ouvertes', () => {
    const f = requestActionFeedback({ action: 'decline', permanent: true, emailSent: true, visitorFirstName: 'Paul' });
    expect(f.title).toBe("Vous n'accueillerez plus Paul");
    expect(f.description).toMatch(/autres ambassades/);
    expect(f.description).not.toMatch(/redemander/);
  });

  it('refus définitif sans prénom', () => {
    const f = requestActionFeedback({ action: 'decline', permanent: true, emailSent: null, visitorFirstName: '' });
    expect(f.title).toBe("Vous n'accueillerez plus cette personne");
  });
});

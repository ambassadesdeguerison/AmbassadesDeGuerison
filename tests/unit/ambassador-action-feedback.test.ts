import { describe, it, expect } from 'vitest';
import { ambassadorActionFeedback } from '@/lib/admin/ambassador-action-feedback';

const base = { firstName: 'Camille', email: 'camille@example.com' };

describe('ambassadorActionFeedback — validation', () => {
  it('e-mail parti : confirme la validation ET l’envoi, avec l’adresse', () => {
    const f = ambassadorActionFeedback({ ...base, action: 'validated', resultingStatus: 'validated', candidateEmail: 'sent' });
    expect(f.tone).toBe('success');
    expect(f.title).toBe('Ambassade de Camille validée');
    expect(f.description).toContain('camille@example.com');
    expect(f.description).toMatch(/envoyé/);
  });

  it('e-mail non parti : avertit, dit que la validation a eu lieu, et ne prétend pas l’envoi', () => {
    const f = ambassadorActionFeedback({ ...base, action: 'validated', resultingStatus: 'validated', candidateEmail: 'failed' });
    expect(f.tone).toBe('warning');
    expect(f.title).toContain('validée');
    expect(f.title).toContain("l'e-mail n'est pas parti");
    expect(f.description).not.toMatch(/a été envoyé/);
    expect(f.description).toContain('camille@example.com');
  });

  it('aucun e-mail concerné : ne mentionne aucun e-mail', () => {
    const f = ambassadorActionFeedback({ ...base, action: 'validated', resultingStatus: 'validated', candidateEmail: 'none' });
    expect(f.tone).toBe('success');
    expect(f.description).toBeUndefined();
  });

  it('validated_bypass se comporte comme validated', () => {
    const f = ambassadorActionFeedback({ ...base, action: 'validated_bypass', resultingStatus: 'validated', candidateEmail: 'sent' });
    expect(f.title).toBe('Ambassade de Camille validée');
  });

  it('élide devant une voyelle (« d’Étienne », jamais « de Étienne »)', () => {
    const f = ambassadorActionFeedback({ ...base, firstName: 'Étienne', action: 'validated', resultingStatus: 'validated', candidateEmail: 'none' });
    expect(f.title).toBe("Ambassade d'Étienne validée");
  });
});

describe('ambassadorActionFeedback — refus', () => {
  it('e-mail de refus parti', () => {
    const f = ambassadorActionFeedback({ ...base, action: 'rejected', resultingStatus: 'rejected', candidateEmail: 'sent' });
    expect(f.tone).toBe('success');
    expect(f.title).toBe('Candidature de Camille refusée');
    expect(f.description).toContain('e-mail de refus a été envoyé');
  });

  it('e-mail de refus non parti : la personne n’a pas été prévenue, et on le dit', () => {
    const f = ambassadorActionFeedback({ ...base, action: 'rejected', resultingStatus: 'rejected', candidateEmail: 'failed' });
    expect(f.tone).toBe('warning');
    expect(f.description).toMatch(/n'a pas été prévenue/);
  });
});

describe('ambassadorActionFeedback — suspension et réintégration', () => {
  it('suspension : dit qu’elle disparaît de la carte', () => {
    const f = ambassadorActionFeedback({ ...base, action: 'suspended', resultingStatus: 'suspended', candidateEmail: 'none' });
    expect(f.title).toBe('Ambassade de Camille suspendue');
    expect(f.description).toMatch(/carte publique/);
  });

  it('réintégration d’un dossier complet : validée, e-mail confirmé', () => {
    const f = ambassadorActionFeedback({ ...base, action: 'reactiver', resultingStatus: 'validated', candidateEmail: 'sent' });
    expect(f.tone).toBe('success');
    expect(f.title).toBe('Ambassade de Camille réintégrée');
    expect(f.description).toContain('camille@example.com');
  });

  it('réintégration d’un dossier incomplet : ne promet pas la carte, dit qu’aucun e-mail n’est parti', () => {
    const f = ambassadorActionFeedback({ ...base, action: 'reactiver', resultingStatus: 'enrichment_pending', candidateEmail: 'none' });
    expect(f.title).toMatch(/questionnaire/);
    expect(f.title).not.toMatch(/réintégrée/);
    expect(f.description).toMatch(/Aucun e-mail/);
  });

  it('réintégration : e-mail non parti → avertissement', () => {
    const f = ambassadorActionFeedback({ ...base, action: 'reactiver', resultingStatus: 'validated', candidateEmail: 'failed' });
    expect(f.tone).toBe('warning');
  });
});

import { describe, it, expect } from 'vitest';
import { describePickedVideoProblem, spokenDuration } from '@/lib/video/recorder-support';

describe('contrôle d’une vidéo choisie', () => {
  const base = {
    durationSeconds: 60,
    bytes: 20 * 1024 * 1024,
    maxSeconds: 90,
    maxBytes: 100 * 1024 * 1024,
    canRecord: true,
  };

  it('accepte une vidéo dans les limites, de durée inconnue, ou à peine au-dessus (tolérance)', () => {
    expect(describePickedVideoProblem(base)).toBeNull();
    expect(describePickedVideoProblem({ ...base, durationSeconds: null })).toBeNull();
    expect(describePickedVideoProblem({ ...base, durationSeconds: 92 })).toBeNull();
  });

  it('refuse une vidéo trop longue et renvoie vers « Ouvrir la caméra »', () => {
    const msg = describePickedVideoProblem({ ...base, durationSeconds: 200 })!;
    expect(msg).toContain('3 min 20 s');
    expect(msg).toContain('1 min 30');
    expect(msg).toContain('Ouvrir la caméra');
  });

  it('refuse une vidéo trop lourde ; sans enregistrement en page, renvoie vers « Filmer avec mon appareil »', () => {
    const msg = describePickedVideoProblem({ ...base, bytes: 300 * 1024 * 1024, canRecord: false })!;
    expect(msg).toContain('300 Mo');
    expect(msg).toContain('Filmer avec mon appareil');
  });

  it('dit la durée à voix haute', () => {
    expect(spokenDuration(45)).toBe('45 s');
    expect(spokenDuration(120)).toBe('2 min');
  });
});

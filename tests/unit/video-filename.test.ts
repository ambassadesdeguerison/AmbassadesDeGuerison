import { describe, it, expect } from 'vitest';
import { slugifyName, videoDownloadName } from '@/lib/video/filename';

describe('nom de fichier de téléchargement', () => {
  it('retire accents, espaces et caractères spéciaux', () => {
    expect(slugifyName('Marie-Hélène', 'D’Ouville')).toBe('marie-helene-d-ouville');
    expect(slugifyName(null, 'Dupont')).toBe('dupont');
  });

  it('ne produit jamais de chemin (pas de / ni ..)', () => {
    expect(slugifyName('../../etc', 'passwd')).toBe('etc-passwd');
  });

  it('videoDownloadName choisit l’extension d’après le type MIME', () => {
    expect(videoDownloadName('Marie', 'Dupont', 'video/webm')).toBe('presentation-marie-dupont.webm');
    expect(videoDownloadName('Marie', 'Dupont', 'video/mp4')).toBe('presentation-marie-dupont.mp4');
  });

  it('retombe sur « ambassadeur » si le nom est vide', () => {
    expect(videoDownloadName('', '', null)).toBe('presentation-ambassadeur.mp4');
  });
});

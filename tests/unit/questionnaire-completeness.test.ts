import { describe, it, expect } from 'vitest';
import { missingFields, missingBySection, joinLabels, type QuestionnaireAnswers } from '@/lib/questionnaire/completeness';

const COMPLETE: QuestionnaireAnswers = {
  church_attendance: 'regular',
  denomination: 'évangélique',
  has_leadership_role: false,
  leadership_role: '',
  has_seen_healings: true,
  presentation_message: 'Bienvenue chez nous !',
  live_screen: 'Télévision',
};
const PHOTOS_OK = { hasProfilePhoto: true, roomPhotoCount: 1 };

describe('missingFields', () => {
  it('dossier complet → rien ne manque', () => {
    expect(missingFields(COMPLETE, PHOTOS_OK)).toEqual([]);
  });

  it('liste ce qui manque, par section', () => {
    const empty: QuestionnaireAnswers = {
      church_attendance: '',
      denomination: '',
      has_leadership_role: null,
      leadership_role: '',
      has_seen_healings: null,
      presentation_message: '',
      live_screen: '',
    };
    const missing = missingFields(empty, { hasProfilePhoto: false, roomPhotoCount: 0 });
    const bySection = missingBySection(missing);

    expect(bySection.pratique).toHaveLength(3);
    expect(bySection.parcours).toHaveLength(1);
    expect(bySection.photos).toHaveLength(4); // photo de profil, message d’accueil, photo du lieu, écran du live
    expect(bySection.formations).toHaveLength(0); // la liste formations et livres est facultative
  });

  it('« non » à la responsabilité ne demande pas la fonction ; « oui » la demande', () => {
    expect(missingFields({ ...COMPLETE, has_leadership_role: false }, PHOTOS_OK)).toEqual([]);
    const withRoleMissing = missingFields({ ...COMPLETE, has_leadership_role: true, leadership_role: '  ' }, PHOTOS_OK);
    expect(withRoleMissing.map((m) => m.label)).toEqual(['la fonction que vous exercez']);
  });

  it('la dénomination n’est pas exigée de qui ne fréquente aucune église', () => {
    expect(missingFields({ ...COMPLETE, church_attendance: 'none', denomination: '' }, PHOTOS_OK)).toEqual([]);
    expect(missingFields({ ...COMPLETE, church_attendance: 'regular', denomination: ' ' }, PHOTOS_OK)).toHaveLength(1);
  });

  it('« non » est une réponse : seul « pas répondu » (null) manque', () => {
    expect(missingFields({ ...COMPLETE, has_seen_healings: false }, PHOTOS_OK)).toEqual([]);
    expect(missingFields({ ...COMPLETE, has_seen_healings: null }, PHOTOS_OK)).toHaveLength(1);
  });

  it('une seule photo du lieu suffit', () => {
    expect(missingFields(COMPLETE, { hasProfilePhoto: true, roomPhotoCount: 1 })).toEqual([]);
    expect(missingFields(COMPLETE, { hasProfilePhoto: true, roomPhotoCount: 0 })).toHaveLength(1);
  });
});

describe('message d’accueil', () => {
  it('obligatoire : vide, espaces ou null le signalent, dans la section photos', () => {
    for (const v of ['', '   ', null]) {
      const missing = missingFields({ ...COMPLETE, presentation_message: v }, PHOTOS_OK);
      expect(missing).toEqual([{ section: 'photos', label: 'votre message d’accueil' }]);
    }
  });
});

describe('écran du live', () => {
  it('obligatoire : vide, espaces ou null le signalent, dans la section photos', () => {
    for (const v of ['', '   ', null]) {
      const missing = missingFields({ ...COMPLETE, live_screen: v }, PHOTOS_OK);
      expect(missing).toEqual([{ section: 'photos', label: 'ce sur quoi vous regarderez le live' }]);
    }
  });
});

describe('joinLabels', () => {
  it('formate « a, b et c »', () => {
    expect(joinLabels([])).toBe('');
    expect(joinLabels(['a'])).toBe('a');
    expect(joinLabels(['a', 'b'])).toBe('a et b');
    expect(joinLabels(['a', 'b', 'c'])).toBe('a, b et c');
  });
});

describe('missingFields — valeurs nulles', () => {
  it('ne plante pas sur des champs texte null (colonnes SQL vides) et les signale', () => {
    const nulls: QuestionnaireAnswers = {
      church_attendance: null,
      denomination: null,
      has_leadership_role: true,
      leadership_role: null,
      has_seen_healings: null,
      presentation_message: null,
      live_screen: null,
    };
    const labels = missingFields(nulls, PHOTOS_OK).map((m) => m.label);
    expect(labels).toContain('la fréquentation d\u2019une église');
    expect(labels).toContain('la fonction que vous exercez');
  });
});

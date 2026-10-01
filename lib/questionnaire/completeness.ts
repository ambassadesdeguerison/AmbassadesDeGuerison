// Ce qui manque encore pour envoyer le questionnaire enrichi.
//
// Règle (David, 2026-10-01) : tous les champs sont obligatoires, sauf
//   - la vidéo de présentation (dépend de la caméra et du navigateur du candidat),
//   - la liste « formations et livres » (on peut n'avoir rien suivi ni lu),
//   - le parcours écrit (simple secours si la vidéo pose problème).
// La dénomination n'est pas exigée de qui ne fréquente aucune église.

export type SectionId = 'formations' | 'pratique' | 'parcours' | 'photos';

export type MissingItem = { section: SectionId; label: string };

export type QuestionnaireAnswers = {
  church_attendance: string;
  denomination: string;
  has_leadership_role: boolean | null;
  leadership_role: string;
  has_seen_healings: boolean | null;
};

export type PhotoStatus = { hasProfilePhoto: boolean; roomPhotoCount: number };

export function missingFields(answers: QuestionnaireAnswers, photos: PhotoStatus): MissingItem[] {
  const missing: MissingItem[] = [];

  if (!answers.church_attendance) {
    missing.push({ section: 'pratique', label: 'la fréquentation d’une église' });
  }
  if (answers.church_attendance !== 'none' && !answers.denomination.trim()) {
    missing.push({ section: 'pratique', label: 'la dénomination' });
  }
  if (answers.has_leadership_role === null) {
    missing.push({ section: 'pratique', label: 'votre fonction de responsabilité (oui ou non)' });
  } else if (answers.has_leadership_role && !answers.leadership_role.trim()) {
    missing.push({ section: 'pratique', label: 'la fonction que vous exercez' });
  }

  if (answers.has_seen_healings === null) {
    missing.push({ section: 'parcours', label: 'les guérisons vues (oui ou non)' });
  }

  if (!photos.hasProfilePhoto) missing.push({ section: 'photos', label: 'la photo de profil' });
  if (photos.roomPhotoCount === 0) missing.push({ section: 'photos', label: 'une photo du lieu d’accueil' });

  return missing;
}

export function missingBySection(items: MissingItem[]): Record<SectionId, MissingItem[]> {
  const out: Record<SectionId, MissingItem[]> = { formations: [], pratique: [], parcours: [], photos: [] };
  for (const item of items) out[item.section].push(item);
  return out;
}

/** « a, b et c » */
export function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`;
}

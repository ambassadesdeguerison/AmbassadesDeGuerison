// Ce qui manque au dossier d'un candidat, vu depuis /admin/ambassadeurs.
//
// Extrait de components/AmbassadeursTable.tsx (2026-08-07) : le test unitaire
// réimplémentait la fonction au lieu de l'importer, et validait donc sa propre
// copie — le changement de signature `string[]` → `{blocking, informational}`
// est passé sans qu'aucun test ne bronche.
//
// `blocking` correspond exactement à l'invariant `isDossierComplet` appliqué
// par l'API : ce sont les seuls manques qui empêchent une validation.
// `informational` n'empêche rien mais aide au discernement — les compter
// ensemble faisait afficher « 1 manquant » sur un dossier parfaitement
// validable, sans que l'admin sache si c'était bloquant.

export type QuestionnaireGaps = {
  blocking: string[];
  informational: string[];
};

export type QuestionnaireGapsInput = {
  profile_photo_signed_url: string | null;
  room_photo_signed_urls: string[];
  parcours_spirituel: string | null;
  /** Chemin de la vidéo de présentation, ou null. */
  intro_video_path: string | null;
};

export function questionnaireGaps(a: QuestionnaireGapsInput): QuestionnaireGaps {
  const blocking: string[] = [];
  if (!a.profile_photo_signed_url) blocking.push('photo de profil manquante');
  if (a.room_photo_signed_urls.length === 0) blocking.push('photo du lieu manquante');

  const informational: string[] = [];
  // Depuis le questionnaire v2, la vidéo remplace le parcours écrit (qui reste un secours si la
  // vidéo pose problème) : seul « ni l'un ni l'autre » est un manque, et il reste informatif.
  if (!a.intro_video_path && !a.parcours_spirituel) informational.push('ni vidéo de présentation ni parcours écrit');

  return { blocking, informational };
}

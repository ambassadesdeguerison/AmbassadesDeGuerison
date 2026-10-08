import { extensionForMime } from './recorder-support';

/** « Marie-Hélène Dupont » → « marie-helene-dupont » : sûr dans un nom de fichier, sans accent. */
export function slugifyName(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Nom proposé au téléchargement : `presentation-marie-dupont.mp4`. */
export function videoDownloadName(firstName: string, lastName: string, mime: string | null): string {
  const slug = slugifyName(firstName, lastName) || 'ambassadeur';
  return `presentation-${slug}.${extensionForMime(mime ?? '')}`;
}

/**
 * Nom du fichier dans pCloud, lisible quand David parcourt les dossiers année/mois :
 * `marie-dupont-2026-10-08-1530-ab12cd34.mp4`. L'identifiant court départage deux homonymes ;
 * l'appartenance à un candidat n'en dépend pas (elle est portée par le billet signé).
 */
export function pcloudFileName(
  profile: { id: string; first_name?: string | null; last_name?: string | null },
  extension: string,
  now = new Date()
): string {
  const slug = slugifyName(profile.first_name, profile.last_name) || 'ambassadeur';
  const stamp = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  return `${slug}-${stamp}-${profile.id.slice(0, 8)}.${extension}`;
}

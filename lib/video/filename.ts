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

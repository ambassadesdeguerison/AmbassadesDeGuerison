// Redirection post-connexion : uniquement un chemin relatif de notre propre app.
// `//evil.com` et `/\evil.com` sont lus comme des URL externes par les navigateurs (open redirect).
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined;
  return value;
}

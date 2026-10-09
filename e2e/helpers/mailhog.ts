// Accès à Mailhog (SMTP local de test, voir docker-compose.yml) depuis les tests E2E.
// Prérequis : `npm run mailhog` + `USE_MAILHOG=true` et `MAILHOG_SMTP_HOST=127.0.0.1` dans .env.local,
// serveur de dev redémarré après modification.

const MAILHOG_API = process.env.MAILHOG_API_URL ?? 'http://localhost:8025';

interface MailhogMessage {
  Content: { Headers: Record<string, string[]>; Body: string };
}

// Le corps est en quoted-printable : `=\r\n` coupe une ligne, `=3D` vaut `=`.
function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

// En-têtes non ASCII : `=?UTF-8?Q?Confirmez_votre_adresse_=E2=80=94?=` (Q) ou `=?UTF-8?B?...?=` (base64).
function decodeMimeHeader(input: string): string {
  return input
    .replace(/\?=\s+=\?/g, '?==?') // des mots encodés adjacents se recollent
    .replace(/=\?UTF-8\?([QB])\?(.*?)\?=/gi, (_, enc: string, text: string) => {
      if (enc.toUpperCase() === 'B') return Buffer.from(text, 'base64').toString('utf8');
      const bytes = text.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (__, h: string) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(bytes, 'latin1').toString('utf8');
    });
}

export interface ReceivedMail {
  subject: string;
  html: string;
}

/** Attend le message le plus récent adressé à `to` (Mailhog classe du plus récent au plus ancien). */
export async function waitForMail(to: string, timeoutMs = 20_000): Promise<ReceivedMail> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILHOG_API}/api/v2/search?kind=to&query=${encodeURIComponent(to)}&limit=1`).catch(() => null);
    if (res?.ok) {
      const data = (await res.json()) as { items: MailhogMessage[] };
      const msg = data.items[0];
      if (msg) {
        const subject = decodeMimeHeader(msg.Content.Headers.Subject?.[0] ?? '');
        return { subject, html: decodeQuotedPrintable(msg.Content.Body) };
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Aucun e-mail reçu dans Mailhog pour ${to} (Mailhog démarré ? USE_MAILHOG=true ? serveur dev redémarré ?)`);
}

/** Premier lien de l'e-mail dont l'URL contient `fragment`, avec les entités HTML décodées. */
export function findLink(html: string, fragment: string): string {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const link = hrefs.find((h) => h.includes(fragment));
  if (!link) throw new Error(`Aucun lien contenant « ${fragment} » dans l'e-mail (liens : ${hrefs.join(', ')})`);
  return link;
}

export async function mailCount(to: string): Promise<number> {
  const res = await fetch(`${MAILHOG_API}/api/v2/search?kind=to&query=${encodeURIComponent(to)}&limit=50`);
  return ((await res.json()) as { total: number }).total;
}

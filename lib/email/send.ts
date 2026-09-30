import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import type * as React from 'react';

interface MailPayload {
  from: string;
  to: string;
  subject: string;
  react: React.ReactElement;
}

function isMailhogEnabled() {
  return process.env.USE_MAILHOG === 'true';
}

// Un nouveau transport par envoi (pas de singleton partagé) : filet de sécurité
// en cas de connexion SMTP keep-alive qui traînerait fermée côté serveur.
// MAILHOG_SMTP_HOST doit rester 127.0.0.1 (pas "localhost") — la résolution
// localhost peut basculer entre IPv4/IPv6 selon l'environnement (Docker
// Desktop/WSL2 sous Windows), causant des "Unexpected socket close"
// intermittents et silencieux (trouvé par David, 2026-08-07).
function getMailhogTransport() {
  return nodemailer.createTransport({
    host: process.env.MAILHOG_SMTP_HOST || 'localhost',
    port: Number(process.env.MAILHOG_SMTP_PORT || 1025),
    ignoreTLS: true,
  });
}

let resendClient: Resend | null = null;

function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * Point d'entrée unique pour l'envoi d'e-mails. Route vers Mailhog (SMTP local, capturé
 * dans son dashboard web) quand USE_MAILHOG=true, sinon vers Resend (API HTTP réelle).
 * Même signature que `new Resend().emails.send(...)` pour ne rien changer dans templates.ts.
 */
export function getMailer() {
  return {
    emails: {
      async send({ from, to, subject, react }: MailPayload) {
        if (isMailhogEnabled()) {
          const html = await render(react);
          try {
            return await getMailhogTransport().sendMail({ from, to, subject, html });
          } catch (err) {
            console.error(`[email] Échec envoi Mailhog vers ${to} ("${subject}"):`, err);
            throw err;
          }
        }
        const result = await getResendClient().emails.send({ from, to, subject, react });
        if (result.error) {
          console.error(`[email] Échec envoi Resend vers ${to} ("${subject}"):`, result.error);
          throw new Error(result.error.message);
        }
        return result;
      },
    },
  };
}

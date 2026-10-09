// Texte de la notification affichée à l'ambassadeur après avoir accepté ou refusé
// une demande de visite depuis son dashboard (`POST /api/visit-requests/[token]/accept|decline`).
//
// Fonction pure, comme `lib/admin/ambassador-action-feedback.ts` : le message dépend de
// l'action et de l'issue de l'e-mail au visiteur, et il ne doit jamais annoncer
// un e-mail « envoyé » que l'API n'a pas confirmé.
//
// Ton : l'ambassadeur n'est pas toujours à l'aise avec le numérique — phrases
// courtes, pas de jargon, et ce qu'il reste à faire quand quelque chose a échoué.

import { de } from '@/lib/elision';

export interface RequestActionFeedback {
  tone: 'success' | 'warning';
  title: string;
  description?: string;
}

export function requestActionFeedback(input: {
  action: 'accept' | 'decline';
  permanent?: boolean;
  /** `true` parti, `false` devait partir et n'est pas parti, `null`/absent : e-mails désactivés. */
  emailSent: boolean | null | undefined;
  visitorFirstName: string;
}): RequestActionFeedback {
  const { action, permanent = false, emailSent, visitorFirstName } = input;
  const name = visitorFirstName.trim();
  const who = name || 'Le visiteur';
  // « Demande de Marie », « Demande d'Étienne » — jamais « de Étienne » (lib/elision.ts).
  const demande = name ? `Demande ${de(name)}` : 'Demande';

  if (action === 'accept') {
    const title = `${demande} acceptée`;
    if (emailSent === true) {
      return {
        tone: 'success',
        title,
        description: `${who} vient de recevoir un e-mail avec votre adresse et vos coordonnées.`,
      };
    }
    if (emailSent === false) {
      return {
        tone: 'warning',
        title: `${title}, mais l'e-mail n'est pas parti`,
        description: `${who} n'a pas reçu votre adresse. Écrivez-lui directement, ou prévenez l'équipe.`,
      };
    }
    return { tone: 'success', title };
  }

  // Refus définitif : la décision est irréversible dans l'app, on la rappelle.
  if (permanent) {
    return {
      tone: emailSent === false ? 'warning' : 'success',
      title: `Vous n'accueillerez plus ${name || 'cette personne'}`,
      description:
        emailSent === false
          ? "Aucune demande de cette personne ne vous parviendra plus. Elle n'a pas pu être prévenue par e-mail."
          : 'Aucune demande de cette personne ne vous parviendra plus. Les autres ambassades lui restent ouvertes.',
    };
  }

  const title = `${demande} déclinée`;
  if (emailSent === false) {
    return {
      tone: 'warning',
      title: `${title}, mais l'e-mail n'est pas parti`,
      description: `${who} n'a pas été prévenu(e). Cette personne pourra redemander pour un autre live.`,
    };
  }
  return {
    tone: 'success',
    title,
    description: `${who} pourra redemander pour un autre live.`,
  };
}

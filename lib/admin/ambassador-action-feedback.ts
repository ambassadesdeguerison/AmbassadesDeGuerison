// Texte de la notification affichée après une action admin sur un ambassadeur
// (`POST /api/admin/ambassadeurs/[id]/status`).
//
// Fonction pure, pour deux raisons :
// - le message dépend de trois choses (l'action, le statut obtenu, l'issue de
//   l'e-mail) et deux de ces combinaisons ne sont pas évidentes : « validé mais
//   l'e-mail n'est pas parti » et « réintégré mais dossier incomplet » ;
// - elle se teste sans DOM.
//
// Règle : ne jamais écrire « e-mail envoyé » sans que l'API l'ait confirmé.

import { de } from '@/lib/elision';

export type CandidateEmail = 'sent' | 'failed' | 'none';

export interface ActionFeedback {
  tone: 'success' | 'warning';
  title: string;
  description?: string;
}

export function ambassadorActionFeedback(input: {
  action: string;
  /** Statut obtenu après l'action (renvoyé par l'API). */
  resultingStatus: string;
  candidateEmail: CandidateEmail;
  firstName: string;
  email: string;
}): ActionFeedback {
  const { action, resultingStatus, candidateEmail, firstName, email } = input;
  const ambassade = `Ambassade ${de(firstName)}`;

  switch (action) {
    case 'validated':
    case 'validated_bypass':
      return withEmail(candidateEmail, {
        done: `${ambassade} validée`,
        sent: `Un e-mail de bienvenue a été envoyé à ${email}.`,
        failed: `Prévenez ${email} vous-même : sa candidature est acceptée.`,
      });

    case 'rejected':
      return withEmail(candidateEmail, {
        done: `Candidature ${de(firstName)} refusée`,
        sent: `Un e-mail de refus a été envoyé à ${email}.`,
        failed: `La personne n'a pas été prévenue. Vous pouvez lui écrire à ${email}.`,
      });

    case 'suspended':
      return {
        tone: 'success',
        title: `${ambassade} suspendue`,
        description: "Elle n'apparaît plus sur la carte publique et ne reçoit plus de demandes de visite.",
      };

    case 'reactiver':
      // Deux issues très différentes derrière le même bouton : l'admin s'attend à
      // remettre l'ambassade sur la carte, or un dossier sans photos repart vers
      // le questionnaire (audit 2.4).
      if (resultingStatus !== 'validated') {
        return {
          tone: 'success',
          title: 'Dossier renvoyé vers le questionnaire',
          description: `Les photos de ${firstName} manquent : l'ambassade ne revient pas sur la carte tant que le dossier n'est pas complet. Aucun e-mail n'a été envoyé.`,
        };
      }
      return withEmail(candidateEmail, {
        done: `${ambassade} réintégrée`,
        sent: `Un e-mail de confirmation a été envoyé à ${email}.`,
        failed: `Prévenez ${email} vous-même : l'ambassade est de nouveau active.`,
      });

    default:
      return { tone: 'success', title: 'Action enregistrée' };
  }
}

function withEmail(
  outcome: CandidateEmail,
  text: { done: string; sent: string; failed: string }
): ActionFeedback {
  if (outcome === 'sent') return { tone: 'success', title: text.done, description: text.sent };
  if (outcome === 'failed') {
    // Le changement a bien eu lieu : on le dit d'abord, puis ce qui reste à faire.
    return {
      tone: 'warning',
      title: `${text.done}, mais l'e-mail n'est pas parti`,
      description: text.failed,
    };
  }
  return { tone: 'success', title: text.done };
}

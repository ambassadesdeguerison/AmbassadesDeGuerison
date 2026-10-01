import * as React from 'react';

import { getMailer } from './send';

import MagicLink from '@/emails/magic-link';
import NouvelleInscriptionAdmin from '@/emails/nouvelle-inscription-admin';
import AideVisiteurAdmin from '@/emails/aide-visiteur-admin';
import ValidationFinale from '@/emails/validation-finale';
import RefusCandidature from '@/emails/refus-candidature';
import RegistrationConfirmation from '@/emails/registration-confirmation';
import CampagneAmbassadeurs from '@/emails/campagne-ambassadeurs';
import FeedbackPostLive from '@/emails/feedback-post-live';
import FeedbackPostLiveHost from '@/emails/feedback-post-live-host';
import ContactReceivedHost from '@/emails/contact-received-host';
import ContactDeclined from '@/emails/contact-declined';
import AcceptationVisite from '@/emails/acceptation-visite';
import RefusVisite from '@/emails/refus-visite';
import CampagneVisiteurs from '@/emails/campagne-visiteurs';
import SignalApproved from '@/emails/signal-approved';
import NouvelleActivationAdmin from '@/emails/nouvelle-activation-admin';
import EnrichissementRecu from '@/emails/enrichissement-recu';
import AdminAlerteNoActivations from '@/emails/admin-alerte-no-activations';
import AmbassadeurModificationAdmin from '@/emails/ambassadeur-modification-admin';
import VisitorCompteCree from '@/emails/visitor-compte-cree';

const FROM = () => process.env.RESEND_FROM_EMAIL!;
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL!;

export async function sendMagicLink(to: string, magicLinkUrl: string) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: 'Votre lien de connexion — Ambassades de Guérison',
    react: React.createElement(MagicLink, { magicLinkUrl }),
  });
}

// Envoyée une seule fois, à la création du compte visiteur (jamais à chaque
// demande de visite suivante) — cf /api/visitor/account. Copie dédiée,
// distincte de sendMagicLink (générique, orientée "espace ambassadeur").
export async function sendVisitorCompteCree(to: string, firstName: string, confirmUrl: string) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: 'Votre compte a bien été créé — Ambassades de Guérison',
    react: React.createElement(VisitorCompteCree, { firstName, confirmUrl }),
  });
}

export async function sendValidationFinale(to: string, firstName: string) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: `Bienvenue dans la famille des Ambassades de Guérison, ${firstName} !`,
    react: React.createElement(ValidationFinale, {
      firstName,
      dashboardUrl: `${APP_URL()}/dashboard`,
      carteUrl: APP_URL(),
    }),
  });
}

export async function sendRefusCandidature(to: string, firstName: string, reason?: string) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: 'Votre candidature d\'ambassadeur — mise à jour',
    react: React.createElement(RefusCandidature, { firstName, reason }),
  });
}

export async function sendRegistrationConfirmation(to: string, firstName: string, continueUrl?: string) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: `${firstName}, votre inscription est confirmée !`,
    react: React.createElement(RegistrationConfirmation, {
      firstName,
      // Lien de connexion direct quand il est fourni ; sinon /dashboard (repli).
      dashboardUrl: continueUrl ?? `${APP_URL()}/dashboard`,
    }),
  });
}

export async function sendCampagneAmbassadeurs(
  to: string,
  firstName: string,
  eventTitle: string,
  eventDate: string,
  activateUrl: string,
  customMessage?: string,
) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: 'Le prochain live approche — allez-vous ouvrir votre ambassade ?',
    react: React.createElement(CampagneAmbassadeurs, { firstName, eventTitle, eventDate, activateUrl, customMessage }),
  });
}

export async function sendFeedbackPostLive(to: string, firstName: string, eventTitle: string, feedbackUrl: string) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: `Comment s'est passé votre soirée ? — ${eventTitle}`,
    react: React.createElement(FeedbackPostLive, { firstName, eventTitle, feedbackUrl }),
  });
}

export async function sendFeedbackPostLiveHost(to: string, firstName: string, eventTitle: string, feedbackUrl: string) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: `Comment s'est passé votre accueil ? — ${eventTitle}`,
    react: React.createElement(FeedbackPostLiveHost, { firstName, eventTitle, feedbackUrl }),
  });
}

export async function sendNewContactRequestHost(
  to: string,
  hostFirstName: string,
  visitorFirstName: string,
  visitorEmail: string,
  visitorWhatsapp: string | null,
  visitorMessage: string | null,
  acceptUrl: string,
  declineUrl: string,
  dashboardUrl?: string | null,
) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: `${visitorFirstName} souhaite rejoindre votre ambassade`,
    react: React.createElement(ContactReceivedHost, {
      hostFirstName, visitorFirstName, visitorEmail, visitorWhatsapp, visitorMessage, acceptUrl, declineUrl, dashboardUrl,
    }),
  });
}

export async function sendContactRequestDeclined(to: string, visitorFirstName: string, hostFirstName: string) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: `Votre demande auprès de ${hostFirstName} n'a pas pu être confirmée`,
    react: React.createElement(ContactDeclined, { visitorFirstName, hostFirstName, appUrl: APP_URL() }),
  });
}

export async function sendAcceptationVisite(
  to: string,
  visitorFirstName: string,
  hostFirstName: string,
  hostAddress: string,
  hostPhone: string | null,
  eventTitle: string,
  eventDate: string,
  contactEquipeUrl: string,
  hostEmail: string | null = null,
  hostWhatsappGroupUrl: string | null = null,
) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: `${hostFirstName} vous accueille — voici l'adresse`,
    react: React.createElement(AcceptationVisite, {
      visitorFirstName, hostFirstName, hostAddress, hostPhone, hostEmail, hostWhatsappGroupUrl, eventTitle, eventDate, contactEquipeUrl,
    }),
  });
}

export async function sendRefusVisite(to: string, visitorFirstName: string, hostFirstName: string) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: `Votre demande auprès de ${hostFirstName} — mise à jour`,
    react: React.createElement(RefusVisite, { visitorFirstName, hostFirstName, carteUrl: APP_URL() }),
  });
}

export async function sendCampagneVisiteurs(
  to: string,
  firstName: string,
  eventTitle: string,
  eventDate: string,
  unsubscribeUrl: string,
) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: 'Un nouveau live de guérison arrive — rejoignez une ambassade près de chez vous',
    react: React.createElement(CampagneVisiteurs, {
      firstName, eventTitle, eventDate, carteUrl: APP_URL(), unsubscribeUrl,
    }),
  });
}

export async function sendSignalApproved(to: string, firstName: string, liveLink: string) {
  return getMailer().emails.send({
    from: FROM(), to,
    subject: 'Vous avez été sélectionné pour témoigner en direct !',
    react: React.createElement(SignalApproved, { firstName, liveLink }),
  });
}

export async function sendNouvelleInscriptionAdmin(firstName: string, city: string, country: string) {
  return getMailer().emails.send({
    from: FROM(),
    to: process.env.RESEND_ADMIN_EMAIL!,
    subject: `Nouvelle candidature — ${firstName}, ${city}`,
    react: React.createElement(NouvelleInscriptionAdmin, {
      firstName, city, country,
      adminUrl: `${APP_URL()}/admin/ambassadeurs`,
    }),
  });
}

export async function sendAideVisiteurAdmin(visitorEmail: string, message: string) {
  return getMailer().emails.send({
    from: FROM(),
    to: process.env.RESEND_ADMIN_EMAIL!,
    subject: `Demande d'aide visiteur — ${visitorEmail}`,
    react: React.createElement(AideVisiteurAdmin, {
      visitorEmail, message,
      adminUrl: `${APP_URL()}/admin/live`,
    }),
  });
}

export async function sendNouvelleActivationAdmin(firstName: string, city: string, country: string) {
  return getMailer().emails.send({
    from: FROM(),
    to: process.env.RESEND_ADMIN_EMAIL!,
    subject: `Nouvelle ambassade activée — ${firstName}, ${city}`,
    react: React.createElement(NouvelleActivationAdmin, {
      firstName, city, country,
      adminUrl: `${APP_URL()}/admin/ambassadeurs`,
    }),
  });
}

export async function sendEnrichissementRecu(adminEmail: string, ambassadeurFirstName: string) {
  return getMailer().emails.send({
    from: FROM(),
    to: adminEmail,
    subject: `Questionnaire soumis — ${ambassadeurFirstName} attend sa validation finale`,
    react: React.createElement(EnrichissementRecu, {
      ambassadeurFirstName,
      adminUrl: `${APP_URL()}/admin/ambassadeurs`,
    }),
  });
}

export async function sendAmbassadeurModificationAdmin(
  adminEmail: string,
  ambassadeurFirstName: string,
  ancienneVille: string,
  nouvelleVille: string,
) {
  return getMailer().emails.send({
    from: FROM(),
    to: adminEmail,
    subject: `${ambassadeurFirstName} a modifié sa ville — ${ancienneVille} → ${nouvelleVille}`,
    react: React.createElement(AmbassadeurModificationAdmin, {
      ambassadeurFirstName,
      ancienneVille,
      nouvelleVille,
      adminUrl: `${APP_URL()}/admin/ambassadeurs`,
    }),
  });
}

export async function sendAdminAlertNoActivations(eventTitle: string, eventDate: string) {
  return getMailer().emails.send({
    from: FROM(),
    to: process.env.RESEND_ADMIN_EMAIL!,
    subject: `⚠️ Alerte : 0 hôtes actifs pour "${eventTitle}"`,
    react: React.createElement(AdminAlerteNoActivations, {
      eventTitle, eventDate,
      adminUrl: `${APP_URL()}/admin/stats`,
    }),
  });
}

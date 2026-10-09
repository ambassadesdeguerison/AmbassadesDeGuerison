import { notFound } from 'next/navigation';
import { render } from 'react-email';
import * as React from 'react';
import { MOCKS } from '@/emails/__mocks__';

import MagicLink from '@/emails/magic-link';
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
import VisitorCompteCree from '@/emails/visitor-compte-cree';
import InscriptionVerification from '@/emails/inscription-verification';

export default async function EmailPreviewPage() {
  if (process.env.EMAIL_PREVIEW !== 'true') notFound();

  const m = MOCKS;

  const [
    htmlMagicLink,
    htmlValidation,
    htmlRefusCandidature,
    htmlRegistration,
    htmlCampagneAmb,
    htmlFeedback,
    htmlFeedbackHost,
    htmlContactHost,
    htmlContactDeclined,
    htmlAcceptation,
    htmlRefus,
    htmlCampagneVisit,
    htmlVisitorCompteCree,
    htmlSignal,
    htmlNouvelleActivation,
    htmlEnrichissement,
    htmlAlerte,
    htmlInscriptionVerification,
  ] = await Promise.all([
    render(<MagicLink magicLinkUrl={m.magicLink} />),
    render(<ValidationFinale firstName={m.marie.firstName} dashboardUrl={m.dashboardUrl} carteUrl={m.carteUrl} />),
    render(<RefusCandidature firstName={m.jp.firstName} reason="Nous cherchons pour le moment des ambassades avec un espace dédié à l'accueil." />),
    render(<RegistrationConfirmation firstName={m.marie.firstName} dashboardUrl={m.dashboardUrl} />),
    render(<CampagneAmbassadeurs firstName={m.marie.firstName} eventTitle={m.liveTitle} eventDate={m.liveDate} activateUrl={m.activateUrl} customMessage={m.customMessage} />),
    render(<FeedbackPostLive firstName={m.marie.firstName} eventTitle={m.liveTitle} feedbackUrl={m.feedbackUrl} />),
    render(<FeedbackPostLiveHost firstName={m.host.firstName} eventTitle={m.liveTitle} feedbackUrl={m.feedbackUrl} />),
    render(<ContactReceivedHost hostFirstName={m.host.firstName} visitorFirstName={m.visitor.firstName} visitorEmail={m.visitor.email} visitorMessage={m.visitorMessage} acceptUrl={m.accueilUrl} declineUrl={m.declineUrl} dashboardUrl={m.activateUrl} />),
    render(<ContactDeclined visitorFirstName={m.visitor.firstName} hostFirstName={m.host.firstName} appUrl={m.appUrl} />),
    render(<AcceptationVisite visitorFirstName={m.visitor.firstName} hostFirstName={m.host.firstName} hostAddress={m.host.address} hostPhone={m.host.phone} eventTitle={m.liveTitle} eventDate={m.liveDate} contactEquipeUrl={m.contactEquipeUrl} />),
    render(<RefusVisite visitorFirstName={m.visitor.firstName} hostFirstName={m.host.firstName} carteUrl={m.carteUrl} />),
    render(<CampagneVisiteurs firstName={m.visitor.firstName} eventTitle={m.liveTitle} eventDate={m.liveDate} carteUrl={m.carteUrl} unsubscribeUrl={m.unsubscribeUrl} />),
    render(<VisitorCompteCree firstName={m.visitor.firstName} confirmUrl={m.magicLink} />),
    render(<SignalApproved firstName={m.marie.firstName} liveLink={m.liveLink} />),
    render(<NouvelleActivationAdmin firstName={m.marie.firstName} city={m.marie.city} country={m.marie.country} adminUrl={m.adminUrl} />),
    render(<EnrichissementRecu ambassadeurFirstName={m.marie.firstName} adminUrl={m.adminUrl} />),
    render(<AdminAlerteNoActivations eventTitle={m.liveTitle} eventDate={m.liveDate} adminUrl={m.adminUrl} />),
    render(<InscriptionVerification verifyUrl={m.magicLink} />),
  ]);

  const ambassadeur = [
    { label: 'Inscription — confirmer son adresse (avant le formulaire)', html: htmlInscriptionVerification },
    { label: 'Magic link (connexion standard)', html: htmlMagicLink },
    { label: 'Validation finale — ambassade active', html: htmlValidation },
    { label: 'Candidature refusée', html: htmlRefusCandidature },
    { label: 'Confirmation inscription', html: htmlRegistration },
    { label: 'Campagne — invitation au prochain live', html: htmlCampagneAmb },
    { label: 'Feedback post-live', html: htmlFeedback },
    { label: 'Feedback post-live — hôte (nouveau)', html: htmlFeedbackHost },
    { label: 'Ambassadeur — demande de visite reçue', html: htmlContactHost },
  ];

  const visiteur = [
    { label: 'Demande refusée', html: htmlContactDeclined },
    { label: 'Confirmation de visite — adresse dévoilée', html: htmlAcceptation },
    { label: 'Visite refusée', html: htmlRefus },
    { label: 'Campagne — prochain live', html: htmlCampagneVisit },
    { label: 'Compte visiteur créé', html: htmlVisitorCompteCree },
  ];

  const live = [
    { label: 'Signal approuvé — témoignage en direct', html: htmlSignal },
  ];

  const admin = [
    { label: 'Nouvelle ambassade activée', html: htmlNouvelleActivation },
    { label: "Questionnaire d'enrichissement soumis", html: htmlEnrichissement },
    { label: 'Alerte — 0 hôtes actifs', html: htmlAlerte },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
        Preview emails — Ambassades de Guérison
      </h1>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '48px' }}>
        {ambassadeur.length + visiteur.length + live.length + admin.length} templates · données mock seed
      </p>

      <Section title="Parcours ambassadeur" items={ambassadeur} />
      <Section title="Parcours visiteur" items={visiteur} />
      <Section title="Live" items={live} />
      <Section title="Admin" items={admin} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: { label: string; html: string }[] }) {
  return (
    <div style={{ marginBottom: '56px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '24px' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {items.map(({ label, html }) => (
          <div key={label}>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 6px', fontWeight: '500' }}>{label}</p>
            {/* srcdoc isole les styles email du CSS Next.js */}
            <iframe
              srcDoc={html}
              sandbox="allow-same-origin"
              style={{ width: '100%', height: '420px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
              title={label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

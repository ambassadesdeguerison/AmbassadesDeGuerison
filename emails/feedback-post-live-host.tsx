import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  firstName: string;
  eventTitle: string;
  feedbackUrl: string;
}

export default function FeedbackPostLiveHost({ firstName, eventTitle, feedbackUrl }: Props) {
  return (
    <EmailLayout preview={`Comment s'est passé votre accueil ? — ${eventTitle}`}>
      <Text style={p}>Bonjour {firstName},</Text>
      <Text style={p}>Merci d&apos;avoir ouvert votre porte pour le live <strong>{eventTitle}</strong>.</Text>
      <Text style={p}>Dites-nous en une minute comment cela s&apos;est passé avec vos visiteurs. Votre réponse reste entre vous et l&apos;équipe.</Text>
      <Btn href={feedbackUrl}>Donner mon avis</Btn>
      <Text style={muted}>Ce bouton est personnel : ne le transmettez pas. Il fonctionne pendant 7 jours.</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '14px', color: '#64748b', marginTop: '24px' };

import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  firstName: string;
  eventTitle: string;
  feedbackUrl: string;
}

export default function FeedbackPostLive({ firstName, eventTitle, feedbackUrl }: Props) {
  return (
    <EmailLayout preview={`Comment s'est passée votre soirée ? — ${eventTitle}`}>
      <Text style={p}>Bonjour {firstName},</Text>
      <Text style={p}>Merci d&apos;avoir participé au live <strong>{eventTitle}</strong>. Nous espérons que la soirée a été une bénédiction pour vous.</Text>
      <Text style={p}>En deux minutes, partagez votre ressenti — votre retour aide à améliorer chaque live :</Text>
      <Btn href={feedbackUrl}>Donner mon avis</Btn>
      <Text style={muted}>Ce lien est personnel et valable 7 jours.</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '13px', color: '#64748b', marginTop: '24px' };

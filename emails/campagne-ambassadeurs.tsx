import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  firstName: string;
  eventTitle: string;
  eventDate: string;
  activateUrl: string;
  customMessage?: string;
}

export default function CampagneAmbassadeurs({ firstName, eventTitle, eventDate, activateUrl, customMessage }: Props) {
  return (
    <EmailLayout preview="Le prochain live approche — allez-vous ouvrir votre ambassade ?">
      <Text style={p}>Bonjour {firstName},</Text>
      {customMessage && <Text style={{ ...p, fontStyle: 'italic' }}>{customMessage}</Text>}
      <Text style={p}>Le prochain live de David Théry — <strong>{eventTitle}</strong> — a lieu le <strong>{eventDate}</strong>.</Text>
      <Text style={p}>Allez-vous ouvrir votre ambassade pour accueillir des visiteurs ce soir-là ?</Text>
      <Btn href={activateUrl}>Oui, j&apos;ouvre mon ambassade</Btn>
      <Text style={muted}>Vous pouvez aussi préciser le nombre de places disponibles depuis votre espace ambassadeur.</Text>
      <Text style={muted}>Si vous ne pouvez pas cette fois, pas de problème — votre ambassade restera inactive pour ce live uniquement.</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '13px', color: '#64748b', marginTop: '12px' };

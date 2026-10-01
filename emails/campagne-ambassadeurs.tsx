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
    <EmailLayout preview="Le prochain live approche — ouvrez-vous votre porte ?">
      <Text style={p}>Bonjour {firstName},</Text>
      {customMessage && <Text style={{ ...p, fontStyle: 'italic' }}>{customMessage}</Text>}
      <Text style={p}>Le prochain live de David Théry, <strong>{eventTitle}</strong>, a lieu le <strong>{eventDate}</strong>.</Text>
      <Text style={p}>Ouvrez-vous votre porte ce soir-là pour accueillir les personnes qui le souhaitent ?</Text>
      <Btn href={activateUrl}>Oui, j&apos;ouvre ma porte</Btn>
      <Text style={muted}>Depuis votre espace, vous pourrez aussi indiquer combien de personnes vous pouvez accueillir.</Text>
      <Text style={muted}>Vous ne pouvez pas cette fois ? Aucun souci : ne faites rien. Votre ambassade ne sera simplement pas affichée sur la carte pour ce live.</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '14px', color: '#64748b', marginTop: '12px' };

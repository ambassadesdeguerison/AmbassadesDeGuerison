import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  visitorFirstName: string;
  hostFirstName: string;
  carteUrl: string;
}

export default function RefusVisite({ visitorFirstName, hostFirstName, carteUrl }: Props) {
  return (
    <EmailLayout preview={`Votre demande auprès de ${hostFirstName} — mise à jour`}>
      <Text style={p}>Bonjour {visitorFirstName},</Text>
      <Text style={p}>{hostFirstName} n&apos;est malheureusement pas en mesure de vous accueillir pour ce live.</Text>
      <Text style={p}>D&apos;autres ambassades sont peut-être disponibles près de chez vous :</Text>
      <Btn href={carteUrl}>Voir la carte</Btn>
      <Text style={muted}>Ne vous découragez pas — les ambassades grandissent à chaque live.</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '13px', color: '#64748b', marginTop: '24px' };

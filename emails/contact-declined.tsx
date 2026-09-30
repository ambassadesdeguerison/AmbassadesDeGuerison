import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  visitorFirstName: string;
  hostFirstName: string;
  appUrl: string;
}

export default function ContactDeclined({ visitorFirstName, hostFirstName, appUrl }: Props) {
  return (
    <EmailLayout preview={`Votre demande auprès de ${hostFirstName} n'a pas pu être confirmée`}>
      <Text style={p}>Bonjour {visitorFirstName},</Text>
      <Text style={p}>{hostFirstName} n&apos;est malheureusement pas en mesure de vous accueillir pour ce live.</Text>
      <Text style={p}>D&apos;autres ambassades sont peut-être disponibles près de chez vous :</Text>
      <Btn href={appUrl}>Voir la carte</Btn>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };

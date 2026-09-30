import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  firstName: string;
  dashboardUrl: string;
}

export default function RegistrationConfirmation({ firstName, dashboardUrl }: Props) {
  return (
    <EmailLayout preview="Bienvenue parmi les Ambassadeurs de Guérison !">
      <Text style={p}>Bonjour {firstName},</Text>
      <Text style={p}>Votre demande pour devenir ambassadeur est bien reçue.</Text>
      <Text style={p}>Il reste une dernière étape avant de rejoindre le réseau : regarder la vidéo de formation, valider votre engagement, puis vous présenter à David. Votre ambassade apparaîtra sur la carte dès validation par l'équipe de David Théry.</Text>
      <Btn href={dashboardUrl}>Continuer mon inscription</Btn>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };

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
      <Text style={p}>Il reste une dernière étape avant de rejoindre le réseau : regarder la vidéo de formation, valider votre engagement, puis vous présenter à David. Votre ambassade apparaîtra sur la carte dès validation par l&apos;équipe de David Théry.</Text>
      <Btn href={dashboardUrl}>Continuer mon inscription</Btn>
      <Text style={note}>Ce lien vous connecte directement et reste valable 1 heure. Passé ce délai, demandez-en un nouveau depuis la page de connexion.</Text>
    </EmailLayout>
  );
}

const note: React.CSSProperties = { fontSize: '13px', lineHeight: '1.5', color: '#64748b', margin: '16px 0 0' };
const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };

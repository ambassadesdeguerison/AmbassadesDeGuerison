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
    <EmailLayout preview="Votre demande pour devenir ambassadeur est bien reçue">
      <Text style={p}>Bonjour {firstName},</Text>
      <Text style={p}>Merci : nous avons bien reçu votre demande pour devenir ambassadeur.</Text>
      <Text style={p}>Il reste trois choses à faire, à votre rythme :</Text>
      <Text style={p}>
        1. regarder la courte vidéo de formation ;<br />
        2. confirmer votre engagement ;<br />
        3. répondre au questionnaire pour vous présenter à David et à son équipe.
      </Text>
      <Text style={p}>
        Ensuite, l&apos;équipe relira votre dossier. Quand il sera validé, vous serez ambassadeur : avant chaque live,
        nous vous demanderons si vous ouvrez votre porte, et votre ambassade apparaîtra alors sur la carte.
      </Text>
      <Btn href={dashboardUrl}>Continuer mon inscription</Btn>
      <Text style={note}>
        Ce bouton vous connecte directement et fonctionne pendant 1 heure. Après, demandez-en un nouveau depuis la page « Se connecter ».
      </Text>
    </EmailLayout>
  );
}

const note: React.CSSProperties = { fontSize: '14px', lineHeight: '1.5', color: '#64748b', margin: '16px 0 0' };
const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };

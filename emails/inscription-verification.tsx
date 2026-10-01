import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  verifyUrl: string;
}

// Première étape de « Devenir ambassadeur » : l'adresse doit être confirmée AVANT que le
// formulaire s'ouvre. Aucun compte n'existe encore à ce stade (cf lib/auth/email-proof.ts).
export default function InscriptionVerification({ verifyUrl }: Props) {
  return (
    <EmailLayout preview="Confirmez votre adresse pour devenir ambassadeur">
      <Text style={p}>Bonjour,</Text>
      <Text style={p}>
        Vous souhaitez devenir ambassadeur et accueillir des personnes lors des lives de David Théry. Merci !
        Confirmez d&apos;abord que cette adresse est bien la vôtre : le formulaire s&apos;ouvrira juste après.
      </Text>
      <Btn href={verifyUrl}>Confirmer mon adresse</Btn>
      <Text style={muted}>
        Ce lien est valable 24 heures. Si vous n&apos;êtes pas à l&apos;origine de cette demande, ignorez simplement ce message : rien ne sera créé.
      </Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '13px', color: '#64748b', marginTop: '24px' };

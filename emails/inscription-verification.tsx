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
        Vous avez demandé à devenir ambassadeur. Un ambassadeur, c&apos;est une personne qui ouvre sa maison ou son
        église pour accueillir et prier avec d&apos;autres pendant les lives de guérison de David Théry (un live, c&apos;est
        une rencontre en direct sur internet).
      </Text>
      <Text style={p}>
        Avant de continuer, nous devons vérifier que cette adresse e-mail est bien la vôtre.
        <strong> Appuyez sur le bouton ci-dessous : le formulaire s&apos;ouvrira aussitôt.</strong>
      </Text>
      <Btn href={verifyUrl}>Vérifier mon adresse e-mail</Btn>
      <Text style={muted}>
        Ce bouton fonctionne pendant 24 heures. Ce n&apos;est pas vous qui avez fait cette demande ? Ne faites rien :
        rien ne sera enregistré à votre nom.
      </Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '14px', color: '#64748b', marginTop: '24px' };

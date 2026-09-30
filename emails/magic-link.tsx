import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  magicLinkUrl: string;
}

export default function MagicLink({ magicLinkUrl }: Props) {
  return (
    <EmailLayout preview="Votre lien de connexion — Ambassades de Guérison">
      <Text style={p}>Bonjour,</Text>
      <Text style={p}>Cliquez sur le lien ci-dessous pour vous connecter à votre espace ambassadeur :</Text>
      <Btn href={magicLinkUrl}>Me connecter</Btn>
      <Text style={muted}>Ce lien expire dans 1 heure. Si vous n&apos;avez pas demandé ce lien, ignorez cet email.</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '13px', color: '#64748b', marginTop: '24px' };

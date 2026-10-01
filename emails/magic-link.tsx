import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  magicLinkUrl: string;
}

export default function MagicLink({ magicLinkUrl }: Props) {
  return (
    <EmailLayout preview="Pour vous connecter — Ambassades de Guérison">
      <Text style={p}>Bonjour,</Text>
      <Text style={p}>
        Vous avez demandé à vous connecter. Appuyez sur le bouton ci-dessous : vous arriverez directement sur votre
        espace, sans mot de passe.
      </Text>
      <Btn href={magicLinkUrl}>Me connecter</Btn>
      <Text style={muted}>
        Ce bouton fonctionne pendant 1 heure. Ce n&apos;est pas vous qui avez fait cette demande ? Ignorez simplement ce message.
      </Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '14px', color: '#64748b', marginTop: '24px' };

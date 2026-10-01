import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  firstName: string;
  liveLink: string;
}

export default function SignalApproved({ firstName, liveLink }: Props) {
  return (
    <EmailLayout preview="David vous invite à témoigner en direct !">
      <Text style={p}>Bonjour {firstName},</Text>
      <Text style={p}>Pendant le live, vous avez levé la main pour témoigner, et David a accepté. Il vous invite à prendre la parole en direct !</Text>
      <Text style={p}>Rejoignez le live maintenant :</Text>
      <Btn href={liveLink} color="green">Rejoindre le live</Btn>
      <Text style={muted}>Préparez-vous à partager votre témoignage en quelques mots.</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '14px', color: '#64748b', marginTop: '24px' };

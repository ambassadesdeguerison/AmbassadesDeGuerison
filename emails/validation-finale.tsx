import { Text, Link } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  firstName: string;
  dashboardUrl: string;
  carteUrl: string;
}

export default function ValidationFinale({ firstName, dashboardUrl, carteUrl }: Props) {
  return (
    <EmailLayout preview={`Bienvenue dans la famille des Ambassades de Guérison, ${firstName} !`}>
      <Text style={p}>Bonjour {firstName},</Text>
      <Text style={p}>
        Bonne nouvelle : votre ambassade est validée. Vous faites maintenant partie des Ambassades de Guérison, partout dans le monde.
      </Text>
      <Text style={p}>
        Avant chaque live de David Théry, nous vous écrirons pour vous demander si vous ouvrez votre porte ce soir-là.
        Un seul clic suffira.
      </Text>
      <Text style={p}>D&apos;ici là, vous pouvez retrouver vos demandes de visite sur votre espace :</Text>
      <Btn href={dashboardUrl}>Aller sur mon espace</Btn>
      <Text style={{ marginTop: '16px' }}>
        <Link href={carteUrl} style={link}>Voir la carte</Link>
      </Text>
      <Text style={muted}>Merci d&apos;ouvrir votre maison. C&apos;est là que tout se passe.</Text>
      <Text style={signature}>— David Théry</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '14px', color: '#64748b', marginTop: '24px' };
const signature: React.CSSProperties = { fontSize: '16px', color: '#334155', fontStyle: 'italic', marginTop: '8px' };
const link: React.CSSProperties = { color: '#4F46E5' };

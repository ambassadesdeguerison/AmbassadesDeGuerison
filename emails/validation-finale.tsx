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
      <Text style={p}>C&apos;est officiel — votre ambassade est validée. Vous faites maintenant partie du réseau mondial des Ambassades de Guérison.</Text>
      <Text style={p}>Lors du prochain live de David Théry, vous recevrez un e-mail pour confirmer que vous ouvrez votre maison. Un simple clic suffira.</Text>
      <Text style={p}>D&apos;ici là, vous pouvez consulter votre espace ambassadeur et suivre les demandes de visite :</Text>
      <Btn href={dashboardUrl}>Mon espace ambassadeur</Btn>
      <Text style={{ marginTop: '16px' }}>
        <Link href={carteUrl} style={link}>Voir ma position sur la carte</Link>
      </Text>
      <Text style={muted}>Merci d&apos;ouvrir votre maison. C&apos;est là que tout se passe.</Text>
      <Text style={signature}>— David Théry</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '13px', color: '#64748b', marginTop: '24px' };
const signature: React.CSSProperties = { fontSize: '15px', color: '#334155', fontStyle: 'italic', marginTop: '8px' };
const link: React.CSSProperties = { color: '#4F46E5' };

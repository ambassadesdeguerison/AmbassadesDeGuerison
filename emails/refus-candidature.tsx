import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';

interface Props {
  firstName: string;
  reason?: string;
}

export default function RefusCandidature({ firstName, reason }: Props) {
  return (
    <EmailLayout preview="Votre candidature d'ambassadeur — mise à jour">
      <Text style={p}>Bonjour {firstName},</Text>
      <Text style={p}>Après examen de votre candidature, nous ne sommes pas en mesure de la retenir pour le moment.</Text>
      {reason && <Text style={p}>{reason}</Text>}
      <Text style={muted}>Merci pour votre intérêt envers les Ambassades de Guérison.</Text>
      <Text style={signature}>— David Théry</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '14px', color: '#64748b', marginTop: '24px' };
const signature: React.CSSProperties = { fontSize: '16px', color: '#334155', fontStyle: 'italic', marginTop: '8px' };

import { Text, Link } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';

interface Props {
  ambassadeurFirstName: string;
  adminUrl: string;
}

export default function EnrichissementRecu({ ambassadeurFirstName, adminUrl }: Props) {
  return (
    <EmailLayout preview={`Questionnaire soumis — ${ambassadeurFirstName} attend sa validation finale`}>
      <Text style={p}>L&apos;ambassadeur <strong>{ambassadeurFirstName}</strong> vient de soumettre son questionnaire d&apos;enrichissement.</Text>
      <Text style={p}>Son profil enrichi est soumis — il attend votre validation finale.</Text>
      <Text style={p}>
        <Link href={adminUrl} style={link}>Valider dans l&apos;admin →</Link>
      </Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const link: React.CSSProperties = { color: '#4F46E5' };

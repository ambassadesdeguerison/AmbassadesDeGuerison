import { Text, Link } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';

interface Props {
  ambassadeurFirstName: string;
  adminUrl: string;
}

export default function EnrichissementRecu({ ambassadeurFirstName, adminUrl }: Props) {
  return (
    <EmailLayout preview={`Dossier complet — ${ambassadeurFirstName} attend votre validation`}>
      <Text style={p}>L&apos;ambassadeur <strong>{ambassadeurFirstName}</strong> vient d&apos;envoyer son questionnaire.</Text>
      <Text style={p}>Son dossier est complet : il attend votre validation.</Text>
      <Text style={p}>
        <Link href={adminUrl} style={link}>Relire le dossier et valider →</Link>
      </Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const link: React.CSSProperties = { color: '#4F46E5' };

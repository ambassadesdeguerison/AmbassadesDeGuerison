import { Text, Link } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';

interface Props {
  eventTitle: string;
  eventDate: string;
  adminUrl: string;
}

export default function AdminAlerteNoActivations({ eventTitle, eventDate, adminUrl }: Props) {
  return (
    <EmailLayout preview={`⚠️ Alerte : 0 hôtes actifs pour "${eventTitle}"`}>
      <Text style={p}>⚠️ Attention : l&apos;événement <strong>{eventTitle}</strong> ({eventDate}) n&apos;a aucun hôte actif dans host_activations.</Text>
      <Text style={p}>Le mécanisme d&apos;activation automatique des hôtes n&apos;a peut-être pas fonctionné.</Text>
      <Text style={p}>
        <Link href={adminUrl} style={link}>Vérifier dans l&apos;admin →</Link>
      </Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const link: React.CSSProperties = { color: '#4F46E5' };

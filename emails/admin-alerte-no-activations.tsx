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
    <EmailLayout preview={`⚠️ Aucune ambassade ouverte pour "${eventTitle}"`}>
      <Text style={p}>⚠️ Attention : le live <strong>{eventTitle}</strong> ({eventDate}) approche, et aucune ambassade n&apos;a encore confirmé qu&apos;elle ouvrait sa porte.</Text>
      <Text style={p}>Vérifiez que l&apos;e-mail d&apos;invitation est bien parti aux ambassadeurs.</Text>
      <Text style={p}>
        <Link href={adminUrl} style={link}>Voir dans l&apos;admin →</Link>
      </Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const link: React.CSSProperties = { color: '#4F46E5' };

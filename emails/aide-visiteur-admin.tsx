import { Text, Link } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';

interface Props {
  visitorEmail: string;
  message: string;
  adminUrl: string;
}

export default function AideVisiteurAdmin({ visitorEmail, message, adminUrl }: Props) {
  return (
    <EmailLayout preview={`Demande d'aide visiteur — ${visitorEmail}`}>
      <Text style={p}>Un visiteur a besoin d&apos;aide :</Text>
      <Text style={list}>• <strong>Email :</strong> {visitorEmail}</Text>
      <Text style={label}>Message :</Text>
      <Text style={quote}>{message}</Text>
      <Text style={{ marginTop: '16px' }}>
        <Link href={adminUrl} style={link}>Voir dans l&apos;admin →</Link>
      </Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 8px' };
const list: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 12px', paddingLeft: '8px' };
const label: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' };
const quote: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px', padding: '12px 16px', backgroundColor: '#f8fafc', borderLeft: '3px solid #e2e8f0', borderRadius: '0 4px 4px 0' };
const link: React.CSSProperties = { color: '#4F46E5' };

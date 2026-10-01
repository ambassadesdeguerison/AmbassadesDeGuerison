import { Text, Link } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';

interface Props {
  firstName: string;
  city: string;
  country: string;
  adminUrl: string;
}

export default function NouvelleInscriptionAdmin({ firstName, city, country, adminUrl }: Props) {
  return (
    <EmailLayout preview={`Nouvelle candidature — ${firstName}, ${city}`}>
      <Text style={p}>Un nouveau candidat vient de s&apos;inscrire et attend votre validation :</Text>
      <Text style={list}>• <strong>Prénom :</strong> {firstName}</Text>
      <Text style={list}>• <strong>Ville :</strong> {city}</Text>
      <Text style={list}>• <strong>Pays :</strong> {country}</Text>
      <Text style={{ marginTop: '16px' }}>
        <Link href={adminUrl} style={link}>Valider la candidature →</Link>
      </Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 8px' };
const list: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 4px', paddingLeft: '8px' };
const link: React.CSSProperties = { color: '#4F46E5' };

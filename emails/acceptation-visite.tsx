import { Text, Link } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  visitorFirstName: string;
  hostFirstName: string;
  hostAddress: string;
  hostPhone?: string | null;
  hostEmail?: string | null;
  hostWhatsappGroupUrl?: string | null;
  eventTitle: string;
  eventDate: string;
  contactEquipeUrl: string;
}

export default function AcceptationVisite({
  visitorFirstName, hostFirstName, hostAddress, hostPhone, hostEmail, hostWhatsappGroupUrl, eventTitle, eventDate, contactEquipeUrl,
}: Props) {
  return (
    <EmailLayout preview={`${hostFirstName} vous accueille — voici l'adresse`}>
      <Text style={p}>Bonjour {visitorFirstName},</Text>
      <Text style={p}>Bonne nouvelle : <strong>{hostFirstName}</strong> vous accueille pour le live <strong>{eventTitle}</strong>, le <strong>{eventDate}</strong>.</Text>
      <Text style={p}>Voici où vous rendre :</Text>
      <Text style={highlight}>{hostAddress}</Text>
      {(hostPhone || hostEmail || hostWhatsappGroupUrl) && (
        <Text style={p}>Pour joindre {hostFirstName} :</Text>
      )}
      {hostPhone && <Text style={p}>Téléphone : <strong>{hostPhone}</strong></Text>}
      {hostEmail && <Text style={p}>E-mail : <Link href={`mailto:${hostEmail}`} style={link}>{hostEmail}</Link></Text>}
      {hostWhatsappGroupUrl && <Text style={p}>Groupe WhatsApp : <Link href={hostWhatsappGroupUrl} style={link}>Rejoindre le groupe</Link></Text>}
      <Text style={p}>Pensez à arriver quelques minutes avant le début du live.</Text>
      <Text style={muted}>Besoin d&apos;aide ? <Link href={contactEquipeUrl} style={link}>Écrivez à l&apos;équipe</Link></Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '14px', color: '#64748b', marginTop: '24px' };
const link: React.CSSProperties = { color: '#4F46E5' };
const highlight: React.CSSProperties = {
  fontSize: '16px', lineHeight: '1.6', color: '#1e293b',
  backgroundColor: '#f0fdf4', borderLeft: '4px solid #16a34a',
  padding: '16px', borderRadius: '4px', margin: '0 0 16px',
};

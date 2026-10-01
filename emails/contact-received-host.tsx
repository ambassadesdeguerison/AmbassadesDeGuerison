import { Text, Link } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  hostFirstName: string;
  visitorFirstName: string;
  visitorEmail: string;
  // Le téléphone du visiteur n'est volontairement pas transmis ici : il n'est
  // visible par l'hôte qu'après acceptation (dashboard).
  visitorMessage?: string | null;
  acceptUrl: string;
  declineUrl: string;
  // Photo affichée dans le dashboard (page authentifiée, signed URL fraîche
  // à chaque vue), jamais embarquée dans l'email — cf /plan-eng-review.
  dashboardUrl?: string | null;
}

export default function ContactReceivedHost({
  hostFirstName, visitorFirstName, visitorEmail, visitorMessage, acceptUrl, declineUrl, dashboardUrl,
}: Props) {
  return (
    <EmailLayout preview={`${visitorFirstName} aimerait venir chez vous`}>
      <Text style={p}>Bonjour {hostFirstName},</Text>
      <Text style={p}><strong>{visitorFirstName}</strong> aimerait venir chez vous pour suivre le live.</Text>
      <Text style={p}>Voici ce que cette personne vous a indiqué :</Text>
      <Text style={p}>E-mail : <Link href={`mailto:${visitorEmail}`} style={link}>{visitorEmail}</Link></Text>
      {visitorMessage && (
        <Text style={p}>Message : <em>&quot;{visitorMessage}&quot;</em></Text>
      )}
      {/* `dashboardUrl` n'est fourni que si le visiteur a une photo (cf /api/visit-requests) :
          son absence signifie « sans photo » — l'hôte le sait avant d'accepter. */}
      {dashboardUrl ? (
        <Text style={p}>{visitorFirstName} a ajouté une photo de profil — <Link href={dashboardUrl} style={link}>voir sa photo sur mon espace</Link></Text>
      ) : (
        <Text style={p}>{visitorFirstName} n&apos;a pas ajouté de photo de profil.</Text>
      )}
      <Text style={p}>
        Si vous acceptez, nous lui enverrons votre adresse, et vous verrez son numéro de téléphone. Si vous refusez, il ne les recevra pas.
      </Text>
      <Btn href={acceptUrl} color="green">Oui, j&apos;accueille {visitorFirstName}</Btn>
      <Text style={muted}>Vous ne pouvez pas cette fois ?</Text>
      <Btn href={declineUrl} color="red">Non, je ne peux pas</Btn>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '14px', color: '#64748b', margin: '24px 0 12px' };
const link: React.CSSProperties = { color: '#4F46E5' };

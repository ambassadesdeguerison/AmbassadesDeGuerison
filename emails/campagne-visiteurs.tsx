import { Text, Link } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  firstName: string;
  eventTitle: string;
  eventDate: string;
  carteUrl: string;
  unsubscribeUrl: string;
}

export default function CampagneVisiteurs({ firstName, eventTitle, eventDate, carteUrl, unsubscribeUrl }: Props) {
  return (
    <EmailLayout preview="Un nouveau live de guérison arrive — trouvez une ambassade près de chez vous">
      <Text style={p}>Bonjour {firstName},</Text>
      <Text style={p}>David Théry anime un nouveau live de guérison : <strong>{eventTitle}</strong>, le <strong>{eventDate}</strong>.</Text>
      <Text style={p}>
        Des ambassades vous accueillent partout dans le monde, chez des particuliers ou dans de petites églises,
        pour vivre ce live ensemble.
      </Text>
      <Btn href={carteUrl}>Trouver une ambassade près de moi</Btn>
      <Text style={muted}>Une ambassade, c&apos;est une maison ou une église qui ouvre sa porte pendant le live.</Text>
      <Text style={muted}>
        Vous recevez cet e-mail parce que vous avez déjà participé à un live.<br />
        <Link href={unsubscribeUrl} style={unsub}>Ne plus recevoir ces e-mails</Link>
      </Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '14px', color: '#64748b', marginTop: '24px' };
const unsub: React.CSSProperties = { color: '#94a3b8' };

import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  visitorFirstName: string;
  hostFirstName: string;
  carteUrl: string;
  // « Ne plus accueillir cette personne » : aucune nouvelle demande possible chez cette ambassade.
  permanent?: boolean;
}

export default function RefusVisite({ visitorFirstName, hostFirstName, carteUrl, permanent = false }: Props) {
  return (
    <EmailLayout preview={`Votre demande auprès de ${hostFirstName} — mise à jour`}>
      <Text style={p}>Bonjour {visitorFirstName},</Text>
      {permanent ? (
        <Text style={p}>{hostFirstName} ne peut pas vous accueillir. Vous ne pourrez pas lui envoyer de nouvelle demande.</Text>
      ) : (
        <Text style={p}>{hostFirstName} n&apos;est pas disponible pour ce live. Vous pourrez lui écrire de nouveau pour le prochain.</Text>
      )}
      <Text style={p}>
        Il y a peut-être d&apos;autres ambassades près de chez vous : des maisons ou des églises qui ouvrent leur porte
        pendant le live. Vous pouvez les voir sur la carte :
      </Text>
      <Btn href={carteUrl}>Voir la carte</Btn>
      <Text style={muted}>Ne vous découragez pas : de nouvelles ambassades s&apos;ouvrent à chaque live.</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '14px', color: '#64748b', marginTop: '24px' };

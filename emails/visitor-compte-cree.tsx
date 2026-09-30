import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  firstName: string;
  confirmUrl: string;
}

// Copie dédiée (Phase 3 PR2) — distincte du magic link générique
// ("espace ambassadeur"), pour rassurer un visiteur qui vient de créer son
// compte que celui-ci lui appartient bien (cf design doc, retour Théo).
// Envoyée une seule fois, à la création du compte — jamais à chaque demande
// de visite suivante (cf /api/visitor/account).
export default function VisitorCompteCree({ firstName, confirmUrl }: Props) {
  return (
    <EmailLayout preview="Votre compte a bien été créé — Ambassades de Guérison">
      <Text style={p}>Bonjour {firstName},</Text>
      <Text style={p}>
        Votre compte visiteur vient d&apos;être créé sur Ambassades de Guérison. Il vous permettra de
        retrouver vos prochaines demandes de visite sans tout retaper.
      </Text>
      <Text style={p}>Ce lien vous connecte à votre espace :</Text>
      <Btn href={confirmUrl}>Accéder à mon espace</Btn>
      <Text style={muted}>Ce lien expire dans 1 heure. Si vous n&apos;êtes pas à l&apos;origine de cette création de compte, contactez-nous.</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '13px', color: '#64748b', marginTop: '24px' };

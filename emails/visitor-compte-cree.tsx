import { Text } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';
import { Btn } from './components/Btn';

interface Props {
  firstName: string;
  confirmUrl: string;
}

// Copie dédiée (Phase 3 PR2) — distincte du magic link générique
// ("espace ambassadeur"). Depuis la vérification réelle de l'adresse, ce lien
// est le SEUL moyen d'ouvrir la session : le message demande de confirmer
// l'adresse, il ne se contente plus d'annoncer un compte déjà utilisable.
// Envoyée une seule fois, à la création du compte (cf /api/visitor/account).
export default function VisitorCompteCree({ firstName, confirmUrl }: Props) {
  return (
    <EmailLayout preview="Confirmez votre adresse pour continuer — Ambassades de Guérison">
      <Text style={p}>Bonjour {firstName},</Text>
      <Text style={p}>
        Merci d&apos;avoir créé votre compte sur Ambassades de Guérison. Un dernier geste : confirmez que cette
        adresse est bien la vôtre, et vous reprendrez exactement là où vous en étiez.
      </Text>
      <Btn href={confirmUrl}>Confirmer mon adresse</Btn>
      <Text style={muted}>Ce lien expire dans 1 heure. Si vous n&apos;êtes pas à l&apos;origine de cette création de compte, ignorez simplement ce message.</Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '13px', color: '#64748b', marginTop: '24px' };

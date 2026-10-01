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
    <EmailLayout preview="Vérifiez votre adresse e-mail pour continuer">
      <Text style={p}>Bonjour {firstName},</Text>
      <Text style={p}>
        Merci d&apos;avoir créé votre compte. Il vous permet de demander à être accueilli chez un ambassadeur (une maison
        ou une église qui ouvre sa porte pendant un live de David Théry), sans avoir à tout retaper à chaque fois.
      </Text>
      <Text style={p}>
        Avant de continuer, nous devons vérifier que cette adresse e-mail est bien la vôtre.
        <strong> Appuyez sur le bouton ci-dessous : vous reviendrez exactement là où vous en étiez.</strong>
      </Text>
      <Btn href={confirmUrl}>Vérifier mon adresse e-mail</Btn>
      <Text style={muted}>
        Ce bouton fonctionne pendant 1 heure. Si ce n&apos;est pas vous qui avez créé ce compte, ne faites rien.
      </Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '16px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const muted: React.CSSProperties = { fontSize: '14px', color: '#64748b', marginTop: '24px' };

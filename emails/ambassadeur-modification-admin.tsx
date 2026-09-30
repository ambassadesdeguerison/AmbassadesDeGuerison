import { Text, Link } from 'react-email';
import * as React from 'react';
import { EmailLayout } from './components/EmailLayout';

interface Props {
  ambassadeurFirstName: string;
  ancienneVille: string;
  nouvelleVille: string;
  adminUrl: string;
}

export default function AmbassadeurModificationAdmin({
  ambassadeurFirstName,
  ancienneVille,
  nouvelleVille,
  adminUrl,
}: Props) {
  return (
    <EmailLayout preview={`${ambassadeurFirstName} a modifié sa ville — ${ancienneVille} → ${nouvelleVille}`}>
      <Text style={p}>
        L&apos;ambassadeur <strong>{ambassadeurFirstName}</strong> a mis à jour ses informations de profil.
      </Text>
      <Text style={p}>
        <strong>Ville :</strong> {ancienneVille} → <strong>{nouvelleVille}</strong>
      </Text>
      <Text style={p}>
        Son pin sur la carte sera automatiquement mis à jour.
        Si nécessaire, vous pouvez consulter son profil complet depuis l&apos;admin.
      </Text>
      <Text style={p}>
        <Link href={adminUrl} style={link}>Voir le profil dans l&apos;admin →</Link>
      </Text>
    </EmailLayout>
  );
}

const p: React.CSSProperties = { fontSize: '15px', lineHeight: '1.6', color: '#1e293b', margin: '0 0 16px' };
const link: React.CSSProperties = { color: '#4F46E5' };

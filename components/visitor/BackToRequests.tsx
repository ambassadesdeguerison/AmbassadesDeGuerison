import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

// Paramètre ajouté aux liens de « Mes demandes » vers les pages à jeton (/visitor, /feedback).
// Ces pages s'ouvrent aussi depuis un e-mail, sans session : le lien de retour n'apparaît donc
// que si le visiteur vient de /mon-espace.
export const FROM_MON_ESPACE = 'mon-espace';

export function cameFromMonEspace(from: string | string[] | undefined): boolean {
  return from === FROM_MON_ESPACE;
}

export default function BackToRequests() {
  return (
    <Link
      href="/mon-espace?onglet=demandes"
      className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-slate-500 hover:text-slate-700 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Mes demandes
    </Link>
  );
}

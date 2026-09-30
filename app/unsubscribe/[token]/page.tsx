'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { CheckCircle2 } from 'lucide-react';

export default function UnsubscribePage() {
  const { token } = useParams<{ token: string }>();
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/unsubscribe/${token}`)
      .then((r) => {
        if (r.ok) setDone(true);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [token]);

  return (
    <>
      <AppHeader />
      <main className="flex-1 bg-slate-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-sm w-full text-center">
          {!done && !error && (
            <p className="text-slate-500 text-sm">Traitement en cours…</p>
          )}
          {done && (
            <>
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h1 className="text-lg font-semibold text-slate-800 mb-2">Désinscription confirmée</h1>
              <p className="text-sm text-slate-500 mb-6">
                Vous ne recevrez plus d'e-mails de ce type. Si vous changez d'avis, vous pouvez toujours
                nous contacter directement.
              </p>
              <Link href="/" className="text-indigo-600 text-sm hover:underline">
                Retour à la carte
              </Link>
            </>
          )}
          {error && (
            <>
              <h1 className="text-lg font-semibold text-slate-800 mb-2">Lien introuvable</h1>
              <p className="text-sm text-slate-500 mb-6">
                Ce lien de désinscription est invalide ou a déjà été utilisé.
              </p>
              <Link href="/" className="text-indigo-600 text-sm hover:underline">
                Retour à la carte
              </Link>
            </>
          )}
        </div>
      </main>
    </>
  );
}

'use client';

import { WifiOff } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <WifiOff className="w-8 h-8 text-slate-400" />
        </div>
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Pas de connexion</h1>
        <p className="text-slate-500 text-sm mb-2">
          La carte des ambassades n&apos;est pas disponible pour le moment.
        </p>
        <p className="text-xs text-slate-400 mb-6">
          Si vous avez déjà visité la carte, elle peut être disponible en cache.
        </p>
        <div className="flex flex-col gap-2 items-center">
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Réessayer
          </button>
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </main>
  );
}

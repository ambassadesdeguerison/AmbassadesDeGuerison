'use client';

import Link from 'next/link';
import { useState } from 'react';
import { UserPlus, MessageSquare, LogIn } from 'lucide-react';
import MonEspaceLink from '@/components/MonEspaceLink';

export default function AppHeader() {
  const [isHost, setIsHost] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  return (
    <header className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shrink-0 z-10">
      <Link href="/" className="flex items-center gap-2 min-w-0">
        {/* Monogramme — identité de marque visible même sur les écrans les plus
            étroits (280px), là où le nom complet et l'ancienne icône Home
            générique n'apportaient aucun signal distinctif. */}
        <div className="w-7 h-7 shrink-0 bg-indigo-50 rounded-lg flex items-center justify-center">
          <span className="text-[11px] font-bold text-indigo-600 tracking-tight">AG</span>
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="font-semibold text-slate-800 text-sm truncate">Ambassades de Guérison</span>
          <span className="hidden sm:block text-slate-400 text-xs">Groupes de prière — lives de guérison</span>
        </div>
      </Link>
      <nav className="flex items-center gap-1">
        <Link
          href="/temoignages"
          className="flex items-center gap-1.5 text-sm px-3 py-2.5 sm:py-1.5 rounded-lg font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="sr-only sm:not-sr-only">Témoignages</span>
        </Link>
        <div className="w-px h-5 bg-slate-200 mx-2" />
        {!isHost && (
          <Link
            href="/inscription"
            className="flex items-center gap-1.5 text-sm px-3 py-2.5 sm:py-1.5 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span className="sr-only sm:not-sr-only">Devenir ambassadeur</span>
          </Link>
        )}
        {showLogin && (
          <Link
            href="/auth"
            className="flex items-center gap-1.5 text-sm px-3 py-2.5 sm:py-1.5 rounded-lg font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span className="sr-only sm:not-sr-only">Se connecter</span>
          </Link>
        )}
        <MonEspaceLink
          onRoleResolved={(role) => {
            setIsHost(role === 'host');
            setShowLogin(role === null);
          }}
        />
      </nav>
    </header>
  );
}

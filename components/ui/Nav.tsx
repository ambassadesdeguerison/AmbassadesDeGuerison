'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, UserPlus, LayoutDashboard } from 'lucide-react';

interface NavProps {
  variant?: 'default' | 'minimal';
}

export default function Nav({ variant = 'default' }: NavProps) {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2 group">
        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-700 transition-colors">
          <Home className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-slate-800 text-sm hidden sm:block">Ambassades de Guérison</span>
      </Link>

      {variant === 'default' && (
        <nav className="flex items-center gap-2">
          <Link
            href="/inscription"
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
              pathname === '/inscription'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Devenir ambassadeur</span>
          </Link>
          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
              pathname === '/dashboard'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Mon espace</span>
          </Link>
        </nav>
      )}
    </header>
  );
}

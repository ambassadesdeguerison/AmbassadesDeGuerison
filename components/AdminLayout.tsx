'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Radio,
  Calendar,
  MessageSquare,
  Settings,
  ChevronLeft,
  LogOut,
  AlertTriangle,
  Ban,
  Shield,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

// `badgeKey` relie l'entrée au compteur retourné par /api/admin/queue-counts.
// `label` est aussi utilisé comme tooltip : sous 640px la sidebar se réduit à
// des icônes, et neuf icônes sans libellé sont indistinctes pour un nouvel
// admin (audit 2026-08-07, T.8).
const NAV: { href: string; label: string; Icon: typeof Users; badgeKey?: 'ambassadeurs' | 'temoignages' | 'feedback' }[] = [
  { href: '/admin/stats',         label: 'Vue générale',      Icon: LayoutDashboard },
  { href: '/admin/ambassadeurs',  label: 'Ambassadeurs',      Icon: Users,           badgeKey: 'ambassadeurs' },
  // « Live en cours » promettait un live actif alors que la page affiche le plus
  // souvent le dernier live passé, avec un bandeau d'avertissement (audit 3.3).
  { href: '/admin/live',          label: 'Live',              Icon: Radio           },
  { href: '/admin/calendrier',    label: 'Calendrier',        Icon: Calendar        },
  { href: '/admin/temoignages',   label: 'Témoignages',       Icon: MessageSquare,   badgeKey: 'temoignages' },
  // La sidebar disait « Signalements », la page « Retours post-live » — deux
  // noms pour le même écran, dont le contenu réel est mixte (audit 6.1).
  { href: '/admin/feedback',      label: 'Retours après le live', Icon: AlertTriangle,   badgeKey: 'feedback' },
  { href: '/admin/blacklist',     label: 'Blocages',          Icon: Ban             },
  { href: '/admin/team',          label: 'Équipe',            Icon: Shield          },
  { href: '/admin/settings',      label: 'Paramètres',        Icon: Settings        },
];

type Counts = Partial<Record<'ambassadeurs' | 'temoignages' | 'feedback', number>>;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>({});

  // Best-effort : un échec laisse simplement la sidebar sans badge.
  //
  // Rafraîchi à la navigation et périodiquement : traiter un dossier ne change
  // pas `pathname`, or le badge doit refléter la file après l'action.
  useEffect(() => {
    let cancelled = false;

    function load() {
      fetch('/api/admin/queue-counts')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && !cancelled) setCounts(d); })
        .catch(() => {});
    }

    load();
    const id = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/auth');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-14 sm:w-52 shrink-0 bg-slate-900 flex flex-col sticky top-0 h-screen self-start">
        <div className="px-4 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            {/* Monogramme — même identité de marque que AppHeader.tsx (carte publique),
                adapté au fond sombre de la sidebar (indigo-600 plein, texte blanc). */}
            <div className="w-7 h-7 shrink-0 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-[11px] font-bold text-white tracking-tight">AG</span>
            </div>
            <p className="hidden sm:block text-slate-500 text-xs">Espace admin</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, label, Icon, badgeKey }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            const count = badgeKey ? counts[badgeKey] ?? 0 : 0;
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`relative flex items-center justify-center sm:justify-start gap-3 px-2 sm:px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline flex-1 min-w-0 truncate">{label}</span>
                {count > 0 && (
                  <>
                    {/* Desktop : pastille chiffrée alignée à droite du libellé. */}
                    <span className="hidden sm:inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-violet-600 text-white text-[10px] font-semibold shrink-0">
                      {count}
                    </span>
                    {/* Mobile (icônes seules) : point de notification, le chiffre ne tiendrait pas. */}
                    <span
                      className="sm:hidden absolute top-1 right-1 w-2 h-2 rounded-full bg-violet-500 ring-2 ring-slate-900"
                      aria-hidden="true"
                    />
                  </>
                )}
                {count > 0 && <span className="sr-only">{`— ${count} en attente`}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="px-2 py-4 border-t border-slate-800 space-y-1">
          <Link
            href="/"
            title="Carte publique"
            className="flex items-center justify-center sm:justify-start gap-2 px-2 sm:px-3 py-2 text-slate-500 hover:text-slate-300 text-xs transition-colors rounded-lg"
          >
            <ChevronLeft className="w-3 h-3 shrink-0" />
            <span className="hidden sm:inline">Carte publique</span>
          </Link>
          <button
            onClick={handleSignOut}
            title="Se déconnecter"
            className="w-full flex items-center justify-center sm:justify-start gap-2 px-2 sm:px-3 py-2 text-slate-500 hover:text-red-400 text-xs transition-colors rounded-lg"
          >
            <LogOut className="w-3 h-3 shrink-0" />
            <span className="hidden sm:inline">Se déconnecter</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-slate-50 overflow-auto">
        {children}
      </main>
    </div>
  );
}

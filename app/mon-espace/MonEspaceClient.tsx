'use client';

import { useEffect, useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Loader2, MessageSquare, UserCircle } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import MesDemandes from '@/components/MesDemandes';
import DecouvrirContent from '@/components/decouvrir/DecouvrirContent';
import ProfilTab, { type VisitorProfileData } from '@/components/visitor/ProfilTab';
import TabNav, { tabButtonId, tabPanelId, type TabItem } from '@/components/ui/TabNav';
import { createClient } from '@/lib/supabase/browser';
import { groupRequests, type VisitorRequest } from '@/lib/visitor/group-requests';
import type { FeaturedTestimonial } from '@/lib/decouvrir/featured-testimonial';

type MonEspaceTab = 'demandes' | 'profil' | 'guide';

const TAB_IDS: readonly MonEspaceTab[] = ['demandes', 'profil', 'guide'];
const DEFAULT_TAB: MonEspaceTab = 'demandes';
const TABS_ID = 'mon-espace';

function parseTab(value: string | null): MonEspaceTab {
  return TAB_IDS.find((t) => t === value) ?? DEFAULT_TAB;
}

// Espace visiteur : suivre ses demandes, régler son profil, relire comment se passe une visite.
// L'onglet actif vit dans l'URL (`?onglet=`) : un lien d'e-mail peut ouvrir directement « Demandes »,
// et un rechargement ne ramène pas au premier onglet.
export default function MonEspaceClient({ testimonial }: { testimonial: FeaturedTestimonial | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get('onglet'));

  const [profile, setProfile] = useState<VisitorProfileData | null>(null);
  const [requests, setRequests] = useState<VisitorRequest[] | null>(null);
  const [requestsFailed, setRequestsFailed] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/auth'); return; }

    const res = await fetch('/api/visitor/profile');
    if (res.status === 404) { router.replace('/mon-espace/creer'); return; }
    if (!res.ok) { router.replace('/'); return; }
    const data = await res.json();
    setProfile({
      email: data.email ?? user.email ?? '',
      firstName: data.first_name ?? '',
      phone: (data.phone ?? '').replace(/\s+/g, ''),
      photoUrl: data.photo_signed_url ?? null,
      photoPath: data.photo_url ?? null,
    });

    // Chargées ici (et non dans l'onglet) : le badge de « Demandes » doit être juste
    // même quand le visiteur est sur un autre onglet.
    try {
      const reqRes = await fetch('/api/visitor/requests');
      if (!reqRes.ok) throw new Error();
      const reqData = await reqRes.json();
      setRequests(reqData.requests ?? []);
    } catch {
      setRequestsFailed(true);
    }
  }, [router]);

  // Différé d'un tick : `load` met à jour l'état, ce qu'un effet ne doit pas faire de façon synchrone.
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const changeTab = useCallback((tab: MonEspaceTab) => {
    router.replace(`${pathname}?onglet=${tab}`, { scroll: false });
  }, [router, pathname]);

  const pendingCount = useMemo(
    () => (requests ? groupRequests(requests, new Date()).pendingCount : 0),
    [requests],
  );

  const tabs: TabItem<MonEspaceTab>[] = [
    { id: 'demandes', label: 'Demandes', icon: MessageSquare, badge: pendingCount, badgeLabel: 'en attente' },
    { id: 'profil', label: 'Profil', icon: UserCircle },
    { id: 'guide', label: 'Guide', icon: BookOpen },
  ];

  if (!profile) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center bg-slate-50">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </main>
      </>
    );
  }

  // Les trois panneaux restent montés (masqués par `hidden`) : saisie du téléphone, accordéon de la
  // FAQ et état de l'historique ne se perdent pas quand on change d'onglet.
  const panelProps = (tab: MonEspaceTab) => ({
    role: 'tabpanel' as const,
    id: tabPanelId(TABS_ID, tab),
    'aria-labelledby': tabButtonId(TABS_ID, tab),
    hidden: activeTab !== tab,
  });

  return (
    <>
      <AppHeader />
      <TabNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={changeTab}
        ariaLabel="Navigation de mon espace"
        idPrefix={TABS_ID}
        desktopTopClassName="sm:top-[58px]"
      />
      <main className="flex-1 bg-slate-50 px-4 py-8 pb-24 sm:pb-8">
        <div className="max-w-lg mx-auto">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour à la carte
          </Link>

          <h1 className="text-xl font-semibold text-slate-800 mb-6">
            {profile.firstName ? `Bonjour, ${profile.firstName} !` : 'Mon espace'}
          </h1>

          <div {...panelProps('demandes')}>
            <MesDemandes
              requests={requests}
              failed={requestsFailed}
              onOpenGuide={() => changeTab('guide')}
            />
          </div>

          <div {...panelProps('profil')}>
            <ProfilTab initial={profile} />
          </div>

          <div {...panelProps('guide')}>
            <DecouvrirContent testimonial={testimonial} titleAs="h2" />
          </div>
        </div>
      </main>
    </>
  );
}

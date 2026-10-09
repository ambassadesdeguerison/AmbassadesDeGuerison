'use client';

import { Home, MessageSquare, UserCircle, Play } from 'lucide-react';
import TabNav, { type TabItem } from '@/components/ui/TabNav';

export type DashboardTab = 'accueil' | 'demandes' | 'profil' | 'formation';

// Préfixe des id ARIA : à reprendre sur le panneau actif (`tabPanelId(DASHBOARD_TABS_ID, tab)`).
export const DASHBOARD_TABS_ID = 'dashboard';

interface Props {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  pendingCount: number;
}

export default function DashboardTabs({ activeTab, onTabChange, pendingCount }: Props) {
  const tabs: TabItem<DashboardTab>[] = [
    { id: 'accueil', label: 'Accueil', icon: Home },
    { id: 'demandes', label: 'Demandes', icon: MessageSquare, badge: pendingCount, badgeLabel: 'en attente' },
    { id: 'profil', label: 'Profil', icon: UserCircle },
    { id: 'formation', label: 'Formation', icon: Play },
  ];

  return (
    <TabNav
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      ariaLabel="Navigation du tableau de bord"
      idPrefix={DASHBOARD_TABS_ID}
      desktopTopClassName="sm:top-[52px]"
    />
  );
}

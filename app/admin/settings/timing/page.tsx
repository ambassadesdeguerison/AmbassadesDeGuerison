import { createServiceClient } from '@/lib/supabase/server';
import AdminLayout from '@/components/AdminLayout';
import TimingConfigClient from './TimingConfigClient';
import { DEFAULTS } from '@/lib/timing-config';

export const dynamic = 'force-dynamic';

// Les colonnes retirées de l'UI (host_reminder_days_before,
// visitor_auto_decline_days_before, queue_aging_days) restent sélectionnées par
// `select('*')` et transmises telles quelles — TimingConfigClient ne les
// affiche simplement plus. Voir la note dans ce composant (audit 9.1).

export default async function TimingSettingsPage() {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('event_timing_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  const config = { ...DEFAULTS, ...(data ?? {}) };

  return (
    <AdminLayout>
      <TimingConfigClient config={config} />
    </AdminLayout>
  );
}

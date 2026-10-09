import { createServiceClient } from '@/lib/supabase/server';
import AdminLayout from '@/components/AdminLayout';
import AdminPage from '@/components/admin/AdminPage';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PlanningClient from '@/components/PlanningClient';
import CalendrierCampaignSection from './CalendrierCampaignSection';

export const dynamic = 'force-dynamic';

export default async function AdminCalendrierPage() {
  const supabase = createServiceClient();

  const [{ data: events }, { data: campaigns }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, event_date, live_link, description')
      .order('event_date', { ascending: true }),
    supabase
      .from('scheduled_campaigns')
      .select('id, type, event_id, status, scheduled_at, sent_count, custom_message')
      .order('scheduled_at', { ascending: true }),
  ]);

  const allEvents = (events ?? []).map((e) => ({
    id: e.id as string,
    title: e.title as string,
    event_date: e.event_date as string,
  }));

  const futureEvents = allEvents.filter((e) => new Date(e.event_date) > new Date());

  return (
    <AdminLayout>
      <AdminPage>
        <AdminPageHeader
          title="Calendrier"
          subtitle="Les lives à venir, et les e-mails groupés qui les annoncent."
        />

        <div className="space-y-10">
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Lives</h2>
            <PlanningClient events={events ?? []} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Envois groupés par e-mail</h2>
            <CalendrierCampaignSection
              futureEvents={futureEvents}
              // Tous les events, pour résoudre le titre des campagnes rattachées
              // à un live déjà passé — sinon un UUID brut s'affichait (audit 4.4).
              allEvents={allEvents}
              campaigns={campaigns ?? []}
              tzOffset={process.env.NEXT_PUBLIC_ADMIN_TZ_OFFSET ?? '+04:00'}
            />
          </section>
        </div>
      </AdminPage>
    </AdminLayout>
  );
}

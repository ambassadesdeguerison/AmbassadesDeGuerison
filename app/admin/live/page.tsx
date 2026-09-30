import AdminFeed from '@/components/AdminFeed';
import LiveTestimonialsCounter from '@/components/LiveTestimonialsCounter';
import AdminLayout from '@/components/AdminLayout';
import AdminPage from '@/components/admin/AdminPage';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import LiveCloseButton from '@/components/LiveCloseButton';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { getCurrentEvent } from '@/lib/admin/event-window';

export const dynamic = 'force-dynamic';

export default async function AdminLivePage() {
  const { event, isCurrentLive } = await getCurrentEvent();

  const eventDate = event
    ? new Date(event.event_date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : null;

  return (
    <AdminLayout>
      <AdminPage width="wide">
        {/* Audit 3.4 : le bandeau exposait `LIVE_WINDOW_FUTURE_HOURS`, une
            variable d'environnement Vercel invisible et inaccessible depuis
            l'admin — un nombre que personne ne pouvait ni vérifier ni changer. */}
        {!isCurrentLive && event && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 max-w-2xl">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Aucun live en cours en ce moment — voici le dernier live connu.{' '}
              <Link href="/admin/calendrier" className="underline underline-offset-2 hover:text-amber-900">
                Voir le calendrier
              </Link>
            </p>
          </div>
        )}

        <AdminPageHeader
          title={event ? event.title : 'Live'}
          subtitle={
            event
              ? isCurrentLive
                ? `${eventDate} — en cours`
                : eventDate
              : 'Aucun live programmé pour le moment.'
          }
          action={isCurrentLive && event ? <LiveCloseButton eventId={event.id} /> : undefined}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <h2 className="text-sm font-semibold text-slate-700">Mains levées</h2>
            </div>
            {/* Audit 3.1 : la page ne disait jamais ce qu'est un signal, d'où il
                vient, ni ce que l'admin est censé en faire — une colonne vide
                était indiscernable d'une panne. */}
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Les ambassadeurs signalent depuis leur tableau de bord les moments forts vécus chez eux pendant le live.
              David peut les citer à l&apos;antenne.
            </p>
            <AdminFeed eventId={event?.id ?? null} />
          </section>

          <section>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-indigo-500 rounded-full" />
              <h2 className="text-sm font-semibold text-slate-700">Témoignages</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Témoignages déposés publiquement pour ce live.{' '}
              <Link href="/admin/temoignages" className="underline underline-offset-2 hover:text-slate-600">
                Les modérer
              </Link>
            </p>
            <LiveTestimonialsCounter eventId={event?.id ?? null} />
          </section>
        </div>
      </AdminPage>
    </AdminLayout>
  );
}

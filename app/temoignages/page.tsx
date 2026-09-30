import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import AppHeader from '@/components/AppHeader';
import TemoignageCard from '@/components/TemoignageCard';
import TemoignageShareButtons from '@/components/TemoignageShareButtons';
import TemoignageLiveFilter from '@/components/TemoignageLiveFilter';
import Link from 'next/link';
import { MapPin, Sparkles, PenLine, Users, Globe, ChevronLeft, ChevronRight } from 'lucide-react';

export const revalidate = 60;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ambassades-guerison.fr';
const PAGE_SIZE = 20;

// revalidate=60 seul est un no-op ici : la lecture de searchParams (?live=,
// ?page=) force Next.js en rendu dynamique quelle que soit la valeur de
// revalidate. unstable_cache met en cache les requêtes Supabase elles-mêmes
// (clé = event+page), indépendamment de ce comportement.
async function getTemoignages(eventId?: string, page = 1) {
  return unstable_cache(
    async () => {
      const supabase = createServiceClient();
      const offset = (page - 1) * PAGE_SIZE;

      let query = supabase
        .from('testimonials')
        .select('id, content, created_at, visitor_name, submitter_city, host_profile:host_profiles(first_name, city, country), event:events(id, title)', { count: 'exact' })
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (eventId) query = query.eq('event_id', eventId);
      const { data, count } = await query;
      return { temoignages: data ?? [], total: count ?? 0 };
    },
    ['temoignages', eventId ?? 'all', String(page)],
    { revalidate: 60, tags: ['temoignages'] }
  )();
}

async function getTotalCities(eventId?: string) {
  return unstable_cache(
    async () => {
      const supabase = createServiceClient();
      let query = supabase
        .from('testimonials')
        .select('submitter_city, host_profile:host_profiles(city)', { count: 'exact' })
        .eq('is_visible', true);
      if (eventId) query = query.eq('event_id', eventId);
      const { data } = await query;
      const cities = new Set<string>();
      (data ?? []).forEach((t) => {
        const hp = Array.isArray(t.host_profile) ? t.host_profile[0] : t.host_profile;
        const city = (hp as { city?: string } | null)?.city ?? (t as Record<string, unknown>).submitter_city as string | null;
        if (city) cities.add(city);
      });
      return cities.size;
    },
    ['temoignages-cities', eventId ?? 'all'],
    { revalidate: 60, tags: ['temoignages'] }
  )();
}

async function getEvents() {
  return unstable_cache(
    async () => {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from('events')
        .select('id, title, event_date')
        .order('event_date', { ascending: false })
        .limit(20);
      return data ?? [];
    },
    ['temoignages-events'],
    { revalidate: 60, tags: ['events'] }
  )();
}

export default async function TemoignagesPage({
  searchParams,
}: {
  searchParams: Promise<{ live?: string; page?: string }>;
}) {
  const { live, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));

  const [{ temoignages, total }, cityCount, events] = await Promise.all([
    getTemoignages(live, page),
    getTotalCities(live),
    getEvents(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeEvent = live ? events.find((e) => e.id === live) : null;
  const pageUrl = `${APP_URL}/temoignages`;
  const waText = `Ce que Dieu a fait — témoignages des lives de David Théry : ${pageUrl}`;

  function buildPageUrl(p: number) {
    const params = new URLSearchParams();
    if (live) params.set('live', live);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/temoignages${qs ? `?${qs}` : ''}`;
  }

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-2xl mx-auto px-4 py-12">

          {/* En-tête */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-indigo-500" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-800">Ce que Dieu a fait</h1>
            <p className="text-slate-500 text-sm mt-2">
              Témoignages reçus lors des lives de David Théry.
            </p>

            {/* Stats */}
            {total > 0 && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  {total} témoignage{total > 1 ? 's' : ''}
                </span>
                {cityCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    {cityCount} ville{cityCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Filtre par live + CTA partage discret */}
          <div className="flex items-center justify-between gap-4 mb-6">
            {events.length > 0 ? (
              <TemoignageLiveFilter
                events={events.map((e) => ({ id: e.id as string, title: e.title as string, event_date: e.event_date as string }))}
                currentLive={live}
                activeEventTitle={activeEvent?.title as string | undefined}
              />
            ) : <span />}
            <Link
              href={`/temoignages/nouveau${live ? `?live=${live}` : ''}`}
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline whitespace-nowrap shrink-0"
            >
              <PenLine className="w-3.5 h-3.5" />
              Partager le mien
            </Link>
          </div>

          {/* Liste ou état vide */}
          {temoignages.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-400 text-sm">
                {live
                  ? 'Aucun témoignage publié pour ce live.'
                  : 'Les premiers témoignages arrivent bientôt.'}
              </p>
              <Link
                href={`/temoignages/nouveau${live ? `?live=${live}` : ''}`}
                className="mt-5 inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors"
              >
                <PenLine className="w-4 h-4" />
                Partagez votre expérience
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {temoignages.map((t) => {
                  const hp = Array.isArray(t.host_profile) ? t.host_profile[0] : t.host_profile;
                  const ev = Array.isArray(t.event) ? t.event[0] : t.event;
                  const raw = t as Record<string, unknown>;
                  const displayName = hp
                    ? `${hp.first_name}, ${hp.city}${hp.country ? ` (${hp.country})` : ''}`
                    : raw.visitor_name
                      ? `${raw.visitor_name}${raw.submitter_city ? `, ${raw.submitter_city}` : ''}`
                      : null;
                  return (
                    <TemoignageCard
                      key={t.id}
                      content={t.content}
                      hostName={displayName}
                      eventTitle={ev?.title ?? null}
                    />
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-8">
                  {page > 1 ? (
                    <Link
                      href={buildPageUrl(page - 1)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" /> Plus récents
                    </Link>
                  ) : <span />}
                  <span className="text-xs text-slate-400">{page} / {totalPages}</span>
                  {page < totalPages ? (
                    <Link
                      href={buildPageUrl(page + 1)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Témoignages plus anciens <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : <span />}
                </div>
              )}

              {/* CTAs */}
              <div className="mt-12 space-y-6 text-center">
                <Link
                  href={`/temoignages/nouveau${live ? `?live=${live}` : ''}`}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors"
                >
                  <PenLine className="w-4 h-4" />
                  Partagez votre témoignage
                </Link>

                <div className="border-t border-slate-100 pt-6 flex flex-col items-center gap-3">
                  <p className="text-slate-400 text-sm">Partager cette page</p>
                  <TemoignageShareButtons url={pageUrl} whatsappText={waText} />
                </div>

                <div className="pt-2">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-indigo-600 text-sm font-medium hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Rejoindre une ambassade
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

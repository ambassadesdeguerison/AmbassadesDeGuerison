import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import ShareButtons from '@/components/ShareButtons';
import AppHeader from '@/components/AppHeader';
import { firstRow } from '@/lib/supabase/relation';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TemoignagesPage({ params }: Props) {
  const { id } = await params;
  const supabase = createServiceClient();

  const [eventRes, testimonialsRes] = await Promise.all([
    supabase.from('events').select('id, title, event_date').eq('id', id).single(),
    supabase
      .from('testimonials')
      .select(`
        id, content, created_at,
        host_profiles!inner (first_name, city, country)
      `)
      .eq('event_id', id)
      .eq('is_visible', true)
      .order('created_at', { ascending: false }),
  ]);

  if (eventRes.error || !eventRes.data) notFound();
  const event = eventRes.data;
  const testimonials = testimonialsRes.data ?? [];

  return (
    <>
      <AppHeader />
      <main className="flex-1 bg-white px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
              <p className="text-gray-500 text-sm mt-1">
                {new Date(event.event_date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <p className="text-indigo-600 font-medium mt-1">
                {testimonials.length} témoignage{testimonials.length !== 1 ? 's' : ''}
              </p>
            </div>
            <ShareButtons
              url={`/lives/${id}/temoignages`}
              text={`${testimonials.length} témoignage${testimonials.length !== 1 ? 's' : ''} lors du live "${event.title}" avec David Théry 🙏`}
            />
          </div>
        </div>

        {testimonials.length === 0 ? (
          <p className="text-gray-400 text-center py-10">Aucun témoignage pour ce live.</p>
        ) : (
          <div className="space-y-4">
            {testimonials.map((t) => {
              const hp = firstRow(t.host_profiles);
              if (!hp) return null; // `!inner` sur la requête : ne devrait jamais arriver
              return (
                <div key={t.id} className="border border-gray-100 rounded-xl p-5 shadow-sm">
                  <blockquote className="text-gray-800 italic mb-3">&quot;{t.content}&quot;</blockquote>
                  <footer className="text-sm text-gray-500">
                    <span className="font-medium text-gray-700">{hp.first_name}</span>
                    {' — '}
                    {hp.city}, {hp.country}
                  </footer>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
    </>
  );
}

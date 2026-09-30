import Link from 'next/link';
import { ArrowLeft, MapPin, Quote } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import FaqAccordion from '@/components/FaqAccordion';
import { createServiceClient } from '@/lib/supabase/server';

export const revalidate = 60;

// Témoignage vedette — jamais d'état vide visible (design doc Pass 2) :
// fallback sur le témoignage global le plus récent si aucun n'est publié
// pour le prochain live spécifiquement (même requête que /temoignages,
// sans filtre event).
async function getFeaturedTestimonial() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('testimonials')
    .select('content, visitor_name, submitter_city, host_profile:host_profiles(first_name, city)')
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const hp = Array.isArray(data.host_profile) ? data.host_profile[0] : data.host_profile;
  const displayName = hp
    ? `${hp.first_name}, ${hp.city}`
    : data.visitor_name
      ? `${data.visitor_name}${data.submitter_city ? `, ${data.submitter_city}` : ''}`
      : null;

  return { content: data.content as string, displayName };
}

const STEPS = [
  {
    title: 'Vous trouvez une ambassade près de chez vous',
    body: 'Sur la carte, cherchez votre ville et contactez un hôte disponible pour le prochain live.',
  },
  {
    title: "L'hôte vous accueille",
    body: "Une fois votre demande acceptée, vous recevez l'adresse et pouvez échanger directement avec lui.",
  },
  {
    title: 'Vous vivez le live ensemble',
    body: 'Rien à apporter, rien à préparer. Juste votre présence, en communion avec le groupe.',
  },
] as const;

export default async function DecouvrirPage() {
  const testimonial = await getFeaturedTestimonial();

  return (
    <>
      <AppHeader />
      <main className="flex-1 bg-slate-50">
        <div className="max-w-lg mx-auto px-4 py-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour à la carte
          </Link>

          {/* 1. Réassurance — répond directement à "est-ce sérieux ?" (David, R4) */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
            <h1 className="text-xl font-semibold text-slate-800 mb-2">Votre première visite</h1>
            <p className="text-sm text-slate-500 leading-relaxed">
              Découvrir un groupe de prière n&apos;a rien de compliqué. Voici comment ça se passe, sans surprise.
            </p>
          </div>

          {/* 2. Les 3 étapes concrètes */}
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">Comment ça se passe</h2>
            <div className="space-y-2.5">
              {STEPS.map((step, i) => (
                <div key={step.title} className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold text-sm shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">{step.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. FAQ */}
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">Questions fréquentes</h2>
            <FaqAccordion />
          </section>

          {/* 4. Témoignage vedette */}
          {testimonial && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-3">Ce que d&apos;autres ont vécu</h2>
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <Quote className="w-5 h-5 text-indigo-400 mb-2" />
                <p className="text-sm text-slate-700 italic leading-relaxed mb-3">{testimonial.content}</p>
                {testimonial.displayName && (
                  <p className="text-xs text-slate-400">— {testimonial.displayName}</p>
                )}
              </div>
            </section>
          )}

          {/* 5. CTA retour carte */}
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            Trouver une ambassade près de moi
          </Link>
        </div>
      </main>
    </>
  );
}

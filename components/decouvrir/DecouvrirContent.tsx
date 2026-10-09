import Link from 'next/link';
import { MapPin, Quote } from 'lucide-react';
import FaqAccordion from '@/components/FaqAccordion';
import type { FeaturedTestimonial } from '@/lib/decouvrir/featured-testimonial';

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

// Contenu de « Votre première visite », partagé par la page publique /decouvrir et l'onglet
// « Guide » de /mon-espace. Purement présentationnel : pas d'en-tête de page, pas de lien retour.
// `titleAs` : « h2 » quand la page porte déjà son propre h1 (onglet « Guide » de /mon-espace).
export default function DecouvrirContent({
  testimonial,
  titleAs: Title = 'h1',
}: {
  testimonial: FeaturedTestimonial | null;
  titleAs?: 'h1' | 'h2';
}) {
  return (
    <>
      {/* 1. Réassurance — répond directement à "est-ce sérieux ?" (David, R4) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <Title className="text-xl font-semibold text-slate-800 mb-2">Votre première visite</Title>
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
    </>
  );
}

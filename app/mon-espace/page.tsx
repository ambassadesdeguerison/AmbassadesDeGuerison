import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import { getFeaturedTestimonial } from '@/lib/decouvrir/featured-testimonial';
import MonEspaceClient from './MonEspaceClient';

// Le témoignage de l'onglet « Guide » ne dépend pas de la session : la coque est servie en cache
// (60 s), comme /decouvrir. La session et les demandes sont chargées côté navigateur.
export const revalidate = 60;

export default async function MonEspacePage() {
  const testimonial = await getFeaturedTestimonial();

  // Suspense : MonEspaceClient lit `?onglet=` (useSearchParams), requis pour une page préparée au build.
  return (
    <Suspense
      fallback={
        <>
          <AppHeader />
          <main className="flex-1 flex items-center justify-center bg-slate-50">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </main>
        </>
      }
    >
      <MonEspaceClient testimonial={testimonial} />
    </Suspense>
  );
}

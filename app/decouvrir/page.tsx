import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import DecouvrirContent from '@/components/decouvrir/DecouvrirContent';
import { getFeaturedTestimonial } from '@/lib/decouvrir/featured-testimonial';

export const revalidate = 60;

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

          <DecouvrirContent testimonial={testimonial} />
        </div>
      </main>
    </>
  );
}

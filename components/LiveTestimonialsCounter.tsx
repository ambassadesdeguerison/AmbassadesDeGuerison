'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { MessageSquare, ArrowRight } from 'lucide-react';

export default function LiveTestimonialsCounter({ eventId }: { eventId: string | null }) {
  const [count, setCount] = useState<number | null>(null);

  const fetchCount = useCallback(async () => {
    const base = '/api/testimonials?is_visible=false';
    const url = eventId ? `${base}&event_id=${eventId}` : base;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setCount(Array.isArray(data) ? data.length : 0);
    }
  }, [eventId]);

  useEffect(() => {
    // Premier appel différé d'un tick : `fetchCount` met à jour l'état, ce qu'un effet ne doit pas faire de façon synchrone.
    const first = setTimeout(fetchCount, 0);
    const interval = setInterval(fetchCount, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [fetchCount]);

  const href = eventId
    ? `/admin/temoignages?event_id=${eventId}`
    : '/admin/temoignages';

  if (count === null) return null;

  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4 hover:border-indigo-200 hover:shadow-md transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <p className="text-slate-800 font-semibold text-sm">
            {count === 0
              ? 'Aucun témoignage reçu'
              : `${count} témoignage${count > 1 ? 's' : ''} reçu${count > 1 ? 's' : ''}`}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">À modérer après le live</p>
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
    </Link>
  );
}

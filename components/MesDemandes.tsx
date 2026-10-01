'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import { formatEventDateDual } from '@/lib/format-event-date';
import { de } from '@/lib/elision';

type Status = 'pending' | 'accepted' | 'declined' | 'cancelled_no_response';

interface VisitorRequest {
  id: string;
  status: Status;
  nb_personnes: number;
  created_at: string;
  event_title: string | null;
  event_date: string | null;
  host_first_name: string | null;
  host_city: string | null;
  host_country: string | null;
}

const STATUS: Record<Status, { label: string; detail: string; icon: typeof Clock; classes: string }> = {
  pending: {
    label: 'En attente de réponse',
    detail: "L'ambassadeur a reçu votre demande.",
    icon: Clock,
    classes: 'bg-amber-50 text-amber-700',
  },
  accepted: {
    label: 'Acceptée',
    detail: "Vous avez reçu l'adresse et les coordonnées par e-mail.",
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-700',
  },
  declined: {
    label: 'Non retenue cette fois',
    detail: "D'autres ambassades sont peut-être disponibles près de chez vous.",
    icon: XCircle,
    classes: 'bg-slate-100 text-slate-600',
  },
  cancelled_no_response: {
    label: 'Sans réponse',
    detail: "L'ambassadeur n'a pas pu répondre à temps. Vous pouvez en contacter une autre.",
    icon: XCircle,
    classes: 'bg-slate-100 text-slate-600',
  },
};

export default function MesDemandes() {
  const [requests, setRequests] = useState<VisitorRequest[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/visitor/requests')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setRequests(data.requests ?? []);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section aria-labelledby="mes-demandes-title" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
      <h2 id="mes-demandes-title" className="font-semibold text-slate-800 text-sm">Mes demandes</h2>

      {requests === null && !failed && (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        </div>
      )}

      {failed && (
        <p className="text-sm text-slate-500">Vos demandes ne peuvent pas être affichées pour le moment. Réessayez dans un instant.</p>
      )}

      {requests?.length === 0 && (
        <p className="text-sm text-slate-500">
          Vous n&apos;avez pas encore fait de demande.{' '}
          <Link href="/" className="text-indigo-600 hover:text-indigo-700 font-medium">Voir la carte</Link>
        </p>
      )}

      {requests && requests.length > 0 && (
        <ul className="space-y-3">
          {requests.map((r) => {
            const s = STATUS[r.status] ?? STATUS.pending;
            const Icon = s.icon;
            const place = [r.host_city, r.host_country].filter(Boolean).join(', ');
            return (
              <li key={r.id} className="rounded-xl border border-slate-100 p-4">
                <p className="text-sm font-medium text-slate-800">
                  {r.host_first_name ? `Ambassade ${de(r.host_first_name)}` : 'Ambassade'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {[place, r.event_date ? formatEventDateDual(r.event_date) : null].filter(Boolean).join(' — ')}
                </p>
                <p className={`inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full text-xs font-medium ${s.classes}`}>
                  <Icon className="w-3.5 h-3.5" /> {s.label}
                </p>
                <p className="text-xs text-slate-500 mt-2">{s.detail}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

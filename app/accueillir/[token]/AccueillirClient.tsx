'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Users, MessageCircle } from 'lucide-react';

interface Props {
  token: string;
  status: string;
  visitorName: string;
  nbPersonnes: number | null;
  message: string | null;
  hostName: string;
  eventTitle: string;
  eventDate: string;
}

export default function AccueillirClient({
  token, status, visitorName, nbPersonnes, message, hostName, eventTitle, eventDate,
}: Props) {
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(
    status === 'accepted' ? 'accepted' : status === 'declined' ? 'declined' : null
  );
  const [error, setError] = useState('');

  async function handleAction(action: 'accept' | 'decline') {
    setLoading(action);
    setError('');

    const route = action === 'accept' ? 'accept' : 'decline';
    const res = await fetch(`/api/visit-requests/${token}/${route}`, { method: 'POST' });
    const data = await res.json();

    if (res.ok || data.message) {
      setDone(action === 'accept' ? 'accepted' : 'declined');
    } else {
      setError(data.error ?? 'Une erreur est survenue.');
    }
    setLoading(null);
  }

  if (done === 'accepted') {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 max-w-sm w-full text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
        <p className="text-slate-800 font-semibold text-lg mb-2">Demande acceptée !</p>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          {visitorName} recevra vos coordonnées par e-mail.
        </p>
        <Link href="/dashboard" className="inline-block text-indigo-600 text-sm hover:underline">
          Mon espace ambassadeur
        </Link>
      </div>
    );
  }

  if (done === 'declined') {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 max-w-sm w-full text-center">
        <CheckCircle2 className="w-10 h-10 text-slate-400 mx-auto mb-4" />
        <p className="text-slate-800 font-semibold mb-2">Demande refusée</p>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          {visitorName} a été prévenu(e). Il pourra chercher une autre ambassade.
        </p>
        <Link href="/dashboard" className="inline-block text-indigo-600 text-sm hover:underline">
          Mon espace ambassadeur
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-sm w-full">
      {/* Info event */}
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{eventTitle}</p>
      <p className="text-xs text-slate-400 mb-5">{eventDate}</p>

      {/* Demande visiteur */}
      <h1 className="text-lg font-semibold text-slate-800 mb-4">
        {visitorName} souhaite rejoindre votre ambassade
      </h1>

      <div className="space-y-3 mb-6">
        {nbPersonnes && nbPersonnes > 1 && (
          <div className="flex items-center gap-2 text-slate-600 text-sm">
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
            {nbPersonnes} personnes
          </div>
        )}
        {message && (
          <div className="flex items-start gap-2 text-slate-600 text-sm">
            <MessageCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{message}</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}

      <div className="space-y-3">
        <button
          onClick={() => handleAction('accept')}
          disabled={!!loading}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading === 'accept' ? 'En cours…' : "J'accueille"}
        </button>
        <button
          onClick={() => handleAction('decline')}
          disabled={!!loading}
          className="w-full border border-red-200 text-red-700 py-3 rounded-xl font-medium text-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {loading === 'decline' ? 'En cours…' : 'Je ne peux pas'}
        </button>
      </div>
    </div>
  );
}

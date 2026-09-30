'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Mic, Check, X } from 'lucide-react';

interface Signal {
  id: string;
  description: string;
  status: string;
  link_shared: boolean;
  created_at: string;
  host_profiles: {
    id: string;
    first_name: string;
    city: string;
    country: string;
  };
}

type EmailToast = { id: string; sent: boolean };

export default function AdminFeed({ eventId }: { eventId: string | null }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [emailToast, setEmailToast] = useState<EmailToast | null>(null);
  const prevCountRef = useRef<number | null>(null);

  function playBeep(frequency = 880) {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  }

  useEffect(() => {
    if (prevCountRef.current !== null && signals.length > prevCountRef.current) {
      playBeep(880);
      const orig = document.title;
      document.title = `🔔 Témoignage — ${orig}`;
      setTimeout(() => { document.title = orig; }, 5000);
    }
    prevCountRef.current = signals.length;
  }, [signals.length]);

  const fetchSignals = useCallback(async () => {
    setRefreshing(true);
    try {
      const url = eventId
        ? `/api/live-signals?status=pending&event_id=${eventId}`
        : `/api/live-signals?status=pending`;
      const res = await fetch(url);
      if (res.ok) setSignals(await res.json());
    } finally {
      setRefreshing(false);
    }
  }, [eventId]);

  // Polling 5s
  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 5_000);
    return () => clearInterval(interval);
  }, [fetchSignals]);

  async function handleAction(id: string, action: 'approve' | 'decline') {
    setProcessing((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/live-signals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (action === 'approve' && res.ok) {
        const data = await res.json();
        setEmailToast({ id, sent: data.emailSent ?? false });
        setTimeout(() => setEmailToast(null), 4000);
      }
      // Retire le signal du feed
      setSignals((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-700">
          En attente d'invitation ({signals.length})
        </h2>
        {refreshing && (
          <svg className="animate-spin w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>

      {emailToast && (
        <div className={`mb-3 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
          emailToast.sent
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-red-50 text-red-700'
        }`}>
          {emailToast.sent ? (
            <><Check className="w-4 h-4 flex-shrink-0" /> Lien YouTube envoyé par e-mail</>
          ) : (
            <><X className="w-4 h-4 flex-shrink-0" /> Approuvé, mais l'e-mail n'est pas parti</>
          )}
        </div>
      )}

      {signals.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Mic className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm">Aucun témoignage en attente</p>
        </div>
      )}

      <div className="space-y-3">
        {signals.map((signal) => {
          const hp = signal.host_profiles;
          const isProcessing = processing.has(signal.id);
          return (
            <div
              key={signal.id}
              className="bg-white rounded-xl shadow-sm border border-slate-100 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-800">{hp.first_name}</span>
                    <span className="text-xs text-slate-400">
                      {hp.city}, {hp.country}
                    </span>
                  </div>
                  <p className="text-slate-700 text-sm">{signal.description}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(signal.created_at).toLocaleTimeString('fr-FR')}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleAction(signal.id, 'approve')}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approuver
                  </button>
                  <button
                    onClick={() => handleAction(signal.id, 'decline')}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Refuser
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

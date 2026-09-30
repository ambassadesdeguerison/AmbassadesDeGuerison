'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { CheckCircle2, Home, Loader2 } from 'lucide-react';

interface CampaignContext {
  event_title: string;
  event_date: string;
  already_active: boolean;
}

type State = 'loading' | 'invalid' | 'already_active' | 'ready' | 'confirmed';

export default function ActivationPage() {
  const { token } = useParams<{ token: string }>();
  const [rawState, setState] = useState<State>('loading');
  const [ctx, setCtx] = useState<CampaignContext | null>(null);
  const [activating, setActivating] = useState(false);
  // Sans token, le lien est invalide d'emblée : dérivé au rendu plutôt que posé par un effet.
  const state: State = token ? rawState : 'invalid';

  useEffect(() => {
    if (!token) return;

    fetch(`/api/campaign-activations/context?token=${token}`)
      .then((r) => {
        if (r.status === 404) { setState('invalid'); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setCtx(data);
        setState(data.already_active ? 'already_active' : 'ready');
      })
      .catch(() => setState('invalid'));
  }, [token]);

  async function activate() {
    if (!token) return;
    setActivating(true);
    const res = await fetch('/api/campaign-activations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activation_token: token }),
    });
    setActivating(false);
    if (res.ok) setState('confirmed');
    else setState('invalid');
  }

  const eventDate = ctx?.event_date
    ? new Date(ctx.event_date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <>
      <AppHeader />
      <main className="flex-1 bg-slate-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-sm w-full">
          {state === 'loading' && (
            <div className="text-center">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Chargement…</p>
            </div>
          )}

          {state === 'invalid' && (
            <div className="text-center">
              <h1 className="text-lg font-semibold text-slate-800 mb-2">Ce lien ne fonctionne plus</h1>
              <p className="text-sm text-slate-500 mb-6">
                Ce lien n&apos;est plus valable. Rendez-vous dans votre espace ambassadeur pour confirmer votre présence.
              </p>
              <Link href="/dashboard" className="text-indigo-600 text-sm hover:underline">
                Accéder à mon espace
              </Link>
            </div>
          )}

          {(state === 'ready' || state === 'already_active') && ctx && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <Home className="w-4 h-4 text-indigo-600" />
                </div>
                <h1 className="text-base font-semibold text-slate-800">Confirmer ma présence</h1>
              </div>
              <p className="text-sm text-slate-600 mb-1 font-medium">{ctx.event_title}</p>
              <p className="text-sm text-slate-500 mb-6 capitalize">{eventDate}</p>

              {state === 'already_active' ? (
                <div className="flex items-start gap-2 bg-emerald-50 rounded-xl p-4">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-emerald-700">
                    Votre présence à ce live est déjà confirmée. Merci !
                  </p>
                </div>
              ) : (
                <button
                  onClick={activate}
                  disabled={activating}
                  className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {activating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Je confirme ma présence
                </button>
              )}
            </div>
          )}

          {state === 'confirmed' && (
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h1 className="text-lg font-semibold text-slate-800 mb-2">
                Votre présence est confirmée !
              </h1>
              <p className="text-sm text-slate-500 mb-2">
                {ctx?.event_title && <><strong>{ctx.event_title}</strong> — </>}
                votre ambassade apparaîtra sur la carte pendant le live.
              </p>
              <p className="text-sm text-slate-400 mb-6">
                Les visiteurs pourront vous contacter directement depuis la carte.
              </p>
              <Link href="/dashboard" className="text-indigo-600 text-sm hover:underline">
                Accéder à mon espace
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

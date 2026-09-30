'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';

export default function RefuserPage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<'loading' | 'confirm' | 'done' | 'already' | 'error'>('loading');
  const [names, setNames] = useState<{ visitor_first_name: string; host_first_name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/contact-requests/${token}/decline`)
      .then((r) => r.json())
      .then((d) => {
        if (d.already_declined) { setStep('already'); return; }
        if (d.error) { setStep('error'); return; }
        setNames(d);
        setStep('confirm');
      })
      .catch(() => setStep('error'));
  }, [token]);

  async function handleDecline() {
    setSubmitting(true);
    const res = await fetch(`/api/contact-requests/${token}/decline`, { method: 'POST' });
    const d = await res.json();
    if (res.ok || d.already_declined) {
      setStep('done');
    } else {
      setStep('error');
    }
    setSubmitting(false);
  }

  if (step === 'loading') {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
            Chargement…
          </div>
        </main>
      </>
    );
  }

  if (step === 'error') {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center bg-slate-50 px-4">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <h1 className="text-slate-800 font-semibold text-lg mb-1">Ce lien ne fonctionne plus</h1>
            <p className="text-slate-400 text-sm">Ce lien est valable 7 jours.</p>
            <Link href="/" className="mt-4 inline-block text-indigo-600 text-sm hover:underline">Retour à la carte</Link>
          </div>
        </main>
      </>
    );
  }

  if (step === 'already' || step === 'done') {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center bg-slate-50 px-4">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h1 className="text-slate-800 font-semibold text-lg mb-1">Demande refusée</h1>
            <p className="text-slate-500 text-sm">
              {step === 'already' ? 'Cette demande avait déjà été refusée.' : 'Le visiteur en a été informé par e-mail.'}
            </p>
            <Link href="/dashboard" className="mt-4 inline-block text-indigo-600 text-sm hover:underline">Mon espace</Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="flex-1 flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 max-w-sm w-full text-center">
          <h1 className="text-slate-800 font-semibold text-lg mb-2">Refuser la demande de {names?.visitor_first_name} ?</h1>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            {names?.visitor_first_name} sera prévenu par e-mail et pourra chercher une autre ambassade.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleDecline}
              disabled={submitting}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-medium text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'En cours…' : 'Refuser'}
            </button>
            <Link
              href="/dashboard"
              className="block w-full border border-slate-200 text-slate-600 py-3 rounded-xl font-medium text-sm hover:bg-slate-50 transition-colors"
            >
              Annuler
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

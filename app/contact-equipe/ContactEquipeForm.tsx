'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  token: string | null;
}

export default function ContactEquipeForm({ token }: Props) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/visitor-help-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        message,
        token: token ?? undefined,
        website: '', // honeypot
      }),
    });

    if (res.ok) {
      setDone(true);
    } else {
      const data = await res.json();
      setError(data.error ?? 'Une erreur est survenue.');
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
        <p className="text-slate-800 font-semibold mb-2">Message envoyé</p>
        <p className="text-slate-500 text-sm leading-relaxed">
          L&apos;équipe vous recontacte rapidement par e-mail.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Votre e-mail *</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputCls}
          placeholder="vous@exemple.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Que se passe-t-il ? *</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          minLength={10}
          className={inputCls}
          placeholder="Décrivez la situation — plus vous donnez de détails, mieux on peut vous aider."
        />
      </div>

      {/* Honeypot */}
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />

      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Envoi…' : 'Envoyer le message'}
      </button>
    </form>
  );
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white';

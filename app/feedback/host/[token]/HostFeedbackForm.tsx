'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  eventId: string;
  hostProfileId: string;
  contactRequestId: string;
  visitorEmail: string;
  visitorPhone: string;
  visitorFirstName: string;
}

// V1 minimal (design doc D.3) : 1-2 questions, pas les 4 critères étoilés du
// formulaire visiteur — le sens de la question est différent ("est-ce que je
// veux revoir cette personne", pas "comment était l'accueil que j'ai reçu").
export default function HostFeedbackForm({ eventId, hostProfileId, contactRequestId, visitorEmail, visitorPhone, visitorFirstName }: Props) {
  const [wouldHostAgain, setWouldHostAgain] = useState<boolean | null>(null);
  const [freeText, setFreeText] = useState('');
  const [blockVisitor, setBlockVisitor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (wouldHostAgain === null) {
      setError('Merci de répondre à la question.');
      return;
    }
    setLoading(true);
    setError('');

    const res = await fetch('/api/feedbacks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        host_profile_id: hostProfileId,
        contact_request_id: contactRequestId,
        visitor_email: visitorEmail,
        direction: 'host_to_visitor',
        would_host_again: wouldHostAgain,
        free_text: freeText.trim() || null,
        block_visitor: wouldHostAgain === false && blockVisitor,
        visitor_phone: visitorPhone,
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
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        <p className="text-sm text-slate-600">Merci pour votre retour sur {visitorFirstName}.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
      <p className="text-sm font-medium text-slate-800">{visitorFirstName}</p>

      <div>
        <p id={`q-${contactRequestId}`} className="text-sm font-medium text-slate-700 mb-2">
          Seriez-vous à l&apos;aise que cette personne revienne chez vous ?
        </p>
        {/* role=radio + aria-checked : sans ça un lecteur d'écran annonçait deux
            boutons ordinaires, sans dire lequel était sélectionné — l'état
            n'était porté que par la couleur. min-h-11 = 44px (DESIGN.md). */}
        <div role="radiogroup" aria-labelledby={`q-${contactRequestId}`} className="flex gap-2">
          <button
            type="button"
            role="radio"
            aria-checked={wouldHostAgain === true}
            tabIndex={wouldHostAgain === false ? -1 : 0}
            onClick={() => setWouldHostAgain(true)}
            className={`flex-1 min-h-11 py-2 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${wouldHostAgain === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
          >
            Oui
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={wouldHostAgain === false}
            tabIndex={wouldHostAgain === false ? 0 : -1}
            onClick={() => setWouldHostAgain(false)}
            className={`flex-1 min-h-11 py-2 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${wouldHostAgain === false ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
          >
            Non
          </button>
        </div>
      </div>

      {wouldHostAgain === false && (
        <label className="flex items-start gap-2.5 cursor-pointer bg-amber-50 border border-amber-100 rounded-lg p-3">
          <input
            type="checkbox"
            checked={blockVisitor}
            onChange={(e) => setBlockVisitor(e.target.checked)}
            className="mt-0.5 w-5 h-5 shrink-0 accent-amber-600"
          />
          <span className="text-xs text-amber-800 leading-relaxed">
            Ne plus recevoir de demande de la part de cette personne. Elle pourra toujours contacter d&apos;autres ambassades.
          </span>
        </label>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Sinon, avez-vous quelque chose à partager ? (optionnel)</label>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          rows={2}
          maxLength={1000}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white"
          placeholder="Un détail qui aiderait l'équipe à mieux comprendre…"
        />
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Envoi…' : 'Envoyer'}
      </button>
    </form>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

interface Props {
  eventId: string;
  hostProfileId: string;
  hostName: string;
}

export default function VisitRequestForm({ eventId, hostProfileId, hostName }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    nb_personnes: 1,
    visitor_message: '',
    // Jamais pré-coché : la CJUE (1er oct. 2019) a jugé qu'une case cochée par
    // défaut ne vaut pas consentement — le RGPD exige un acte positif clair.
    visitor_notifications_optin: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Phase 3 PR3 : demande faite depuis un compte visiteur authentifié —
  // undefined = vérification en cours, null = pas de session (gate affichée).
  const [visitorEmail, setVisitorEmail] = useState<string | null | undefined>(undefined);

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user?.user_metadata?.role !== 'visitor') { setVisitorEmail(null); return; }
      const res = await fetch('/api/visitor/profile').catch(() => null);
      if (!res?.ok) { setVisitorEmail(null); return; }
      const profile = await res.json();
      setVisitorEmail(profile.email ?? null);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/visit-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        host_profile_id: hostProfileId,
        nb_personnes: form.nb_personnes,
        message: form.visitor_message || null,
        consent: form.visitor_notifications_optin,
        website: '', // honeypot
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Une erreur est survenue.');
      setLoading(false);
    } else {
      router.push(`/visitor/${data.action_token}`);
    }
  }

  if (visitorEmail === null) {
    return (
      <div className="space-y-3 text-center py-2">
        <p className="text-slate-500 text-sm">
          Créez votre compte visiteur pour contacter {hostName} — vos informations seront réutilisées pour vos prochaines demandes.
        </p>
        <Link
          href={`/mon-espace/creer?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`}
          className="w-full inline-flex items-center justify-center bg-indigo-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Créer mon compte
        </Link>
        <p className="text-center text-xs text-slate-400">
          Déjà venu ? <Link href="/auth" className="text-indigo-600 hover:underline">Se connecter</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {visitorEmail && (
        <p className="text-xs text-slate-400">
          Connecté avec <span className="text-slate-600 font-medium">{visitorEmail}</span>
        </p>
      )}

      {/* Logistique */}
      <fieldset>
        <legend className="text-xs text-slate-400 uppercase tracking-wide mb-3">Logistique</legend>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre de personnes</label>
            <input
              type="number"
              min={1}
              max={20}
              value={form.nb_personnes}
              onChange={(e) => set('nb_personnes', Math.max(1, parseInt(e.target.value) || 1))}
              className={inputCls}
            />
          </div>
        </div>
      </fieldset>

      {/* Étape : message */}
      <fieldset>
        <legend className="text-xs text-slate-400 uppercase tracking-wide mb-3">Message</legend>
        <textarea
          value={form.visitor_message}
          onChange={(e) => set('visitor_message', e.target.value)}
          rows={3}
          className={inputCls}
          placeholder={`Un mot pour ${hostName} (optionnel) — présentation, situation particulière…`}
        />
      </fieldset>

      {/* Consentement */}
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={form.visitor_notifications_optin}
          onChange={(e) => set('visitor_notifications_optin', e.target.checked)}
          className="mt-0.5 accent-indigo-600"
        />
        <span className="text-xs text-slate-500 leading-relaxed">
          Je souhaite être informé(e) des prochains lives de David Théry.
          <span className="text-slate-400"> Vous pouvez vous désabonner à tout moment.</span>
        </span>
      </label>

      {/* Honeypot */}
      <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />

      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <p className="text-slate-400 text-xs leading-relaxed">
        L'ambassadeur se réserve le droit d'accepter ou non votre demande.
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        <Send className="w-4 h-4" />
        {loading ? 'Envoi…' : 'Envoyer ma demande'}
      </button>
    </form>
  );
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white';

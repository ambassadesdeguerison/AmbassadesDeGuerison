'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

interface Props {
  hostProfileId: string;
  hostName: string;
  eventId: string | null;
  isWomenOnly?: boolean;
}

export default function ContactForm({ hostProfileId, hostName, eventId, isWomenOnly = false }: Props) {
  const [form, setForm] = useState({
    nb_personnes: 1,
    visitor_message: '',
    // Jamais pré-coché : la CJUE (1er oct. 2019) a jugé qu'une case cochée par
    // défaut ne vaut pas consentement — le RGPD exige un acte positif clair.
    visitor_notifications_optin: false,
  });
  const [gender, setGender] = useState<'female' | 'male' | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionToken, setActionToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Phase 3 PR3 : la demande se fait désormais depuis un compte visiteur
  // authentifié (écran /mon-espace/creer) — plus de saisie identité/photo
  // à chaque demande. `visitorEmail === undefined` = vérification en cours,
  // `null` = pas de session visiteur (gate affichée).
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
    if (!eventId) return;
    // Garde anti-bypass (touche Entrée) : si l'ambassade est femmes-only,
    // refuser tout submit qui n'a pas explicitement coché "Femme".
    if (isWomenOnly && gender !== 'female') return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/visit-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host_profile_id: hostProfileId,
        event_id: eventId,
        nb_personnes: form.nb_personnes,
        message: form.visitor_message || null,
        consent: form.visitor_notifications_optin,
        website: '', // honeypot
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Une erreur est survenue.');
    } else {
      setActionToken(data.action_token);
    }
    setLoading(false);
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencieux
    }
  }

  if (!eventId) {
    return (
      <p className="text-slate-500 text-sm text-center py-2">
        Aucun live à venir pour cette ambassade pour le moment.
      </p>
    );
  }

  if (actionToken) {
    const inviteUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/visitor/${actionToken}`;
    return (
      <div className="py-4 space-y-4">
        <div className="text-center">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-slate-800 font-medium text-sm">Demande envoyée !</p>
          <p className="text-slate-500 text-xs mt-1 leading-relaxed">
            Vous recevrez une notification par e-mail dès que l&apos;ambassadeur aura répondu.
          </p>
        </div>

        <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
          <p className="text-indigo-800 text-xs font-medium">Votre lien d&apos;invitation</p>
          <p className="text-indigo-600 text-xs break-all font-mono">{inviteUrl}</p>
          <div className="flex gap-2">
            <button
              onClick={() => copyLink(inviteUrl)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-indigo-200 text-indigo-700 text-xs font-medium py-2 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copié !' : 'Copier'}
            </button>
            <a
              href={inviteUrl}
              className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-xs font-medium py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Accéder
            </a>
          </div>
        </div>

        <p className="text-slate-400 text-xs text-center">Un e-mail vous a également été envoyé.</p>
      </div>
    );
  }

  // Si l'ambassade est femmes-only et que le visiteur s'est identifié comme homme :
  // on masque entièrement le formulaire et on propose de retourner à la carte.
  if (isWomenOnly && gender === 'male') {
    return (
      <div className="py-4 space-y-3">
        <div className="bg-pink-50 border border-pink-100 rounded-xl p-4">
          <p className="text-pink-800 text-sm font-medium">Cet espace est réservé aux femmes.</p>
          <p className="text-pink-700 text-xs mt-1.5 leading-relaxed">
            Cette ambassade accueille uniquement des groupes de femmes. Vous pouvez explorer les autres ambassades sur la carte.
          </p>
        </div>
        <Link
          href="/"
          className="w-full inline-flex items-center justify-center gap-1.5 bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voir les autres ambassades
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {isWomenOnly && (
        <div className="bg-pink-50 border border-pink-100 rounded-xl p-3 space-y-2">
          <p className="text-sm text-pink-800 font-medium">Cet espace est réservé aux femmes.</p>
          <fieldset>
            <legend className="text-xs text-pink-700 mb-1.5">Je suis :</legend>
            <div className="flex gap-2">
              <label className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm border transition-colors ${gender === 'female' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="gender"
                  checked={gender === 'female'}
                  onChange={() => setGender('female')}
                  className="sr-only"
                />
                Femme
              </label>
              <label className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm border transition-colors ${gender === 'male' ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="gender"
                  checked={gender === 'male'}
                  onChange={() => setGender('male')}
                  className="sr-only"
                />
                Homme
              </label>
            </div>
          </fieldset>
        </div>
      )}

      {(!isWomenOnly || gender === 'female') && visitorEmail === null && (
        <div className={`space-y-3 text-center py-2 ${isWomenOnly ? 'form-reveal' : ''}`}>
          <p className="text-slate-500 text-sm">
            Créez votre compte visiteur pour contacter {hostName} — vos informations seront réutilisées pour vos prochaines demandes.
          </p>
          <Link
            href={`/mon-espace/creer?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`}
            className="w-full inline-flex items-center justify-center bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Créer mon compte
          </Link>
          <p className="text-center text-xs text-slate-400">
            Déjà venu ? <Link href="/auth" className="text-indigo-600 hover:underline">Se connecter</Link>
          </p>
        </div>
      )}

      {(!isWomenOnly || gender === 'female') && visitorEmail && (
        <div className={`space-y-3 ${isWomenOnly ? 'form-reveal' : ''}`}>
          <p className="text-xs text-slate-400">
            Connecté avec <span className="text-slate-600 font-medium">{visitorEmail}</span>
          </p>
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Message (optionnel)</label>
            <textarea value={form.visitor_message} onChange={(e) => set('visitor_message', e.target.value)} rows={2} className={inputCls} placeholder="Je serai avec ma famille de 3 personnes…" />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.visitor_notifications_optin}
              onChange={(e) => set('visitor_notifications_optin', e.target.checked)}
              className="mt-0.5 accent-indigo-600"
            />
            <span className="text-xs text-slate-500">
              Je souhaite être informé(e) des prochains lives de David Théry.
              <span className="text-slate-400"> Vous pouvez vous désabonner à tout moment.</span>
            </span>
          </label>

          {/* Honeypot — invisible */}
          <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <p className="text-slate-400 text-xs">
            L&apos;ambassadeur se réserve le droit d&apos;accepter ou non votre demande.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
      )}
    </form>
  );
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white';

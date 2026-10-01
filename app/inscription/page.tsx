'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, UserPlus, ChevronRight, HelpCircle, Loader2, Mail } from 'lucide-react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import InscriptionSuccess from '@/components/InscriptionSuccess';
import { createClient } from '@/lib/supabase/browser';
import CityInput from '@/components/ui/CityInput';
import CountrySelect from '@/components/ui/CountrySelect';
import PhoneInput from '@/components/ui/PhoneInput';
import AddressInput from '@/components/ui/AddressInput';
import { isValidPhoneNumber } from 'react-phone-number-input';
const TYPES = [
  { value: 'individual', label: 'Domicile' },
  { value: 'church', label: 'Église' },
];

export default function InscriptionPage() {
  return (
    <Suspense fallback={null}>
      <InscriptionContent />
    </Suspense>
  );
}

function InscriptionContent() {
  const verifyToken = useSearchParams().get('verify');
  // Preuve que l'adresse est la leur (lien reçu par e-mail) : sans elle, le formulaire ne s'ouvre pas
  // et aucun compte n'est créé.
  const [proof, setProof] = useState<string | null>(null);
  const [proofState, setProofState] = useState<'idle' | 'checking' | 'invalid'>(verifyToken ? 'checking' : 'idle');
  const [linkSending, setLinkSending] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [linkError, setLinkError] = useState('');

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // Session ouverte avec la même adresse que l'inscription : l'écran de confirmation n'a pas à redemander de se connecter.
  const [connected, setConnected] = useState(false);
  const [showWhatsAppHelp, setShowWhatsAppHelp] = useState(false);
  const [addressConfirmed, setAddressConfirmed] = useState(false);

  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    city: '',
    country: 'France',
    lat: undefined as number | undefined,
    lng: undefined as number | undefined,
    type: 'individual',
    capacity: '10',
    address_private: '',
    lat_precise: undefined as number | undefined,
    lng_precise: undefined as number | undefined,
    whatsapp_group_url: '',
    consignes: '',
    quartier: '',
    is_women_only: false,
  });

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Arrivée par le lien de l'e-mail : le serveur confirme le jeton et renvoie l'adresse prouvée.
  useEffect(() => {
    if (!verifyToken) return;
    let cancelled = false;
    fetch(`/api/inscriptions/verify-email?token=${encodeURIComponent(verifyToken)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { email: string }) => {
        if (cancelled) return;
        setProof(verifyToken);
        setForm((prev) => ({ ...prev, email: data.email }));
        setProofState('idle');
      })
      .catch(() => {
        if (!cancelled) setProofState('invalid');
      });
    return () => { cancelled = true; };
  }, [verifyToken]);

  async function sendVerificationLink(e?: React.FormEvent) {
    e?.preventDefault();
    setLinkSending(true);
    setLinkError('');
    const res = await fetch('/api/inscriptions/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setLinkSending(false);
    if (!res?.ok) {
      setLinkError(data?.error ?? 'Une erreur est survenue. Réessayez dans un instant.');
      return;
    }
    setProofState('idle');
    setLinkSent(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/inscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, capacity: parseInt(form.capacity, 10), email_proof: proof }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.code === 'email_not_verified') {
        // Lien périmé ou adresse modifiée : on repart de la confirmation de l'adresse.
        setProof(null);
        setLinkSent(false);
        setStep(1);
      }
      setError(data.error ?? 'Une erreur est survenue.');
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await createClient().auth.getUser();
      setConnected(user?.email?.toLowerCase() === form.email.trim().toLowerCase());
    } catch {
      // Pas de session lisible : on garde l'écran « connectez-vous »
    }
    setSubmitted(true);
  }

  const steps = ['Coordonnées', 'Lieu', 'Contact'];

  if (submitted) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 bg-slate-50 px-4 py-8">
          <InscriptionSuccess email={form.email} connected={connected} />
        </main>
      </>
    );
  }

  // Étape 0 — confirmer l'adresse AVANT d'ouvrir le formulaire (aucun compte n'est créé à ce stade).
  if (!proof) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 bg-slate-50 px-4 py-8">
          <div className="max-w-lg mx-auto">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Retour à la carte
            </Link>

            {proofState === 'checking' ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center justify-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Vérification en cours…
              </div>
            ) : linkSent ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center space-y-3">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6 text-indigo-500" />
                </div>
                <h1 className="text-lg font-semibold text-slate-800">Regardez votre boîte mail</h1>
                <p className="text-slate-500 text-sm">
                  Nous venons d&apos;écrire à <strong className="text-slate-700">{form.email.trim()}</strong>. Appuyez sur le bouton dans ce
                  message : il vérifie votre adresse et ouvre le formulaire.
                </p>
                <p className="text-slate-400 text-xs">Rien reçu ? Regardez dans les courriers indésirables.</p>
                {linkError && <p className="text-red-600 text-sm">{linkError}</p>}
                <div className="flex items-center justify-center gap-4 pt-1 text-sm">
                  <button type="button" onClick={() => sendVerificationLink()} disabled={linkSending} className="text-indigo-600 font-medium hover:underline disabled:opacity-50">
                    {linkSending ? 'Envoi…' : 'Renvoyer l\u2019e-mail'}
                  </button>
                  <button type="button" onClick={() => { setLinkSent(false); setLinkError(''); }} className="text-slate-500 hover:underline">
                    Changer d&apos;adresse
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={sendVerificationLink} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                      <UserPlus className="w-4 h-4 text-white" />
                    </div>
                    <h1 className="text-xl font-semibold text-slate-800">Devenir ambassadeur</h1>
                  </div>
                  <p className="text-sm text-slate-500 ml-9">Accueillez des personnes lors des lives de David Théry</p>
                </div>

                {proofState === 'invalid' && (
                  <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                    Ce bouton ne fonctionne plus (il dure 24 heures). Demandez-en un nouveau ci-dessous.
                  </p>
                )}
                {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

                <Field label="Votre adresse e-mail" required htmlFor="inscription-email">
                  <input
                    id="inscription-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    required
                    autoComplete="email"
                    className={inputCls}
                    placeholder="marie@exemple.com"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Pour commencer, nous vous écrivons à cette adresse pour vérifier qu&apos;elle est bien la vôtre. Elle vous servira ensuite à vous connecter (sans mot de passe) et à recevoir les demandes de visite.
                  </p>
                </Field>
                {linkError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{linkError}</p>}
                <button type="submit" disabled={linkSending || !form.email.includes('@')} className={`${btnPrimary} flex items-center gap-2 justify-center`}>
                  {linkSending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Recevoir l&apos;e-mail de vérification
                </button>
                <p className="text-center text-xs text-slate-400">
                  Déjà ambassadeur ? <Link href="/auth" className="text-indigo-600 hover:underline">Se connecter</Link>
                </p>
              </form>
            )}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="flex-1 bg-slate-50 px-4 py-8">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour à la carte
        </Link>

        <div className="mb-7">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-slate-800">Devenir ambassadeur</h1>
          </div>
          <p className="text-sm text-slate-500 ml-9">Accueillez des personnes lors des lives de David Thery</p>

          <div className="flex items-center gap-1 mt-4 ml-9">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  i + 1 === step
                    ? 'bg-indigo-600 text-white'
                    : i + 1 < step
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {i + 1 < step && <CheckCircle2 className="w-3 h-3" />}
                  {s}
                </div>
                {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300" />}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          {step === 1 && (
            <>
              <Field label="Prénom" required>
                <input type="text" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required className={inputCls} placeholder="Votre prénom" />
              </Field>
              <Field label="Nom" required>
                <input type="text" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required className={inputCls} placeholder="Votre nom" />
              </Field>
              <Field label="E-mail" required>
                {/* Adresse confirmée par le lien reçu : non modifiable (la preuve est liée à cette adresse). */}
                <input type="email" value={form.email} readOnly className={`${inputCls} bg-slate-50 text-slate-500`} />
                <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Adresse vérifiée : elle vous servira à vous connecter et à recevoir les demandes de visite.
                </p>
              </Field>
              <Field label="Téléphone" required>
                <PhoneInput
                  id="phone"
                  value={form.phone}
                  onChange={(v) => set('phone', v)}
                />
                <p className="text-xs text-slate-400 mt-1">Privé — utilisé par David pour vous joindre.</p>
              </Field>
              <CityInput
                label="Ville"
                id="city"
                required
                value={form.city}
                onChange={(city, lat, lng, country) =>
                  setForm((prev) => ({ ...prev, city, lat, lng, ...(country ? { country } : {}) }))
                }
              />
              {form.city && form.lat == null && (
                <p className="text-xs text-amber-600 -mt-1">
                  Sélectionnez votre ville dans la liste pour confirmer votre position sur la carte.
                </p>
              )}
              <CountrySelect
                label="Pays"
                id="country"
                required
                value={form.country}
                onChange={(country) => set('country', country)}
              />
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!form.first_name || !form.last_name || !form.email || !form.phone || !isValidPhoneNumber(form.phone) || !form.city || form.lat == null}
                className={`${btnPrimary} flex items-center gap-2 justify-center`}
              >
                Continuer <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Type de lieu" required>
                <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Capacité d'accueil (personnes)" required>
                <input type="number" min="1" max="500" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} required className={inputCls} />
              </Field>
              <Field label="Adresse complète" badge="Privée" required>
                <AddressInput
                  value={form.address_private}
                  onChange={(v) => {
                    setForm((prev) => ({ ...prev, address_private: v, lat_precise: undefined, lng_precise: undefined }));
                    setAddressConfirmed(false);
                  }}
                  onSelect={(sel) => {
                    setForm((prev) => ({
                      ...prev,
                      address_private: sel.address,
                      lat_precise: sel.lat_precise,
                      lng_precise: sel.lng_precise,
                      // Plus de saisie manuelle à l'étape 1 (retiré 2026-09-27) — quartier
                      // vient exclusivement du geocodage de l'adresse ici. Toujours écraser
                      // avec la nouvelle sélection : si l'ambassadeur corrige son adresse,
                      // l'ancien quartier déduit ne doit pas rester bloqué en mémoire.
                      quartier: sel.quartier ?? '',
                    }));
                    setAddressConfirmed(true);
                  }}
                  placeholder="12 rue des Lilas, 69001 Lyon"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">Jamais affichée sur la carte. Partagée uniquement avec les visiteurs que vous acceptez.</p>
                {form.address_private && !addressConfirmed && (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-1.5">
                    Sélectionnez votre adresse dans la liste pour un calcul de distance précis avec les visiteurs.
                  </p>
                )}
              </Field>
              <Field label="Détails utiles pour vos visiteurs (optionnel)">
                <textarea value={form.consignes} onChange={(e) => set('consignes', e.target.value)} rows={3} className={inputCls} placeholder={form.type === 'church' ? "Ex. : stationnement sur le parvis. Accessibilité PMR : accès de plain-pied. Merci d'arriver entre 14h et 14h30." : "Ex. : stationnement facile dans la rue. Accessibilité PMR : accès sans marches. Merci d'arriver entre 14h et 14h30."} />
                <p className="text-xs text-slate-400 mt-1">Sera transmis aux visiteurs acceptés. Tout détail qui facilite leur arrivée.</p>
              </Field>
              {form.type === 'individual' && (
                <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_women_only}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_women_only: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-pink-500 focus:ring-pink-500"
                  />
                  <span className="text-sm text-slate-700">
                    Ce groupe est réservé aux femmes uniquement
                    <span className="block text-xs text-slate-400 mt-0.5">Une mention « Groupe femmes » apparaîtra sur votre fiche publique.</span>
                  </span>
                </label>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className={btnSecondary}>
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setStep(3)} disabled={!form.address_private} className={`${btnPrimary} flex-1 flex items-center gap-2 justify-center`}>
                  Continuer <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <label className="text-sm font-medium text-slate-700">
                    Lien groupe WhatsApp <span className="font-normal text-slate-400">(optionnel)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppHelp((v) => !v)}
                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                    aria-label="En savoir plus sur le lien WhatsApp"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
                <input type="url" value={form.whatsapp_group_url} onChange={(e) => set('whatsapp_group_url', e.target.value)} className={inputCls} placeholder="https://chat.whatsapp.com/..." />
                {showWhatsAppHelp && (
                  <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-2">
                    <p><span className="font-medium text-slate-700">À quoi ça sert ?</span> Ce lien apparaît sur votre page ambassade publique. Les visiteurs peuvent rejoindre votre groupe directement — avant même de vous contacter personnellement.</p>
                    <p><span className="font-medium text-slate-700">Particulièrement utile pour une église.</span> Votre groupe devient un canal de mobilisation : les fidèles partagent le lien, coordonnent l&apos;arrivée et restent en contact après le live.</p>
                    <div>
                      <p className="font-medium text-slate-700 mb-1">Comment créer le lien ?</p>
                      <ol className="list-decimal list-inside space-y-0.5 text-slate-500">
                        <li>Ouvrez votre groupe WhatsApp</li>
                        <li>Appuyez sur le nom du groupe → <strong>Infos du groupe</strong></li>
                        <li>→ <strong>Lien d&apos;invitation</strong> → <strong>Copier le lien</strong></li>
                      </ol>
                    </div>
                    <p className="text-amber-600 font-medium">⚠️ Ce lien est public — tout visiteur qui consulte votre fiche peut rejoindre le groupe. Ne l&apos;utilisez que si votre groupe est ouvert.</p>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 border border-slate-100">
                <p className="font-medium text-slate-800 mb-1">Récapitulatif</p>
                <p className="text-slate-600">{form.first_name} {form.last_name} — {form.city}, {form.country}</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {TYPES.find((t) => t.value === form.type)?.label} · {form.capacity} personnes
                </p>
                {form.is_women_only && form.type === 'individual' && (
                  <p className="text-pink-600 text-xs font-medium mt-1.5">
                    Groupe réservé aux femmes
                  </p>
                )}
              </div>

              {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <p className="text-xs text-slate-500 leading-relaxed">
                En soumettant cette demande, vous reconnaissez que l&apos;équipe de David Thery se réserve le droit d&apos;accepter ou de refuser toute candidature, sans avoir à en justifier les raisons.
              </p>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className={btnSecondary}>
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button type="submit" disabled={loading} className={`${btnPrimary} flex-1`}>
                  {loading ? 'Envoi…' : 'Envoyer ma demande'}
                </button>
              </div>
            </>
          )}
        </form>

        <p className="text-center text-xs text-slate-400 mt-4">
          Déjà ambassadeur ?{' '}
          <Link href="/auth" className="text-indigo-600 hover:underline">Se connecter</Link>
        </p>
      </div>
    </main>
    </>
  );
}

function Field({ label, required, badge, htmlFor, children }: { label: string; required?: boolean; badge?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        {badge && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-xs font-medium align-middle">
            <span aria-hidden="true">🔒</span>{badge}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white';
const btnPrimary = 'w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors';
const btnSecondary = 'px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center';

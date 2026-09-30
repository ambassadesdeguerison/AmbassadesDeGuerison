'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, UserPlus, ChevronRight, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/inscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, capacity: parseInt(form.capacity, 10) }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Une erreur est survenue.');
      setLoading(false);
      return;
    }

    setSubmitted(true);
  }

  const steps = ['Coordonnées', 'Lieu', 'Contact'];

  if (submitted) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 bg-slate-50 px-4 py-8">
          <div className="max-w-lg mx-auto text-center py-16">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">Inscription confirmée !</h2>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-1">
              Un e-mail vient d&apos;être envoyé à <span className="font-medium text-slate-700">{form.email}</span>.
            </p>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              Connectez-vous à votre espace ambassadeur pour démarrer : vidéo de formation, engagement à valider, puis votre présentation.
            </p>
            <Link
              href="/auth"
              className="mt-6 inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Accéder à mon espace ambassadeur
            </Link>
            <div className="mt-4">
              <Link href="/" className="inline-flex items-center gap-1.5 text-slate-400 text-sm hover:text-slate-600 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Retour à la carte
              </Link>
            </div>
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
                <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required className={inputCls} placeholder="Votre e-mail" />
                <p className="text-xs text-slate-400 mt-1">Sert à vous connecter (lien de connexion, sans mot de passe) et à recevoir les notifications de demandes de visite.</p>
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

function Field({ label, required, badge, children }: { label: string; required?: boolean; badge?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
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

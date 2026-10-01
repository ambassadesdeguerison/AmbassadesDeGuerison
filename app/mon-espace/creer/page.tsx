'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, Loader2, X } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import PhoneInput from '@/components/ui/PhoneInput';
import { isValidPhoneNumber } from 'react-phone-number-input';
import { createClient } from '@/lib/supabase/browser';

type EmailStatus = 'idle' | 'checking' | 'new' | 'visitor_existing' | 'collision';

const MAX_PHOTO_MB = 5;

function CreerCompteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');

  // Un visiteur déjà connecté qui atterrit ici (lien partagé, retour en
  // arrière) n'a rien à créer — le renvoyer directement plutôt que de lui
  // montrer un formulaire dont la soumission échouerait sur son propre
  // e-mail (trouvé en QA 2026-07-29, TODO-24).
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata?.role === 'visitor') {
        const target = redirect && redirect.startsWith('/') ? redirect : '/mon-espace';
        router.replace(target);
        return;
      }
      setCheckingSession(false);
    });
  }, [redirect, router]);

  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [magicLinkSending, setMagicLinkSending] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handleEmailBlur() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    setEmailStatus('checking');
    setMagicLinkSent(false);
    const res = await fetch('/api/visitor/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
    }).catch(() => null);
    if (!res?.ok) { setEmailStatus('idle'); return; }
    const data = await res.json();
    setEmailStatus(data.status as EmailStatus);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Seules les images sont acceptées.');
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPhotoError(`Taille max : ${MAX_PHOTO_MB} Mo.`);
      return;
    }
    setPhotoError('');
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError('');
  }

  async function handleSendMagicLink() {
    setMagicLinkSending(true);
    await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    }).catch(() => {});
    setMagicLinkSending(false);
    setMagicLinkSent(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailStatus === 'collision' || emailStatus === 'visitor_existing') return;
    if (!isValidPhoneNumber(phone)) {
      setFormError('Merci de renseigner un numéro de téléphone valide.');
      return;
    }
    setSubmitting(true);
    setFormError('');

    const body = new FormData();
    body.set('first_name', firstName.trim());
    body.set('email', email.trim());
    body.set('phone', phone);
    if (photoFile) body.set('file', photoFile);

    const res = await fetch('/api/visitor/account', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 409 && (data.type === 'collision' || data.type === 'visitor_exists')) {
        setEmailStatus(data.type === 'collision' ? 'collision' : 'visitor_existing');
      } else {
        setFormError(data.error ?? 'Une erreur est survenue.');
      }
      setSubmitting(false);
      return;
    }

    const target = redirect && redirect.startsWith('/') ? redirect : '/mon-espace';
    router.push(`/auth/confirm?token_hash=${data.token_hash}&type=magiclink&redirect=${encodeURIComponent(target)}`);
  }

  const canSubmit =
    firstName.trim() && email.trim() && isValidPhoneNumber(phone) &&
    emailStatus !== 'collision' && emailStatus !== 'visitor_existing' && !submitting;

  if (checkingSession) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center bg-slate-50">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
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

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div>
              <h1 className="text-lg font-semibold text-slate-800">Créer votre compte</h1>
              <p className="text-slate-500 text-sm mt-1">
                Pour contacter un ambassadeur et retrouver vos prochaines demandes sans tout retaper.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className={inputCls}
                  placeholder="Marie"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  E-mail <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailStatus('idle'); }}
                  onBlur={handleEmailBlur}
                  required
                  className={inputCls}
                  placeholder="marie@exemple.com"
                />

                {emailStatus === 'visitor_existing' && (
                  <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-800">
                    Vous avez déjà un compte avec cet e-mail.
                    {magicLinkSent ? (
                      <p className="text-indigo-600 text-xs mt-2">Lien envoyé — vérifiez votre boîte mail.</p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendMagicLink}
                        disabled={magicLinkSending}
                        className="mt-2 inline-flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {magicLinkSending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Recevoir mon lien de connexion
                      </button>
                    )}
                  </div>
                )}

                {emailStatus === 'collision' && (
                  <div className="mt-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-800">
                    Cet e-mail est déjà utilisé pour un autre type de compte sur Ambassades de Guérison.
                    Merci d&apos;utiliser une autre adresse pour votre compte visiteur.
                  </div>
                )}

                {emailStatus !== 'collision' && emailStatus !== 'visitor_existing' && (
                  <p className="text-xs text-slate-400 mt-2">
                    Sert à vous connecter et à recevoir la réponse de l&apos;ambassadeur.
                  </p>
                )}
              </div>

              <div>
                <PhoneInput
                  label="Téléphone"
                  id="visitor-account-phone"
                  required
                  value={phone}
                  onChange={setPhone}
                  placeholder="+33 6 12 34 56 78"
                />
                <p className="text-xs text-slate-400 mt-2">
                  L&apos;ambassadeur ne voit votre numéro que s&apos;il accepte votre demande. Il peut alors vous appeler si besoin le jour du live. Nous l&apos;utilisons aussi pour écarter les personnes bloquées. Il n&apos;est jamais affiché publiquement.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Photo de profil <span className="text-slate-400 font-normal">(optionnel)</span>
                </label>

                {photoPreview ? (
                  <div className="flex items-center gap-3">
                    <img src={photoPreview} alt="Aperçu" className={`w-16 h-16 rounded-full object-cover border border-slate-200 ${submitting ? 'blur-sm' : ''}`} />
                    {submitting ? (
                      <p className="text-sm text-indigo-600">Envoi en cours…</p>
                    ) : (
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Changer
                      </button>
                    )}
                  </div>
                ) : (
                  <label
                    role="button"
                    tabIndex={0}
                    aria-label="Ajouter une photo de profil (optionnel)"
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); }}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 px-4 py-5 text-center cursor-pointer hover:border-indigo-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-indigo-500" />
                    </div>
                    <p className="text-sm font-medium text-indigo-600">Prendre une photo ou choisir dans la galerie</p>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="sr-only" />
                  </label>
                )}
                {photoError && <p className="text-red-600 text-xs mt-1.5">{photoError}</p>}
                <p className="text-xs text-slate-400 mt-2">
                  Aide l&apos;ambassadeur à savoir qui il accueille — jamais publiée, visible uniquement par lui.
                </p>
              </div>

              {formError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Créer mon compte
              </button>

              <p className="text-center text-xs text-slate-400">
                En créant votre compte, vous acceptez notre{' '}
                <Link href="/confidentialite" className="text-indigo-600 hover:underline">
                  politique de confidentialité
                </Link>
                .
              </p>

              <p className="text-center text-xs text-slate-400">
                Déjà un compte ? <Link href="/auth" className="text-indigo-600 hover:underline">Se connecter</Link>
              </p>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}

export default function CreerCompteVisiteurPage() {
  return (
    <Suspense fallback={
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center bg-slate-50">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </main>
      </>
    }>
      <CreerCompteContent />
    </Suspense>
  );
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white';

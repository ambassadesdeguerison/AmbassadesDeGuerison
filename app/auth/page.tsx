'use client';

import { useState, useEffect } from 'react';
import { Mail, MailCheck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { createClient } from '@/lib/supabase/browser';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Adresse sans compte : aucun e-mail n'est envoyé, on guide vers l'inscription.
  const [noAccount, setNoAccount] = useState(false);
  // Déjà connecté : on le dit (et on propose la suite) plutôt que de réafficher un formulaire de
  // connexion muet. `destination` vaut null quand le compte n'a ni profil ambassadeur ni profil visiteur.
  const [session, setSession] = useState<{ email: string; destination: string | null } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const role = user.user_metadata?.role;
      let destination: string | null = null;
      if (role === 'admin') {
        destination = '/admin/stats';
      } else if (role === 'visitor') {
        const res = await fetch('/api/visitor/profile');
        if (res.ok) destination = '/mon-espace';
      } else {
        const { data: host } = await supabase
          .from('host_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (host) destination = '/dashboard';
      }
      setSession({ email: user.email ?? '', destination });
    });
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    setSession(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (res.status === 404 && data.error === 'no_account') {
      setNoAccount(true);
    } else if (!res.ok) {
      setError(data.error ?? 'Une erreur est survenue.');
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (session) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
            {/* Pas de « déjà » : on arrive le plus souvent ici juste après avoir cliqué sur le lien reçu par e-mail. */}
            <h1 className="text-xl font-semibold text-slate-800 mb-2">
              {session.destination ? 'Vous êtes connecté' : 'Connexion réussie'}
            </h1>
            <p className="text-slate-500 text-sm mb-6">
              Connecté avec <span className="font-medium text-slate-700">{session.email}</span>.
              {session.destination
                ? ''
                : ' Il reste \u00e0 choisir comment continuer : ce compte n\u2019a pas encore d\u2019ambassade ni d\u2019espace visiteur.'}
            </p>
            <div className="space-y-2">
              {session.destination ? (
                <Link
                  href={session.destination}
                  className="flex items-center justify-center min-h-[44px] w-full bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Aller à mon espace
                </Link>
              ) : (
                <>
                  <Link
                    href="/inscription"
                    className="flex items-center justify-center min-h-[44px] w-full bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Devenir ambassadeur
                  </Link>
                  <Link
                    href="/mon-espace/creer"
                    className="flex items-center justify-center min-h-[44px] w-full border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Créer mon espace visiteur
                  </Link>
                </>
              )}
              <button
                onClick={signOut}
                className="flex items-center justify-center min-h-[44px] w-full text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (noAccount) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
            <h1 className="text-xl font-semibold text-slate-800 mb-2">Aucun compte avec cette adresse</h1>
            <p className="text-slate-500 text-sm mb-6">
              Nous n&apos;avons pas trouvé de compte pour{' '}
              <span className="font-medium text-slate-700">{email}</span>. Aucun lien n&apos;a été envoyé.
            </p>
            <div className="space-y-2">
              <Link
                href="/inscription"
                className="flex items-center justify-center min-h-[44px] w-full bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Devenir ambassadeur
              </Link>
              <Link
                href="/mon-espace/creer"
                className="flex items-center justify-center min-h-[44px] w-full border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Créer mon espace visiteur
              </Link>
            </div>
            <button
              onClick={() => setNoAccount(false)}
              className="mt-5 text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-3 h-3" /> Essayer une autre adresse
            </button>
          </div>
        </main>
      </>
    );
  }

  if (sent) {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <MailCheck className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Vérifiez votre messagerie</h1>
          <p className="text-slate-500 text-sm">
            Un lien de connexion a été envoyé à{' '}
            <span className="font-medium text-slate-700">{email}</span>.
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-5 text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 mx-auto"
          >
            <ArrowLeft className="w-3 h-3" /> Changer d&apos;adresse
          </button>
        </div>
      </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="flex-1 flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour à la carte
        </Link>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          <div className="mb-7">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
              <Mail className="w-5 h-5 text-indigo-600" />
            </div>
            <h1 className="text-xl font-semibold text-slate-800">Connexion</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vous@exemple.com"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Envoi en cours…' : 'Recevoir le lien de connexion'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-5">
            Pas encore ambassadeur ?{' '}
            <Link href="/inscription" className="text-indigo-600 hover:underline">
              S&apos;inscrire
            </Link>
          </p>
        </div>
      </div>
    </main>
    </>
  );
}

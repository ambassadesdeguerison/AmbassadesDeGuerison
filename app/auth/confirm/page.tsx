'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { createClient } from '@/lib/supabase/browser';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type') as 'magiclink' | 'email' | null;

    if (!token_hash || !type) {
      setStatus('error');
      setErrorMsg('Ce lien est incomplet. Copiez-le en entier depuis votre e-mail.');
      return;
    }

    const supabase = createClient();
    supabase.auth.verifyOtp({ token_hash, type }).then(({ data, error }) => {
      if (error) {
        setStatus('error');
        setErrorMsg("Ce lien a déjà été utilisé ou n'est plus valable.");
      } else {
        setStatus('success');
        // Redirection vers la page d'origine (ex : reprendre une demande de
        // visite juste après la création de compte) — uniquement un chemin
        // relatif, jamais une URL externe (open redirect).
        const redirect = searchParams.get('redirect');
        if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
          router.replace(redirect);
          return;
        }
        const role = data.user?.user_metadata?.role;
        if (role === 'admin') {
          router.replace('/admin/stats');
        } else if (role === 'visitor') {
          router.replace('/mon-espace');
        } else {
          router.replace('/dashboard');
        }
      }
    });
  }, [searchParams, router]);

  if (status === 'loading') {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
            Vérification en cours…
          </div>
        </main>
      </>
    );
  }

  if (status === 'error') {
    return (
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center bg-slate-50 px-4">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <h1 className="text-lg font-semibold text-slate-800 mb-2">Ce lien ne fonctionne plus</h1>
            <p className="text-slate-500 text-sm mb-1">{errorMsg}</p>
            <p className="text-slate-400 text-xs mt-2">Les liens de connexion sont valables 1 heure.</p>
            <Link href="/auth" className="mt-5 inline-block text-indigo-600 text-sm hover:underline">
              Demander un nouveau lien
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-emerald-600 text-sm">
          <CheckCircle2 className="w-5 h-5" />
          Connexion réussie, redirection…
        </div>
      </main>
    </>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <>
        <AppHeader />
        <main className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
        </main>
      </>
    }>
      <ConfirmContent />
    </Suspense>
  );
}

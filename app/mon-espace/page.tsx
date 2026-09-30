'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, Camera, X } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import PhoneInput from '@/components/ui/PhoneInput';
import Avatar from '@/components/ui/Avatar';
import { createClient } from '@/lib/supabase/browser';

// Espace visiteur minimal (Phase 2bis) — pas un espace visiteur complet
// (Phase 5, fermée sine die : pas de "mes demandes", pas de dashboard).
// Seul but : confirmer la connexion et permettre de mettre à jour le
// téléphone réutilisé automatiquement sur la prochaine demande de visite.
export default function MonEspacePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/auth'); return; }

    const res = await fetch('/api/visitor/profile');
    if (!res.ok) { router.replace('/'); return; }
    const data = await res.json();
    setEmail(data.email ?? user.email ?? '');
    setFirstName(data.first_name ?? '');
    setPhone((data.phone ?? '').replace(/\s+/g, ''));
    setPhotoUrl(data.photo_signed_url ?? null);
    setPhotoPath(data.photo_url ?? null);
    setLoading(false);
  }, [router]);

  // Différé d'un tick : `load` met à jour l'état, ce qu'un effet ne doit pas faire de façon synchrone.
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhotoError('');
    setPhotoUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload/visitor-photo', { method: 'POST', body: formData });
    const d = await res.json();
    if (!res.ok) {
      setPhotoError(d.error ?? 'Une erreur est survenue.');
    } else {
      setPhotoUrl(d.url);
      setPhotoPath(d.path);
    }
    setPhotoUploading(false);
  }

  async function handlePhotoDelete() {
    if (!photoPath) return;
    setPhotoError('');
    setPhotoUploading(true);
    const res = await fetch('/api/upload/visitor-photo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: photoPath }),
    });
    if (!res.ok) {
      const d = await res.json();
      setPhotoError(d.error ?? 'Une erreur est survenue.');
    } else {
      setPhotoUrl(null);
      setPhotoPath(null);
    }
    setPhotoUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await fetch('/api/visitor/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? 'Une erreur est survenue.');
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/');
  }

  if (loading) {
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
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-slate-800 text-sm">
                {firstName ? `Bonjour, ${firstName} !` : 'Mon espace'}
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              Connecté avec <span className="font-medium text-slate-700">{email}</span>. Votre téléphone sera pré-rempli automatiquement sur votre prochaine demande de visite.
            </p>

            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <Avatar photoUrl={photoUrl} firstName={firstName} size={64} />
                {photoUploading && (
                  <div className="absolute inset-0 bg-white/70 rounded-full flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoUploading}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" /> {photoUrl ? 'Changer la photo' : 'Ajouter une photo'}
                </button>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={handlePhotoDelete}
                    disabled={photoUploading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Supprimer
                  </button>
                )}
              </div>
            </div>
            {photoError && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{photoError}</p>}

            <form onSubmit={handleSave} className="space-y-4">
              <PhoneInput
                label="Téléphone"
                id="visitor-phone"
                value={phone}
                onChange={setPhone}
              />

              {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              {saved && (
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Informations enregistrées !
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Enregistrer
              </button>
            </form>

            <button
              onClick={handleLogout}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

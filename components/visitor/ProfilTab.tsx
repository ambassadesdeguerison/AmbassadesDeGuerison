'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Camera, X } from 'lucide-react';
import PhoneInput from '@/components/ui/PhoneInput';
import Avatar from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/browser';

export interface VisitorProfileData {
  email: string;
  firstName: string;
  phone: string;
  photoUrl: string | null;
  photoPath: string | null;
}

// Onglet « Profil » de /mon-espace : photo, téléphone réutilisé sur les prochaines demandes,
// déconnexion. Reste monté quand on change d'onglet (un téléphone en cours de saisie n'est pas perdu).
export default function ProfilTab({ initial }: { initial: VisitorProfileData }) {
  const router = useRouter();
  const toast = useToast();
  const [phone, setPhone] = useState(initial.phone);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial.photoUrl);
  const [photoPath, setPhotoPath] = useState<string | null>(initial.photoPath);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      toast.success('Informations enregistrées');
    }
    setSaving(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/');
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
      <h2 className="font-semibold text-slate-800 text-sm">Mes informations</h2>
      <p className="text-sm text-slate-500">
        Connecté avec <span className="font-medium text-slate-700">{initial.email}</span>. Votre téléphone sera pré-rempli automatiquement sur votre prochaine demande de visite.
      </p>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <Avatar photoUrl={photoUrl} firstName={initial.firstName} size={64} />
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

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Enregistrer
        </button>
      </form>

      <div className="flex flex-col items-center gap-3 pt-1">
        <button
          type="button"
          onClick={handleLogout}
          className="min-h-[44px] px-4 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Se déconnecter
        </button>
        <p className="text-xs text-slate-400">
          <Link href="/confidentialite" className="hover:text-slate-600 underline underline-offset-2">Politique de confidentialité</Link>
          {' · '}
          <Link href="/contact-equipe" className="hover:text-slate-600 underline underline-offset-2">Contacter l&apos;équipe</Link>
        </p>
      </div>
    </div>
  );
}

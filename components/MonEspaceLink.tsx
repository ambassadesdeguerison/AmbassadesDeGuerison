'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import Avatar from '@/components/ui/Avatar';

// 'none' = connecté, mais sans profil (ni ambassadeur ni visiteur) : compte créé par une
// connexion sans inscription, ou profil supprimé. Ni avatar « ? » ni espace à proposer.
type Role = 'admin' | 'visitor' | 'host' | 'none';

export default function MonEspaceLink({ onRoleResolved }: { onRoleResolved?: (role: Role | null) => void }) {
  // null = pas encore résolu (rien affiché) ; '' = pas de session, aucun
  // espace personnel à proposer → lien masqué. Sans cette distinction, le
  // lien pointait par défaut vers /dashboard pour un visiteur anonyme, qui
  // atterrissait sur l'écran de connexion générique /auth sans jamais être
  // guidé vers /mon-espace/creer — un clic qui ne menait nulle part d'utile
  // pour l'immense majorité des visiteurs de la carte publique.
  const [href, setHref] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [firstName, setFirstName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const userRole = data.user?.user_metadata?.role;
      if (userRole === 'admin') {
        setHref('/admin/stats');
        setRole('admin');
        onRoleResolved?.('admin');
        return;
      }
      if (userRole === 'visitor') {
        const res = await fetch('/api/visitor/profile');
        if (res.ok) {
          const profile = await res.json();
          setFirstName(profile.first_name ?? '');
          setPhotoUrl(profile.photo_signed_url ?? null);
          setHref('/mon-espace');
          setRole('visitor');
          onRoleResolved?.('visitor');
        } else {
          // Compte visiteur sans profil : /mon-espace le renverrait silencieusement vers l'accueil.
          setFirstName(data.user?.email ?? '');
          setHref('/auth');
          setRole('none');
          onRoleResolved?.('none');
        }
        return;
      }
      if (data.user) {
        // maybeSingle : « aucun profil » est un état normal, pas une erreur (PGRST116 avec single()).
        const { data: host } = await supabase
          .from('host_profiles')
          .select('first_name, profile_photo_url')
          .eq('user_id', data.user.id)
          .maybeSingle();
        if (!host) {
          setFirstName(data.user.email ?? '');
          setHref('/auth');
          setRole('none');
          onRoleResolved?.('none');
          return;
        }
        setFirstName(host.first_name ?? '');
        if (host.profile_photo_url) {
          const { data: signed } = await supabase.storage
            .from('ambassador-photos')
            .createSignedUrl(host.profile_photo_url, 900);
          setPhotoUrl(signed?.signedUrl ?? null);
        }
        setHref('/dashboard');
        setRole('host');
        onRoleResolved?.('host');
        return;
      }
      setHref('');
      onRoleResolved?.(null);
    });
  }, []);

  if (!href) return null;

  // L'admin garde le monogramme de marque "AG" (pas de photo personnelle
  // associée à ce rôle) — seuls visiteur/ambassadeur ont un avatar.
  if (role === 'admin') {
    return (
      <Link
        href={href}
        className="flex items-center gap-1.5 text-sm px-3 py-2.5 sm:py-1.5 rounded-lg font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
      >
        <div className="w-7 h-7 shrink-0 bg-indigo-50 rounded-lg flex items-center justify-center">
          <span className="text-[11px] font-bold text-indigo-600 tracking-tight">AG</span>
        </div>
        <span className="hidden sm:inline">Mon espace</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 text-sm px-2 py-2.5 sm:py-1.5 rounded-lg font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
    >
      <Avatar photoUrl={photoUrl} firstName={firstName} size={28} />
      <span className="sr-only">{role === 'none' ? 'Mon compte' : 'Mon espace'}</span>
    </Link>
  );
}

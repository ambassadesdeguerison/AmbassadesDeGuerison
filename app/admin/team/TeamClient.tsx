'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, UserPlus, Shield, Crown, Mail } from 'lucide-react';
import { apiCall } from '@/lib/admin/api-call';
import AdminPage from '@/components/admin/AdminPage';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminNotice from '@/components/admin/AdminNotice';
import ErrorMessage from '@/components/admin/ErrorMessage';
import ConfirmDialog, { type ConfirmSpec } from '@/components/admin/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

interface Member {
  user_id: string;
  role: string;
  email: string;
  added_at: string;
}

interface Props {
  members: Member[];
  /** Rôle de l'admin connecté — les contrôles d'écriture exigent super_admin. */
  currentRole: string | null;
  currentUserId: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
};

const ROLE_ICONS: Record<string, typeof Crown> = {
  super_admin: Crown,
  admin: Shield,
};

// Audit admin 2026-08-07 (8.3) : la différence entre les deux rôles n'était
// expliquée nulle part — ni dans le sélecteur, ni sur la page. Un nouvel admin
// choisissait au hasard un rôle qui détermine qui peut gérer l'équipe.
const ROLE_HELP: Record<string, string> = {
  admin: 'Accès complet à l\'espace d\'administration : candidatures, témoignages, lives, blocages.',
  super_admin: 'Tout ce que fait un admin, plus la gestion de cette page : ajouter et retirer des membres.',
};

export default function TeamClient({ members: initial, currentRole, currentUserId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [members, setMembers] = useState(initial);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'super_admin'>('admin');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');

  // Audit 8.2 : le formulaire et les boutons de suppression étaient affichés à
  // tous les admins alors que l'API exige super_admin. Un admin simple cliquait
  // et recevait « Accès refusé » — et pour la suppression, dont l'échec était
  // avalé, le bouton ne faisait rien du tout, sans aucun message.
  const canManage = currentRole === 'super_admin';

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError('');

    const res = await apiCall<{ invited: boolean; emailSent: boolean; email: string }>('/api/admin/team', {
      body: { email: newEmail, role: newRole },
    });

    if (res.ok) {
      setNewEmail('');
      const { invited, emailSent, email } = res.data;
      // Deux issues valides qui n'appellent pas la même action de l'admin :
      // l'accès est accordé en base même si l'e-mail n'est pas parti — le dire
      // franchement plutôt que d'annoncer un envoi qui n'a pas eu lieu.
      if (emailSent) {
        toast.success(invited ? `Compte créé pour ${email}` : `Accès donné à ${email}`, {
          description: 'Un lien de connexion vient de lui être envoyé par e-mail.',
        });
      } else {
        toast.warning(`Accès donné à ${email}, mais l'e-mail n'est pas parti`, {
          description: "Prévenez la personne : elle peut se connecter depuis /auth avec cette adresse.",
        });
      }
      router.refresh();
    } else {
      setAddError(res.error);
    }
    setAdding(false);
  }

  function askRemove(m: Member) {
    setConfirm({
      title: 'Retirer cet accès ?',
      body: `${m.email} n'aura plus accès à l'espace d'administration. Son compte n'est pas supprimé — vous pouvez lui redonner l'accès à tout moment.`,
      confirmLabel: 'Retirer l\'accès',
      onConfirm: async () => {
        setBusy(true);
        setRemoveError('');
        const res = await apiCall('/api/admin/team', { method: 'DELETE', body: { user_id: m.user_id } });
        setBusy(false);
        setConfirm(null);
        if (res.ok) {
          setMembers((list) => list.filter((x) => x.user_id !== m.user_id));
          toast.success('Accès retiré', { description: `${m.email} n'a plus accès à l'espace d'administration.` });
        } else {
          setRemoveError(res.error);
        }
      },
    });
  }

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title="Équipe admin"
        subtitle="Qui a accès à cet espace d'administration."
      />

      {!canManage && (
        <AdminNotice tone="info" className="mb-6">
          Vous pouvez consulter cette liste, mais seul un <strong>super admin</strong> peut ajouter ou retirer des
          membres.
        </AdminNotice>
      )}

      <div className="space-y-8">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {members.length === 0 ? (
            <p className="px-6 py-8 text-slate-400 text-sm text-center">Aucun membre</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {members.map((m) => {
                const Icon = ROLE_ICONS[m.role] ?? Shield;
                const isSelf = m.user_id === currentUserId;
                return (
                  <li key={m.user_id} className="flex items-center gap-4 px-5 py-4">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {m.email}
                        {isSelf && <span className="text-slate-400 font-normal"> — vous</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        {ROLE_LABELS[m.role] ?? m.role}
                        {/* Audit 8.6 : `added_at` était chargé, typé, transmis… et jamais affiché. */}
                        {m.added_at && ` · depuis le ${new Date(m.added_at).toLocaleDateString('fr-FR')}`}
                      </p>
                    </div>
                    {/* Audit 8.5 : l'auto-révocation est refusée par l'API, mais
                        le bouton restait actif sur sa propre ligne. */}
                    {canManage && !isSelf && (
                      <button
                        onClick={() => askRemove(m)}
                        className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Retirer l'accès"
                        aria-label={`Retirer l'accès de ${m.email}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {removeError && <ErrorMessage>{removeError}</ErrorMessage>}

        {canManage && (
          <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="w-4 h-4 text-indigo-500" />
              <p className="text-sm font-medium text-slate-800">Ajouter un membre</p>
            </div>

            <div>
              <label htmlFor="team-email" className="block text-xs text-slate-500 mb-1.5">Adresse e-mail</label>
              <input
                id="team-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition"
                placeholder="camille@exemple.com"
              />
              {/* Le label disait « doit déjà avoir un compte » sans dire où le
                  créer, et aucun écran ne le permettait (audit 8.1). */}
              <p className="flex items-start gap-1.5 text-xs text-slate-400 mt-1.5 leading-relaxed">
                <Mail className="w-3 h-3 mt-0.5 shrink-0" />
                Si cette personne n&apos;a pas encore de compte, elle en recevra un par e-mail avec un lien pour l&apos;activer.
              </p>
            </div>

            <div>
              <label htmlFor="team-role" className="block text-xs text-slate-500 mb-1.5">Rôle</label>
              <select
                id="team-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'super_admin')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition bg-white"
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super admin</option>
              </select>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{ROLE_HELP[newRole]}</p>
            </div>

            {addError && <ErrorMessage>{addError}</ErrorMessage>}

            <button
              type="submit"
              disabled={adding}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
            >
              {adding ? 'Ajout…' : 'Donner l\'accès'}
            </button>
          </form>
        )}
      </div>

      <ConfirmDialog spec={confirm} onCancel={() => setConfirm(null)} pending={busy} />
    </AdminPage>
  );
}

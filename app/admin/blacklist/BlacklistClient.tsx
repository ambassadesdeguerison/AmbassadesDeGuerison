'use client';

import { useState } from 'react';
import { Ban, Trash2, UserX, Home, Globe } from 'lucide-react';
import { apiCall } from '@/lib/admin/api-call';
import AdminPage from '@/components/admin/AdminPage';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminNotice from '@/components/admin/AdminNotice';
import ErrorMessage from '@/components/admin/ErrorMessage';
import ConfirmDialog, { type ConfirmSpec } from '@/components/admin/ConfirmDialog';

type Entry = {
  id: string;
  email: string | null;
  phone: string | null;
  reason: string;
  created_at: string;
  addedByEmail: string | null;
  /** Renseigné = blocage limité à une ambassade (créé depuis son feedback post-live). */
  scopedToHost: { firstName: string; city: string } | null;
};

interface Props { entries: Entry[] }

export default function BlacklistClient({ entries: initial }: Props) {
  const [entries, setEntries] = useState(initial);
  const [form, setForm] = useState({ email: '', phone: '', reason: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim() && !form.phone.trim()) {
      setAddError('Renseignez au moins un e-mail ou un téléphone.');
      return;
    }
    setAdding(true);
    setAddError('');
    const res = await apiCall<{ id: string }>('/api/admin/blacklist', { body: form });
    if (res.ok) {
      setEntries((list) => [
        {
          id: res.data.id,
          email: form.email.trim().toLowerCase() || null,
          phone: form.phone.trim() || null,
          reason: form.reason.trim(),
          created_at: new Date().toISOString(),
          addedByEmail: null,
          scopedToHost: null,
        },
        ...list,
      ]);
      setForm({ email: '', phone: '', reason: '' });
    } else {
      setAddError(res.error);
    }
    setAdding(false);
  }

  // Audit 7.5 : le déblocage se faisait sans confirmation.
  function askRemove(entry: Entry) {
    const who = entry.email ?? entry.phone ?? 'cette personne';
    setConfirm({
      title: 'Débloquer cette personne ?',
      body: entry.scopedToHost
        ? `${who} pourra de nouveau envoyer une demande à l'ambassade de ${entry.scopedToHost.firstName}. Ce blocage avait été posé par l'ambassadeur lui-même.`
        : `${who} pourra de nouveau envoyer des demandes de visite à toutes les ambassades.`,
      confirmLabel: 'Débloquer',
      onConfirm: async () => {
        setBusy(true);
        setRemoveError('');
        const res = await apiCall('/api/admin/blacklist', { method: 'DELETE', body: { id: entry.id } });
        setBusy(false);
        setConfirm(null);
        if (res.ok) setEntries((list) => list.filter((x) => x.id !== entry.id));
        else setRemoveError(res.error);
      },
    });
  }

  const globalCount = entries.filter((e) => !e.scopedToHost).length;
  const scopedCount = entries.length - globalCount;

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title="Blocages"
        subtitle={
          entries.length === 0
            ? 'Aucun blocage actif.'
            : `${globalCount} blocage${globalCount > 1 ? 's' : ''} général${globalCount > 1 ? 'aux' : ''}` +
              (scopedCount > 0 ? ` · ${scopedCount} limité${scopedCount > 1 ? 's' : ''} à une ambassade` : '')
        }
      />

      <div className="space-y-8">
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Ban className="w-4 h-4 text-red-500" />
            <p className="text-sm font-medium text-slate-800">Bloquer une personne</p>
          </div>

          {/* Audit 7.3 : l'effet réel du blocage n'était pas expliqué. C'est un
              choix éthique assumé du projet — refus honnête plutôt que
              shadow-ban — mais l'admin pouvait croire à un blocage silencieux. */}
          <AdminNotice tone="info">
            La personne bloquée reçoit un message neutre l&apos;invitant à contacter l&apos;équipe si elle pense qu&apos;il s&apos;agit
            d&apos;une erreur. Ce n&apos;est pas un blocage silencieux : elle sait que sa demande n&apos;a pas été prise en compte.
          </AdminNotice>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="bl-email" className="block text-xs text-slate-500 mb-1.5">E-mail</label>
              <input
                id="bl-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputCls}
                placeholder="spam@exemple.com"
              />
            </div>
            <div>
              <label htmlFor="bl-phone" className="block text-xs text-slate-500 mb-1.5">Téléphone</label>
              <input
                id="bl-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className={inputCls}
                placeholder="+33 6…"
              />
            </div>
          </div>
          {/* Audit 7.4 : rien ne disait que le blocage ne porte que sur les
              champs renseignés — bloquer un e-mail laisse passer une nouvelle
              demande avec une autre adresse et le même téléphone. */}
          <p className="text-xs text-slate-400 -mt-1">
            Le blocage ne porte que sur les champs renseignés. Renseignez les deux quand vous les connaissez.
          </p>

          <div>
            <label htmlFor="bl-reason" className="block text-xs text-slate-500 mb-1.5">Motif (interne) *</label>
            <input
              id="bl-reason"
              type="text"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              required
              className={inputCls}
              placeholder="Spam, harcèlement, fausses demandes…"
            />
            <p className="text-xs text-slate-400 mt-1">Visible uniquement par l&apos;équipe — jamais communiqué à la personne.</p>
          </div>

          {addError && <ErrorMessage>{addError}</ErrorMessage>}

          <button
            type="submit"
            disabled={adding}
            className="w-full bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            {adding ? 'Blocage…' : 'Bloquer cette personne'}
          </button>
        </form>

        {removeError && <ErrorMessage>{removeError}</ErrorMessage>}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {entries.length === 0 ? (
            <p className="px-6 py-8 text-slate-400 text-sm text-center">Aucun blocage</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {entries.map((e) => (
                <li key={e.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <UserX className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-800 break-all">
                        {e.email ?? e.phone ?? '—'}
                      </p>
                      {e.scopedToHost ? (
                        <span
                          className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-medium px-1.5 py-0.5 rounded border border-amber-100 shrink-0"
                          title={`Bloqué uniquement pour l'ambassade de ${e.scopedToHost.firstName}`}
                        >
                          <Home className="w-2.5 h-2.5" />
                          {e.scopedToHost.firstName}, {e.scopedToHost.city}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0">
                          <Globe className="w-2.5 h-2.5" />
                          Toutes les ambassades
                        </span>
                      )}
                    </div>
                    {e.email && e.phone && <p className="text-xs text-slate-400 mt-0.5">{e.phone}</p>}
                    <p className="text-xs text-slate-500 mt-0.5">{e.reason}</p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      {new Date(e.created_at).toLocaleDateString('fr-FR')}
                      {e.addedByEmail && ` · par ${e.addedByEmail}`}
                      {!e.addedByEmail && e.scopedToHost && ' · par l\'ambassadeur'}
                    </p>
                  </div>
                  <button
                    onClick={() => askRemove(e)}
                    className="w-8 h-8 flex items-center justify-center text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    title="Débloquer"
                    aria-label={`Débloquer ${e.email ?? e.phone ?? 'cette personne'}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog spec={confirm} onCancel={() => setConfirm(null)} pending={busy} />
    </AdminPage>
  );
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition bg-white';

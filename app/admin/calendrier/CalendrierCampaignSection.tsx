'use client';

import { useState } from 'react';
import { Send, Mail, Users, CheckCircle2, AlertCircle, Clock, Trash2 } from 'lucide-react';
import { apiCall } from '@/lib/admin/api-call';
import AdminNotice from '@/components/admin/AdminNotice';
import ErrorMessage from '@/components/admin/ErrorMessage';
import ConfirmDialog, { type ConfirmSpec } from '@/components/admin/ConfirmDialog';

type Event = { id: string; title: string; event_date: string };
type Campaign = {
  id: string;
  type: string;
  event_id: string;
  status: string;
  scheduled_at: string;
  sent_count: number | null;
  custom_message: string | null;
};

interface Props {
  /** Events futurs — seuls éligibles à une nouvelle campagne. */
  futureEvents: Event[];
  /** Tous les events, pour résoudre le titre des campagnes déjà passées (audit 4.4). */
  allEvents: Event[];
  campaigns: Campaign[];
  /** Offset admin (La Réunion) — aligné sur la création de live (audit 4.5). */
  tzOffset: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-700',
  sending:  'bg-indigo-50 text-indigo-700',
  sent:     'bg-emerald-50 text-emerald-700',
  failed:   'bg-red-50 text-red-700',
};

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  pending:  Clock,
  sending:  Clock,
  sent:     CheckCircle2,
  failed:   AlertCircle,
};

// Audit 4.2 : le badge affichait la valeur brute anglaise de la base
// (`pending`, `sent`, `failed`) alors que tout le reste de l'admin traduit ses
// statuts — et qu'un dictionnaire de couleurs existait déjà juste au-dessus.
const STATUS_LABELS: Record<string, string> = {
  pending:  'En attente',
  sending:  'Envoi en cours',
  sent:     'Envoyée',
  failed:   'Échec',
};

const TYPE_LABELS: Record<string, string> = {
  ambassadeurs: 'Ambassadeurs',
  visiteurs:    'Visiteurs',
};

// Audit 4.6 : l'admin ne pouvait pas deviner qui chaque type cible.
const TYPE_HELP: Record<string, string> = {
  ambassadeurs: 'Tous les ambassadeurs validés. L\'e-mail contient leur lien d\'activation pour ce live.',
  visiteurs:    'Les visiteurs dont une demande de visite a été acceptée pour ce live — souvent aucun avant le live.',
};

export default function CalendrierCampaignSection({ futureEvents, allEvents, campaigns: initial, tzOffset }: Props) {
  const [campaigns, setCampaigns] = useState(initial);
  const [form, setForm] = useState({
    event_id: futureEvents[0]?.id ?? '',
    type: 'ambassadeurs',
    scheduled_at: '',
    custom_message: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Le champ `datetime-local` est interprété avec le même offset que la
    // création de live, pas celui du navigateur : un admin en métropole
    // programmait sinon un envoi décalé de 2 à 3 heures (audit 4.5).
    const scheduledIso = new Date(`${form.scheduled_at}:00${tzOffset}`).toISOString();

    const res = await apiCall<{ id: string; recipients: number }>('/api/admin/campaigns', {
      body: { ...form, scheduled_at: scheduledIso },
    });

    if (res.ok) {
      // Audit 4.3 : le nombre de destinataires était retourné par l'API mais
      // jamais affiché — l'admin ignorait à combien de personnes il venait de
      // programmer un envoi, et que la liste est figée à cet instant.
      const n = res.data.recipients;
      setSuccess(
        n === 0
          ? 'Envoi planifié, mais aucun destinataire ne correspond pour le moment.'
          : `Envoi planifié pour ${n} destinataire${n > 1 ? 's' : ''} — liste figée maintenant, les inscriptions ultérieures ne la rejoindront pas.`
      );
      setCampaigns((c) => [
        ...c,
        { id: res.data.id, type: form.type, event_id: form.event_id, status: 'pending', scheduled_at: scheduledIso, sent_count: null, custom_message: form.custom_message || null },
      ]);
      setForm((f) => ({ ...f, scheduled_at: '', custom_message: '' }));
    } else {
      setError(res.error);
    }
    setSaving(false);
  }

  // Audit 4.7 : une erreur de date était définitive, aucun moyen d'annuler.
  function askDelete(c: Campaign) {
    const event = allEvents.find((e) => e.id === c.event_id);
    setConfirm({
      title: 'Annuler cet envoi ?',
      body: `Envoi ${TYPE_LABELS[c.type] ?? c.type}${event ? ` pour « ${event.title} »` : ''}. La liste de destinataires enregistrée sera supprimée.`,
      confirmLabel: "Annuler l'envoi",
      onConfirm: async () => {
        setBusy(true);
        const res = await apiCall('/api/admin/campaigns', { method: 'DELETE', body: { id: c.id } });
        setBusy(false);
        setConfirm(null);
        if (res.ok) setCampaigns((list) => list.filter((x) => x.id !== c.id));
        else setError(res.error);
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Audit 4.1 : vercel.json contient `{"crons": []}`. L'UI affichait
          « Campagne planifiée. » puis un badge « pending » indéfiniment, sans
          jamais dire qu'aucun envoi n'était déclenché. */}
      <AdminNotice tone="paused" title="Les envois automatiques sont désactivés">
        Un envoi planifié ici est enregistré avec sa liste de destinataires, mais <strong>aucun e-mail ne partira
        tant que les envois automatiques ne sont pas activés</strong>. Elle restera au statut « En attente ».
      </AdminNotice>

      {campaigns.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <ul className="divide-y divide-slate-50">
            {campaigns.map((c) => {
              const StatusIcon = STATUS_ICONS[c.status] ?? Clock;
              const event = allEvents.find((e) => e.id === c.event_id);
              return (
                <li key={c.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center shrink-0">
                    {c.type === 'ambassadeurs' ? (
                      <Users className="w-4 h-4 text-indigo-500" />
                    ) : (
                      <Mail className="w-4 h-4 text-indigo-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {TYPE_LABELS[c.type] ?? c.type}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {event?.title ?? 'Live supprimé'} — {new Date(c.scheduled_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Indian/Reunion' })}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${STATUS_COLORS[c.status] ?? 'bg-slate-50 text-slate-500'}`}>
                    <StatusIcon className="w-3 h-3" />
                    {STATUS_LABELS[c.status] ?? c.status}
                    {c.sent_count != null && ` (${c.sent_count})`}
                  </span>
                  {c.status === 'pending' && (
                    <button
                      onClick={() => askDelete(c)}
                      className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="Annuler cet envoi"
                      aria-label="Annuler cet envoi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {futureEvents.length > 0 && (
        <form onSubmit={handleSchedule} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-medium text-slate-800">Programmer un envoi groupé</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Live</label>
              <select
                value={form.event_id}
                onChange={(e) => setForm((f) => ({ ...f, event_id: e.target.value }))}
                required
                className={selectCls}
              >
                {futureEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} — {new Date(e.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Indian/Reunion' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Destinataires</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className={selectCls}
              >
                <option value="ambassadeurs">Ambassadeurs</option>
                <option value="visiteurs">Visiteurs</option>
              </select>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{TYPE_HELP[form.type]}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              Date d'envoi <span className="text-slate-400">(heure La Réunion)</span>
            </label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
              required
              className={inputCls}
            />
          </div>

          {form.type === 'ambassadeurs' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Message personnalisé (optionnel)</label>
              <textarea
                value={form.custom_message}
                onChange={(e) => setForm((f) => ({ ...f, custom_message: e.target.value }))}
                rows={3}
                className={inputCls}
                placeholder="Bonjour à toutes et tous, le prochain live aura lieu…"
              />
              <p className="text-xs text-slate-400 mt-1">Apparaîtra dans l'e-mail ambassadeur avant le bouton d'activation.</p>
            </div>
          )}

          {error && <ErrorMessage>{error}</ErrorMessage>}
          {success && <p className="text-emerald-800 text-sm bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">{success}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
          >
            {saving ? 'Planification…' : "Planifier l'envoi"}
          </button>
        </form>
      )}

      {futureEvents.length === 0 && (
        <p className="text-slate-400 text-sm text-center py-6">
          Aucun live à venir — créez d'abord un live dans la section ci-dessus.
        </p>
      )}

      <ConfirmDialog spec={confirm} onCancel={() => setConfirm(null)} pending={busy} />
    </div>
  );
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 transition bg-white';
const selectCls = inputCls;

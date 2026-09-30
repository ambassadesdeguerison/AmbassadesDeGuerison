'use client';

import { useState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import type { TimingConfig } from '@/lib/timing-config';
import { apiCall } from '@/lib/admin/api-call';
import AdminPage from '@/components/admin/AdminPage';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminNotice from '@/components/admin/AdminNotice';
import ErrorMessage from '@/components/admin/ErrorMessage';

type Field = { key: keyof TimingConfig; label: string; tooltip: string };

// Audit admin 2026-08-07 (9.1) : trois champs ne pilotaient rien —
// `visitor_auto_decline_days_before` (cron supprimé),
// `host_reminder_days_before` (aucun cron n'a jamais existé) et
// `queue_aging_days` (aucun consommateur). Leurs infobulles décrivaient
// pourtant un comportement précis au présent : l'admin configurait une
// automatisation inexistante en croyant l'avoir activée.
//
// Les colonnes restent en base — `host_reminder_days_before` est noté comme
// TODO avant l'ouverture au public. Seuls les champs pilotant du code réel
// sont exposés ici.
const CAMPAIGN_FIELDS: Field[] = [
  {
    key: 'campaign_ambassadors_days_before',
    label: 'E-mail aux ambassadeurs (jours avant le live)',
    tooltip: 'Nombre de jours avant le live pour envoyer le mail d\'invitation aux ambassadeurs.',
  },
  {
    key: 'campaign_visitors_days_before',
    label: 'E-mail aux visiteurs (jours avant le live)',
    tooltip: 'Nombre de jours avant le live pour notifier les visiteurs qui ont accepté de recevoir des notifications.',
  },
  {
    key: 'feedback_days_after',
    label: 'E-mail de retour (jours après le live)',
    tooltip: 'Nombre de jours après le live pour envoyer les mails de retour d\'expérience.',
  },
];

// `soon_threshold_days` ne concerne aucun envoi : il pilote l'affichage de la
// carte publique. Il était noyé au milieu de six champs inertes, sous un
// sous-titre « Délais pour les envois automatiques » qui ne s'y appliquait pas
// (audit 9.3).
const DISPLAY_FIELDS: Field[] = [
  {
    key: 'soon_threshold_days',
    label: 'Seuil "bientôt" (jours)',
    tooltip: 'Quand le prochain live est dans ≤ N jours, la carte publique affiche « Les ambassades confirment leur participation » au lieu de la date seule.',
  },
];

interface Props { config: TimingConfig }

export default function TimingConfigClient({ config }: Props) {
  const [values, setValues] = useState(config);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function set(key: keyof TimingConfig, v: string) {
    const n = parseInt(v);
    if (!isNaN(n) && n >= 0) setValues((prev) => ({ ...prev, [key]: n }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const res = await apiCall('/api/admin/settings/timing', { method: 'PATCH', body: values });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(res.error);
    }
    setSaving(false);
  }

  function renderField({ key, label, tooltip }: Field) {
    return (
      <div key={key} className="grid sm:grid-cols-3 gap-3 items-center">
        <div className="sm:col-span-2">
          <label htmlFor={key} className="block text-sm font-medium text-slate-700">{label}</label>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{tooltip}</p>
        </div>
        <input
          id={key}
          type="number"
          min={0}
          max={60}
          value={values[key]}
          onChange={(e) => set(key, e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-600 transition tabular-nums"
        />
      </div>
    );
  }

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title="Délais et affichage"
        subtitle="Quand les e-mails automatiques partent, et à partir de quand la carte annonce un live imminent."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-slate-800">Envois automatiques</h2>
            <p className="text-xs text-slate-400 mt-0.5">Délais en jours, relatifs à la date du live.</p>
          </div>

          <AdminNotice tone="paused">
            Les envois automatiques sont <strong>désactivés</strong> pour le moment. Ces délais seront appliqués dès
            leur activation, mais aucun e-mail ne part automatiquement aujourd'hui.
          </AdminNotice>

          {CAMPAIGN_FIELDS.map(renderField)}
        </section>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-slate-800">Carte publique</h2>
            <p className="text-xs text-slate-400 mt-0.5">Actif immédiatement — visible par tous les visiteurs.</p>
          </div>
          {DISPLAY_FIELDS.map(renderField)}
        </section>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Sauvegardé
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </>
          )}
        </button>
      </form>
    </AdminPage>
  );
}

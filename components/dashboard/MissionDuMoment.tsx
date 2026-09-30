'use client';

import { Radio, Send, ExternalLink, MessageSquare, Calendar } from 'lucide-react';

interface Activation {
  id: string;
  is_active: boolean;
  events: { title: string; event_date: string } | null;
}

interface ContactRequest {
  status: string;
}

interface Props {
  currentEvent: { id: string; live_link: string | null } | null;
  approvedLiveLink: string | null;
  signalSent: boolean;
  signalDescription: string;
  signalLoading: boolean;
  onDescriptionChange: (v: string) => void;
  onSendSignal: () => void;
  contactRequests: ContactRequest[];
  activations: Activation[];
}

function isWithin3Days(dateStr: string): boolean {
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff > 0 && diff <= 3 * 24 * 60 * 60 * 1000;
}

export default function MissionDuMoment({
  currentEvent,
  approvedLiveLink,
  signalSent,
  signalDescription,
  signalLoading,
  onDescriptionChange,
  onSendSignal,
  contactRequests,
  activations,
}: Props) {
  // Priorité 1 — Signal approuvé : David invite à témoigner en live
  if (currentEvent && approvedLiveLink) {
    return (
      <div className="bg-emerald-600 text-white rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-200 animate-pulse" />
          <p className="font-semibold">David vous invite à témoigner !</p>
        </div>
        <p className="text-emerald-100 text-sm">
          Rejoignez le live maintenant et partagez ce que Dieu a fait dans votre ambassade.
        </p>
        <a
          href={approvedLiveLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-white text-emerald-700 px-5 py-3 rounded-xl font-semibold hover:bg-emerald-50 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Rejoindre le live
        </a>
      </div>
    );
  }

  // Priorité 2 — Signal envoyé, en attente d'approbation
  if (currentEvent && signalSent) {
    return (
      <div className="bg-indigo-600 text-white rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-indigo-300 rounded-full animate-pulse" />
          <p className="font-semibold text-sm">Votre témoignage est envoyé — David vous répond bientôt</p>
        </div>
        <p className="text-indigo-200 text-sm">
          Si David vous accepte, le lien pour rejoindre le live apparaîtra ici automatiquement.
        </p>
      </div>
    );
  }

  // Priorité 3 — Live en cours, formulaire signal
  if (currentEvent) {
    return (
      <div className="bg-indigo-600 text-white rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-indigo-300" />
          <p className="font-semibold">Témoigner en live</p>
        </div>
        <p className="text-indigo-200 text-sm">
          Décrivez ce qui s&apos;est passé dans votre ambassade — guérison, transformation, moment fort.
          David lira votre message et pourra vous inviter à partager en direct.
        </p>
        <textarea
          value={signalDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
          placeholder="Ex : Marie a été guérie d'une douleur chronique pendant la prière…"
          className="w-full bg-indigo-700 text-white placeholder-indigo-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
        />
        <button
          onClick={onSendSignal}
          disabled={signalLoading || !signalDescription.trim()}
          className="flex items-center gap-2 bg-white text-indigo-700 px-5 py-2 rounded-full text-sm font-medium disabled:opacity-60 hover:bg-indigo-50 transition-colors"
        >
          <Send className="w-4 h-4" />
          {signalLoading ? 'Envoi…' : 'Lever la main pour témoigner'}
        </button>
      </div>
    );
  }

  // Priorité 4 — Demandes de visiteurs en attente (hors live)
  const pendingCount = contactRequests.filter((r) => r.status === 'pending').length;
  if (pendingCount > 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="font-semibold text-amber-900 text-sm">
            {pendingCount === 1
              ? '1 personne attend votre réponse'
              : `${pendingCount} personnes attendent votre réponse`}
          </p>
          <p className="text-amber-700 text-xs mt-0.5">
            Ouvrez l&apos;onglet « Demandes » pour accepter ou refuser.
          </p>
        </div>
      </div>
    );
  }

  // Priorité 5 — Live dans ≤ 3 jours, participation non confirmée
  const upcoming = activations.find(
    (a) => !a.is_active && a.events?.event_date && isWithin3Days(a.events.event_date)
  );
  if (upcoming) {
    const dateLabel = upcoming.events?.event_date
      ? new Date(upcoming.events.event_date).toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      : null;

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
          <Calendar className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <p className="font-semibold text-blue-900 text-sm capitalize">
            Live {dateLabel ?? 'bientôt'} — confirmez votre participation
          </p>
          <p className="text-blue-700 text-xs mt-0.5">
            Cliquez sur « Je participe à ce live » dans l&apos;onglet Accueil.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

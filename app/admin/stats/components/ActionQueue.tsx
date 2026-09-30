import Link from 'next/link';
import { ChevronRight, Inbox, Clock } from 'lucide-react';
import type { ActionQueue as ActionQueueData } from '@/lib/admin/stats-helpers';

type Props = {
  queue: ActionQueueData;
};

function QueueRow({ href, count, children }: { href: string; count: number; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700"
      >
        <span>
          <span className="font-semibold text-violet-700">{count}</span> {children}
        </span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </Link>
    </li>
  );
}

export default function ActionQueue({ queue }: Props) {
  // `awaitingCandidate` est exclu du total : ces candidats n'attendent rien de
  // l'admin (transition self-service). Ils sont affichés séparément, en note
  // informative, pour ne pas gonfler artificiellement la file d'action.
  const total = queue.questionnairesToReview + queue.testimonialsPending + queue.feedbackReports;

  const awaitingNote = queue.awaitingCandidate > 0 && (
    <p className="flex items-start gap-2 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-50">
      <Clock className="w-3.5 h-3.5 mt-px shrink-0" />
      <span>
        {queue.awaitingCandidate} candidat{queue.awaitingCandidate > 1 ? 's n\'ont' : ' n\'a'} pas encore accepté les
        conditions d'engagement.{' '}
        <Link href="/admin/ambassadeurs?status=pending_review" className="underline underline-offset-2 hover:text-slate-600">
          Voir
        </Link>{' '}
        — rien à faire de votre côté, {queue.awaitingCandidate > 1 ? 'ils avancent' : 'il avance'} seul
        {queue.awaitingCandidate > 1 ? 's' : ''} depuis leur tableau de bord.
      </span>
    </p>
  );

  if (total === 0) {
    return (
      <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <Inbox className="w-4 h-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">À traiter</h2>
        </div>
        <p className="text-sm text-slate-500 mt-2">Rien à traiter en ce moment.</p>
        {awaitingNote}
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="w-4 h-4 text-violet-600" />
        <h2 className="text-sm font-semibold text-slate-700">À traiter</h2>
      </div>
      <ul className="space-y-1">
        {queue.questionnairesToReview > 0 && (
          <QueueRow href="/admin/ambassadeurs?status=enrichment_pending" count={queue.questionnairesToReview}>
            dossier{queue.questionnairesToReview > 1 ? 's' : ''} à valider
          </QueueRow>
        )}
        {queue.testimonialsPending > 0 && (
          <QueueRow href="/admin/temoignages" count={queue.testimonialsPending}>
            témoignage{queue.testimonialsPending > 1 ? 's' : ''} à modérer
          </QueueRow>
        )}
        {queue.feedbackReports > 0 && (
          <QueueRow href="/admin/feedback" count={queue.feedbackReports}>
            signalement{queue.feedbackReports > 1 ? 's' : ''} à traiter
          </QueueRow>
        )}
      </ul>
      {awaitingNote}
    </section>
  );
}

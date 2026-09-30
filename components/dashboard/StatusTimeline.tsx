'use client';

import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { isDossierComplet } from '@/lib/host-profile';

type Step = {
  label: string;
  description: string;
};

const STEPS: Step[] = [
  {
    label: 'Inscription',
    description: 'Regardez la vidéo et acceptez les conditions',
  },
  {
    label: 'Engagement pris',
    description: 'Parlez-nous de vous',
  },
  {
    label: 'Ma présentation',
    description: 'David regarde votre dossier…',
  },
  {
    label: 'Réponse de David',
    description: 'Ambassade active sur la carte',
  },
];

const STATUS_TO_STEP: Record<string, number> = {
  pending_review: 1,
  pre_approved: 2,
  enrichment_pending: 3,
  validated: 4,
  suspended: 4,
  rejected: 4,
};

export default function StatusTimeline({
  status,
  profilePhotoUrl,
  roomPhotoUrls,
}: {
  status: string;
  profilePhotoUrl?: string | null;
  roomPhotoUrls?: string[] | null;
}) {
  // enrichment_pending devrait garantir un dossier complet (garde API sur
  // PATCH /api/ambassadeur/enrichissement), mais une donnée créée hors de ce
  // chemin (test, script, migration) peut violer l'invariant. Sans cette
  // revérification, un ambassadeur au dossier vide verrait "Profil enrichi ✓"
  // alors que David n'a rien à examiner.
  const dossierComplet = isDossierComplet(profilePhotoUrl, roomPhotoUrls);
  const effectiveStatus = status === 'enrichment_pending' && !dossierComplet
    ? 'pre_approved'
    : status;
  const activeStep = STATUS_TO_STEP[effectiveStatus] ?? 1;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-4">Votre parcours</p>
      <ol className="relative">
        {STEPS.map((step, i) => {
          const stepNum = i + 1;
          const done = stepNum < activeStep;
          const active = stepNum === activeStep;
          const future = stepNum > activeStep;
          const last = i === STEPS.length - 1;

          return (
            <li key={step.label} className="flex gap-3">
              {/* Icon + connector */}
              <div className="flex flex-col items-center">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                  done ? 'bg-emerald-500' : active ? 'bg-indigo-600' : 'bg-slate-100'
                }`}>
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : active ? (
                    <Clock className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </div>
                {!last && (
                  <div className={`w-px flex-1 my-1 ${done ? 'bg-emerald-300' : 'bg-slate-100'}`} />
                )}
              </div>

              {/* Content */}
              <div className={`pb-4 ${last ? 'pb-0' : ''}`}>
                <p className={`text-sm font-medium leading-tight ${
                  done ? 'text-emerald-700' : active ? 'text-indigo-700' : 'text-slate-400'
                }`}>
                  {step.label}
                </p>
                {active && (
                  <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

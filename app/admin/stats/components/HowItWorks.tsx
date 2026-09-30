'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

// Audit admin 2026-08-07 (T.7) : aucun écran d'accueil ou d'aide. Un nouvel
// admin arrivait ici sans savoir dans quel ordre les onglets s'utilisent, ni
// que le pipeline ambassadeur est majoritairement self-service.
//
// Replié une fois lu, mémorisé en localStorage — l'aide ne doit pas peser sur
// l'usage quotidien de quelqu'un qui connaît déjà l'outil.

const STORAGE_KEY = 'admin-how-it-works-dismissed';

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Le candidat avance seul',
    body: "Il s'inscrit, regarde la vidéo, valide son engagement, puis se présente avec ses photos. Vous n'avez rien à faire pendant cette phase.",
  },
  {
    title: 'Vous validez le dossier',
    body: 'Quand sa présentation est complète, il passe « À valider » dans Ambassadeurs. Vous examinez ses photos et son parcours, puis vous validez ou refusez.',
  },
  {
    title: 'Le live rend l\'ambassade visible',
    body: "Créez le live dans Calendrier. Les ambassadeurs validés reçoivent un lien d'activation et confirment leur participation — c'est ce qui fait apparaître leur point sur la carte publique.",
  },
  {
    title: 'Après le live',
    body: 'Clôturez le live pour retirer les points de la carte. Modérez les témoignages déposés, et traitez les signalements éventuels dans Retours après le live.',
  },
];

export default function HowItWorks() {
  // Fermé par défaut au premier rendu : évite un flash d'ouverture chez
  // quelqu'un qui l'avait déjà masqué (localStorage est illisible en SSR).
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) !== '1');
    } catch {
      setOpen(true);
    }
    setReady(true);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      if (next) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Safari en navigation privée — l'état reste valable pour la session.
    }
  }

  if (!ready) return null;

  return (
    <section className="bg-white rounded-xl border border-slate-100 shadow-sm">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-5 py-4 text-left"
      >
        <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-700 flex-1">Comment ça marche</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {open && (
        <ol className="px-5 pb-5 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700">{s.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  { question: 'Est-ce que ça coûte quelque chose ?', answer: "Non, c'est entièrement gratuit. Aucune contribution n'est demandée." },
  { question: 'Dois-je apporter quelque chose ?', answer: "Non, rien n'est nécessaire. Juste votre présence." },
  { question: 'Combien de temps dure un live ?', answer: 'Généralement 1h30 à 2h, selon les échanges.' },
  { question: "Que se passe-t-il si je ne connais personne sur place ?", answer: "L'ambassadeur vous accueille personnellement — vous n'êtes jamais seul(e). C'est justement le sens d'une ambassade : une famille qui vous reçoit." },
];

// Accordéon accessible : <button> natif + aria-expanded, navigable au clavier
// (Tab + Entrée/Espace nativement via <button>). Persona "mamie 60 ans à
// Abidjan" — touch target 44px minimum par question (cf /plan-design-review).
export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Unique par instance : l'accordéon peut apparaître sur /decouvrir et dans /mon-espace.
  const baseId = useId();

  return (
    <div className="space-y-2">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.question} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`${baseId}-answer-${i}`}
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 min-h-[44px] text-left text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
            >
              {item.question}
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <p id={`${baseId}-answer-${i}`} hidden={!isOpen} className="px-4 pb-4 text-sm text-slate-500 leading-relaxed">
              {item.answer}
            </p>
          </div>
        );
      })}
    </div>
  );
}

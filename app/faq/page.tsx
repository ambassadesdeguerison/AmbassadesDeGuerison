import AppHeader from '@/components/AppHeader';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

const FAQ = [
  {
    q: "C'est quoi un live de guérison de David Théry ?",
    a: "David Théry est pasteur évangélique. Plusieurs fois par an, il organise des lives sur YouTube dédiés à la prière pour la guérison des malades. Des milliers de personnes participent en France et dans toute la francophonie.",
  },
  {
    q: "Qu'est-ce qu'une ambassade ?",
    a: "Une ambassade, c'est une maison ouverte. Un ambassadeur invite des personnes de son quartier à regarder le live ensemble, à prier, à partager un moment de foi. Pas besoin de grande salle — un salon avec un écran suffit.",
  },
  {
    q: "Comment je trouve une ambassade près de chez moi ?",
    a: "Sur la carte de la page d'accueil, chaque pin représente une ambassade disponible. Cliquez sur un pin pour voir les détails et demander à rejoindre.",
  },
  {
    q: "L'ambassadeur peut-il refuser ma demande ?",
    a: "Oui. L'ambassadeur peut accepter ou refuser votre demande. Si votre demande n'est pas retenue, vous en serez informé par e-mail. Il y a souvent d'autres ambassades disponibles.",
  },
  {
    q: "Est-ce que je peux venir avec ma famille ?",
    a: "Oui, vous pouvez indiquer le nombre de personnes lors de votre demande. L'ambassadeur le prendra en compte avant de confirmer.",
  },
  {
    q: "Combien ça coûte ?",
    a: "Rien. Les ambassades de guérison sont entièrement gratuites. Aucun don n'est collecté lors de ces rencontres.",
  },
  {
    q: "Est-ce que je dois être croyant pour participer ?",
    a: "Non. Tout le monde est bienvenu — que vous soyez croyant, curieux, ou en recherche. L'accueil est inconditionnel.",
  },
  {
    q: "Et si je n'ai pas internet chez moi ?",
    a: "Les ambassades accueillent justement les personnes qui ne peuvent pas suivre le live seules — problème de connexion, d'écran, ou simplement pour ne pas rester seul. C'est fait pour ça.",
  },
  {
    q: "Je veux ouvrir ma maison. Comment je fais ?",
    a: "Cliquez sur 'Devenir ambassadeur' et remplissez le formulaire d'inscription. Après validation par l'équipe, vous recevrez les informations pour configurer votre ambassade et activer votre présence lors des prochains lives.",
  },
  {
    q: "Que se passe-t-il si quelque chose ne va pas lors de la rencontre ?",
    a: "Vous pouvez nous contacter directement depuis votre lien de confirmation ou via la page 'Contacter l'équipe'. L'équipe répond rapidement.",
  },
  {
    q: "Où se passe la prière pour la guérison ? En ligne ou en ambassade ?",
    a: "La prière est menée par David Théry en direct sur YouTube. En ambassade, vous participez tous ensemble devant l'écran. L'ambassadeur peut également prier avec vous en personne.",
  },
  {
    q: "Combien de temps dure un live ?",
    a: "En général entre 1h30 et 2h30. David annonce la durée à l'avance dans ses communications.",
  },
];

export const metadata = {
  title: 'Questions fréquentes — Ambassades de Guérison',
  description: 'Tout ce que vous voulez savoir sur les ambassades de guérison de David Théry.',
};

export default function FaqPage() {
  return (
    <>
      <AppHeader />
      <main className="bg-slate-50 min-h-screen px-4 py-10">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-semibold text-slate-800 mb-2">Questions fréquentes</h1>
          <p className="text-slate-500 text-sm mb-8">
            Tout ce que vous voulez savoir avant de rejoindre ou d&apos;ouvrir une ambassade.
          </p>

          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <FaqItem key={i} question={item.q} answer={item.a} />
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-slate-500 text-sm mb-4">Une question non listée ici ?</p>
            <Link
              href="/contact-equipe"
              className="inline-block bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Contacter l&apos;équipe
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="bg-white rounded-xl border border-slate-100 shadow-sm group">
      <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none">
        <span className="text-sm font-medium text-slate-800">{question}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 group-open:rotate-180 transition-transform" />
      </summary>
      <div className="px-5 pb-4">
        <p className="text-slate-600 text-sm leading-relaxed">{answer}</p>
      </div>
    </details>
  );
}

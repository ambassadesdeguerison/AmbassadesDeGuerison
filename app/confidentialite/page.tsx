import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import AppHeader from '@/components/AppHeader';

export const metadata = {
  title: 'Politique de confidentialité — Ambassades de Guérison',
  description:
    'Quelles données nous collectons, pourquoi, qui les voit, combien de temps nous les gardons, et comment les supprimer.',
};

// ⚠️ PLACEHOLDERS À COMPLÉTER PAR DAVID / SON ÉQUIPE ⚠️
//
// Les constantes ci-dessous portent des valeurs provisoires clairement marquées
// `[À COMPLÉTER]`. Elles s'affichent telles quelles sur la page : c'est
// volontaire — une valeur fausse mais plausible (une adresse inventée, un nom
// d'association approximatif) serait pire qu'un trou visible, parce qu'elle
// passerait la relecture sans être corrigée.
//
// Les trois premières sont des mentions légalement obligatoires (identité du
// responsable de traitement + moyen de contact, art. 13 RGPD). La page ne doit
// pas être considérée comme publiable tant qu'elles ne sont pas renseignées.
const ENTITE = '[À COMPLÉTER : nom de l\'association ou de la structure]';
const ENTITE_ADRESSE = '[À COMPLÉTER : adresse postale du siège]';
const CONTACT_EMAIL = '[À COMPLÉTER : adresse e-mail de contact RGPD]';

// Durées de conservation — valeurs par défaut alignées sur les référentiels CNIL
// (3 ans à compter du dernier contact actif pour un contact/prospect). David peut
// les raccourcir : la CNIL admet toute durée justifiée et documentée, et une
// durée plus courte est toujours plus protectrice.
const DUREE_DEMANDES = '12 mois après le live concerné';
const DUREE_COMPTE = '3 ans sans aucune activité (connexion ou nouvelle demande)';
const DUREE_TEMOIGNAGES = 'sans limite tant qu\'ils restent publiés, suppression sur simple demande';

export const revalidate = 3600;

type Section = {
  title: string;
  body: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    title: 'Qui est responsable de vos données',
    body: (
      <>
        <p>
          Les données collectées sur Ambassades de Guérison le sont par{' '}
          <strong className="text-slate-700">{ENTITE}</strong>, dont le siège est situé{' '}
          {ENTITE_ADRESSE}.
        </p>
        <p className="mt-2">
          Pour toute question sur vos données, ou pour exercer vos droits, écrivez à{' '}
          <strong className="text-slate-700">{CONTACT_EMAIL}</strong>.
        </p>
      </>
    ),
  },
  {
    title: 'Ce que nous collectons, et pourquoi',
    body: (
      <>
        <p className="mb-3">
          Nous ne collectons que ce qui est nécessaire pour qu’une rencontre puisse
          avoir lieu. Rien de plus.
        </p>
        <p className="font-medium text-slate-700 mt-4 mb-1.5">Si vous cherchez une ambassade</p>
        <ul className="space-y-1.5 list-disc pl-5">
          <li>
            <strong className="text-slate-700">Prénom</strong> — pour que l’ambassadeur
            sache qui il accueille.
          </li>
          <li>
            <strong className="text-slate-700">E-mail</strong> — pour vous connecter à
            votre espace et vous transmettre la réponse de l’ambassadeur.
          </li>
          <li>
            <strong className="text-slate-700">Téléphone</strong> — l’ambassadeur ne le
            voit que s’il accepte votre demande, pour pouvoir vous appeler le jour du live.
            Nous l’utilisons aussi pour écarter les personnes bloquées. Jamais affiché
            publiquement.
          </li>
          <li>
            <strong className="text-slate-700">Photo de profil (facultative)</strong> —
            visible uniquement par l’ambassadeur que vous contactez. Jamais publiée sur
            la carte ni ailleurs sur le site.
          </li>
          <li>
            <strong className="text-slate-700">Votre message et le nombre de
            personnes</strong> — transmis à l’ambassadeur avec votre demande.
          </li>
        </ul>
        <p className="font-medium text-slate-700 mt-4 mb-1.5">Si vous ouvrez votre maison</p>
        <ul className="space-y-1.5 list-disc pl-5">
          <li>
            <strong className="text-slate-700">Identité et coordonnées</strong> — pour
            vous contacter et valider votre candidature.
          </li>
          <li>
            <strong className="text-slate-700">Ville et quartier</strong> — affichés
            publiquement sur la carte, pour que les visiteurs vous trouvent.
          </li>
          <li>
            <strong className="text-slate-700">Adresse précise</strong> — jamais
            affichée sur la carte. Elle sert uniquement à calculer une distance
            approximative, et n’est transmise à un visiteur qu’au moment où{' '}
            <em>vous</em> acceptez sa demande.
          </li>
          <li>
            <strong className="text-slate-700">Photo de profil</strong> — vue par
            l’équipe pour valider votre candidature, puis affichée en petit sur la
            carte publique tant que votre ambassade est active.
          </li>
          <li>
            <strong className="text-slate-700">Photos de votre lieu</strong> — stockées
            de façon privée, visibles par vous et par l’équipe.
          </li>
          <li>
            <strong className="text-slate-700">Réponses de présentation</strong> —
            fréquentation d’une église, dénomination, fonction de responsabilité,
            formations et livres, guérisons vues. Elles touchent à vos convictions
            religieuses : vous les donnez volontairement, elles ne sont vues que par
            l’équipe et ne sont jamais publiées.
          </li>
          <li>
            <strong className="text-slate-700">Vidéo de présentation</strong> —
            enregistrée dans un espace privé, visible uniquement par les
            administrateurs, jamais publiée. Vous pouvez en demander la suppression
            à tout moment.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Ce que nous ne faisons pas',
    body: (
      <ul className="space-y-1.5 list-disc pl-5">
        <li>Nous ne vendons aucune donnée, à personne, jamais.</li>
        <li>Nous n’affichons jamais l’adresse d’un ambassadeur sur la carte publique.</li>
        <li>
          Nous n’enregistrons jamais votre position. Si vous utilisez « Trier par
          distance », votre position est utilisée le temps du calcul puis oubliée — le
          résultat est arrondi au kilomètre.
        </li>
        <li>Nous n’utilisons pas de cookies publicitaires ni de traceurs tiers.</li>
        <li>
          Nous ne publions jamais la photo d’un visiteur. Elle n’est visible que par
          l’ambassadeur que vous avez contacté.
        </li>
      </ul>
    ),
  },
  {
    title: 'Sur quelle base légale',
    body: (
      <ul className="space-y-2 list-disc pl-5">
        <li>
          <strong className="text-slate-700">Votre consentement</strong> — pour la
          photo de profil (facultative) et pour recevoir l’annonce des prochains lives.
          Vous pouvez le retirer à tout moment, sans avoir à vous justifier.
        </li>
        <li>
          <strong className="text-slate-700">L’exécution de votre demande</strong> —
          prénom, e-mail et téléphone sont nécessaires pour qu’une rencontre puisse
          s’organiser. Sans eux, l’ambassadeur ne peut ni vous répondre ni vous
          accueillir. Le téléphone n’est transmis à l’ambassadeur qu’après son accord.
        </li>
        <li>
          <strong className="text-slate-700">Notre intérêt légitime</strong> — pour la
          sécurité des personnes qui ouvrent leur maison (prévention des abus). Par
          exemple, votre numéro permet de refuser une demande venant d’une personne
          déjà bloquée.
        </li>
      </ul>
    ),
  },
  {
    title: 'Combien de temps nous les gardons',
    body: (
      <>
        <ul className="space-y-1.5 list-disc pl-5">
          <li>
            <strong className="text-slate-700">Demandes de visite</strong> —{' '}
            {DUREE_DEMANDES}.
          </li>
          <li>
            <strong className="text-slate-700">Compte visiteur</strong> —{' '}
            {DUREE_COMPTE}. Vous pouvez demander sa suppression avant ce délai.
          </li>
          <li>
            <strong className="text-slate-700">Témoignages publiés</strong> —{' '}
            {DUREE_TEMOIGNAGES}.
          </li>
          <li>
            <strong className="text-slate-700">Profil d’ambassadeur</strong> — tant que
            l’ambassade est active, puis 12 mois après son retrait.
          </li>
        </ul>
        <p className="mt-3 text-slate-400">
          Passé ces délais, les données sont supprimées. Vous pouvez demander une
          suppression à tout moment, sans attendre.
        </p>
      </>
    ),
  },
  {
    title: 'Vos droits',
    body: (
      <>
        <p className="mb-3">
          Vous pouvez à tout moment demander :
        </p>
        <ul className="space-y-1.5 list-disc pl-5">
          <li>
            <strong className="text-slate-700">à voir</strong> les données que nous
            avons sur vous ;
          </li>
          <li>
            <strong className="text-slate-700">à les corriger</strong> si elles sont
            inexactes ;
          </li>
          <li>
            <strong className="text-slate-700">à les supprimer</strong> ;
          </li>
          <li>
            <strong className="text-slate-700">à vous opposer</strong> à un usage
            particulier, ou à en limiter la portée ;
          </li>
          <li>
            <strong className="text-slate-700">à retirer votre consentement</strong>,
            à tout moment.
          </li>
        </ul>
        <p className="mt-3">
          Une partie est déjà faisable directement : depuis{' '}
          <Link href="/mon-espace" className="text-indigo-600 hover:underline">
            votre espace
          </Link>
          , vous pouvez modifier votre téléphone et votre photo. Chaque e-mail
          d’annonce contient un lien de désinscription.
        </p>
        <p className="mt-3">
          Pour tout le reste, écrivez à{' '}
          <strong className="text-slate-700">{CONTACT_EMAIL}</strong>. Nous répondons
          sous un mois.
        </p>
        <p className="mt-3 text-slate-400">
          Si notre réponse ne vous satisfait pas, vous pouvez saisir la CNIL —
          l’autorité française de protection des données —{' '}
          <a
            href="https://www.cnil.fr/fr/plaintes"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            cnil.fr/fr/plaintes
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: 'Qui héberge et traite les données pour nous',
    body: (
      <>
        <p className="mb-3">
          Nous nous appuyons sur quelques prestataires techniques, chacun pour une
          tâche précise :
        </p>
        <ul className="space-y-1.5 list-disc pl-5">
          <li>
            <strong className="text-slate-700">Supabase</strong> — base de données et
            stockage des photos.
          </li>
          <li>
            <strong className="text-slate-700">Vercel</strong> — hébergement du site.
          </li>
          <li>
            <strong className="text-slate-700">Resend</strong> — envoi des e-mails.
          </li>
          <li>
            <strong className="text-slate-700">OpenStreetMap / Nominatim</strong> —
            conversion d’un nom de ville en position sur la carte.
          </li>
        </ul>
        <p className="mt-3 text-slate-400">
          Aucun de ces prestataires n’est autorisé à utiliser vos données pour son
          propre compte.
        </p>
      </>
    ),
  },
  {
    title: 'Mineurs',
    body: (
      <p>
        Ce site s’adresse à des personnes majeures. Un mineur peut participer à une
        rencontre accompagné d’un parent ou d’un adulte responsable, mais la demande
        doit être faite depuis le compte de cet adulte.
      </p>
    ),
  },
];

export default function ConfidentialitePage() {
  return (
    <>
      <AppHeader />
      <main className="flex-1 bg-slate-50">
        <div className="max-w-lg mx-auto px-4 py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Retour à la carte
          </Link>

          <div className="flex items-start gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">
                Politique de confidentialité
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Ce que nous collectons, pourquoi, et ce que vous pouvez en faire.
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-500 leading-relaxed mt-5 bg-white rounded-2xl border border-slate-100 p-4">
            Ouvrir sa maison à un inconnu, ou frapper à la porte de quelqu’un qu’on ne
            connaît pas, demande de la confiance. Cette page existe pour que cette
            confiance repose sur du concret : vous saurez exactement ce que nous savons
            de vous, et ce que nous n’en faisons pas.
          </p>

          <div className="mt-5 space-y-3">
            {SECTIONS.map((section) => (
              <section
                key={section.title}
                className="bg-white rounded-2xl border border-slate-100 p-5"
              >
                <h2 className="text-base font-semibold text-slate-800 mb-2.5">
                  {section.title}
                </h2>
                <div className="text-sm text-slate-500 leading-relaxed">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <p className="text-xs text-slate-400 mt-6 text-center">
            Une question sur vos données ?{' '}
            <Link href="/contact-equipe" className="text-indigo-600 hover:underline">
              Contactez l’équipe
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}

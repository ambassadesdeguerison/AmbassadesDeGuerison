import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

interface Props {
  email: string;
  /** La personne a une session ouverte avec cette même adresse : inutile de lui demander de se connecter. */
  connected: boolean;
}

// Écran affiché après l'envoi du formulaire « Devenir ambassadeur ».
// Déjà connecté (même adresse) : on enchaîne directement sur l'espace ambassadeur.
// Sinon : l'e-mail reçu contient le lien de connexion, ou on renvoie vers /auth.
export default function InscriptionSuccess({ email, connected }: Props) {
  return (
    <div className="max-w-lg mx-auto text-center py-16">
      <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <CheckCircle2 className="w-7 h-7 text-emerald-600" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Votre demande est bien reçue !</h2>
      {connected ? (
        <p className="text-slate-500 text-sm max-w-sm mx-auto">
          Il reste trois choses à faire : regarder la courte vidéo de formation, confirmer votre engagement,
          puis vous présenter à David et à son équipe. Nous avons aussi écrit à{' '}
          <span className="font-medium text-slate-700">{email}</span>.
        </p>
      ) : (
        <>
          <p className="text-slate-500 text-sm max-w-sm mx-auto mb-1">
            Nous venons d&apos;écrire à <span className="font-medium text-slate-700">{email}</span>.
          </p>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            Appuyez sur le bouton dans ce message pour vous connecter et continuer : courte vidéo de formation,
            engagement, puis votre présentation.
          </p>
        </>
      )}
      <Link
        href={connected ? '/dashboard' : '/auth'}
        className="mt-6 inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
      >
        {connected ? 'Continuer mon inscription' : 'Me connecter pour continuer'}
      </Link>
      <div className="mt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-slate-500 text-sm hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour à la carte
        </Link>
      </div>
    </div>
  );
}

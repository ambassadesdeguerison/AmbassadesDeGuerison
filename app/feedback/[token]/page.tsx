import { notFound } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { createServiceClient } from '@/lib/supabase/server';
import { de } from '@/lib/elision';
import AppHeader from '@/components/AppHeader';
import FeedbackForm from './FeedbackForm';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function FeedbackPage({ params }: Props) {
  const { token } = await params;
  const supabase = createServiceClient();

  // Le token est le `visitor_token` d'un contact_request (jamais `action_token`, réservé à l'hôte).
  // Le feedback hôte → visiteur a sa propre page : /feedback/host/[token].
  const { data: contact } = await supabase
    .from('contact_requests')
    .select(`
      id, status, visitor_email, visitor_first_name,
      host_activations!inner(
        event_id,
        host_profile_id,
        events!inner(id, title, event_date),
        host_profiles!inner(first_name)
      )
    `)
    .eq('visitor_token', token)
    .maybeSingle();

  if (!contact || contact.status !== 'accepted') notFound();

  const ha = Array.isArray(contact.host_activations) ? contact.host_activations[0] : contact.host_activations;
  const event = Array.isArray(ha?.events) ? ha.events[0] : ha?.events;
  const host = Array.isArray(ha?.host_profiles) ? ha.host_profiles[0] : ha?.host_profiles;

  const eventDate = event?.event_date
    ? new Date(event.event_date).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long',
      })
    : '';

  // Avis déjà donné : on le dit AVANT le formulaire plutôt que de laisser le
  // visiteur tout ressaisir pour finir sur un « Feedback déjà soumis » rouge en
  // bas de page (la contrainte `live_feedbacks_unique` rejette l'insert, donc la
  // saisie était simplement perdue). Même garde que la page hôte, qui retire
  // déjà les visiteurs notés de sa liste. Trouvé en QA le 2026-08-07.
  const { data: existingFeedback } = await supabase
    .from('live_feedbacks')
    .select('id')
    .eq('event_id', ha?.event_id ?? '')
    .eq('host_profile_id', ha?.host_profile_id ?? '')
    .eq('visitor_email', contact.visitor_email.trim().toLowerCase())
    .eq('direction', 'visitor_to_host')
    .maybeSingle();

  return (
    <>
      <AppHeader />
      <main className="bg-slate-50 px-4 py-5 flex-1">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Votre avis</p>
            <h1 className="text-lg font-semibold text-slate-800 mb-0.5">
              Live du {eventDate}
            </h1>
            <p className="text-slate-500 text-sm">Ambassade {de(host?.first_name)}</p>
          </div>

          {existingFeedback ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
              <p className="text-slate-800 font-semibold text-lg mb-2">Vous avez déjà donné votre avis</p>
              <p className="text-slate-500 text-sm leading-relaxed">
                Merci ! Votre retour pour ce live a bien été enregistré.
              </p>
            </div>
          ) : (
            <FeedbackForm
              eventId={ha?.event_id ?? ''}
              hostProfileId={ha?.host_profile_id ?? ''}
              contactRequestId={contact.id}
              visitorEmail={contact.visitor_email}
              direction="visitor_to_host"
            />
          )}
        </div>
      </main>
    </>
  );
}

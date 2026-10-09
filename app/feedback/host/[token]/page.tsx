import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import AppHeader from '@/components/AppHeader';
import HostFeedbackForm from './HostFeedbackForm';

interface Props {
  params: Promise<{ token: string }>;
}

// Token = host_activations.id — pas de nouvelle colonne, réutilise l'ID déjà
// unique par (host, event). Un hôte a pu accueillir plusieurs visiteurs pour
// ce live : une carte de feedback par visiteur, sur la même page.
export default async function HostFeedbackPage({ params }: Props) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: activation } = await supabase
    .from('host_activations')
    .select(`
      id, event_id, host_profile_id,
      events!inner(id, title),
      host_profiles!inner(first_name)
    `)
    .eq('id', token)
    .maybeSingle();

  if (!activation) notFound();

  const event = Array.isArray(activation.events) ? activation.events[0] : activation.events;
  const host = Array.isArray(activation.host_profiles) ? activation.host_profiles[0] : activation.host_profiles;

  const { data: contacts } = await supabase
    .from('contact_requests')
    .select('id, visitor_first_name, visitor_email, visitor_phone')
    .eq('host_activation_id', activation.id)
    .eq('status', 'accepted');

  // Feedbacks déjà soumis pour ne pas re-proposer un visiteur déjà noté
  const { data: existing } = await supabase
    .from('live_feedbacks')
    .select('visitor_email')
    .eq('event_id', activation.event_id)
    .eq('host_profile_id', activation.host_profile_id)
    .eq('direction', 'host_to_visitor');

  const alreadyDone = new Set((existing ?? []).map((f) => f.visitor_email));
  const pending = (contacts ?? []).filter((c) => !alreadyDone.has(c.visitor_email));

  return (
    <>
      <AppHeader />
      <main className="bg-slate-50 px-4 py-5 flex-1">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Votre avis</p>
            <h1 className="text-lg font-semibold text-slate-800 mb-0.5">{event?.title}</h1>
            <p className="text-slate-500 text-sm">Bonjour {host?.first_name}, comment s&apos;est passé votre accueil ?</p>
          </div>

          {pending.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
              <p className="text-slate-600 text-sm">
                {contacts?.length ? 'Merci, vous avez déjà donné votre avis pour tous vos visiteurs.' : "Vous n'avez accueilli personne pour ce live."}
              </p>
            </div>
          ) : (
            pending.map((c) => (
              <HostFeedbackForm
                key={c.id}
                eventId={activation.event_id}
                hostProfileId={activation.host_profile_id}
                contactRequestId={c.id}
                visitorEmail={c.visitor_email}
                visitorPhone={c.visitor_phone}
                visitorFirstName={c.visitor_first_name}
              />
            ))
          )}
        </div>
      </main>
    </>
  );
}

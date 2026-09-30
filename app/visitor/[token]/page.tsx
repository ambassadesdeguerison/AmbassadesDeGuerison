import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import AppHeader from '@/components/AppHeader';
import { CheckCircle2, Clock, MapPin, AlertCircle } from 'lucide-react';
import { formatEventDateDual } from '@/lib/format-event-date';
import { de } from '@/lib/elision';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function VisitorConfirmationPage({ params }: Props) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: contact } = await supabase
    .from('contact_requests')
    .select(`
      id, status, visitor_first_name,
      host_activations!inner(
        events!inner(title, event_date),
        host_profiles!inner(first_name, city)
      )
    `)
    .eq('action_token', token)
    .maybeSingle();

  if (!contact) notFound();

  const ha = Array.isArray(contact.host_activations) ? contact.host_activations[0] : contact.host_activations;
  const event = Array.isArray(ha?.events) ? ha.events[0] : ha?.events;
  const host = Array.isArray(ha?.host_profiles) ? ha.host_profiles[0] : ha?.host_profiles;

  const status = contact.status as string;

  const steps = [
    {
      id: 'sent',
      label: 'Demande envoyée',
      icon: CheckCircle2,
      done: true,
      current: status === 'pending',
      detail: `${host?.first_name ?? "L'ambassadeur"} a reçu votre demande.`,
    },
    {
      id: 'reply',
      label: `${host?.first_name ?? "L'ambassadeur"} répond`,
      icon: Clock,
      done: ['accepted', 'declined'].includes(status),
      current: status === 'pending',
      detail: status === 'accepted'
        ? 'Demande acceptée !'
        : status === 'declined'
        ? 'Demande non retenue cette fois.'
        : 'Dès que possible.',
    },
    {
      id: 'address',
      label: 'Adresse à venir',
      icon: MapPin,
      done: status === 'accepted',
      current: status === 'accepted',
      detail: status === 'accepted'
        ? `Vous recevrez les coordonnées de ${host?.first_name ?? "l'ambassadeur"} par e-mail.`
        : 'Transmise par e-mail à la confirmation.',
    },
  ];

  const eventDate = event?.event_date ? formatEventDateDual(event.event_date) : '';

  return (
    <>
      <AppHeader />
      <main className="bg-slate-50 px-4 py-5 flex-1">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Event info */}
          {event && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Votre demande</p>
              <p className="text-slate-800 font-medium text-sm">{event.title}</p>
              <p className="text-slate-500 text-xs mt-0.5">{eventDate} — ambassade {de(host?.first_name)}, {host?.city}</p>
            </div>
          )}

          {/* Barre 3 étapes */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <nav aria-label="Progression de votre demande">
              <ol className="space-y-4">
                {steps.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <li
                      key={step.id}
                      className="flex items-start gap-4"
                      aria-current={step.current ? 'step' : undefined}
                    >
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            step.done
                              ? 'bg-indigo-600 text-white'
                              : step.current
                              ? 'bg-indigo-50 text-indigo-600 border-2 border-indigo-600'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        {i < steps.length - 1 && (
                          <div className={`w-0.5 h-4 mt-1 ${step.done ? 'bg-indigo-200' : 'bg-slate-100'}`} />
                        )}
                      </div>
                      {/* Content */}
                      <div className="pb-4">
                        <p className={`text-sm font-medium ${step.done || step.current ? 'text-slate-800' : 'text-slate-400'}`}>
                          {step.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{step.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>

          {/* Statut declined */}
          {status === 'declined' && (
            <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 text-center">
              <p className="text-amber-800 text-sm font-medium mb-2">
                Pas de place cette fois
              </p>
              <p className="text-amber-700 text-xs mb-4">
                D&apos;autres ambassades sont peut-être disponibles près de chez vous.
              </p>
              <Link
                href="/"
                className="inline-block bg-indigo-600 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Voir la carte
              </Link>
            </div>
          )}

          {/* Lien aide */}
          <div className="text-center">
            <Link
              href={`/contact-equipe?token=${token}`}
              className="inline-flex items-center gap-1.5 text-slate-400 text-xs hover:text-slate-600 transition-colors"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Quelque chose ne va pas ?
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

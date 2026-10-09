// Tri des demandes de visite d'un visiteur pour l'onglet « Demandes » de /mon-espace.
//
// Le plafond `max_requests_per_visitor_per_event` limite à quelques demandes en cours par live :
// la liste « en cours » reste courte par construction, c'est l'historique qui grossit. D'où
// deux groupes : ce qui demande encore l'attention du visiteur, et le reste (replié à l'écran).

export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled_no_response';

export interface VisitorRequest {
  id: string;
  status: RequestStatus;
  nb_personnes: number;
  created_at: string;
  event_id: string | null;
  event_title: string | null;
  event_date: string | null;
  event_closed_at: string | null;
  // Jeton du VISITEUR (/visitor/[token], /feedback/[token]) : il ne donne aucun pouvoir
  // d'acceptation. Ne jamais y mettre `action_token`, qui appartient à l'hôte.
  visitor_token: string;
  host_first_name: string | null;
  host_city: string | null;
  host_country: string | null;
}

// Même fenêtre « live en cours » que le reste de l'app (carte, dashboard).
export const DEFAULT_LIVE_WINDOW_HOURS = 4;

export function liveWindowHours(): number {
  const parsed = Number(process.env.NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS ?? DEFAULT_LIVE_WINDOW_HOURS);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_LIVE_WINDOW_HOURS;
}

// Un live est terminé s'il a été clôturé, ou une fois sa fenêtre horaire écoulée. Une demande
// dont on ne connaît pas la date est rangée avec le passé : on ne peut rien en attendre.
export function isLiveOver(
  r: Pick<VisitorRequest, 'event_date' | 'event_closed_at'>,
  now: Date,
  windowHours: number = liveWindowHours(),
): boolean {
  if (r.event_closed_at) return true;
  if (!r.event_date) return true;
  return new Date(r.event_date).getTime() + windowHours * 3_600_000 < now.getTime();
}

export type RequestAction = 'track' | 'details' | 'feedback' | 'find_other' | null;

// L'action proposée sur une carte, selon le statut et le moment.
export function requestAction(
  r: Pick<VisitorRequest, 'status' | 'event_date' | 'event_closed_at'>,
  now: Date,
  windowHours: number = liveWindowHours(),
): RequestAction {
  const over = isLiveOver(r, now, windowHours);
  switch (r.status) {
    case 'pending':
      return over ? null : 'track';
    case 'accepted':
      return over ? 'feedback' : 'details';
    case 'declined':
    case 'cancelled_no_response':
      return over ? null : 'find_other';
    default:
      return null;
  }
}

// Statut à AFFICHER : une demande restée « en attente » alors que le live est passé ne recevra
// plus de réponse — la présenter comme « en attente » induirait en erreur.
export function displayStatus(
  r: Pick<VisitorRequest, 'status' | 'event_date' | 'event_closed_at'>,
  now: Date,
  windowHours: number = liveWindowHours(),
): RequestStatus {
  return r.status === 'pending' && isLiveOver(r, now, windowHours) ? 'cancelled_no_response' : r.status;
}

export interface GroupedRequests {
  active: VisitorRequest[];
  history: VisitorRequest[];
  pendingCount: number;
  acceptedCount: number;
}

function time(value: string | null, fallback: string): number {
  return new Date(value ?? fallback).getTime();
}

function newestCreatedFirst(a: VisitorRequest, b: VisitorRequest): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function groupRequests(
  requests: VisitorRequest[],
  now: Date = new Date(),
  windowHours: number = liveWindowHours(),
): GroupedRequests {
  const active: VisitorRequest[] = [];
  const history: VisitorRequest[] = [];

  for (const r of requests) {
    const live = !isLiveOver(r, now, windowHours);
    if (live && (r.status === 'pending' || r.status === 'accepted')) active.push(r);
    else history.push(r);
  }

  // En cours : le live le plus proche d'abord ; à date égale, l'acceptée avant l'en-attente.
  active.sort((a, b) => {
    const byDate = time(a.event_date, a.created_at) - time(b.event_date, b.created_at);
    if (byDate !== 0) return byDate;
    if (a.status !== b.status) return a.status === 'accepted' ? -1 : 1;
    return newestCreatedFirst(a, b);
  });

  // Historique : le plus récent d'abord.
  history.sort((a, b) => {
    const byDate = time(b.event_date, b.created_at) - time(a.event_date, a.created_at);
    return byDate !== 0 ? byDate : newestCreatedFirst(a, b);
  });

  return {
    active,
    history,
    pendingCount: active.filter((r) => r.status === 'pending').length,
    acceptedCount: active.filter((r) => r.status === 'accepted').length,
  };
}

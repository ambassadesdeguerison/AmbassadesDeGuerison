'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, Copy, Home, LogOut, Share2,
  MessageSquare, Send, ExternalLink, Play, UserCheck, UserX, Camera,
  Calendar, Loader2, Download,
} from 'lucide-react';
import Dropzone from '@/components/ui/Dropzone';
import Avatar from '@/components/ui/Avatar';
import StatusTimeline from '@/components/dashboard/StatusTimeline';
import MissionDuMoment from '@/components/dashboard/MissionDuMoment';
import { participationLabels } from '@/lib/dashboard/participation-labels';
import DashboardTabs, { type DashboardTab } from '@/components/dashboard/DashboardTabs';
import MesInfosSection from '@/app/dashboard/MesInfosSection';
import DeclineChoice from '@/components/DeclineChoice';
import { useToast } from '@/components/ui/Toast';
import { requestActionFeedback } from '@/lib/dashboard/request-action-feedback';
import { useBrowserTimezone } from '@/lib/hooks/use-browser-timezone';

const LIVE_WINDOW_HOURS = parseInt(process.env.NEXT_PUBLIC_LIVE_SIGNAL_WINDOW_HOURS ?? '4');
import Link from 'next/link';
import { ONBOARDING } from '@/config/onboarding';
import { buildVideoUrl } from '@/lib/youtube';
import { isDossierComplet } from '@/lib/host-profile';

interface HostProfile {
  id: string;
  first_name: string;
  city: string;
  country: string;
  status: string;
  email: string;
  profile_photo_url: string | null;
  room_photo_urls: string[] | null;
  address_private: string | null;
  consignes: string | null;
  phone: string | null;
  host_type?: string | null;
}

interface Activation {
  id: string;
  is_active: boolean;
  is_full: boolean;
  event_id: string;
  events: { title: string; event_date: string } | null;
}

interface ContactRequest {
  id: string;
  visitor_first_name: string;
  visitor_email: string;
  visitor_phone: string | null;
  visitor_message: string;
  nb_personnes: number | null;
  status: string;
  created_at: string;
  action_token: string;
  host_activation_id: string | null;
  visitor_profile_id: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const tzLabel = useBrowserTimezone();
  const [profile, setProfile] = useState<HostProfile | null>(null);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [onboardingConfig, setOnboardingConfig] = useState({
    video_url: ONBOARDING.VIDEO_URL,
    pdf_url:   ONBOARDING.PDF_PATH,
  });

  // Live signal
  const [signalDescription, setSignalDescription] = useState('');
  const [signalSent, setSignalSent] = useState(false);
  const [signalLoading, setSignalLoading] = useState(false);
  const [approvedLiveLink, setApprovedLiveLink] = useState<string | null>(null);

  // Share ambassade
  const [linkCopied, setLinkCopied] = useState(false);

  // Testimonial
  const [testimonialContent, setTestimonialContent] = useState('');
  const [testimonialSubmitting, setTestimonialSubmitting] = useState(false);
  const [testimonialsSentCount, setTestimonialsSentCount] = useState(0);
  const [testimonialError, setTestimonialError] = useState('');

  // Accept/decline loading state
  const [requestActionLoading, setRequestActionLoading] = useState<{ token: string; action: 'accept' | 'decline'; permanent?: boolean } | null>(null);
  // Demande dont le panneau « Refuser » est ouvert (une seule à la fois).
  const [decliningToken, setDecliningToken] = useState<string | null>(null);

  // Photos visiteur (Phase 3 PR3) — signed URLs récupérées via une route
  // dédiée (ownership vérifié serveur), et signalements en cours (optimiste).
  const [visitorPhotoUrls, setVisitorPhotoUrls] = useState<Record<string, string>>({});
  // « Sans photo » n'est affiché qu'une fois la réponse reçue : jamais pendant le
  // chargement ni après un échec réseau, pour ne pas affirmer à tort qu'il n'y en a pas.
  const [visitorPhotosLoaded, setVisitorPhotosLoaded] = useState(false);
  const [reportedPhotoIds, setReportedPhotoIds] = useState<Set<string>>(new Set());

  // Photos upload
  const [photoUploading, setPhotoUploading] = useState<'profile' | 'room' | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [photoSignedUrls, setPhotoSignedUrls] = useState<Record<string, string>>({});
  const [showPhotosEdit, setShowPhotosEdit] = useState(false);

  // Onglet actif — navigation du dashboard une fois validé
  const [activeTab, setActiveTab] = useState<DashboardTab>('accueil');

  // Gate onboarding (vidéo + PDF + accept) — uniquement pour pending_review
  const [videoStarted, setVideoStarted] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');

  // Event courant — uniquement dans la fenêtre live (±LIVE_WINDOW_HOURS autour de event_date)
  const [currentEvent, setCurrentEvent] = useState<{ id: string; live_link: string | null } | null>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/auth'); return; }

    // Un visiteur connecté (Phase 2bis) n'a pas de host_profile — le renvoyer
    // vers son propre espace plutôt que vers /auth (qui bouclerait : déjà
    // connecté, rien à confirmer).
    if (user.user_metadata?.role === 'visitor') { router.replace('/mon-espace'); return; }

    const { data: prof } = await supabase
      .from('host_profiles')
      .select('id, first_name, city, country, status, email, profile_photo_url, room_photo_urls, address_private, consignes, phone, quartier, presentation_message, host_type, is_women_only')
      .eq('user_id', user.id)
      .maybeSingle();

    // Connecté sans profil ambassadeur : /auth l'explique et propose de s'inscrire.
    if (!prof) { router.replace('/auth'); return; }

    const { data: acts } = await supabase
      .from('host_activations')
      .select('id, is_active, is_full, event_id, events(title, event_date)')
      .eq('host_profile_id', prof.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const activationIds = (acts ?? []).map((a) => a.id);
    const { data: reqs } = activationIds.length > 0
      ? await supabase
          .from('contact_requests')
          .select('id, visitor_first_name, visitor_email, visitor_phone, visitor_message, nb_personnes, status, created_at, action_token, host_activation_id, visitor_profile_id')
          .in('host_activation_id', activationIds)
          .order('created_at', { ascending: false })
          .limit(20)
      : { data: [] };

    const idsWithPhoto = (reqs ?? []).filter((r) => r.visitor_profile_id).map((r) => r.id);
    if (idsWithPhoto.length > 0) {
      fetch('/api/dashboard/contact-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_request_ids: idsWithPhoto }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((urls) => {
          setVisitorPhotoUrls(urls);
          setVisitorPhotosLoaded(true);
        })
        .catch(() => {});
    } else {
      setVisitorPhotosLoaded(true);
    }

    const windowMs = LIVE_WINDOW_HOURS * 60 * 60 * 1000;
    const now = new Date();
    const { data: activeEvent } = await supabase
      .from('events')
      .select('id, live_link')
      .gte('event_date', new Date(now.getTime() - windowMs).toISOString())
      .lte('event_date', new Date(now.getTime() + windowMs).toISOString())
      .order('event_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const event = activeEvent ? { id: activeEvent.id, live_link: activeEvent.live_link ?? null } : null;

    if (event) {
      const { data: approved } = await supabase
        .from('live_signals')
        .select('id')
        .eq('host_profile_id', prof.id)
        .eq('event_id', event.id)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();
      if (approved) setApprovedLiveLink(event.live_link);
    }

    setProfile(prof);
    setActivations((acts as unknown as Activation[]) ?? []);
    setContactRequests(reqs ?? []);
    setCurrentEvent(event);

    const paths = [prof.profile_photo_url, ...(prof.room_photo_urls ?? [])].filter(Boolean) as string[];
    if (paths.length > 0) {
      const entries = await Promise.all(
        paths.map(async (p) => {
          if (p.startsWith('http')) return [p, p] as const;
          const { data } = await supabase.storage.from('ambassador-photos').createSignedUrl(p, 900);
          return [p, data?.signedUrl ?? ''] as const;
        })
      );
      setPhotoSignedUrls(Object.fromEntries(entries.filter(([, url]) => url)));
    }

    setLoading(false);
  }, [router, supabase]);

  // Différé d'un tick : `load` met à jour l'état, ce qu'un effet ne doit pas faire de façon synchrone.
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Poll toutes les 5s pour détecter l'approbation de David quand un signal est en attente
  useEffect(() => {
    if (!signalSent || !profile || !currentEvent) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('live_signals')
        .select('id')
        .eq('host_profile_id', profile.id)
        .eq('event_id', currentEvent.id)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();
      if (data) {
        setApprovedLiveLink(currentEvent.live_link);
        setSignalSent(false);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [signalSent, profile, currentEvent, supabase]);

  useEffect(() => {
    fetch('/api/onboarding/config')
      .then((r) => r.json())
      .then((d) => setOnboardingConfig({ video_url: d.video_url, pdf_url: d.pdf_url }))
      .catch(() => {});
  }, []);

  // Détection du clic dans l'iframe YouTube — débloque la checkbox d'engagement
  useEffect(() => {
    if (profile?.status !== 'pending_review') return;
    function onBlur() {
      if (document.activeElement instanceof HTMLIFrameElement) {
        setVideoStarted(true);
      }
    }
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [profile?.status]);

  async function handleOnboardingComplete() {
    if (!onboardingChecked || onboardingSubmitting) return;
    setOnboardingSubmitting(true);
    setOnboardingError('');

    const res = await fetch('/api/onboarding/complete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setOnboardingError(data.error ?? 'Une erreur est survenue. Réessayez.');
      setOnboardingSubmitting(false);
      return;
    }

    await load();
    setOnboardingSubmitting(false);
  }

  async function toggleActivation(id: string, currentValue: boolean) {
    const labels = participationLabels(profile?.host_type);
    try {
      const res = await fetch(`/api/host-activations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentValue }),
      });
      if (!res.ok) {
        // L'état local basculait même si l'enregistrement avait échoué : la carte
        // publique ne suivait pas, et rien ne le disait à l'ambassadeur.
        toast.error("Votre choix n'a pas été enregistré", { description: 'Réessayez dans un instant.' });
        return;
      }
      setActivations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: !currentValue } : a))
      );
      if (currentValue) {
        toast.success("C'est noté", {
          description: "Vous n'accueillez pas pour ce live. Vous n'apparaissez plus sur la carte.",
        });
      } else {
        toast.success(labels.joined, { description: 'Vous apparaissez maintenant sur la carte pour ce live.' });
      }
    } catch {
      toast.error('Connexion impossible', { description: 'Vérifiez votre connexion Internet, puis réessayez.' });
    }
  }

  async function sendLiveSignal() {
    if (!signalDescription.trim() || !profile || !currentEvent) return;
    setSignalLoading(true);
    try {
      const res = await fetch('/api/live-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_profile_id: profile.id,
          event_id: currentEvent.id,
          description: signalDescription.trim(),
        }),
      });
      if (!res.ok) {
        // Le signal était affiché « envoyé » même quand l'API l'avait refusé :
        // l'ambassadeur attendait une réponse de David qui ne viendrait jamais.
        const data = await res.json().catch(() => ({}));
        toast.error("Votre témoignage n'a pas été envoyé", {
          description: data.error ?? 'Votre texte est conservé. Réessayez dans un instant.',
        });
        return;
      }
      setSignalSent(true);
      setSignalDescription('');
      toast.success('Témoignage envoyé', { description: 'David le reçoit tout de suite et vous répond bientôt.' });
    } catch {
      toast.error('Connexion impossible', { description: 'Votre texte est conservé. Réessayez dans un instant.' });
    } finally {
      setSignalLoading(false);
    }
  }

  async function copyAmbassadeLink() {
    if (!profile) return;
    const url = `${window.location.origin}/ambassade/${profile.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* fallback ignored */ }
  }

  function shareOnWhatsApp() {
    if (!profile) return;
    const url = `${window.location.origin}/ambassade/${profile.id}`;
    const text = encodeURIComponent(
      `Je suis ambassadeur des lives de guérison avec David Théry 🙏\nRejoignez-nous à ${profile.city} !\n${url}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  async function submitTestimonial() {
    if (!testimonialContent.trim() || !profile || !currentEvent) return;
    setTestimonialSubmitting(true);
    setTestimonialError('');
    try {
      const res = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_profile_id: profile.id,
          event_id: currentEvent.id,
          content: testimonialContent.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setTestimonialError(d.error ?? 'Erreur lors de l\'envoi.');
      } else {
        setTestimonialsSentCount((n) => n + 1);
        setTestimonialContent('');
      }
    } catch {
      setTestimonialError('Erreur réseau.');
    }
    setTestimonialSubmitting(false);
  }

  async function uploadPhoto(file: File, type: 'profile' | 'room') {
    setPhotoUploading(type);
    setPhotoError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', type);
    const res = await fetch('/api/upload/ambassador-photo', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      setPhotoError(data.error ?? 'Erreur lors de l\'upload.');
    } else {
      const { path, url } = data;
      setProfile((prev) => {
        if (!prev) return prev;
        if (type === 'profile') return { ...prev, profile_photo_url: path };
        return { ...prev, room_photo_urls: [...(prev.room_photo_urls ?? []), path] };
      });
      if (path && url) {
        setPhotoSignedUrls((prev) => ({ ...prev, [path]: url }));
      }
    }
    setPhotoUploading(null);
  }

  function removeRoomPhoto(url: string) {
    setProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, room_photo_urls: (prev.room_photo_urls ?? []).filter((u) => u !== url) };
    });
  }

  async function handleReportPhoto(contactRequestId: string) {
    setReportedPhotoIds((prev) => new Set(prev).add(contactRequestId));
    await fetch('/api/dashboard/report-visitor-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_request_id: contactRequestId }),
    }).catch(() => {});
  }

  async function handleContactAction(token: string, action: 'accept' | 'decline', permanent = false) {
    setRequestActionLoading({ token, action, permanent });
    const request = contactRequests.find((r) => r.action_token === token);
    try {
      const res = await fetch(`/api/visit-requests/${token}/${action}`, {
        method: 'POST',
        ...(action === 'decline' && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permanent }) }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Avant, l'échec ne laissait aucune trace : le bouton se rouvrait et
        // l'ambassadeur ne savait pas si sa réponse avait été prise en compte.
        toast.error("Votre réponse n'a pas été enregistrée", {
          description: data.error ?? 'Réessayez dans un instant.',
        });
        return;
      }

      // L'API répond 200 « déjà traitée » (autre appareil, lien de l'e-mail) :
      // afficher le vrai statut plutôt que celui du bouton cliqué.
      if (data.message) {
        setContactRequests((prev) =>
          prev.map((r) => (r.action_token === token ? { ...r, status: data.status ?? r.status } : r))
        );
        toast.info('Cette demande avait déjà reçu une réponse', {
          description: "Rien n'a été modifié.",
        });
        return;
      }

      const newStatus = action === 'accept' ? 'accepted' : 'declined';
      setContactRequests((prev) =>
        prev.map((r) => (r.action_token === token ? { ...r, status: newStatus } : r))
      );
      const { tone, title, description } = requestActionFeedback({
        action,
        permanent,
        emailSent: data.emailSent,
        visitorFirstName: request?.visitor_first_name ?? '',
      });
      toast[tone](title, { description });
    } catch {
      toast.error('Connexion impossible', { description: 'Vérifiez votre connexion Internet, puis réessayez.' });
    } finally {
      setRequestActionLoading(null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth');
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
          Chargement…
        </div>
      </main>
    );
  }

  if (!profile) return null;

  const isValidated = profile.status === 'validated';
  const isOnboarding = ['pending_review', 'pre_approved', 'enrichment_pending'].includes(profile.status);
  const dossierComplet = isDossierComplet(profile.profile_photo_url, profile.room_photo_urls);

  const statusLabels: Record<string, string> = {
    pending_review:     'Candidature en cours',
    pre_approved:       'Engagement pris',
    enrichment_pending: 'En attente de validation',
    validated:          'Actif',
    suspended:          'Suspendu',
    rejected:           'Refusé',
    pending_onboarding: 'Inscription à finaliser',
  };
  const statusColors: Record<string, string> = {
    pending_review:     'bg-amber-50 text-amber-700',
    pre_approved:       'bg-blue-50 text-blue-700',
    enrichment_pending: 'bg-purple-50 text-purple-700',
    validated:          'bg-emerald-50 text-emerald-700',
    suspended:          'bg-red-50 text-red-700',
    rejected:           'bg-slate-100 text-slate-500',
    pending_onboarding: 'bg-amber-50 text-amber-700',
  };

  const REQUEST_STATUS: Record<string, { label: string; cls: string }> = {
    pending:               { label: 'En attente',  cls: 'bg-amber-50 text-amber-700'    },
    accepted:              { label: 'Acceptée',    cls: 'bg-emerald-50 text-emerald-700' },
    declined:              { label: 'Refusée',     cls: 'bg-red-50 text-red-700'         },
    cancelled_no_response: { label: 'Expirée',     cls: 'bg-slate-100 text-slate-500'    },
  };

  const ambassadeUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/ambassade/${profile.id}`;
  const pendingCount = contactRequests.filter((r) => r.status === 'pending').length;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Home className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-slate-800 text-sm hidden sm:block">Ambassades de Guérison</span>
        </Link>
        <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
          <LogOut className="w-3.5 h-3.5" />
          Déconnexion
        </button>
      </header>

      {isValidated && (
        <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} pendingCount={pendingCount} />
      )}

      <div className="max-w-2xl mx-auto px-4 py-8 pb-24 sm:pb-8 space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              photoUrl={profile.profile_photo_url ? photoSignedUrls[profile.profile_photo_url] ?? null : null}
              firstName={profile.first_name}
              size={48}
            />
            <div>
              <h1 className="text-xl font-semibold text-slate-800">Bonjour, {profile.first_name}</h1>
              <p className="text-slate-500 text-sm">{profile.city}, {profile.country}</p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[profile.status] ?? 'bg-slate-100 text-slate-600'}`}>
            {statusLabels[profile.status] ?? profile.status}
          </span>
        </div>

        {/* ─── COMPTE SUSPENDU / REFUSÉ — aucun onglet, aucun parcours onboarding ─── */}
        {profile.status === 'suspended' && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <UserX className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Votre ambassade est en pause</p>
                <p className="text-sm text-slate-600 mt-0.5">
                  Votre ambassade n&apos;est plus visible sur la carte publique et vous ne pouvez plus recevoir de nouvelles demandes.
                  Contactez l&apos;équipe si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
                </p>
              </div>
            </div>
          </div>
        )}

        {profile.status === 'rejected' && (
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <UserX className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">Candidature non retenue</p>
                <p className="text-sm text-slate-600 mt-0.5">
                  Votre candidature d&apos;ambassadeur n&apos;a pas été validée à ce stade. Merci pour votre intérêt pour le ministère.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── PARCOURS EN COURS D'ONBOARDING ─── */}
        {isOnboarding && (
          <>
            {/* Stepper parcours — uniquement pour les non-validés */}
            <StatusTimeline
              status={profile.status}
              profilePhotoUrl={profile.profile_photo_url}
              roomPhotoUrls={profile.room_photo_urls}
            />

            {/* Encart candidature reçue — gate self-service vidéo + PDF + CGU */}
            {profile.status === 'pending_review' && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">Bienvenue, {profile.first_name} !</p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Pour rejoindre les Ambassades de Guérison, regardez la vidéo de formation ci-dessous,
                      téléchargez le guide pratique, puis validez votre engagement pour accéder à votre présentation.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Encart conditions acceptées — CTA questionnaire */}
            {profile.status === 'pre_approved' && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">Engagement pris</p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Il reste une dernière étape avant de rejoindre la carte des ambassadeurs :
                      vous présenter pour que David puisse mieux vous connaître.
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/questionnaire"
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Me présenter →
                </Link>
              </div>
            )}

            {/* Encart enrichissement en attente — le statut seul ne suffit pas : une donnée
                créée hors du chemin PATCH /api/ambassadeur/enrichissement (test, script) peut
                avoir enrichment_pending sans dossier complet. Sans cette revérification,
                l'ambassadeur voit "en cours d'examen chez David" alors qu'il n'a rien envoyé. */}
            {profile.status === 'enrichment_pending' && dossierComplet && (
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">David regarde votre dossier</p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Merci d&apos;avoir complété votre présentation. L&apos;équipe vous contactera prochainement pour vous donner la réponse de David.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Formation — visible en onboarding */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                <Play className="w-4 h-4 text-indigo-500" />
                <h2 className="font-semibold text-slate-800 text-sm">Formation ambassadeur</h2>
              </div>
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={buildVideoUrl(onboardingConfig.video_url)}
                  title="Formation ambassadeur — David Théry"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Guide pratique de l&apos;ambassade</p>
                  <p className="text-slate-500 text-xs mt-0.5">Informations pratiques pour accueillir lors des lives</p>
                </div>
                <a
                  href={onboardingConfig.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium px-3 py-2 rounded-xl hover:bg-indigo-100 transition-colors shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </a>
              </div>
            </div>

            {/* Gate onboarding — checkbox + bouton, uniquement pending_review */}
            {profile.status === 'pending_review' && (
              <>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                  {!videoStarted && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg">
                      Regardez la vidéo ci-dessus pour débloquer cette étape.
                    </p>
                  )}
                  <label className={`flex items-start gap-3 ${videoStarted ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                    <div className="mt-0.5">
                      <input
                        type="checkbox"
                        checked={onboardingChecked}
                        onChange={(e) => setOnboardingChecked(e.target.checked)}
                        disabled={!videoStarted}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </div>
                    <span className="text-sm text-slate-700">
                      J&apos;ai regardé la vidéo de formation et je m&apos;engage à accueillir les participants
                      dans l&apos;esprit de la charte des Ambassades de Guérison.
                    </span>
                  </label>

                  {onboardingError && (
                    <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{onboardingError}</p>
                  )}

                  <button
                    onClick={handleOnboardingComplete}
                    disabled={!onboardingChecked || onboardingSubmitting}
                    className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {onboardingSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Activation…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Je m&apos;engage et je continue
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ─── AMBASSADEUR VALIDÉ — contenu réparti par onglet (voir DashboardTabs) ─── */}
        {isValidated && (
          <>
            {/* ── Onglet Accueil ── */}
            {activeTab === 'accueil' && (
              <>
                {/* Mission du moment — carte contextuelle (priorité décroissante) */}
                <MissionDuMoment
                  hostType={profile.host_type}
                  currentEvent={currentEvent}
                  approvedLiveLink={approvedLiveLink}
                  signalSent={signalSent}
                  signalDescription={signalDescription}
                  signalLoading={signalLoading}
                  onDescriptionChange={setSignalDescription}
                  onSendSignal={sendLiveSignal}
                  contactRequests={contactRequests}
                  activations={activations}
                />

                {/* Témoignage — visible pendant un live */}
                {currentEvent && (
                  <section className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <h2 className="font-semibold text-slate-800 text-sm">Partager un témoignage</h2>
                    </div>

                    {testimonialsSentCount > 0 && (
                      <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg text-sm">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        {testimonialsSentCount} témoignage{testimonialsSentCount > 1 ? 's' : ''} envoyé{testimonialsSentCount > 1 ? 's' : ''} — merci !
                      </div>
                    )}

                    <p className="text-slate-500 text-xs">
                      Chaque personne de votre ambassade peut partager son témoignage. Soumissions multiples acceptées.
                    </p>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Comment s&apos;est passé le live chez vous ?
                      </label>
                      <textarea
                        value={testimonialContent}
                        onChange={(e) => setTestimonialContent(e.target.value)}
                        rows={4}
                        placeholder="Partagez ce que vous avez vécu pendant ce live…"
                        className={inputCls}
                      />
                    </div>

                    {testimonialError && (
                      <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{testimonialError}</p>
                    )}

                    <button
                      onClick={submitTestimonial}
                      disabled={testimonialSubmitting || !testimonialContent.trim()}
                      className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {testimonialSubmitting ? 'Envoi…' : 'Envoyer le témoignage'}
                    </button>
                  </section>
                )}

                {/* Mes lives */}
                {activations.length > 0 && (
                  <section>
                    <h2 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide">Mes lives</h2>
                    <div className="space-y-3">
                      {activations.map((a) => {
                        const ev = a.events;
                        const dateLabel = ev?.event_date
                          ? new Date(ev.event_date).toLocaleDateString('fr-FR', {
                              weekday: 'long', day: 'numeric', month: 'long',
                            })
                          : null;
                        const timeLabel = ev?.event_date
                          ? new Date(ev.event_date).toLocaleTimeString('fr-FR', {
                              hour: '2-digit', minute: '2-digit',
                            })
                          : null;

                        return (
                          <div key={a.id} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 text-sm">
                                  {ev?.title ?? `Live ${a.event_id.slice(0, 8)}`}
                                </p>
                                {dateLabel && (
                                  <p className="text-slate-400 text-xs mt-0.5 capitalize">
                                    {dateLabel}{timeLabel ? ` à ${timeLabel} · ${tzLabel}` : ''}
                                  </p>
                                )}
                              </div>
                            </div>

                            {a.is_full ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 px-3 py-1.5 bg-slate-100 rounded-lg">
                                  Votre ambassade est complète
                                </span>
                              </div>
                            ) : a.is_active ? (
                              <div className="flex items-center justify-between gap-3">
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {participationLabels(profile.host_type).joined}
                                </span>
                                <button
                                  onClick={() => toggleActivation(a.id, a.is_active)}
                                  className="text-xs text-slate-400 hover:text-red-500 transition-colors underline-offset-2 hover:underline"
                                >
                                  {participationLabels(profile.host_type).leave}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => toggleActivation(a.id, a.is_active)}
                                className="w-full bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
                              >
                                {participationLabels(profile.host_type).join}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* ── Onglet Demandes ── */}
            {activeTab === 'demandes' && (
              <section>
                <h2 className="font-semibold text-slate-800 mb-3 text-sm uppercase tracking-wide">Mes demandes</h2>
                {pendingCount > 0 && (
                  <p className="text-slate-500 text-sm leading-relaxed bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 mb-4">
                    Vous pouvez refuser quelle qu&apos;en soit la raison, par exemple le nombre de places. La personne ne saura pas pourquoi vous avez refusé.
                  </p>
                )}
                {contactRequests.length === 0 ? (
                  <p className="text-slate-400 text-sm">Aucune demande pour l&apos;instant.</p>
                ) : (
                  <div className="space-y-3">
                    {contactRequests.map((r) => {
                      const s = REQUEST_STATUS[r.status] ?? { label: r.status, cls: 'bg-slate-100 text-slate-500' };
                      const isPending = r.status === 'pending';
                      const isAccepting = requestActionLoading?.token === r.action_token && requestActionLoading.action === 'accept';
                      const isDeclining = requestActionLoading?.token === r.action_token && requestActionLoading.action === 'decline';
                      const isActioning = isAccepting || isDeclining;
                      const liveTitle = r.host_activation_id
                        ? activations.find((a) => a.id === r.host_activation_id)?.events?.title
                        : null;
                      return (
                        <div key={r.id} className={`bg-white rounded-xl border p-4 shadow-sm ${r.status === 'declined' ? 'opacity-60' : 'border-slate-100'}`}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0 flex items-start gap-2.5">
                              {visitorPhotoUrls[r.id] && (
                                <img
                                  src={visitorPhotoUrls[r.id]}
                                  alt=""
                                  className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 text-sm">{r.visitor_first_name}</p>
                                {visitorPhotosLoaded && !visitorPhotoUrls[r.id] && (
                                  <p className="text-slate-400 text-xs mt-0.5">Sans photo</p>
                                )}
                                {liveTitle && (
                                  <p className="text-indigo-600 text-xs mt-0.5">Pour le live : {liveTitle}</p>
                                )}
                                {/* Bouton "Signaler cette photo" masqué — TODO-25 : le signalement
                                    (visitor_profiles.photo_reported) n'a aujourd'hui aucune conséquence
                                    automatique (pas de page admin, pas de blocage), voir
                                    app/api/dashboard/report-visitor-photo/route.ts. Réactiver une fois
                                    qu'un flux admin exploite ce flag. */}
                              </div>
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${s.cls}`}>
                              {s.label}
                            </span>
                          </div>

                          <div className="space-y-0.5 mb-2">
                            <p className="text-slate-500 text-xs">{r.visitor_email}</p>
                            {/* Le téléphone n'est montré qu'après acceptation (cf. légende de /mon-espace/creer). */}
                            {r.status === 'accepted' && r.visitor_phone && (
                              <p className="text-slate-500 text-xs">Tél : {r.visitor_phone}</p>
                            )}
                            {r.nb_personnes && (
                              <p className="text-slate-500 text-xs">{r.nb_personnes} personne{r.nb_personnes > 1 ? 's' : ''}</p>
                            )}
                          </div>

                          {r.visitor_message && (
                            <p className="text-slate-600 text-sm italic mb-2">&quot;{r.visitor_message}&quot;</p>
                          )}

                          <p className="text-slate-400 text-xs mb-3">{relativeTime(r.created_at)}</p>

                          {isPending && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleContactAction(r.action_token, 'accept')}
                                disabled={isActioning}
                                className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 disabled:opacity-50 transition-colors font-medium"
                              >
                                {isAccepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                                Accepter
                              </button>
                              <button
                                onClick={() => setDecliningToken(decliningToken === r.action_token ? null : r.action_token)}
                                disabled={isActioning}
                                className="flex-1 flex items-center justify-center gap-1.5 text-sm px-3 py-2 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors font-medium"
                              >
                                <UserX className="w-4 h-4" />
                                Refuser
                              </button>
                            </div>
                          )}
                          {isPending && decliningToken === r.action_token && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <p className="text-sm font-medium text-slate-700 mb-3">Que répondez-vous à {r.visitor_first_name} ?</p>
                              <DeclineChoice
                                visitorName={r.visitor_first_name}
                                loading={isDeclining ? { permanent: !!requestActionLoading?.permanent } : false}
                                onDecline={(permanent) => handleContactAction(r.action_token, 'decline', permanent)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ── Onglet Profil ── */}
            {activeTab === 'profil' && (
              <>
                {/* Mon ambassade — partage */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-indigo-500" />
                    <h2 className="font-semibold text-slate-800 text-sm">Votre ambassade</h2>
                  </div>

                  <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-slate-400 mb-0.5">Lien public</p>
                    <p className="text-xs text-indigo-600 font-mono break-all">{ambassadeUrl}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={copyAmbassadeLink}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium py-2.5 rounded-xl hover:bg-indigo-100 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      {linkCopied ? 'Copié !' : 'Copier le lien'}
                    </button>
                    <button
                      onClick={shareOnWhatsApp}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-emerald-600 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      WhatsApp
                    </button>
                  </div>

                  <a
                    href={`/ambassade/${profile.id}/badge`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Mon image à partager
                  </a>
                </div>

                {/* Photos — pendant enrichissement ou si l'ambassadeur veut modifier */}
                {(profile.status === 'enrichment_pending' || showPhotosEdit) && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-5">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-indigo-500" />
                      <h2 className="font-semibold text-slate-800 text-sm">Photos de votre ambassade</h2>
                    </div>

                    {photoError && (
                      <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{photoError}</p>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Photo de profil</p>
                      {photoUploading === 'profile' ? (
                        <div className="flex items-center justify-center h-32 rounded-xl border border-slate-200 bg-slate-50">
                          <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                        </div>
                      ) : (
                        <Dropzone
                          onFile={(f) => uploadPhoto(f, 'profile')}
                          preview={profile.profile_photo_url ? (photoSignedUrls[profile.profile_photo_url] ?? null) : null}
                          onRemove={profile.profile_photo_url ? () => setProfile((p) => p ? { ...p, profile_photo_url: null } : p) : undefined}
                          label="Ajouter ma photo de profil"
                        />
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                        Photos de la salle
                        <span className="font-normal text-slate-400 normal-case ml-1">({(profile.room_photo_urls ?? []).length}/5)</span>
                      </p>
                      {(profile.room_photo_urls ?? []).length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {(profile.room_photo_urls ?? []).map((path) => (
                            <div key={path} className="relative group rounded-lg overflow-hidden border border-slate-100">
                              <img src={photoSignedUrls[path] ?? ''} alt="Salle" className="w-full h-24 object-cover" />
                              <button
                                type="button"
                                onClick={() => removeRoomPhoto(path)}
                                className="absolute top-1 right-1 w-5 h-5 bg-white/90 rounded-full flex items-center justify-center text-slate-500 hover:text-red-600 shadow text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {(profile.room_photo_urls ?? []).length < 5 && (
                        photoUploading === 'room' ? (
                          <div className="flex items-center justify-center h-24 rounded-xl border border-slate-200 bg-slate-50">
                            <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
                          </div>
                        ) : (
                          <Dropzone
                            onFile={(f) => uploadPhoto(f, 'room')}
                            label="Ajouter une photo de la salle de réunion"
                          />
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Modifier mes photos — bouton discret pour les ambassadeurs validés */}
                {!showPhotosEdit && (
                  <button
                    onClick={() => setShowPhotosEdit(true)}
                    className="flex items-center gap-2 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Camera className="w-3 h-3" />
                    Modifier mes photos
                  </button>
                )}

                {/* Mes informations */}
                <MesInfosSection profile={profile} />
              </>
            )}

            {/* ── Onglet Formation ── */}
            {activeTab === 'formation' && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                  <Play className="w-4 h-4 text-indigo-500" />
                  <h2 className="font-semibold text-slate-800 text-sm">Formation ambassadeur</h2>
                </div>
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={buildVideoUrl(onboardingConfig.video_url)}
                    title="Formation ambassadeur — David Théry"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">Guide pratique de l&apos;ambassade</p>
                    <p className="text-slate-500 text-xs mt-0.5">Informations pratiques pour accueillir lors des lives</p>
                  </div>
                  <a
                    href={onboardingConfig.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium px-3 py-2 rounded-xl hover:bg-indigo-100 transition-colors shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    Télécharger
                  </a>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </main>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(diff / 86_400_000);
  return rtf.format(-days, 'day');
}

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white';

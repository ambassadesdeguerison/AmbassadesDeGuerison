'use client';

import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { useBrowserTimezone } from '@/lib/hooks/use-browser-timezone';

interface EventInfo {
  id: string;
  title: string;
  event_date: string;
}

interface Props {
  nextEvent: EventInfo | null;
  lastEvent: EventInfo | null;
  liveInProgress: boolean;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}j ${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h ${minutes}min ${seconds}s`;
  return `${minutes}min ${seconds}s`;
}

export default function EventBanner({ nextEvent, lastEvent, liveInProgress }: Props) {
  const [countdown, setCountdown] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const tzLabel = useBrowserTimezone();

  useEffect(() => {
    if (!nextEvent) return;
    const tick = () => {
      const ms = new Date(nextEvent.event_date).getTime() - Date.now();
      setCountdown(formatCountdown(ms));
      setNow(Date.now());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextEvent]);

  if (liveInProgress) {
    const youtubeUrl = process.env.NEXT_PUBLIC_YOUTUBE_CHANNEL_URL ?? 'https://www.youtube.com/@DavidThery';
    return (
      <div className="absolute top-14 lg:top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full shadow-md text-sm font-medium bg-indigo-600 text-white">
          <Radio className="w-3.5 h-3.5 text-indigo-200 animate-pulse shrink-0" />
          <span className="sm:hidden">Live en cours</span>
          <span className="hidden sm:inline">Live en cours — rejoignez-nous</span>
        </div>
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 rounded-full shadow-md text-xs font-medium bg-white text-slate-700 border border-slate-100 hover:bg-slate-50 transition-colors hidden sm:inline-block"
        >
          Regarder sur YouTube
        </a>
      </div>
    );
  }

  if (!nextEvent && !lastEvent) return null;

  let messageShort: string;
  let messageFull: string;
  let isUrgent = false;

  if (nextEvent) {
    const msLeft = new Date(nextEvent.event_date).getTime() - now;
    const daysLeft = msLeft / (1000 * 60 * 60 * 24);

    if (daysLeft < 7 && countdown) {
      messageShort = `Dans ${countdown}`;
      messageFull = `Prochain live dans ${countdown}`;
      isUrgent = true;
    } else {
      const dateFull = new Date(nextEvent.event_date).toLocaleString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit',
      });
      const dateShort = new Date(nextEvent.event_date).toLocaleString('fr-FR', {
        weekday: 'short', day: 'numeric',
      });
      messageShort = `Live ${dateShort}`;
      messageFull = `Prochain live le ${dateFull} · ${tzLabel}`;
    }
  } else if (lastEvent) {
    const daysAgo = Math.floor(
      (now - new Date(lastEvent.event_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    messageShort = 'Prochainement';
    messageFull = `Dernier live il y a ${daysAgo} jour${daysAgo > 1 ? 's' : ''} — prochainement`;
  } else {
    return null;
  }

  return (
    <div
      className={`absolute top-14 lg:top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-full shadow-md text-sm font-medium ${
        isUrgent
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-slate-700 border border-slate-100'
      }`}
    >
      <Radio className={`w-3.5 h-3.5 shrink-0 ${isUrgent ? 'text-indigo-200 animate-pulse' : 'text-indigo-400'}`} />
      <span className="sm:hidden">{messageShort}</span>
      <span className="hidden sm:inline">{messageFull}</span>
    </div>
  );
}

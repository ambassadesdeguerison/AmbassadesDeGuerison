'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle, ChevronDown, Search, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/browser';

interface Event {
  id: string;
  title: string;
  event_date: string;
}

interface Props {
  events: Event[];
  defaultEventId?: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function EventCombobox({
  events,
  value,
  onChange,
}: {
  events: Event[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = events.find((e) => e.id === value);

  const filtered = query.trim()
    ? events.filter((e) =>
        e.title.toLowerCase().includes(query.toLowerCase()) ||
        formatDate(e.event_date).toLowerCase().includes(query.toLowerCase())
      )
    : events;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleSelect(ev: Event) {
    onChange(ev.id);
    setOpen(false);
    setQuery('');
  }

  function handleOpen() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition flex items-center justify-between gap-2"
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? (
            <>
              <span className="font-medium">{selected.title}</span>
              <span className="text-slate-400 ml-1.5 text-xs">— {formatDate(selected.event_date)}</span>
            </>
          ) : (
            'Choisir un live'
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un live…"
                className="w-full pl-7 pr-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 bg-slate-50 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-400 text-center">Aucun résultat</li>
            ) : (
              filtered.map((ev) => (
                <li key={ev.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(ev); }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-indigo-50 ${
                      ev.id === value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                    }`}
                  >
                    <span className="font-medium block leading-snug">{ev.title}</span>
                    <span className="text-xs text-slate-400">{formatDate(ev.event_date)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function NouveauTemoignageForm({ events, defaultEventId }: Props) {
  const firstId = defaultEventId ?? events[0]?.id ?? '';
  const [eventId, setEventId] = useState(firstId);
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [ambassadorCity, setAmbassadorCity] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('host_profiles')
        .select('city, status')
        .eq('user_id', user.id)
        .eq('status', 'validated')
        .single()
        .then(({ data }) => {
          if (data?.city) {
            setAmbassadorCity(data.city);
            return;
          }
          fetch('/api/visitor/profile')
            .then((res) => (res.ok ? res.json() : null))
            .then((profile) => {
              if (profile?.first_name) setName(profile.first_name);
            })
            .catch(() => {});
        });
    });
  }, []);

  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 text-sm">Aucun live disponible pour l&apos;instant.</p>
        <Link href="/temoignages" className="mt-4 inline-flex items-center gap-1.5 text-indigo-600 text-sm hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour aux témoignages
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-7 h-7 text-emerald-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Merci pour votre témoignage</h2>
        <p className="text-slate-500 text-sm max-w-xs mx-auto">
          Il sera relu avant d&apos;être publié. Ce que Dieu fait mérite d&apos;être partagé.
        </p>
        <Link
          href="/temoignages"
          className="mt-6 inline-flex items-center gap-1.5 text-indigo-600 text-sm hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voir les témoignages
        </Link>
      </div>
    );
  }

  const requiresNameAndCity = !ambassadorCity;
  const canSubmit =
    content.trim().length > 0 &&
    (!requiresNameAndCity || (name.trim().length > 0 && city.trim().length > 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/temoignages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        content: content.trim(),
        submitter_name: name.trim() || undefined,
        submitter_city: city.trim() || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Une erreur est survenue.');
      setLoading(false);
      return;
    }
    setSubmitted(true);
  }

  return (
    <div>
      <Link
        href="/temoignages"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux témoignages
      </Link>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <h1 className="text-xl font-semibold text-slate-800 mb-1">Partagez votre témoignage</h1>
        <p className="text-slate-500 text-sm mb-6">
          Qu&apos;avez-vous vécu pendant ce live ?
        </p>

        {ambassadorCity && (
          <div className="flex items-start gap-2.5 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-6">
            <UserCheck className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
            <p className="text-sm text-indigo-700">
              Vous êtes ambassadeur à <span className="font-medium">{ambassadorCity}</span> — votre témoignage sera lié à votre profil.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Live concerné
            </label>
            <EventCombobox
              events={events}
              value={eventId}
              onChange={setEventId}
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-slate-700 mb-1.5">
              Votre témoignage <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              maxLength={2000}
              rows={5}
              placeholder="Ce que j'ai vécu pendant ce live..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
            />
            <p className="mt-1 text-xs text-slate-400 text-right">{content.trim().length}/2000</p>
          </div>

          {!ambassadorCity && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={60}
                  placeholder="Votre prénom"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Ville <span className="text-red-500">*</span>
                </label>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  maxLength={80}
                  placeholder="Votre ville"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Envoi en cours…' : 'Envoyer mon témoignage'}
          </button>
        </form>
      </div>
    </div>
  );
}

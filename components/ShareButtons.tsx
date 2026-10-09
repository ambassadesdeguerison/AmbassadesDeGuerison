'use client';

import { useState, useSyncExternalStore } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  url: string;
  text: string;
}

export default function ShareButtons({ url, text }: Props) {
  const [copied, setCopied] = useState(false);
  // Origine du site : inconnue au rendu serveur, on garde alors `url` tel quel.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ''
  );
  const normalized = url.startsWith('/') ? url : `/${url}`;
  const fullUrl = origin ? `${origin}${normalized}` : url;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback ignoré */ }
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${text}\n${fullUrl}`)}`;

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copié !' : 'Copier'}
      </button>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 bg-emerald-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-emerald-600 transition-colors"
      >
        WhatsApp
      </a>
    </div>
  );
}

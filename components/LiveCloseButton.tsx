'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PowerOff } from 'lucide-react';
import { apiCall } from '@/lib/admin/api-call';
import ErrorMessage from '@/components/admin/ErrorMessage';
import ConfirmDialog, { type ConfirmSpec } from '@/components/admin/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

interface Props {
  eventId: string;
}

export default function LiveCloseButton({ eventId }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);

  // Audit admin 2026-08-07 (3.2) : `confirm()` natif n'expliquait pas l'effet
  // réel — l'action retire toutes les ambassades de la carte publique et
  // marque le live fermé. Elle est visible publiquement et n'a pas de bouton
  // d'annulation dans l'UI.
  function askClose() {
    setConfirm({
      title: 'Clôturer ce live ?',
      body: "Toutes les ambassades disparaîtront de la carte publique et ne recevront plus de demandes de visite. Le live sera marqué comme terminé — les visiteurs verront « Prochain live prochainement ».",
      confirmLabel: 'Clôturer le live',
      onConfirm: async () => {
        setLoading(true);
        setError('');
        const res = await apiCall('/api/admin/live/close', { body: { event_id: eventId } });
        setLoading(false);
        setConfirm(null);
        if (res.ok) {
          setDone(true);
          router.refresh();
          toast.success('Live clôturé', {
            description: 'Les ambassades ont été retirées de la carte publique.',
          });
        } else {
          setError(res.error);
          toast.error("Le live n'a pas été clôturé", { description: res.error });
        }
      },
    });
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
        <PowerOff className="w-3.5 h-3.5" />
        Live clôturé — pins retirés de la carte
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={askClose}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
      >
        <PowerOff className="w-3.5 h-3.5" />
        {loading ? 'Clôture...' : 'Clôturer le live'}
      </button>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <ConfirmDialog spec={confirm} onCancel={() => setConfirm(null)} pending={loading} />
    </div>
  );
}

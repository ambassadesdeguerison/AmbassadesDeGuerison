'use client';

import { useState } from 'react';
import { Save, CheckCircle2, ExternalLink } from 'lucide-react';
import { apiCall } from '@/lib/admin/api-call';
import { extractYoutubeId } from '@/lib/youtube';
import ErrorMessage from '@/components/admin/ErrorMessage';

interface Config {
  video_url: string;
  pdf_url: string;
}

interface Props {
  initialConfig: Config;
}

const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent bg-white';

export default function OnboardingConfigForm({ initialConfig }: Props) {
  const [videoUrl, setVideoUrl] = useState(initialConfig.video_url);
  const [pdfUrl,   setPdfUrl]   = useState(initialConfig.pdf_url);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');

  // Aperçu live : l'admin voit immédiatement si son lien est exploitable,
  // au lieu de découvrir une iframe vide côté candidat (audit 9.5).
  const previewId = extractYoutubeId(videoUrl);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    const res = await apiCall<{ video_url?: string }>('/api/admin/settings/onboarding', {
      method: 'PATCH',
      body: { video_url: videoUrl, pdf_url: pdfUrl },
    });

    if (res.ok) {
      // L'API normalise vers la forme embed — refléter ce qui est réellement stocké.
      if (res.data?.video_url) setVideoUrl(res.data.video_url);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(res.error);
    }
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="font-medium text-slate-800 text-sm">Accueil des nouveaux ambassadeurs</h2>
        {/* Audit 9.6 : rien n'indiquait où ces réglages apparaissent, ni que la
            vidéo conditionne la progression du candidat. */}
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Affichés sur le tableau de bord d'un candidat au statut « En attente du candidat ». Il doit lancer la vidéo
          pour pouvoir cocher son engagement — un lien cassé le bloque à cette étape.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Lien de la vidéo YouTube
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className={inputCls}
          />
          <p className="text-xs text-slate-400 mt-1">
            Collez l'adresse de la vidéo telle quelle — elle sera convertie automatiquement au bon format.
          </p>

          {videoUrl.trim() && !previewId && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg mt-2">
              Ce lien n'est pas reconnu comme une vidéo YouTube. L'enregistrement sera refusé.
            </p>
          )}

          {previewId && (
            <div className="mt-3">
              <p className="text-xs text-slate-500 mb-1.5">Aperçu — ce que verra le candidat :</p>
              <div className="rounded-lg overflow-hidden border border-slate-200 aspect-video max-w-sm">
                <iframe
                  src={`https://www.youtube.com/embed/${previewId}`}
                  title="Aperçu de la vidéo de bienvenue"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Lien vers le PDF guide
          </label>
          <input
            type="text"
            value={pdfUrl}
            onChange={(e) => setPdfUrl(e.target.value)}
            placeholder="https://drive.google.com/file/d/..."
            className={inputCls}
          />
          {/* Audit 9.7 : un lien Drive non partagé publiquement échoue
              silencieusement côté candidat. */}
          <p className="text-xs text-slate-400 mt-1">
            Google Drive, Dropbox ou tout autre lien. Vérifiez qu'il s'ouvre{' '}
            <strong className="font-medium text-slate-500">sans être connecté</strong> — sinon le candidat verra une
            page d'erreur.
          </p>
          {pdfUrl.trim() && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline mt-1.5"
            >
              <ExternalLink className="w-3 h-3" />
              Tester le lien dans un nouvel onglet
            </a>
          )}
        </div>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Enregistré !
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </>
          )}
        </button>
      </form>
    </div>
  );
}

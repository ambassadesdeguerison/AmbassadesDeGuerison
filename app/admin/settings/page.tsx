import { createServiceClient } from '@/lib/supabase/server';
import AdminLayout from '@/components/AdminLayout';
import AdminPage from '@/components/admin/AdminPage';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import OnboardingConfigForm from '@/components/OnboardingConfigForm';
import { ONBOARDING } from '@/config/onboarding';
import Link from 'next/link';
import { Timer, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('onboarding_config')
    .select('video_url, pdf_url')
    .eq('id', 1)
    .single();

  const config = {
    video_url: data?.video_url || ONBOARDING.VIDEO_URL,
    pdf_url:   data?.pdf_url   || ONBOARDING.PDF_PATH,
  };

  return (
    <AdminLayout>
      <AdminPage width="narrow">
        <AdminPageHeader
          title="Paramètres"
          subtitle="Contenu d'accueil des candidats, délais des envois automatiques et limites de demandes."
        />

        <div className="space-y-4">
          <OnboardingConfigForm initialConfig={config} />

          {/* Audit 9.4 : ce lien était un petit texte en bas de page, sans
              indication qu'il menait à un écran de configuration distinct —
              facile à manquer entièrement. */}
          <Link
            href="/admin/settings/timing"
            className="flex items-center gap-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:border-indigo-200 transition-colors group"
          >
            <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
              <Timer className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">Délais, affichage et limites</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Quand les e-mails de campagne et de retour d&apos;expérience partent, quand la carte annonce un live
                imminent, et le nombre de demandes qu&apos;un visiteur peut envoyer par live.
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
          </Link>
        </div>
      </AdminPage>
    </AdminLayout>
  );
}

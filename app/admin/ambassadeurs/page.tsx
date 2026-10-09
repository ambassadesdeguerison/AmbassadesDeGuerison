import { createServiceClient } from '@/lib/supabase/server';
import { getAdminPhotoUrl } from '@/lib/storage/photo-url';
import { getAdminVideoUrls } from '@/lib/storage/video-url';
import { videoDownloadName } from '@/lib/video/filename';
import AdminLayout from '@/components/AdminLayout';
import AdminPage from '@/components/admin/AdminPage';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AmbassadeursTable from '@/components/AmbassadeursTable';
import {
  SORT_COLUMNS,
  parseSort,
  parseParcours,
  parcoursOrFilter,
  type SortKey,
  type SortDir,
  type ParcoursValue,
} from '@/lib/admin/ambassadeurs-query';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

async function getAmbassadeurs(
  page: number,
  q: string,
  status: string,
  sort: SortKey,
  dir: SortDir,
  parcours: ParcoursValue[]
) {
  const supabase = createServiceClient();
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('host_profiles')
    .select(
      'id, first_name, last_name, email, city, country, host_type, status, capacity, created_at, phone, healing_challenge_done, conferences_assistees, church_attendance, denomination, parcours_spirituel, livres_lus, books_read, trainings_done, has_seen_healings, has_leadership_role, leadership_role, live_screen, intro_video_path, intro_video_mime, profile_photo_url, room_photo_urls, is_women_only',
      { count: 'exact' }
    );

  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%`);
  if (status !== 'all') query = query.eq('status', status);
  const parcoursFilter = parcoursOrFilter(parcours);
  if (parcoursFilter) query = query.or(parcoursFilter);

  // `id` en second critère : sans ordre total, deux pages successives peuvent
  // se chevaucher quand beaucoup de lignes ont la même valeur (ex. même ville).
  const { data, count } = await query
    .order(SORT_COLUMNS[sort], { ascending: dir === 'asc' })
    .order('id')
    .range(offset, offset + PAGE_SIZE - 1);

  // Convertir les chemins Storage privés en signed URLs (1h) pour affichage admin
  const ambassadeurs = await Promise.all(
    (data ?? []).map(async (a) => {
      const profile_photo_signed_url = a.profile_photo_url
        ? await getAdminPhotoUrl(a.profile_photo_url)
        : null;
      const room_photo_signed_urls = a.room_photo_urls?.length
        ? (await Promise.all(a.room_photo_urls.map((p: string) => getAdminPhotoUrl(p)))).filter(Boolean)
        : [];
      const video = a.intro_video_path
        ? await getAdminVideoUrls(a.intro_video_path, videoDownloadName(a.first_name, a.last_name, a.intro_video_mime))
        : null;
      return {
        ...a,
        profile_photo_signed_url,
        room_photo_signed_urls,
        intro_video_play_url: video?.playUrl ?? null,
        intro_video_download_url: video?.downloadUrl ?? null,
      };
    })
  );

  return { ambassadeurs, total: count ?? 0 };
}

interface PageProps {
  searchParams: Promise<{ page?: string; q?: string; status?: string; sort?: string; dir?: string; parcours?: string }>;
}

export default async function AdminAmbassadeursPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const q = sp.q ?? '';
  const filterStatus = sp.status ?? 'all';

  const { sort, dir } = parseSort(sp.sort, sp.dir);
  const parcours = parseParcours(sp.parcours);

  const { ambassadeurs, total } = await getAmbassadeurs(page, q, filterStatus, sort, dir, parcours);

  return (
    <AdminLayout>
      <AdminPage width="full">
        <AdminPageHeader
          title="Ambassadeurs"
          subtitle="Les candidatures et les ambassades actives."
        />
        <AmbassadeursTable
          ambassadeurs={ambassadeurs}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          searchQ={q}
          filterStatus={filterStatus}
          sort={sort}
          dir={dir}
          parcours={parcours}
        />
      </AdminPage>
    </AdminLayout>
  );
}

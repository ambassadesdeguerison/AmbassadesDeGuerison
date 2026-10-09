import { ImageResponse } from 'next/og';

// Image OG (1200x630) du badge ambassade — preview WhatsApp/réseaux quand
// l'ambassadeur partage /ambassade/[id], + bouton "Voir mon badge" dans
// /dashboard.
//
// IMPORTANT — règles satori (cf CLAUDE.md "Règles importantes" §next/og) :
// 1. Tout <div> avec >1 child doit avoir `display: flex` explicite.
// 2. Pas d'import @supabase/supabase-js (crash silencieux). fetch direct.
// 3. Pas de `runtime = 'edge'` (même symptôme).
// 4. Cache-Control 24h pour que le CDN serve l'image au lieu de re-générer.
//
// Décisions design (validées en cross-model review) :
// - Pas de date du prochain live → cache OG WhatsApp aggressif, date périmée
//   dégrade la confiance.
// - Pas de gradient rose pour women-only → cliché, peut sembler patronnant.
//   Préférer un badge texte sobre.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let host: {
    first_name: string;
    city: string;
    country: string;
    quartier: string | null;
    host_type: string;
    is_women_only: boolean;
  } | null = null;

  if (supabaseUrl && serviceKey) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/host_profiles?id=eq.${id}&status=eq.validated&select=first_name,city,country,quartier,host_type,is_women_only`,
      { headers: { apikey: serviceKey, ...(serviceKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${serviceKey}` }) }, cache: 'no-store' }
    );
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) host = rows[0];
    }
  }

  // Cas : ambassade introuvable / suspendue → badge fallback grisé
  if (!host) {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #94A3B8 0%, #64748B 100%)',
            color: 'white',
            fontFamily: 'sans-serif',
            padding: '50px',
          }}
        >
          <div style={{ fontSize: '56px', marginBottom: '20px' }}>🏠</div>
          <div style={{ fontSize: '28px', opacity: 0.85, marginBottom: '20px' }}>
            Badge non disponible
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.15)',
              padding: '8px 20px',
              borderRadius: '20px',
              fontSize: '16px',
            }}
          >
            Ambassades de Guérison
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        },
      }
    );
  }

  // Cas : ambassade valide → badge complet
  const isChurch = host.host_type === 'church';
  const emoji = isChurch ? '⛪' : '🏠';
  // Vocabulaire aligné sur le reste du site (carte, fiche /ambassade/[id]).
  const hostTypeLabel = isChurch ? 'Lieu de prière en église' : 'Lieu de prière à domicile';
  // Quartier affiché en sous-ligne uniquement s'il apporte de l'info
  // (sinon redondant : "Paris" + "Paris 15e"). Heuristique : on cache si
  // le quartier contient déjà le nom de la ville.
  const showQuartier =
    host.quartier &&
    !host.quartier.toLowerCase().includes(host.city.toLowerCase());

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: '50px 60px',
        }}
      >
        {/* Top — branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '20px',
            opacity: 0.85,
            letterSpacing: '0.5px',
          }}
        >
          Live de guérison avec David Théry
        </div>

        {/* Center — host identity */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '64px', marginBottom: '12px' }}>{emoji}</div>
          <div style={{ fontSize: '52px', fontWeight: 'bold', marginBottom: '6px', lineHeight: 1 }}>
            {host.first_name}
          </div>
          <div style={{ fontSize: '32px', opacity: 0.95, marginBottom: '4px' }}>
            {host.city}
          </div>
          {showQuartier && (
            <div style={{ fontSize: '18px', opacity: 0.85, marginBottom: '4px' }}>
              {host.quartier}
            </div>
          )}
          <div style={{ fontSize: '16px', opacity: 0.65 }}>
            {host.country}
          </div>
          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginTop: '24px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '8px 18px',
                borderRadius: '20px',
                fontSize: '15px',
                fontWeight: 500,
              }}
            >
              {hostTypeLabel}
            </div>
            {host.is_women_only && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  padding: '8px 18px',
                  borderRadius: '20px',
                  fontSize: '15px',
                  fontWeight: 500,
                }}
              >
                Groupe femmes uniquement
              </div>
            )}
          </div>
        </div>

        {/* Bottom — CTA + trust */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: 600, marginBottom: '6px' }}>
            {`Rejoignez ${host.first_name} pour la prière`}
          </div>
          <div style={{ fontSize: '15px', opacity: 0.65 }}>
            Adresse dévoilée après acceptation
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    }
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidateTag } from 'next/cache';

export async function PATCH(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const fields = [
    'campaign_ambassadors_days_before',
    'campaign_visitors_days_before',
    'host_reminder_days_before',
    'visitor_auto_decline_days_before',
    'feedback_days_after',
    'queue_aging_days',
    'soon_threshold_days',
    'max_requests_per_visitor_per_event',
  ] as const;
  // Un plafond à 0 bloquerait toute demande de visite : minimum 1.
  const MIN_VALUE: Partial<Record<(typeof fields)[number], number>> = {
    max_requests_per_visitor_per_event: 1,
  };

  const updates: Record<string, number> = {};
  for (const field of fields) {
    const v = parseInt(String(body[field]));
    if (!isNaN(v) && v >= (MIN_VALUE[field] ?? 0)) updates[field] = v;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucune valeur valide fournie' }, { status: 400 });
  }

  const { supabase } = ctx;
  const { error } = await supabase
    .from('event_timing_config')
    .update(updates)
    .eq('id', 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag('timing-config', 'default');

  return NextResponse.json({ success: true, updated: updates });
}

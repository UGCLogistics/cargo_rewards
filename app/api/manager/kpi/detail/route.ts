import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerSupabaseClient as createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Detailed KPI endpoint for managers and admins. Returns daily aggregates
 * for all transactions within an optional date range.  Requires the
 * caller to have MANAGER or ADMIN role.
 */
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (!['ADMIN', 'MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  try {
    const adminClient = getServiceClient();
    let query = adminClient
      .from('transactions')
      .select('date, count:id, sum(publish_rate) as total_publish_rate, sum(discount_amount) as total_discount, sum(cashback_amount) as total_cashback, sum(points_earned) as total_points')
      .group('date')
      .order('date');
    if (start) query = query.gte('date', start);
    if (end) query = query.lte('date', end);
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
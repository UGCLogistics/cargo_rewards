import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerSupabaseClient as createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

/**
 * Helper for instantiating a Supabase client using the service role key.
 * Required for performing unrestricted queries on behalf of an admin.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/admin/kpi/user-detail
 *
 * Returns transactional KPI details grouped by date and user_id. The
 * response includes the count of transactions, sum of publish_rate,
 * sum of discount_amount and sum of points_earned for each user per
 * date. Optional `start` and `end` query parameters (ISO date strings)
 * restrict the query to a specific date range. This endpoint is
 * intended to power advanced analytics where further filtering (e.g.
 * by membership tier or sales staff) occurs client-side.
 */
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  try {
    const adminClient = getServiceClient();
    let query = adminClient
      .from('transactions')
      .select('date, user_id, count:id, sum(publish_rate) as total_publish_rate, sum(discount_amount) as total_discount, sum(cashback_amount) as total_cashback, sum(points_earned) as total_points')
      .group('date, user_id')
      .order('date');
    if (start) {
      query = query.gte('date', start);
    }
    if (end) {
      query = query.lte('date', end);
    }
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
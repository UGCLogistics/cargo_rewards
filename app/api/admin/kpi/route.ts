import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Returns aggregate KPI metrics for administrators. Metrics include:
 * - total_transactions: number of rows in transactions
 * - total_publish_rate: sum of publish_rate
 * - total_discount: sum of discount_amount
 * - total_points: sum of points_earned
 * Only accessible by ADMIN role.
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
  // Parse optional date filters from query parameters
  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  try {
    const adminClient = getServiceClient();
    let query = adminClient
      .from('transactions')
      .select('count:id, sum(publish_rate) as total_publish_rate, sum(discount_amount) as total_discount, sum(cashback_amount) as total_cashback, sum(points_earned) as total_points');
    if (start) {
      query = query.gte('date', start);
    }
    if (end) {
      query = query.lte('date', end);
    }
    const { data, error } = await query.single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const result = {
      total_transactions: data?.count ?? 0,
      total_publish_rate: data?.total_publish_rate ?? 0,
      total_discount: data?.total_discount ?? 0,
      total_cashback: data?.total_cashback ?? 0,
      total_points: data?.total_points ?? 0,
    };
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
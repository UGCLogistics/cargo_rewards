import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createRouteHandlerSupabaseClient as createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

/**
 * Returns KPI metrics for customers based on their own transactions. The
 * aggregates include total shipments, total spending (publish_rate), total
 * discount received, and total points earned. Only customers (and
 * higher roles) may call this endpoint. It leverages RLS to ensure
 * only the caller's data is aggregated.
 */
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies, headers });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (!['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  try {
    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' });
    if (start) query = query.gte('date', start);
    if (end) query = query.lte('date', end);
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
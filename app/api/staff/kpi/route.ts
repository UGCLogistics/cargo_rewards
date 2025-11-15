import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

/**
 * Returns KPI metrics for staff users. Staff may only see metrics for
 * their own transactions. The aggregates include total_transactions,
 * total_publish_rate, total_discount and total_points. Staff and higher
 * roles (MANAGER/ADMIN) can call this endpoint; customers are forbidden.
 */
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (!['ADMIN', 'MANAGER', 'STAFF'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const url = new URL(request.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  try {
    let query = supabase
      .from('transactions')
      .select('count:id, sum(publish_rate) as total_publish_rate, sum(discount_amount) as total_discount, sum(cashback_amount) as total_cashback, sum(points_earned) as total_points');
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
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

/**
 * Detailed KPI endpoint for staff. Returns daily aggregates of the
 * currently logged-in staff user's transactions within an optional
 * date range. RLS ensures only the user's transactions are counted.
 * Accessible to STAFF, MANAGER or ADMIN roles.
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
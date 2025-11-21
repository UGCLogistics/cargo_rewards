import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
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
  const supabase = createSupabaseServerClient();
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
      .select('date, id, publish_rate, discount_amount, cashback_amount, points_earned')
      .order('date');
    if (start) query = query.gte('date', start);
    if (end) query = query.lte('date', end);
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Aggregate data by date
    const aggregated = (data || []).reduce((acc: any, row: any) => {
      const existing = acc.find((item: any) => item.date === row.date);
      if (existing) {
        existing.count += 1;
        existing.total_publish_rate += row.publish_rate || 0;
        existing.total_discount += row.discount_amount || 0;
        existing.total_cashback += row.cashback_amount || 0;
        existing.total_points += row.points_earned || 0;
      } else {
        acc.push({
          date: row.date,
          count: 1,
          total_publish_rate: row.publish_rate || 0,
          total_discount: row.discount_amount || 0,
          total_cashback: row.cashback_amount || 0,
          total_points: row.points_earned || 0,
        });
      }
      return acc;
    }, []);
    
    return NextResponse.json({ data: aggregated }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

/**
 * Helper function to instantiate a Supabase client using the service role.
 * This bypasses row level security and is required for administrative
 * aggregation queries. If the required environment variables are missing
 * this function will throw an error.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/admin/membership
 *
 * This endpoint computes membership tiers for all users based on the sum of
 * points recorded in the reward ledger. It accepts optional `start` and
 * `end` query parameters (ISO date strings) to restrict the calculation
 * to a specific time range. The response is an array of objects
 * containing `user_id`, `membership` and `total_points`. The logic for
 * assigning tiers is rudimentary: users with ≥1000 points are
 * PLATINUM, ≥500 points are GOLD and the rest are SILVER. Modify
 * thresholds as necessary to reflect your business rules.
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
      .from('reward_ledgers')
      .select('user_id, sum(points) as total_points')
      .group('user_id');
    if (start) {
      query = query.gte('created_at', start);
    }
    if (end) {
      query = query.lte('created_at', end);
    }
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Classify membership tiers based on total points
    const result = (data || []).map((row: any) => {
      const totalPoints = Number(row.total_points) || 0;
      let membership: string;
      if (totalPoints >= 1000) {
        membership = 'PLATINUM';
      } else if (totalPoints >= 500) {
        membership = 'GOLD';
      } else {
        membership = 'SILVER';
      }
      return { user_id: row.user_id, membership, total_points: totalPoints };
    });
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

/**
 * calculateHelloDiscount returns the discount percentage based on the
 * publish rate tier. This follows the brief: 5 % for 1–4.99m, 10 % for
 * 5–14.99m and 15 % for ≥15m【89546385958591†L70-L73】. Amounts below
 * 1m do not receive a hello discount.
 */
function calculateHelloDiscount(publishRate: number): number {
  if (publishRate >= 15_000_000) return 0.15;
  if (publishRate >= 5_000_000) return 0.10;
  if (publishRate >= 1_000_000) return 0.05;
  return 0;
}

/**
 * calculatePoints computes the number of points earned on a transaction
 * based on the net amount after discount: 1 point for each Rp 10.000【89546385958591†L84-L85】.
 */
function calculatePoints(netAmount: number): number {
  return Math.floor(netAmount / 10_000);
}

// Points are valued at 250 per point【89546385958591†L84-L89】. This constant can
// be referenced when converting points into a monetary credit. Used here
// solely for clarity; not directly required by this route.
const POINT_VALUE = 250;

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  // Get the authenticated user. If no user is found, return 401.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Fetch transactions belonging to the current user. We assume the
  // foreign key user_id exists in the transactions table to link the
  // transaction to the auth user. Adjust the query as needed.
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 200 });
}

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json();
  const { date, service, origin, destination, publish_rate } = body;
  if (!date || !service || !origin || !destination || !publish_rate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  // Determine if this is the user’s first transaction to apply the hello discount.
  const { data: existingTransactions, error: txErr } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);
  if (txErr) {
    return NextResponse.json({ error: txErr.message }, { status: 500 });
  }
  const isFirstTransaction = !existingTransactions || existingTransactions.length === 0;
  const discountPercentage = isFirstTransaction ? calculateHelloDiscount(publish_rate) : 0;
  const discountAmount = publish_rate * discountPercentage;
  const netAmount = publish_rate - discountAmount;
  const pointsEarned = calculatePoints(netAmount);
  // Insert the transaction; note that user_id must exist in the schema
  const { data: inserted, error: insertError } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      date,
      service,
      origin,
      destination,
      publish_rate,
      discount_amount: discountAmount,
      cashback_amount: null,
      points_earned: pointsEarned,
    })
    .select()
    .single();
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }
  // Insert ledger entry for earned points
  if (pointsEarned > 0) {
    const { error: ledgerError } = await supabase
      .from('reward_ledgers')
      .insert({
        user_id: user.id,
        type: 'POINT',
        points: pointsEarned,
        amount: null,
        ref_id: inserted.id,
        note: 'Points from transaction',
      });
    if (ledgerError) {
      // Log the error but do not fail the transaction insertion.
      console.error('Failed to insert ledger entry', ledgerError);
    }
  }
  return NextResponse.json({ data: inserted }, { status: 201 });
}
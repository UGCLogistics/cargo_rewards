import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

function calculateHelloDiscount(publishRate: number): number {
  if (publishRate >= 15_000_000) return 0.15;
  if (publishRate >= 5_000_000) return 0.10;
  if (publishRate >= 1_000_000) return 0.05;
  return 0;
}

function calculatePoints(netAmount: number): number {
  return Math.floor(netAmount / 10_000);
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Staff import endpoint. Staff users may import transactions on behalf
 * of themselves or their assigned customers. Unlike the admin import,
 * staff users cannot specify arbitrary user_id values. The server will
 * override the user_id for each row with the current user's id. This
 * ensures that staff can only insert their own transactions. The input
 * rows can omit the user_id field entirely. All other fields are
 * required.
 */
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (!['ADMIN', 'MANAGER', 'STAFF'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json();
  const rows = body.rows as any[];
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }
  const requiredFields = ['date', 'service', 'origin', 'destination', 'publish_rate'];
  for (const row of rows) {
    for (const field of requiredFields) {
      if (!row[field]) {
        return NextResponse.json({ error: `Missing field ${field} in one of the rows` }, { status: 400 });
      }
    }
  }
  try {
    const adminClient = getServiceClient();
    const insertedRows: any[] = [];
    for (const row of rows) {
      const { date, service, origin, destination, publish_rate, invoice_no } = row;
      const user_id = user.id; // override to ensure staff cannot insert for others
      const { data: existing, error: existingErr } = await adminClient
        .from('transactions')
        .select('id')
        .eq('user_id', user_id)
        .limit(1);
      if (existingErr) {
        return NextResponse.json({ error: existingErr.message }, { status: 500 });
      }
      const isFirst = !existing || existing.length === 0;
      const discountPercentage = isFirst ? calculateHelloDiscount(Number(publish_rate)) : 0;
      const discountAmount = Number(publish_rate) * discountPercentage;
      const netAmount = Number(publish_rate) - discountAmount;
      const pointsEarned = calculatePoints(netAmount);
      const { data: insertedTx, error: insertErr } = await adminClient
        .from('transactions')
        .insert({
          user_id,
          date,
          service,
          origin,
          destination,
          publish_rate: Number(publish_rate),
          discount_amount: discountAmount,
          cashback_amount: null,
          points_earned: pointsEarned,
          invoice_no: invoice_no || null,
        })
        .select()
        .single();
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
      insertedRows.push(insertedTx);
      if (pointsEarned > 0) {
        const { error: ledgerErr } = await adminClient
          .from('reward_ledgers')
          .insert({
            user_id,
            type: 'POINT',
            points: pointsEarned,
            amount: null,
            ref_id: insertedTx.id,
            note: 'Points from imported transaction',
          });
        if (ledgerErr) {
          console.warn('Failed to insert ledger for staff import', ledgerErr);
        }
      }
    }
    return NextResponse.json({ data: insertedRows }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
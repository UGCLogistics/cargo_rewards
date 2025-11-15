import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

// Calculate hello discount percentage based on publish rate tiers. Replicates
// the business logic used in individual transaction creation. 5% for
// 1–4.99m, 10% for 5–14.99m, 15% for >=15m; otherwise 0.
function calculateHelloDiscount(publishRate: number): number {
  if (publishRate >= 15_000_000) return 0.15;
  if (publishRate >= 5_000_000) return 0.10;
  if (publishRate >= 1_000_000) return 0.05;
  return 0;
}

// Calculate points earned: 1 point per 10,000 Rupiah of net amount
function calculatePoints(netAmount: number): number {
  return Math.floor(netAmount / 10_000);
}

// Create a service role supabase client for full access
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * This endpoint allows administrators (and optionally managers or staff) to
 * import multiple transactions at once from a CSV or Excel file. The
 * request body must contain a `rows` property which is an array of objects
 * with at least the following keys: `user_id`, `date`, `service`,
 * `origin`, `destination`, `publish_rate`, `invoice_no` (optional). The
 * import logic will compute hello discounts and points for each row using
 * current business rules. It will insert transactions and corresponding
 * reward ledger entries.  Only ADMIN or STAFF roles may call this
 * endpoint. If the file contains invalid records, the response will
 * contain an error and no rows will be inserted.
 */
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (!['ADMIN', 'STAFF', 'MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json();
  const rows = body.rows as any[];
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
  }
  // Basic validation: ensure each row has required fields
  const requiredFields = ['user_id', 'date', 'service', 'origin', 'destination', 'publish_rate'];
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
      const { user_id, date, service, origin, destination, publish_rate, invoice_no } = row;
      // Determine if this is the first transaction for the user
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
      // Insert transaction
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
      // Insert ledger entry for points
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
          // Log error but continue; ledger insertion failure should not
          // interrupt import but should be surfaced
          console.warn('Failed to insert ledger entry for transaction', insertedTx.id, ledgerErr);
        }
      }
    }
    return NextResponse.json({ data: insertedRows }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
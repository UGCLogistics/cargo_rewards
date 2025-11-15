import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

// Create a service role client. See users route for details.
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Program configuration management endpoint. Administrators can view and
 * update configuration values stored in the `program_configs` table. Each
 * config entry has a unique `key` and JSON `value`. Use this endpoint
 * to manage Hello Discount tiers, cashback percentages, point multipliers
 * and other program parameters. Only the ADMIN role may access this
 * endpoint.
 */
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  // Allow both ADMIN and MANAGER to read program configurations. Only ADMIN may modify them (see PUT handler).
  if (role !== 'ADMIN' && role !== 'MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const adminClient = getServiceClient();
    const { data, error } = await adminClient
      .from('program_configs')
      .select('id, key, value, created_at, updated_at')
      .order('key');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json();
  const { key, value } = body;
  if (!key || typeof value === 'undefined') {
    return NextResponse.json({ error: 'Missing key or value' }, { status: 400 });
  }
  try {
    const adminClient = getServiceClient();
    // Upsert the config record. If it exists, update; if not, insert.
    const { error } = await adminClient
      .from('program_configs')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerSupabaseClient as createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

// Service role client to bypass RLS for listing customers
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/manager/customers
 *
 * Returns a list of customers. Accessible to users with the MANAGER or ADMIN
 * role. We use the service role client because the customers table has
 * no RLS policies and we want to retrieve all records. If the user is
 * not authorized, a 403 response is returned.
 */
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (role !== 'MANAGER' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const adminClient = getServiceClient();
    const { data, error: err } = await adminClient.from('customers').select('*').order('created_at', { ascending: false });
    if (err) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
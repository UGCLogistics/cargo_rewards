import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

/**
 * Helper to instantiate a Supabase client using the service role key.
 * This is required for administrative queries that must bypass RLS.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/admin/customers
 *
 * Returns a list of all customers. Only authenticated users with the
 * ADMIN role may access this endpoint. Data is returned from the
 * `public.customers` table. There is no RLS on this table by default,
 * so we use the service role client to ensure full access.
 */
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (role !== 'ADMIN') {
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

/**
 * POST /api/admin/customers
 *
 * Creates a new customer record. Only users with the ADMIN role may
 * create customers. The request body must include at least the
 * `company_name` field. Additional optional fields include
 * tax_id, businessfield, pic_name, phone, email, address and salesname.
 * Returns the newly created customer row on success.
 */
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json();
  const {
    company_name,
    tax_id,
    businessfield,
    pic_name,
    phone,
    email: customer_email,
    address,
    salesname,
    user_id,
  } = body;
  if (!company_name) {
    return NextResponse.json({ error: 'company_name is required' }, { status: 400 });
  }
  try {
    const adminClient = getServiceClient();
    const { data, error: err } = await adminClient
      .from('customers')
      .insert({
        company_name,
        tax_id: tax_id || null,
        businessfield: businessfield || null,
        pic_name: pic_name || null,
        phone: phone || null,
        email: customer_email || null,
        address: address || null,
        salesname: salesname || null,
        user_id: user_id || null,
      })
      .select('*')
      .single();
    if (err) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
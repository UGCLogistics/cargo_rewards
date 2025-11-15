import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client using the service role to perform admin operations.
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/admin/users/create
 *
 * Creates a new user in the Supabase auth system and inserts a
 * corresponding row into the public.users table. Only users with
 * the ADMIN role may invoke this endpoint. The request body must
 * include `email` and `password`. Optionally include `name` and
 * `role` (defaults to CUSTOMER). The new user is automatically
 * confirmed via email_confirm option and the custom role is stored
 * in auth.user_metadata.
 */
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const currentRole = (user.user_metadata as any)?.role;
  if (currentRole !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json();
  const { email, password, name, role } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
  }
  const newRole = role || 'CUSTOMER';
  try {
    const adminClient = getServiceClient();
    // Create the user via the admin API. Set email_confirm to true to avoid requiring email verification.
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: newRole,
        name: name || null,
      },
    });
    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 500 });
    }
    const newUserId = created?.user?.id;
    if (!newUserId) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
    // Insert into our extended users table. We only insert id, name and role; status defaults to ACTIVE.
    const { data: insertData, error: insertErr } = await adminClient
      .from('users')
      .insert({ id: newUserId, name: name || null, role: newRole })
      .select('*')
      .single();
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    return NextResponse.json({ data: insertData }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
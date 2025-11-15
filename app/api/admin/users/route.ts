import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

// Helper to create a Supabase client with the service role key. This client
// bypasses RLS policies and can access any table or auth admin API. The
// service role key must be provided via the SUPABASE_SERVICE_ROLE env var.
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    throw new Error('Supabase service role environment variables are not set');
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/**
 * This route provides administrative access to the list of users and allows
 * updating their role. Only authenticated users with the ADMIN role may
 * perform actions on this endpoint.  The GET handler returns all rows
 * from the public.users table (id, name, role, status, created_at).  The
 * PATCH handler updates the role for a given user id and optionally their
 * status. Future enhancements may update the auth.users metadata via the
 * admin API.
 */

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const adminClient = getServiceClient();
    // Fetch all users from our extended users table. We do not join the
    // auth.users table for email, but the id and name are present. If
    // additional fields like email are required, you can query auth.users
    // via the admin API. This is kept simple here to avoid complexity.
    const { data, error } = await adminClient
      .from('users')
      .select('id, name, role, status, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
  const { id, newRole, status } = body;
  if (!id || !newRole) {
    return NextResponse.json({ error: 'Missing id or newRole' }, { status: 400 });
  }
  try {
    const adminClient = getServiceClient();
    // Update the role and/or status in our public.users table
    const updates: Record<string, any> = { role: newRole };
    if (status) updates.status = status;
    updates.updated_at = new Date().toISOString();
    const { error: updateErr } = await adminClient
      .from('users')
      .update(updates)
      .eq('id', id);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    // Optionally update auth.users metadata for the user. Catch errors but
    // don't fail the request if this update fails.
    try {
      await adminClient.auth.admin.updateUserById(id, { user_metadata: { role: newRole } });
    } catch (metaErr) {
      console.warn('Failed to update user metadata', metaErr);
    }
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
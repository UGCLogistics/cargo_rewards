import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

/**
 * Admin API for redeem approvals. Only users with role ADMIN or MANAGER
 * may call these endpoints. The GET handler returns pending
 * redemption requests. The PATCH handler updates the status of a
 * redemption to APPROVED or REJECTED.
 */
export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (role !== 'ADMIN' && role !== 'MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { data, error } = await supabase
    .from('redemptions')
    .select('*')
    .eq('status', 'PENDING');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 200 });
}

export async function PATCH(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.user_metadata as any)?.role;
  if (role !== 'ADMIN' && role !== 'MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id, action } = await request.json();
  if (!id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }
  // Determine new status
  const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
  const { error: updateErr } = await supabase
    .from('redemptions')
    .update({ status: newStatus, approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  // Record an audit log entry. We do not enforce RLS on audit_logs, so this
  // insert should succeed if the table has no restrictive policy. The
  // payload stores the new status for reference.
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    action: action === 'approve' ? 'REDEEM_APPROVED' : 'REDEEM_REJECTED',
    entity_type: 'REDEMPTION',
    entity_id: id,
    payload: { status: newStatus },
  });
  return NextResponse.json({ success: true }, { status: 200 });
}
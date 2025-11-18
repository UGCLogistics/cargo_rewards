import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerSupabaseClient as createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data, error } = await supabase
    .from('redemptions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
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
  const { kind, points_used, amount } = body;
  if (!kind || !points_used || !amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const { data: inserted, error } = await supabase
    .from('redemptions')
    .insert({
      user_id: user.id,
      kind,
      points_used,
      amount,
      status: 'PENDING',
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: inserted }, { status: 201 });
}
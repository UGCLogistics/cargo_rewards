import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
// PERHATIKAN BARIS DI BAWAH INI ADALAH KUNCI PERBAIKANNYA:
import { createRouteHandlerSupabaseClient as createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies, headers });
  
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (user.user_metadata as any)?.role;
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  try {
    const adminClient = getServiceClient();

    let query = adminClient
      .from('transaction_daily_kpi')
      .select('*')
      .order('date', { ascending: true });

    if (start) {
      query = query.gte('date', start);
    }
    if (end) {
      query = query.lte('date', end);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });

  } catch (err: any) {
    console.error('Server Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
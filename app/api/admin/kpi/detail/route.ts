import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createRouteHandlerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

// Setup Admin Client untuk bypass RLS jika diperlukan
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Cek kedua kemungkinan nama variable agar aman
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
  // 1. Cek Autentikasi User (Login Session)
  const supabase = createRouteHandlerSupabaseClient({ cookies, headers });
  
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Cek Role Admin
  const role = (user.user_metadata as any)?.role;
  if (role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Ambil Parameter URL
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  try {
    const adminClient = getServiceClient();

    // REVISI UTAMA DISINI:
    // Jangan gunakan .group(), tapi panggil View 'transaction_daily_kpi'
    // View ini sudah berisi data yang sudah di-sum dan di-group di database
    let query = adminClient
      .from('transaction_daily_kpi')
      .select('*')
      .order('date', { ascending: true });

    // Filter berdasarkan tanggal jika ada
    if (start) {
      query = query.gte('date', start);
    }
    if (end) {
      query = query.lte('date', end);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase Error:', error.message); // Log error untuk debugging di Vercel
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });

  } catch (err: any) {
    console.error('Server Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
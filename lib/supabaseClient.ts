'use client';

import { createClient } from '@supabase/supabase-js';

// Pastikan .env.local berisi:
// NEXT_PUBLIC_SUPABASE_URL=...
// NEXT_PUBLIC_SUPABASE_ANON_KEY=...

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client Supabase untuk dipakai di komponen client (AuthContext, dsb)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;

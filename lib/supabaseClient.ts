'use client';

import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';

// Versi browser client yang otomatis sinkron dengan middleware
// dan menyimpan session di cookie (bukan cuma localStorage).
const supabase = createBrowserSupabaseClient();

export default supabase;

'use client';

import { createClient } from "@/lib/supabase/client";

// Versi browser client yang otomatis sinkron dengan middleware
// dan menyimpan session di cookie (bukan cuma localStorage).
const supabase = createClient();

export default supabase;

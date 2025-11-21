import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";




export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Service role client (bypass RLS)
function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function isReadRole(role: unknown) {
  if (!role) return false;
  const r = String(role).toUpperCase();
  // ADMIN & MANAGER boleh baca
  return r === "ADMIN" || r === "MANAGER";
}

function isAdmin(role: unknown) {
  return String(role || "").toUpperCase() === "ADMIN";
}

/**
 * GET /api/admin/program-config
 * Baca semua konfigurasi dari tabel program_configs.
 */
export async function GET(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isReadRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("program_configs")
      .select("id, key, value, created_at, updated_at")
      .order("key");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    console.error("GET /program-config error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/program-config
 * Upsert 1 config (key unik).
 * Hanya ADMIN yang boleh modify.
 */
export async function PUT(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isAdmin(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { key, value } = body;
    if (!key || typeof value === "undefined") {
      return NextResponse.json(
        { error: "Missing key or value" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const { error } = await supabase
      .from("program_configs")
      .upsert(
        {
          key,
          value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("PUT /program-config error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

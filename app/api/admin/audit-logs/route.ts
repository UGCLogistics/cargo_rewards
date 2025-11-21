import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function isInternalRole(role: unknown) {
  if (!role) return false;
  const r = String(role).toUpperCase();
  return r === "ADMIN" || r === "MANAGER" || r === "STAFF";
}

/**
 * GET /api/admin/audit-logs
 * Query params:
 *  - page      : nomor halaman (default 1)
 *  - pageSize  : jumlah per halaman (default 50, max 200)
 *  - start     : filter created_at >= start (YYYY-MM-DD)
 *  - end       : filter created_at <= end (YYYY-MM-DD)
 *  - q         : search di user_id / action / entity_type
 *
 * Hanya untuk role internal (ADMIN / MANAGER / STAFF).
 */
export async function GET(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isInternalRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const pageParam = url.searchParams.get("page") || "1";
    const pageSizeParam = url.searchParams.get("pageSize") || "50";
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const q = url.searchParams.get("q");

    let page = parseInt(pageParam, 10);
    if (Number.isNaN(page) || page < 1) page = 1;

    let pageSize = parseInt(pageSizeParam, 10);
    if (Number.isNaN(pageSize) || pageSize < 1) pageSize = 50;
    if (pageSize > 200) pageSize = 200;

    const supabase = getServiceClient();

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (start) {
      query = query.gte("created_at", start);
    }
    if (end) {
      // cukup pakai tanggal mentah; kalau mau detail bisa tambahkan jam 23:59:59
      query = query.lte("created_at", end);
    }

    if (q && q.trim()) {
      const term = q.trim();
      query = query.or(
        `user_id.ilike.%${term}%,action.ilike.%${term}%,entity_type.ilike.%${term}%`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        data: data || [],
        meta: {
          page,
          pageSize,
          total: count ?? null,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /api/admin/audit-logs error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

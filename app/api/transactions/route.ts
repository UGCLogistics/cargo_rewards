import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";




export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Supabase service client (bypass RLS).
 * HANYA dipakai di server.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/transactions
 *
 * Query params:
 *  - scope=all        → ambil semua transaksi
 *  - scope=self&userId=<uuid> → hanya transaksi user tersebut
 *  - startDate=YYYY-MM-DD (opsional)
 *  - endDate=YYYY-MM-DD   (opsional)
 *
 * Output: { data: [ { ..., company_name } ] }
 */
export async function GET(request: Request) {
  try {
    const supabase = getServiceClient();

    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") || "self";
    const userIdParam = url.searchParams.get("userId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    // --- Ambil transaksi dasar ---
    let query = supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });

    if (scope === "self") {
      if (!userIdParam) {
        return NextResponse.json(
          { error: "userId required for scope=self" },
          { status: 400 }
        );
      }
      query = query.eq("user_id", userIdParam);
    }
    // scope=all → tidak pakai filter user_id

    if (startDate) query = query.gte("date", startDate);
    if (endDate) query = query.lte("date", endDate);

    const { data: trxRows, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!trxRows || trxRows.length === 0) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    // --- Join ke public.customers untuk dapat company_name ---
    const userIds = Array.from(
      new Set(
        (trxRows as any[])
          .map((row) => row.user_id)
          .filter((v) => v !== null && v !== undefined)
      )
    );

    let companyMap = new Map<string, string | null>();

    if (userIds.length > 0) {
      const { data: custRows, error: custError } = await supabase
        .from("customers")
        .select("user_id, company_name")
        .in("user_id", userIds);

      if (custError) {
        console.error("Failed to fetch customers:", custError.message);
      } else if (custRows) {
        companyMap = new Map(
          (custRows as any[]).map((c) => [
            c.user_id as string,
            c.company_name as string,
          ])
        );
      }
    }

    const merged = (trxRows as any[]).map((row) => ({
      ...row,
      company_name: companyMap.get(row.user_id) ?? null,
    }));

    return NextResponse.json({ data: merged }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/transactions error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

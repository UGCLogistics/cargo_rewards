// app/api/transactions/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase service client (pakai SERVICE_ROLE, bypass RLS).
 * Wajib: SUPABASE_SERVICE_ROLE cuma di-define di server (Vercel env), JANGAN di-expose ke client.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceClient();
    const { searchParams } = new URL(req.url);

    const scope = (searchParams.get("scope") ?? "self").toLowerCase();
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const companyName = searchParams.get("companyName");

    // base query: AMBIL DATA MENTAH DARI TABEL transactions
    // pastiin kolomnya sesuai sama schema lu
    let query = supabase
      .from("transactions")
      .select(
        `
        id,
        user_id,
        date,
        origin,
        destination,
        publish_rate,
        discount_amount,
        company_name
      `
      );

    // scope=self → cuma transaksi si user
    if (scope === "self") {
      if (!userId) {
        return NextResponse.json(
          { error: "userId is required when scope=self" },
          { status: 400 }
        );
      }
      query = query.eq("user_id", userId);
    }

    // filter tanggal (inclusive)
    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    // filter perusahaan (hanya internal, scope=all)
    if (
      scope === "all" &&
      companyName &&
      companyName !== "ALL"
    ) {
      query = query.eq("company_name", companyName);
    }

    // order by terbaru dulu
    query = query
      .order("date", { ascending: false })
      .order("id", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("[/api/transactions] Supabase error:", error);
      return NextResponse.json(
        { error: "Gagal memuat transaksi" },
        { status: 500 }
      );
    }

    // selalu balikin array
    return NextResponse.json({
      data: data ?? [],
    });
  } catch (err) {
    console.error("[/api/transactions] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

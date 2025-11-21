import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Supabase service-role client (bypass RLS untuk agregat admin) */
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
 * Hitung tier membership berdasarkan total transaksi (Rp)
 * SILVER   : default
 * GOLD     : >= 50.000.000
 * PLATINUM : >= 150.000.000
 */
function getTierFromSpending(
  total: number
): "SILVER" | "GOLD" | "PLATINUM" {
  if (total >= 150_000_000) return "PLATINUM";
  if (total >= 50_000_000) return "GOLD";
  return "SILVER";
}

/**
 * GET /api/admin/membership
 *
 * Mengembalikan daftar status membership semua user,
 * berdasarkan total transaksi (sum(publish_rate)) per user.
 *
 * Query params (opsional):
 *   - start: YYYY-MM-DD  → filter tanggal >= start
 *   - end  : YYYY-MM-DD  → filter tanggal <= end
 *
 * Jika start & end kosong → TIDAK ada filter tanggal (semua data).
 */
export async function GET(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isInternalRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const startParam = url.searchParams.get("start");
    const endParam = url.searchParams.get("end");

    const effectiveStart = startParam || null;
    const effectiveEnd = endParam || null;

    const supabase = getServiceClient();

    // Ambil semua transaksi (dengan filter tanggal kalau ada)
    let query = supabase
      .from("transactions")
      .select("user_id, publish_rate, date");

    if (effectiveStart) {
      query = query.gte("date", effectiveStart);
    }
    if (effectiveEnd) {
      query = query.lte("date", effectiveEnd);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregasi per user_id
    type Agg = { total: number; count: number; lastDate: string | null };
    const totalsMap = new Map<string, Agg>();

    for (const row of data || []) {
      const r: any = row;
      const userId = r.user_id as string | null;
      if (!userId) continue;

      const amount = Number(r.publish_rate) || 0;
      const dateStr = r.date as string | null;

      const prev: Agg = totalsMap.get(userId) ?? {
        total: 0,
        count: 0,
        lastDate: null,
      };

      let lastDate = prev.lastDate;
      if (dateStr) {
        if (!lastDate || new Date(dateStr) > new Date(lastDate)) {
          lastDate = dateStr;
        }
      }

      totalsMap.set(userId, {
        total: prev.total + amount,
        count: prev.count + 1,
        lastDate,
      });
    }

    const userIds = Array.from(totalsMap.keys());

    // Ambil info customer (company_name, salesname)
    let customerMap = new Map<
      string,
      { company_name: string | null; salesname: string | null }
    >();

    if (userIds.length > 0) {
      const { data: custRows, error: custError } = await supabase
        .from("customers")
        .select("user_id, company_name, salesname")
        .in("user_id", userIds);

      if (custError) {
        console.error("Failed to fetch customers:", custError.message);
      } else if (custRows) {
        for (const c of custRows as any[]) {
          customerMap.set(c.user_id as string, {
            company_name: c.company_name ?? null,
            salesname: c.salesname ?? null,
          });
        }
      }
    }

    // Untuk status aktivitas, pakai endDate kalau ada, kalau tidak pakai hari ini
    const endDateObj = effectiveEnd ? new Date(effectiveEnd) : new Date();

    const result = Array.from(totalsMap.entries()).map(
      ([user_id, agg]) => {
        const tier = getTierFromSpending(agg.total);

        let nextThreshold: number | null = null;
        if (tier === "SILVER") nextThreshold = 50_000_000;
        else if (tier === "GOLD") nextThreshold = 150_000_000;

        const amountToNext =
          nextThreshold !== null ? Math.max(0, nextThreshold - agg.total) : 0;

        // Status aktivitas berdasarkan jeda hari dari transaksi terakhir
        let activity_status: "ACTIVE" | "PASSIVE" | "RISK" | "DORMANT" = "DORMANT";
        if (agg.lastDate) {
          const last = new Date(agg.lastDate);
          const diffMs = endDateObj.getTime() - last.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);

          if (diffDays < 15) activity_status = "ACTIVE";
          else if (diffDays <= 30) activity_status = "PASSIVE";
          else if (diffDays <= 45) activity_status = "RISK";
          else activity_status = "DORMANT";
        }

        const cust = customerMap.get(user_id) ?? {
          company_name: null,
          salesname: null,
        };

        return {
          user_id,
          company_name: cust.company_name,
          salesname: cust.salesname,
          total_spending: agg.total,
          total_shipments: agg.count,
          last_transaction_date: agg.lastDate,
          tier,
          amount_to_next_tier: amountToNext,
          activity_status,
        };
      }
    );

    return NextResponse.json(
      {
        data: result,
        meta: {
          start: effectiveStart,
          end: effectiveEnd,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /api/admin/membership error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

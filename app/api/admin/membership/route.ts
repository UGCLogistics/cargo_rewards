// app/api/admin/membership/route.ts
import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// pastikan route ini tidak pernah di-cache di layer Next/Vercel
export const fetchCache = "default-no-store";

/** Supabase service-role client (bypass RLS untuk agregat admin) */
function getServiceClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error(
      "Supabase environment variables are missing (SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE)"
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function isInternalRole(role: unknown) {
  if (!role) return false;
  const r = String(role).toUpperCase();
  return r === "ADMIN" || r === "MANAGER" || r === "STAFF";
}

/**
 * Default fallback tier dari total transaksi (kalau tidak ketemu di membership_periods)
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
 * Mengembalikan daftar status membership semua user.
 *
 * Query params (opsional):
 *   - start: YYYY-MM-DD  → filter tanggal transaksi >= start
 *   - end  : YYYY-MM-DD  → filter tanggal transaksi <= end
 *
 * Tier:
 *   - Jika start & end kosong → tier diambil dari membership_periods
 *     dengan current_membership_status = 'CURRENT' (tier terakhir).
 *   - Jika ada start/end     → tier diambil dari membership_periods
 *     yang periodenya overlap dengan range filter (start–end).
 *   - Jika masih tidak ketemu → fallback ke perhitungan dari total transaksi.
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

    // 1) Ambil semua transaksi (dengan filter tanggal kalau ada)
    let txQuery = supabase
      .from("transactions")
      .select("user_id, publish_rate, date");

    if (effectiveStart) {
      txQuery = txQuery.gte("date", effectiveStart);
    }
    if (effectiveEnd) {
      txQuery = txQuery.lte("date", effectiveEnd);
    }

    const { data: txRows, error: txError } = await txQuery;

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    // 2) Aggregasi transaksi per user_id
    type Agg = { total: number; count: number; lastDate: string | null };
    const totalsMap = new Map<string, Agg>();

    for (const row of txRows || []) {
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

    // 3) Ambil tier dari membership_periods sesuai aturan:
    //    - tanpa filter: current_membership_status = 'CURRENT'
    //    - dengan filter: periode overlap dengan start/end
    const tierMap = new Map<string, "SILVER" | "GOLD" | "PLATINUM">();

    if (userIds.length > 0) {
      let mpQuery = supabase
        .from("membership_periods")
        .select(
          "user_id, tier, period_start, period_end, current_membership_status"
        )
        .in("user_id", userIds);

      if (!effectiveStart && !effectiveEnd) {
        // Tanpa filter tanggal → pakai CURRENT (tier terakhir saat ini)
        mpQuery = mpQuery.eq("current_membership_status", "CURRENT");
      } else {
        // Dengan filter tanggal → periode membership yang overlap dengan range filter
        const startDate = effectiveStart ?? effectiveEnd!;
        const endDate = effectiveEnd ?? effectiveStart!;
        mpQuery = mpQuery
          .gte("period_end", startDate)
          .lte("period_start", endDate);
      }

      const { data: mpRows, error: mpError } = await mpQuery;

      if (mpError) {
        return NextResponse.json({ error: mpError.message }, { status: 500 });
      }

      type TierInfo = {
        tier: "SILVER" | "GOLD" | "PLATINUM";
        period_end: string | null;
      };

      const tmpMap = new Map<string, TierInfo>();

      for (const row of (mpRows || []) as any[]) {
        const uid = row.user_id as string | null;
        if (!uid) continue;

        const rawTier = String(row.tier || "").toUpperCase();
        let t: "SILVER" | "GOLD" | "PLATINUM";
        if (rawTier === "GOLD") t = "GOLD";
        else if (rawTier === "PLATINUM") t = "PLATINUM";
        else t = "SILVER";

        const periodEnd = (row.period_end as string | null) ?? null;
        const prev = tmpMap.get(uid);

        // Simpan yang period_end-nya paling akhir (tier terakhir di range tsb)
        if (
          !prev ||
          (periodEnd && (!prev.period_end || periodEnd > prev.period_end))
        ) {
          tmpMap.set(uid, { tier: t, period_end: periodEnd });
        }
      }

      for (const [uid, info] of tmpMap.entries()) {
        tierMap.set(uid, info.tier);
      }
    }

    // 4) Ambil info customer (company_name, salesname, company_code)
    const customerMap = new Map<
      string,
      {
        company_name: string | null;
        salesname: string | null;
        company_code: string | null;
      }
    >();

    if (userIds.length > 0) {
      const { data: custRows, error: custError } = await supabase
        .from("customers")
        .select("user_id, company_name, salesname, company_code")
        .in("user_id", userIds);

      if (custError) {
        console.error("Failed to fetch customers:", custError.message);
      } else if (custRows) {
        for (const c of custRows as any[]) {
          customerMap.set(c.user_id as string, {
            company_name: c.company_name ?? null,
            salesname: c.salesname ?? null,
            company_code: c.company_code ?? null,
          });
        }
      }
    }

    // 5) Ambil user_code dari tabel users
    const userMap = new Map<string, { user_code: string | null }>();

    if (userIds.length > 0) {
      const { data: userRows, error: userErr } = await supabase
        .from("users")
        .select("id, user_code")
        .in("id", userIds);

      if (userErr) {
        console.error("Failed to fetch users:", userErr.message);
      } else if (userRows) {
        for (const u of userRows as any[]) {
          userMap.set(u.id as string, {
            user_code: u.user_code ?? null,
          });
        }
      }
    }

    // 6) Hitung status aktivitas (pakai endDate kalau ada, kalau tidak pakai hari ini)
    const endDateObj = effectiveEnd ? new Date(effectiveEnd) : new Date();

    const result = Array.from(totalsMap.entries()).map(([user_id, agg]) => {
      // Tier utama diambil dari membership_periods (tierMap),
      // kalau tidak ada → fallback ke perhitungan dari total spending
      const tierFromMp = tierMap.get(user_id);
      const tier: "SILVER" | "GOLD" | "PLATINUM" =
        tierFromMp ?? getTierFromSpending(agg.total);

      let nextThreshold: number | null = null;
      if (tier === "SILVER") nextThreshold = 50_000_000;
      else if (tier === "GOLD") nextThreshold = 150_000_000;

      const amountToNext =
        nextThreshold !== null ? Math.max(0, nextThreshold - agg.total) : 0;

      // Status aktivitas berdasarkan jeda hari dari transaksi terakhir
      let activity_status: "ACTIVE" | "PASSIVE" | "RISK" | "DORMANT" =
        "DORMANT";
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
        company_code: null,
      };
      const usr = userMap.get(user_id) ?? {
        user_code: null,
      };

      return {
        user_id,
        user_code: usr.user_code,
        company_code: cust.company_code,
        company_name: cust.company_name,
        salesname: cust.salesname,
        total_spending: agg.total,
        total_shipments: agg.count,
        last_transaction_date: agg.lastDate,
        tier,
        amount_to_next_tier: amountToNext,
        activity_status,
      };
    });

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

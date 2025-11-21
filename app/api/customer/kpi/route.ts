import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type KpiTotals = {
  total_transactions: number;
  total_publish_rate: number;
  total_discount: number;
  total_cashback: number;      // hanya ACTIVE_CASHBACK_3M
  total_points: number;        // total poin pernah didapat (points > 0)
  points_redeemed: number;     // poin sudah dipakai (abs(points < 0))
  points_remaining: number;    // sisa poin = earned - redeemed
};

/**
 * KPI eksternal customer:
 * - total pengiriman
 * - total transaksi (publish_rate)
 * - total diskon
 * - total cashback 3 bulan pertama (ACTIVE_CASHBACK_3M)
 * - total poin (earned), poin diredeem, poin tersisa
 *
 * Filter optional: ?start=YYYY-MM-DD&end=YYYY-MM-DD
 */
export async function GET(request: Request) {
  try {
    const supabase = createSupabaseServerClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (user.user_metadata as any)?.role;
    if (!["ADMIN", "MANAGER", "STAFF", "CUSTOMER"].includes(String(role))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    // 1) TRANSAKSI → total pengiriman, publish_rate, diskon
    let txQuery = supabase
      .from("transactions")
      .select(
        "id, date, publish_rate, discount_amount"
      )
      .eq("user_id", user.id);

    if (start) txQuery = txQuery.gte("date", start);
    if (end) txQuery = txQuery.lte("date", end);

    const { data: txData, error: txError } = await txQuery;

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    const txRows = (txData ?? []) as any[];

    const totals: KpiTotals = txRows.reduce<KpiTotals>(
      (acc, row) => {
        acc.total_transactions += 1;
        acc.total_publish_rate += Number(row.publish_rate) || 0;
        acc.total_discount += Number(row.discount_amount) || 0;
        return acc;
      },
      {
        total_transactions: 0,
        total_publish_rate: 0,
        total_discount: 0,
        total_cashback: 0,
        total_points: 0,
        points_redeemed: 0,
        points_remaining: 0,
      }
    );

    // 2) CASHBACK & POIN → dari reward_ledgers
    let ledgerQuery = supabase
      .from("reward_ledgers")
      .select("type, amount, points, created_at")
      .eq("user_id", user.id);

    if (start) ledgerQuery = ledgerQuery.gte("created_at", start);
    if (end) ledgerQuery = ledgerQuery.lte("created_at", end);

    const { data: ledgerData, error: ledgerError } = await ledgerQuery;

    if (ledgerError) {
      return NextResponse.json({ error: ledgerError.message }, { status: 500 });
    }

    const ledgerRows = (ledgerData ?? []) as any[];

    let totalCashback3M = 0;
    let totalPointsEarned = 0;
    let totalPointsRedeemed = 0;

    for (const row of ledgerRows) {
      const type = String(row.type || "").toUpperCase();
      const amount = Number(row.amount) || 0;
      const pts = Number(row.points) || 0;

      // Cashback hanya dari ACTIVE_CASHBACK_3M
      if (type === "ACTIVE_CASHBACK_3M" && amount > 0) {
        totalCashback3M += amount;
      }

      // Poin: positif = earned, negatif = redeem/adjust
      if (pts > 0) {
        totalPointsEarned += pts;
      } else if (pts < 0) {
        totalPointsRedeemed += -pts; // disimpan sebagai angka positif
      }
    }

    const remainingPoints = totalPointsEarned - totalPointsRedeemed;

    totals.total_cashback = totalCashback3M;
    totals.total_points = totalPointsEarned;
    totals.points_redeemed = totalPointsRedeemed;
    totals.points_remaining = remainingPoints;

    return NextResponse.json({ data: totals }, { status: 200 });
  } catch (err: any) {
    console.error("Error /api/customer/kpi:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

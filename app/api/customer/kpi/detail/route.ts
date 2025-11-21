import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createRouteHandlerSupabaseClient } from "@supabase/auth-helpers-nextjs";

type DetailRow = {
  date: string;
  count: number;
  total_publish_rate: number;
  total_discount: number;
  total_cashback: number;
  total_points: number;
};

/**
 * Detail KPI eksternal (harian) untuk customer.
 * Cashback diambil dari reward_ledgers (type = ACTIVE_CASHBACK_3M) dan dimerge per tanggal.
 * Poin harian tetap dari transactions.points_earned (poin yang diperoleh dari transaksi).
 */
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerSupabaseClient({
      cookies,
      headers,
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    // 1) TRANSAKSI → agregasi per tanggal (tanpa cashback)
    let txQuery = supabase
      .from("transactions")
      .select(
        "id, date, publish_rate, discount_amount, points_earned"
      )
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (start) txQuery = txQuery.gte("date", start);
    if (end) txQuery = txQuery.lte("date", end);

    const { data: txData, error: txError } = await txQuery;

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    const byDate: Record<string, DetailRow> = {};
    const txRows = (txData ?? []) as any[];

    for (const row of txRows) {
      const date = row.date as string;

      if (!byDate[date]) {
        byDate[date] = {
          date,
          count: 0,
          total_publish_rate: 0,
          total_discount: 0,
          total_cashback: 0,
          total_points: 0,
        };
      }

      byDate[date].count += 1;
      byDate[date].total_publish_rate += Number(row.publish_rate) || 0;
      byDate[date].total_discount += Number(row.discount_amount) || 0;
      byDate[date].total_points += Number(row.points_earned) || 0;
    }

    // 2) CASHBACK → dari reward_ledgers (type = ACTIVE_CASHBACK_3M), dimerge per created_at::date
    let ledgerQuery = supabase
      .from("reward_ledgers")
      .select("type, amount, created_at")
      .eq("user_id", user.id);

    if (start) ledgerQuery = ledgerQuery.gte("created_at", start);
    if (end) ledgerQuery = ledgerQuery.lte("created_at", end);

    const { data: ledgerData, error: ledgerError } = await ledgerQuery;

    if (ledgerError) {
      return NextResponse.json({ error: ledgerError.message }, { status: 500 });
    }

    const ledgerRows = (ledgerData ?? []) as any[];

    for (const row of ledgerRows) {
      const type = String(row.type || "").toUpperCase();
      if (type !== "ACTIVE_CASHBACK_3M") continue; // hanya cashback 3 bulan pertama

      const createdAt: string = row.created_at;
      if (!createdAt) continue;

      const date = createdAt.slice(0, 10); // YYYY-MM-DD

      if (!byDate[date]) {
        byDate[date] = {
          date,
          count: 0,
          total_publish_rate: 0,
          total_discount: 0,
          total_cashback: 0,
          total_points: 0,
        };
      }

      byDate[date].total_cashback += Number(row.amount) || 0;
    }

    const aggregated = Object.values(byDate).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return NextResponse.json({ data: aggregated }, { status: 200 });
  } catch (err: any) {
    console.error("Error /api/customer/kpi/detail:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

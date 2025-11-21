
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/api/rewards/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";



/**
 * Supabase service client (pakai SERVICE_ROLE, bypass RLS).
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/rewards?userId=...
 *
 * Balikkan:
 * - history: gabungan ledger + redemptions + transaksi
 * - ledgers: raw reward_ledgers
 * - redemptions: raw redemptions
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // 1) ambil reward_ledgers + redemptions untuk user tsb
    const [
      { data: ledgerData, error: ledgerError },
      { data: redemptionData, error: redemptionError },
    ] = await Promise.all([
      supabase
        .from("reward_ledgers")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("redemptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (ledgerError) {
      return NextResponse.json(
        { error: ledgerError.message },
        { status: 500 }
      );
    }

    if (redemptionError) {
      return NextResponse.json(
        { error: redemptionError.message },
        { status: 500 }
      );
    }

    const ledgers = (ledgerData ?? []) as any[];
    const redemptions = (redemptionData ?? []) as any[];

    // 2) ambil transaksi yang direferensikan (POINT_TX → ref_id → transactions.id)
    const refIds = Array.from(
      new Set(
        ledgers
          .map((row) => row.ref_id)
          .filter((v: any) => v !== null && v !== undefined)
      )
    );

    let txMap: Record<string, any> = {};

    if (refIds.length > 0) {
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .in("id", refIds);

      if (txError) {
        return NextResponse.json(
          { error: txError.message },
          { status: 500 }
        );
      }

      txMap = Object.fromEntries(
        (txData ?? []).map((tx: any) => [String(tx.id), tx])
      );
    }

    // 3) susun history gabungan
    const history: any[] = [];

    // a. dari reward_ledgers (perolehan poin / cashback / bonus)
    for (const row of ledgers) {
      const type = String(row.type || "").toUpperCase();
      const rewardDate = row.created_at;
      const tx = row.ref_id != null ? txMap[String(row.ref_id)] : undefined;

      const points = toNumber(row.points);

      // base transaksi & diskon & cashback dari tabel transactions
      const publishRate = tx ? toNumber(tx.publish_rate) : null;
      const discountAmount = tx ? toNumber(tx.discount_amount) : null;
      const cashbackFromTx = tx ? toNumber(tx.cashback_amount) : null;

      // base perhitungan poin = nilai transaksi (publish_rate)
      const baseAmount = publishRate;

      // multiplier = perolehan poin / (base transaksi / 10.000)
      //            = (points * 10.000) / baseAmount
      let pointsMultiplier: number | null = null;
      if (points != null && baseAmount && baseAmount > 0) {
        pointsMultiplier = (points * 10_000) / baseAmount;
      }

      const entry: any = {
        id: `ledger-${row.id}`,
        source: "LEDGER",
        category: "OTHER",
        type,
        transactionDate: tx?.date ?? null,
        rewardDate,
        created_at: rewardDate, // buat sorting/filter di FE
        title: row.note || type || "Aktivitas rewards",
        note: row.note,
        pointsDelta: points,
        baseAmount,
        discountAmount,
        cashbackAmount: cashbackFromTx,
        pointsMultiplier,
        status: null as string | null,
      };

      if (tx) {
        entry.transaction = {
          id: tx.id,
          date: tx.date,
          service: tx.service,
          origin: tx.origin,
          destination: tx.destination,
          publish_rate: publishRate,
          discount_amount: discountAmount,
          cashback_amount: cashbackFromTx,
        };
      }

      // klasifikasi kategori
      if (type === "POINT_TX") {
        entry.category = "POINT_EARN";
        entry.title = "Poin dari transaksi";
      } else if (type.includes("CASHBACK")) {
        entry.category = "CASHBACK";
        const extra = toNumber(row.amount);
        if (extra != null) {
          entry.cashbackAmount = (entry.cashbackAmount ?? 0) + extra;
        }
      } else if (type.includes("BONUS")) {
        entry.category = "BONUS";
      }

      history.push(entry);
    }

    // b. dari redemptions (penukaran poin)
    for (const row of redemptions) {
      const rewardDate = row.created_at;

      const entry: any = {
        id: `redemption-${row.id}`,
        source: "REDEMPTION",
        category: "REDEMPTION",
        type: row.kind,
        transactionDate: null,
        rewardDate,
        created_at: rewardDate,
        title: row.kind || "Penukaran poin",
        note: null,
        pointsDelta: row.points_used ? -Number(row.points_used) : null,
        baseAmount: null,
        discountAmount: null,
        cashbackAmount: toNumber(row.amount),
        pointsMultiplier: null,
        status: row.status || null,
        redemption: {
          id: row.id,
          approved_at: row.approved_at,
          approved_by: row.approved_by,
        },
      };

      history.push(entry);
    }

    // urutkan terbaru di atas (pakai rewardDate)
    history.sort((a, b) => {
      const tA = new Date(a.rewardDate ?? a.created_at ?? 0).getTime();
      const tB = new Date(b.rewardDate ?? b.created_at ?? 0).getTime();
      return tB - tA;
    });

    return NextResponse.json(
      {
        history,
        ledgers,
        redemptions,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

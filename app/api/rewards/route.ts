// app/api/rewards/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// Biar semua fetch di dalam handler ini default no-store (termasuk fetch internal Supabase)
export const fetchCache = "default-no-store";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase service client (bypass RLS).
 * - Utamakan SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (standar Supabase)
 * - Fallback ke NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE (legacy)
 */
function getServiceClient() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error(
      "Supabase environment variables are missing (SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE)"
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

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

    // 1) Ambil reward_ledgers + redemptions per user
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

    // 2) Ambil transaksi yang direferensikan (ref_id → transactions.id)
    const refIdsRaw = ledgers
      .map((row) => row.ref_id)
      .filter((v: unknown) => v !== null && v !== undefined);

    const refIdsNumeric = Array.from(
      new Set(
        refIdsRaw
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n))
      )
    );

    let txMap: Record<string, any> = {};

    if (refIdsNumeric.length > 0) {
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .in("id", refIdsNumeric as any);

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

    // 3) Susun history gabungan: ledger + redemptions
    const history: any[] = [];

    // a. Dari reward_ledgers (poin/cashback/bonus/adjust)
    for (const row of ledgers) {
      const rawType = row.type ?? "";
      const type = String(rawType).toUpperCase();

      // Jika ada kolom reward_date gunakan, kalau tidak pakai created_at
      const rewardDate =
        (row.reward_date as string | null) ?? (row.created_at as string);

      const refId = row.ref_id;
      const tx =
        refId !== null && refId !== undefined
          ? txMap[String(refId)]
          : undefined;

      const points = toNumber(row.points);
      const amount = toNumber(row.amount);

      const publishRate = tx ? toNumber(tx.publish_rate) : null;
      const discountAmount = tx ? toNumber(tx.discount_amount) : null;
      const cashbackFromTx = tx ? toNumber(tx.cashback_amount) : null;

      const baseAmount = publishRate;

      // Multiplier poin: (points * 10.000) / baseAmount
      let pointsMultiplier: number | null = null;
      if (points != null && baseAmount && baseAmount > 0) {
        pointsMultiplier = (points * 10_000) / baseAmount;
      }

      // Klasifikasi kategori lebih generic:
      // - ADJUST → OTHER
      // - Type mengandung CASHBACK / CREDIT → CASHBACK
      // - Type mengandung BONUS → BONUS
      // - Selain itu, kalau ada poin ≠ 0 → POINT_EARN
      let category: string = "OTHER";

      if (type === "ADJUST") {
        category = "OTHER";
      } else if (type.includes("CASHBACK") || type === "CREDIT") {
        category = "CASHBACK";
      } else if (type.includes("BONUS")) {
        category = "BONUS";
      } else if (points != null && points !== 0) {
        category = "POINT_EARN";
      }

      const entry: any = {
        id: `ledger-${row.id}`,
        source: "LEDGER",
        category,
        type,
        transactionDate: tx?.date ?? null,
        rewardDate,
        created_at: rewardDate,
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

      // Tambahan logika spesifik:
      // - CASHBACK: tambahkan amount dari ledger ke cashbackAmount
      if (category === "CASHBACK") {
        const extra = amount;
        if (extra != null) {
          entry.cashbackAmount = (entry.cashbackAmount ?? 0) + extra;
        }
      }

      // Kalau mau override title default per kategori:
      if (category === "POINT_EARN") {
        entry.title = "Poin dari transaksi";
      } else if (category === "CASHBACK") {
        entry.title = row.note || "Cashback";
      } else if (category === "BONUS") {
        entry.title = row.note || "Bonus poin";
      }

      history.push(entry);
    }

    // b. Dari redemptions (penukaran poin)
    for (const row of redemptions) {
      const rewardDate =
        (row.reward_date as string | null) ?? (row.created_at as string);

      const pointsUsed =
        row.points_used != null ? Number(row.points_used) : null;
      const amount = toNumber(row.amount);

      const entry: any = {
        id: `redemption-${row.id}`,
        source: "REDEMPTION",
        category: "REDEMPTION",
        type: row.kind, // CREDIT / CASH_OUT / dll
        transactionDate: null,
        rewardDate,
        created_at: rewardDate,
        title: row.kind || "Penukaran poin",
        // Catatan admin (voucher_note) dipakai sebagai note utama
        note: row.voucher_note ?? null,
        pointsDelta: pointsUsed != null ? -pointsUsed : null,
        baseAmount: null,
        discountAmount: null,
        cashbackAmount: amount,
        pointsMultiplier: null,
        status: row.status || null,
        redemption: {
          id: row.id,
          user_id: row.user_id,
          kind: row.kind,
          amount: amount,
          points_used: pointsUsed,
          status: row.status,
          approved_at: row.approved_at,
          approved_by: row.approved_by,
          processed_at: row.processed_at,
          bank_name: row.bank_name,
          bank_account_number: row.bank_account_number,
          bank_account_holder: row.bank_account_holder,
          voucher_code: row.voucher_code,
          voucher_note: row.voucher_note,
          voucher_proof_url: row.voucher_proof_url,
          reject_reason: row.reject_reason,
          created_at: row.created_at,
          updated_at: row.updated_at,
        },
      };

      history.push(entry);
    }

    // 4) Urutkan terbaru di atas (pakai rewardDate / created_at)
    history.sort((a, b) => {
      const tA = new Date(a.rewardDate ?? a.created_at ?? 0).getTime();
      const tB = new Date(b.rewardDate ?? b.created_at ?? 0).getTime();
      return tB - tA;
    });

    // Meta buat ngecek cepat di FE
    const meta = {
      userId,
      ledgerCount: ledgers.length,
      redemptionCount: redemptions.length,
      refIdCount: refIdsNumeric.length,
      txJoinedCount: Object.keys(txMap).length,
      ledgerTypeCounts: ledgers.reduce<Record<string, number>>((acc, row) => {
        const t = String(row.type || "").toUpperCase();
        acc[t] = (acc[t] ?? 0) + 1;
        return acc;
      }, {}),
    };

    return NextResponse.json(
      {
        history,
        ledgers,
        redemptions,
        meta,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("[/api/rewards] ERROR:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

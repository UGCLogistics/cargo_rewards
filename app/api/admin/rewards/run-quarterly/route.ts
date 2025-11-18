// app/api/admin/rewards/run-quarterly/route.ts
import { NextResponse } from "next/server";
import {
  getServiceClient,
  loadProgramConfigs,
  getTierFromSpending,
  addMonths,
  MembershipTier,
} from "lib/rewardsConfig";

function isAdminRole(role: unknown) {
  if (!role) return false;
  return String(role).toUpperCase() === "ADMIN";
}

type TxRow = {
  id: number;
  user_id: string;
  date: string; // YYYY-MM-DD
  publish_rate: number;
  points_earned: number | null;
};

type QuarterInfo = {
  year: number;
  quarter: number;
  totalSpending: number;
};

function getQuarterFromDate(dateStr: string): { year: number; quarter: number } {
  const d = new Date(dateStr + "T00:00:00.000Z");
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-11
  const quarter = Math.floor(month / 3) + 1; // 1-4
  return { year, quarter };
}

function quarterKey(year: number, quarter: number): string {
  return `${year}-Q${quarter}`;
}

function compareYearQuarter(
  a: { year: number; quarter: number },
  b: { year: number; quarter: number }
): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.quarter - b.quarter;
}

function getQuarterStart(year: number, quarter: number): Date {
  const monthIndex = (quarter - 1) * 3; // 0,3,6,9
  return new Date(Date.UTC(year, monthIndex, 1));
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isAdminRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceClient();
    const configs = await loadProgramConfigs(supabase);

    const membershipTiersCfg = configs.membership_tiers;
    const pointsCfg = configs.points_config;

    if (!membershipTiersCfg) {
      return NextResponse.json(
        { error: "membership_tiers config not found" },
        { status: 500 }
      );
    }

    if (!pointsCfg || pointsCfg.enabled === false) {
      return NextResponse.json(
        { error: "points_config disabled or missing" },
        { status: 500 }
      );
    }

    const baseAmount = pointsCfg.base_amount_per_point || 10_000;
    const multipliers = pointsCfg.multipliers_by_membership || {};

    const today = new Date();
    const todayStr = toDateStr(today);

    // 1) Ambil semua transaksi
    const { data: txs, error: txErr } = await supabase
      .from("transactions")
      .select("id, user_id, date, publish_rate, points_earned")
      .order("user_id", { ascending: true })
      .order("date", { ascending: true });

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 });
    }

    const allTx: TxRow[] = (txs || []).map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      date: t.date,
      publish_rate: Number(t.publish_rate) || 0,
      points_earned: t.points_earned,
    }));

    // Kalau belum ada transaksi sama sekali, langsung keluar
    if (allTx.length === 0) {
      return NextResponse.json(
        {
          message: "Tidak ada transaksi untuk diproses.",
          membershipPeriodsCreated: 0,
          transactionsPointed: 0,
        },
        { status: 200 }
      );
    }

    // 2) Agregasi spending per user per quarter (calendar quarter)
    const userQuarterTotals = new Map<string, Map<string, QuarterInfo>>();
    const userIdsSet = new Set<string>();

    for (const tx of allTx) {
      if (!tx.user_id || !tx.date) continue;
      userIdsSet.add(tx.user_id);

      const { year, quarter } = getQuarterFromDate(tx.date);
      const qKey = quarterKey(year, quarter);

      let qMap = userQuarterTotals.get(tx.user_id);
      if (!qMap) {
        qMap = new Map<string, QuarterInfo>();
        userQuarterTotals.set(tx.user_id, qMap);
      }

      let qInfo = qMap.get(qKey);
      if (!qInfo) {
        qInfo = { year, quarter, totalSpending: 0 };
        qMap.set(qKey, qInfo);
      }

      qInfo.totalSpending += tx.publish_rate;
    }

    const userIds = Array.from(userIdsSet);

    // 3) Ambil membership_periods yang sudah ada untuk tahu quarter terakhir per user
    const { data: existingPeriods, error: existingPeriodErr } = await supabase
      .from("membership_periods")
      .select("user_id, period_start, period_end, tier, total_spending");

    if (existingPeriodErr) {
      return NextResponse.json(
        { error: existingPeriodErr.message },
        { status: 500 }
      );
    }

    type PeriodRow = {
      user_id: string;
      period_start: string;
      period_end: string;
      tier: string | null;
      total_spending: number | null;
    };

    const latestQuarterByUser = new Map<string, { year: number; quarter: number }>();

    for (const p of (existingPeriods || []) as PeriodRow[]) {
      if (!p.user_id || !p.period_start) continue;

      // Hanya pakai periode yg benar-benar quarter calendar:
      const d = new Date(p.period_start + "T00:00:00.000Z");
      const m = d.getUTCMonth();
      const day = d.getUTCDate();
      const isQuarterStart =
        day === 1 && (m === 0 || m === 3 || m === 6 || m === 9);

      if (!isQuarterStart) {
        // Ini biasanya periode 3 bulan pertama khusus (run-initial) → abaikan
        continue;
      }

      const { year, quarter } = getQuarterFromDate(p.period_start);
      const current = latestQuarterByUser.get(p.user_id);
      if (!current || compareYearQuarter({ year, quarter }, current) > 0) {
        latestQuarterByUser.set(p.user_id, { year, quarter });
      }
    }

    // 4) Hitung membership period per quarter dan upsert HANYA untuk quarter yang:
    //    - sudah selesai (period_end <= today)
    //    - setelah quarter terakhir yang sudah diproses untuk user tsb
    let membershipPeriodsCreated = 0;

    for (const [userId, qMap] of userQuarterTotals.entries()) {
      const quarters = Array.from(qMap.values()).sort(
        (a, b) => a.year - b.year || a.quarter - b.quarter
      );

      if (quarters.length === 0) continue;

      // Hitung tier & referenceTotal per quarter (berdasarkan spending quarter sebelumnya)
      type QCalc = QuarterInfo & {
        refTotal: number;
        tier: MembershipTier;
      };

      const qCalcs: QCalc[] = quarters.map((q) => ({
        ...q,
        refTotal: 0,
        tier: "SILVER" as MembershipTier,
      }));

      let prevTotal = 0;
      for (let i = 0; i < qCalcs.length; i++) {
        const tier = getTierFromSpending(prevTotal, membershipTiersCfg);
        qCalcs[i].refTotal = prevTotal;
        qCalcs[i].tier = tier;
        prevTotal = qCalcs[i].totalSpending;
      }

      const lastQ = latestQuarterByUser.get(userId);

      for (const qc of qCalcs) {
        const startDate = getQuarterStart(qc.year, qc.quarter);
        const endDate = addMonths(startDate, 3);
        const periodStartStr = toDateStr(startDate);
        const periodEndStr = toDateStr(endDate);

        // Quarter belum selesai → tidak perlu diproses sekarang
        if (periodEndStr > todayStr) {
          // quarter sesudahnya pasti juga belum selesai, jadi boleh break
          break;
        }

        // Kalau sudah pernah diproses quarter ini atau sesudahnya → lewati
        if (lastQ && compareYearQuarter(qc, lastQ) <= 0) {
          continue;
        }

        // Upsert membership_period baru untuk quarter ini
        const { error: upErr } = await supabase
          .from("membership_periods")
          .upsert(
            {
              user_id: userId,
              period_start: periodStartStr,
              period_end: periodEndStr,
              tier: qc.tier,
              total_spending: qc.refTotal, // spending quarter sebelumnya
            },
            { onConflict: "user_id,period_start,period_end" }
          );

        if (upErr) {
          return NextResponse.json(
            { error: upErr.message },
            { status: 500 }
          );
        }

        membershipPeriodsCreated += 1;
      }
    }

    // 5) Ambil membership_periods lagi (sudah termasuk quarter yang baru dibuat)
    const { data: periods, error: periodErr } = await supabase
      .from("membership_periods")
      .select("user_id, period_start, period_end, tier, total_spending");

    if (periodErr) {
      return NextResponse.json(
        { error: periodErr.message },
        { status: 500 }
      );
    }

    type Period = {
      period_start: string;
      period_end: string;
      tier: MembershipTier;
      total_spending: number;
    };

    const periodsByUser = new Map<string, Period[]>();

    for (const p of periods || []) {
      if (!p.user_id || !p.period_start || !p.period_end) continue;

      // hanya pakai periode yang benar-benar quarter (start tgl 1, bulan 0/3/6/9)
      const d = new Date(p.period_start + "T00:00:00.000Z");
      const m = d.getUTCMonth();
      const day = d.getUTCDate();
      const isQuarterStart =
        day === 1 && (m === 0 || m === 3 || m === 6 || m === 9);

      if (!isQuarterStart) continue; // abaikan periode non-kalender (run-initial)

      const arr = periodsByUser.get(p.user_id) || [];
      arr.push({
        period_start: p.period_start,
        period_end: p.period_end,
        tier: (p.tier as MembershipTier) || "SILVER",
        total_spending: Number(p.total_spending) || 0,
      });
      periodsByUser.set(p.user_id, arr);
    }

    // Sort periode per user berdasarkan start date
    for (const [uid, arr] of periodsByUser.entries()) {
      arr.sort((a, b) =>
        a.period_start < b.period_start ? -1 : a.period_start > b.period_start ? 1 : 0
      );
      periodsByUser.set(uid, arr);
    }

    // 6) Hitung poin untuk tiap transaksi yang belum punya poin
    let transactionsPointed = 0;

    for (const tx of allTx) {
      if (!tx.user_id || !tx.date) continue;

      // Guard: kalau sudah punya poin (points_earned > 0) → jangan diapa-apakan lagi
      if (tx.points_earned && tx.points_earned > 0) continue;

      const arr = periodsByUser.get(tx.user_id);
      if (!arr || arr.length === 0) continue;

      const dateStr = tx.date;

      // cari periode yang meng-cover tanggal transaksi (start <= date < end)
      const period = arr.find(
        (p) => dateStr >= p.period_start && dateStr < p.period_end
      );
      if (!period) continue;

      // Guard: quarter pertama (tidak ada spending quarter sebelumnya) → total_spending = 0 → tidak ada poin
      if (!period.total_spending || period.total_spending <= 0) {
        continue;
      }

      const tier: MembershipTier = period.tier || "SILVER";
      const multiplier = multipliers[tier] ?? 1;

      if (baseAmount <= 0 || multiplier <= 0) continue;

      const basePoints = Math.floor(tx.publish_rate / baseAmount);
      const points = Math.floor(basePoints * multiplier);
      if (points <= 0) continue;

      // Update transaksi (idempotent karena kita hanya proses yg points_earned masih 0/null)
      const { error: updErr } = await supabase
        .from("transactions")
        .update({ points_earned: points })
        .eq("id", tx.id);

      if (updErr) {
        return NextResponse.json(
          { error: updErr.message },
          { status: 500 }
        );
      }

      // Insert ledger untuk poin ini
      const { error: ledgerErr } = await supabase
        .from("reward_ledgers")
        .insert({
          user_id: tx.user_id,
          type: "POINT_TX", // HARUS cocok dengan constraint reward_ledgers_type_check
          points,
          amount: null,
          ref_id: tx.id,
          note: "Points from transaction (quarterly engine)",
        });

      if (ledgerErr) {
        return NextResponse.json(
          { error: ledgerErr.message },
          { status: 500 }
        );
      }

      transactionsPointed += 1;
    }

    return NextResponse.json(
      {
        message:
          "Quarterly engine executed (membership tiers + transaction points).",
        membershipPeriodsCreated,
        transactionsPointed,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("run-quarterly error", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

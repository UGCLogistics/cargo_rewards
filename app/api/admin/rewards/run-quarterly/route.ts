import { NextResponse } from "next/server";
import {
  getServiceClient,
  loadProgramConfigs,
  getTierFromSpending,
  addMonths,
  MembershipTier,
} from "lib/rewardsConfig";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


function isAdminRole(role: unknown) {
  const r = String(role || "").toUpperCase();
  return r === "ADMIN" || r === "INTERNAL";
}

type TxRow = {
  id: number;
  user_id: string;
  date: string; // 'YYYY-MM-DD'
  publish_rate: number;
  points_earned: number | null;
};

type BarePeriod = {
  index: number;       // 1 = periode pertama (Q1), dst
  start: string;       // 'YYYY-MM-DD'
  end: string;         // 'YYYY-MM-DD' (exclusive)
  totalSpending: number; // spending DI periode ini (bukan prev)
};

type PeriodCalc = {
  index: number;                 // 1 = Q1, dst
  start: string;
  end: string;
  totalSpendingPrev: number;     // spending periode SEBELUMNYA
  prevPeriodStart: string | null;
  prevPeriodEnd: string | null;
  tier: MembershipTier;
  status: "CURRENT" | "PREVIOUS" | "PAST";
};

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Bangun daftar periode 3 bulanan per user,
 * anchor di first transaction date.
 *
 * Contoh:
 * firstDate = 2025-01-02
 * -> [2025-01-02, 2025-04-02)
 * -> [2025-04-02, 2025-07-02)
 * -> [2025-07-02, 2025-10-02)
 * -> [2025-10-02, 2026-01-02)  (kalau today masih di range ini)
 */
function buildBarePeriods(firstDateStr: string, today: Date, txs: TxRow[]): BarePeriod[] {
  const firstDate = new Date(firstDateStr + "T00:00:00.000Z");
  const todayStr = toDateStr(today);

  const periods: BarePeriod[] = [];
  let index = 1;
  let startDate = firstDate;

  // Loop maksimal 40 periode (10 tahun) biar aman
  for (let safety = 0; safety < 40; safety++) {
    const endDate = addMonths(startDate, 3);
    const startStr = toDateStr(startDate);
    const endStr = toDateStr(endDate);

    // Hitung spending di periode ini
    let totalSpending = 0;
    for (const tx of txs) {
      if (!tx.date) continue;
      if (tx.date >= startStr && tx.date < endStr) {
        totalSpending += tx.publish_rate || 0;
      }
    }

    periods.push({
      index,
      start: startStr,
      end: endStr,
      totalSpending,
    });

    // Kalau today masih di dalam periode ini, ini adalah "current period"
    // dan kita berhenti di sini.
    if (todayStr >= startStr && todayStr < endStr) {
      break;
    }

    // Kalau today di masa depan setelah endStr, lanjut periode berikutnya
    startDate = endDate;
    index += 1;

    // Kalau start sudah lewat jauh dari today, break aja
    if (startStr > todayStr) break;
  }

  return periods;
}

export async function POST(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isAdminRole(roleHeader)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const supabase = getServiceClient();
    const configs = await loadProgramConfigs(supabase);

    const membershipTiersCfg = configs.membership_tiers;
    const pointsCfg = configs.points_config;

    if (!membershipTiersCfg) {
      return NextResponse.json(
        { error: "Membership tiers config tidak ditemukan" },
        { status: 500 }
      );
    }

    if (!pointsCfg) {
      return NextResponse.json(
        { error: "Points config tidak ditemukan" },
        { status: 500 }
      );
    }

    const baseAmount = pointsCfg.base_amount_per_point || 10_000;
    const multipliers = pointsCfg.multipliers_by_membership || {};

    const today = new Date();

    // 1. Ambil semua transaksi (urut per user, lalu per tanggal)
    const { data: txData, error: txError } = await supabase
      .from("transactions")
      .select("id, user_id, date, publish_rate, points_earned")
      .order("user_id", { ascending: true })
      .order("date", { ascending: true });

    if (txError) {
      console.error("Error load transactions:", txError);
      return NextResponse.json(
        { error: "Gagal load transaksi" },
        { status: 500 }
      );
    }

    const allTx: TxRow[] = (txData || []).map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      date: t.date,
      publish_rate: Number(t.publish_rate) || 0,
      points_earned: t.points_earned,
    }));

    if (allTx.length === 0) {
      return NextResponse.json(
        { message: "Tidak ada transaksi, tidak ada yang diproses." },
        { status: 200 }
      );
    }

    // Group by user
    const txByUser = new Map<string, TxRow[]>();
    for (const tx of allTx) {
      if (!tx.user_id || !tx.date) continue;
      if (!txByUser.has(tx.user_id)) {
        txByUser.set(tx.user_id, []);
      }
      txByUser.get(tx.user_id)!.push(tx);
    }

    // 2. Ambil existing membership_periods (buat deteksi upsert vs insert)
    const { data: mpData, error: mpError } = await supabase
      .from("membership_periods")
      .select("id, user_id, period_start, period_end");

    if (mpError) {
      console.error("Error load membership_periods:", mpError);
      return NextResponse.json(
        { error: "Gagal load membership_periods" },
        { status: 500 }
      );
    }

    type ExistingKey = string;
    const existingByKey = new Map<ExistingKey, number>(); // key -> id

    for (const row of mpData || []) {
      if (!row.user_id || !row.period_start || !row.period_end) continue;
      const key = `${row.user_id}|${row.period_start}|${row.period_end}`;
      existingByKey.set(key, row.id);
    }

    let membershipPeriodsCreated = 0;
    let membershipPeriodsUpdated = 0;
    let transactionsPointed = 0;

    // 3. Bangun periode 3 bulanan anchored per user + upsert membership_periods
    const periodsByUserForPoints = new Map<string, PeriodCalc[]>();

    for (const [userId, userTxs] of txByUser.entries()) {
      if (!userTxs || userTxs.length === 0) continue;

      const firstDateStr = userTxs[0].date;
      if (!firstDateStr) continue;

      const barePeriods = buildBarePeriods(firstDateStr, today, userTxs);
      if (barePeriods.length === 0) continue;

      const lastIndex = barePeriods.length - 1;

      const userPeriodsCalc: PeriodCalc[] = [];

      for (let i = 0; i < barePeriods.length; i++) {
        const b = barePeriods[i];
        const prev = i > 0 ? barePeriods[i - 1] : null;

        // Spending periode sebelumnya:
        const totalSpendingPrev = prev ? prev.totalSpending : 0;

        // Tier buat periode ini = fungsi(spending periode sebelumnya)
        const tier = getTierFromSpending(totalSpendingPrev, membershipTiersCfg) as MembershipTier;

        let status: "CURRENT" | "PREVIOUS" | "PAST" = "PAST";
        if (i === lastIndex) status = "CURRENT";
        else if (i === lastIndex - 1) status = "PREVIOUS";

        userPeriodsCalc.push({
          index: b.index,
          start: b.start,
          end: b.end,
          totalSpendingPrev,
          prevPeriodStart: prev ? prev.start : null,
          prevPeriodEnd: prev ? prev.end : null,
          tier,
          status,
        });
      }

      // Simpan buat step hitung poin
      periodsByUserForPoints.set(userId, userPeriodsCalc);

      // Upsert ke membership_periods
      for (const p of userPeriodsCalc) {
        const key = `${userId}|${p.start}|${p.end}`;
        const existingId = existingByKey.get(key);

        // Payload:
        // Catatan:
        //  - Untuk periode ke-1 (Q1):
        //      - KITA TIDAK MENYENTUH total_spending & tier kalau sudah ada row dari run-initial
        //      - Kita cuma update period_index/label/prev_* dan status
        //  - Untuk periode >=2:
        //      - total_spending = spending periode sebelumnya (p.totalSpendingPrev)
        //      - tier = tier yang dipakai di periode ini
        const isFirstPeriod = p.index === 1;

        if (existingId) {
          // UPDATE
          if (isFirstPeriod) {
            // JANGAN utak-atik total_spending & tier yang sudah di-set run-initial
            const { error: updErr } = await supabase
              .from("membership_periods")
              .update({
                period_index: p.index,
                period_label: `Q${p.index}`,
                prev_period_start: p.prevPeriodStart,
                prev_period_end: p.prevPeriodEnd,
                current_membership_status: p.status,
                // prev_period_total_spending tetap alias ke total_spending existing
              })
              .eq("id", existingId);

            if (updErr) {
              console.error("Error update membership_periods (Q1):", updErr);
              return NextResponse.json(
                { error: "Gagal update membership_periods (periode pertama)" },
                { status: 500 }
              );
            }
            membershipPeriodsUpdated += 1;
          } else {
            // Periode >=2 – boleh update total_spending = spending periode sebelumnya
            const { error: updErr } = await supabase
              .from("membership_periods")
              .update({
                period_index: p.index,
                period_label: `Q${p.index}`,
                period_start: p.start,
                period_end: p.end,
                total_spending: p.totalSpendingPrev,
                prev_period_start: p.prevPeriodStart,
                prev_period_end: p.prevPeriodEnd,
                // prev_period_total_spending = alias ke total_spending
                tier: p.tier,
                current_membership_status: p.status,
              })
              .eq("id", existingId);

            if (updErr) {
              console.error("Error update membership_periods:", updErr);
              return NextResponse.json(
                { error: "Gagal update membership_periods" },
                { status: 500 }
              );
            }
            membershipPeriodsUpdated += 1;
          }
        } else {
          // INSERT
          if (isFirstPeriod) {
            // Kalau belum ada row Q1 (run-initial belum pernah jalan),
            // kita bikin row Q1 penuh dengan total_spending & tier berdasarkan spending Q1.
            const firstPeriod = barePeriods[0];
            const totalSpendingQ1 = firstPeriod.totalSpending;
            const tierQ1 = getTierFromSpending(
              totalSpendingQ1,
              membershipTiersCfg
            ) as MembershipTier;

            const { error: insErr } = await supabase
              .from("membership_periods")
              .insert({
                user_id: userId,
                period_start: firstPeriod.start,
                period_end: firstPeriod.end,
                total_spending: totalSpendingQ1,
                // prev period = null
                prev_period_start: null,
                prev_period_end: null,
                // prev_period_total_spending = alias ke total_spending
                tier: tierQ1,
                period_index: 1,
                period_label: "Q1",
                current_membership_status: p.status,
              });

            if (insErr) {
              console.error("Error insert membership_periods (Q1):", insErr);
              return NextResponse.json(
                { error: "Gagal insert membership_periods (periode pertama)" },
                { status: 500 }
              );
            }
            membershipPeriodsCreated += 1;
          } else {
            // Periode >=2
            const { error: insErr } = await supabase
              .from("membership_periods")
              .insert({
                user_id: userId,
                period_start: p.start,
                period_end: p.end,
                total_spending: p.totalSpendingPrev, // SPENDING PERIODE SEBELUMNYA
                prev_period_start: p.prevPeriodStart,
                prev_period_end: p.prevPeriodEnd,
                // prev_period_total_spending = alias ke total_spending
                tier: p.tier,
                period_index: p.index,
                period_label: `Q${p.index}`,
                current_membership_status: p.status,
              });

            if (insErr) {
              console.error("Error insert membership_periods:", insErr);
              return NextResponse.json(
                { error: "Gagal insert membership_periods" },
                { status: 500 }
              );
            }
            membershipPeriodsCreated += 1;
          }
        }
      }
    }

    // 4. Hitung ulang poin berdasarkan periode anchored ini
    //    - transaction di periode index=1 (Q1) TIDAK dapat poin
    //    - transaction di periode index>=2 dapat poin kalau total_spending (prevPeriod) > 0
    const periodsForPoints = new Map<
      string,
      { start: string; end: string; tier: MembershipTier; period_index: number; total_spending: number }[]
    >();

    for (const [userId, list] of periodsByUserForPoints.entries()) {
      const arr = list.map((p) => ({
        start: p.start,
        end: p.end,
        tier: p.tier,
        period_index: p.index,
        total_spending: p.totalSpendingPrev, // spending periode sebelumnya
      }));
      arr.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
      periodsForPoints.set(userId, arr);
    }

    for (const tx of allTx) {
      if (!tx.user_id || !tx.date) continue;

      // Kalau sudah ada poin, skip
      if (tx.points_earned && tx.points_earned > 0) continue;

      const arr = periodsForPoints.get(tx.user_id);
      if (!arr || arr.length === 0) continue;

      const period = arr.find(
        (p) => tx.date >= p.start && tx.date < p.end
      );
      if (!period) continue;

      // Skip periode pertama (Q1) → poin baru mulai bulan ke-4
      if (period.period_index <= 1) continue;

      // Kalau spending periode sebelumnya 0 → nggak ada poin
      if (!period.total_spending || period.total_spending <= 0) continue;

      const tier = period.tier || "SILVER";
      const multiplier = multipliers[tier] ?? 1;
      if (baseAmount <= 0 || multiplier <= 0) continue;

      const basePoints = Math.floor(tx.publish_rate / baseAmount);
      const points = Math.floor(basePoints * multiplier);
      if (points <= 0) continue;

      // Update transaksi
      const { error: updTxErr } = await supabase
        .from("transactions")
        .update({ points_earned: points })
        .eq("id", tx.id);

      if (updTxErr) {
        console.error("Error update transaksi poin:", updTxErr);
        return NextResponse.json(
          { error: "Gagal update poin transaksi" },
          { status: 500 }
        );
      }

      // Insert ke reward_ledgers
      const { error: ledgerErr } = await supabase
        .from("reward_ledgers")
        .insert({
          user_id: tx.user_id,
          type: "POINT_TX",
          points,
          amount: null,
          ref_id: tx.id,
          note: "Points from transaction (anchored 3-month period)",
        });

      if (ledgerErr) {
        console.error("Error insert reward_ledgers:", ledgerErr);
        return NextResponse.json(
          { error: "Gagal insert reward ledger" },
          { status: 500 }
        );
      }

      transactionsPointed += 1;
    }

    return NextResponse.json(
      {
        message: "run-quarterly (anchored 3-month periods) selesai.",
        membershipPeriodsCreated,
        membershipPeriodsUpdated,
        transactionsPointed,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("run-quarterly error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

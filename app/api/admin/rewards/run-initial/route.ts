
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/api/admin/rewards/run-initial/route.ts
import { NextResponse } from "next/server";
import {


  getServiceClient,
  loadProgramConfigs,
  getTierFromSpending,
  getActiveCashbackPercent,
  getWelcomeBonusPoints,
  addMonths,
  MembershipTier,
} from "lib/rewardsConfig";

function isAdminRole(role: unknown) {
  if (!role) return false;
  return String(role).toUpperCase() === "ADMIN";
}

type TxRow = {
  user_id: string;
  date: string;        // kolom date di transactions (YYYY-MM-DD)
  publish_rate: number;
};

/**
 * Engine awal:
 * - Buat / update membership_periods untuk periode 3 bulan pertama setiap user.
 * - Kalau periode 3 bulan pertama SUDAH lewat:
 *     • Hitung Active Cashback 3 bulan pertama (sekali seumur hidup).
 *     • Hitung Welcome Bonus Points bulan ke-4 (sekali seumur hidup).
 *
 * Hello Discount sudah ditangani di route import-transactions,
 * jadi tidak disentuh di sini.
 */
export async function POST(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isAdminRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceClient();
    const configs = await loadProgramConfigs(supabase);

    const membershipTiersCfg = configs.membership_tiers;
    const cashbackCfg = configs.cashback_rules;
    const pointsCfg = configs.points_config;

    const windowMonths = cashbackCfg?.window_months ?? 3;

    // Ambil semua transaksi (urut user_id & date)
    const { data: txs, error: txErr } = await supabase
      .from("transactions")
      .select("user_id, date, publish_rate")
      .order("user_id", { ascending: true })
      .order("date", { ascending: true });

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 });
    }

    const byUser = new Map<string, TxRow[]>();
    for (const row of txs || []) {
      if (!row.user_id || !row.date) continue;
      const list = byUser.get(row.user_id) || [];
      list.push({
        user_id: row.user_id,
        date: row.date,
        publish_rate: Number(row.publish_rate) || 0,
      });
      byUser.set(row.user_id, list);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const summary: any[] = [];

    for (const [userId, list] of byUser.entries()) {
      if (list.length === 0) continue;

      // --- 3 bulan pertama sejak transaksi pertama user tsb ---
      const firstDateStr = list[0].date; // YYYY-MM-DD
      const firstDate = new Date(firstDateStr + "T00:00:00.000Z");

      const periodStartStr = firstDateStr;
      const periodEndDate = addMonths(firstDate, windowMonths);
      const periodEndStr = periodEndDate.toISOString().slice(0, 10);

      // Total spending 3 bulan pertama
      let totalSpending = 0;
      for (const tx of list) {
        if (tx.date >= periodStartStr && tx.date < periodEndStr) {
          totalSpending += tx.publish_rate;
        }
      }

      // Cari membership_period record untuk periode ini
      const { data: existingPeriods, error: mpErr } = await supabase
        .from("membership_periods")
        .select(
          "id, tier, total_spending, active_cashback_given, welcome_bonus_given"
        )
        .eq("user_id", userId)
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr);

      if (mpErr) {
        return NextResponse.json({ error: mpErr.message }, { status: 500 });
      }

      let periodId: number | null = null;
      let periodTier: MembershipTier = "SILVER";
      let activeCashbackGiven = false;
      let welcomeBonusGiven = false;

      if (!existingPeriods || existingPeriods.length === 0) {
        // belum ada → insert baru
        periodTier = getTierFromSpending(totalSpending, membershipTiersCfg);

        const { data: inserted, error: insErr } = await supabase
          .from("membership_periods")
          .insert({
            user_id: userId,
            period_start: periodStartStr,
            period_end: periodEndStr,
            tier: periodTier,
            total_spending: totalSpending,
            active_cashback_given: false,
            welcome_bonus_given: false,
          })
          .select(
            "id, tier, active_cashback_given, welcome_bonus_given"
          )
          .single();

        if (insErr) {
          return NextResponse.json(
            { error: insErr.message },
            { status: 500 }
          );
        }

        periodId = inserted.id;
        periodTier = inserted.tier as MembershipTier;
        activeCashbackGiven = inserted.active_cashback_given;
        welcomeBonusGiven = inserted.welcome_bonus_given;
      } else {
        // sudah ada → pakai yang existing, update kalau perlu
        const p = existingPeriods[0];
        periodId = p.id;
        periodTier = p.tier as MembershipTier;
        activeCashbackGiven = p.active_cashback_given;
        welcomeBonusGiven = p.welcome_bonus_given;

        const newTier = getTierFromSpending(totalSpending, membershipTiersCfg);
        if (p.total_spending !== totalSpending || newTier !== periodTier) {
          const { error: updErr } = await supabase
            .from("membership_periods")
            .update({
              total_spending: totalSpending,
              tier: newTier,
            })
            .eq("id", periodId);
          if (updErr) {
            return NextResponse.json(
              { error: updErr.message },
              { status: 500 }
            );
          }
          periodTier = newTier;
        }
      }

      const periodEnded = todayStr >= periodEndStr;

      // === ACTIVE CASHBACK (3 bulan pertama, sekali) ===
      if (
        periodEnded &&
        !activeCashbackGiven &&
        totalSpending > 0 &&
        cashbackCfg &&
        cashbackCfg.enabled !== false
      ) {
        const cashbackPercent = getActiveCashbackPercent(
          totalSpending,
          cashbackCfg
        );
        const cashbackAmount = Math.round(
          totalSpending * (cashbackPercent / 100)
        );

        if (cashbackAmount > 0) {
          const { error: ledgerErr } = await supabase
            .from("reward_ledgers")
            .insert({
              user_id: userId,
              type: "ACTIVE_CASHBACK_3M",
              amount: cashbackAmount,
              points: null,
              ref_id: null,
              note: "Active Cashback 3 bulan pertama",
            });

          if (ledgerErr) {
            return NextResponse.json(
              { error: ledgerErr.message },
              { status: 500 }
            );
          }

          await supabase
            .from("membership_periods")
            .update({ active_cashback_given: true })
            .eq("id", periodId!);
          activeCashbackGiven = true;
        }
      }

      // === WELCOME BONUS POINTS BULAN KE-4 (sekali) ===
      if (
        periodEnded &&
        !welcomeBonusGiven &&
        pointsCfg &&
        pointsCfg.enabled !== false
      ) {
        const welcomePoints = getWelcomeBonusPoints(periodTier, pointsCfg);

        if (welcomePoints > 0) {
          const { error: wErr } = await supabase
            .from("reward_ledgers")
            .insert({
              user_id: userId,
              type: "WELCOME_BONUS",
              points: welcomePoints,
              amount: null,
              ref_id: null,
              note: `Welcome bonus bulan ke-4 (${periodTier})`,
            });

          if (wErr) {
            return NextResponse.json(
              { error: wErr.message },
              { status: 500 }
            );
          }

          await supabase
            .from("membership_periods")
            .update({ welcome_bonus_given: true })
            .eq("id", periodId!);
          welcomeBonusGiven = true;
        }
      }

      summary.push({
        user_id: userId,
        period_start: periodStartStr,
        period_end: periodEndStr,
        total_spending_3m: totalSpending,
        tier: periodTier,
        active_cashback_given: activeCashbackGiven,
        welcome_bonus_given: welcomeBonusGiven,
      });
    }

    return NextResponse.json(
      {
        message:
          "Initial rewards processed (Active Cashback + Welcome Bonus).",
        summary,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("run-initial error", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

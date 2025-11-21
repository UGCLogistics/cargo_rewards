import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";




export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POINT_VALUE = 250; // 1 poin = 250 rupiah

type MembershipCounts = {
  SILVER: number;
  GOLD: number;
  PLATINUM: number;
};

type TopCustomerRow = {
  user_id: string;
  customer_name: string;
  sales_name: string | null;
  total_transactions: number;
  total_publish_rate: number;
  total_rewards: number;
};

type TopSalesRow = {
  sales_name: string;
  total_transactions: number;
  total_publish_rate: number;
  total_rewards: number;
};

type CustomerActivityStatus =
  | "ACTIVE"
  | "PASSIVE"
  | "HIGH_RISK_DORMANT"
  | "DORMANT";

type CustomerActivitySummary = {
  active: number;
  passive: number;
  high_risk_dormant: number;
  dormant: number;
};

type CustomerActivityDetailRow = {
  user_id: string;
  last_transaction_date: string;
  days_since_last: number;
  status: CustomerActivityStatus;
};

type KpiResponse = {
  total_transactions: number;
  total_publish_rate: number;
  total_discount: number;
  total_cashback: number;
  total_points: number; // total poin diberikan (earned)
  total_points_earned: number;
  total_points_redeemed: number;
  total_points_remaining: number;
  total_customers: number;
  membership_counts: MembershipCounts;
  discount_base_amount: number;
  cashback_base_amount: number;
  points_base_amount: number;
  top_customers: TopCustomerRow[];
  top_sales: TopSalesRow[];
  customer_activity_summary: CustomerActivitySummary;
  customer_activity_detail: CustomerActivityDetailRow[];
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function intersect(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
}

function emptyKpiResponse(): KpiResponse {
  return {
    total_transactions: 0,
    total_publish_rate: 0,
    total_discount: 0,
    total_cashback: 0,
    total_points: 0,
    total_points_earned: 0,
    total_points_redeemed: 0,
    total_points_remaining: 0,
    total_customers: 0,
    membership_counts: {
      SILVER: 0,
      GOLD: 0,
      PLATINUM: 0,
    },
    discount_base_amount: 0,
    cashback_base_amount: 0,
    points_base_amount: 0,
    top_customers: [],
    top_sales: [],
    customer_activity_summary: {
      active: 0,
      passive: 0,
      high_risk_dormant: 0,
      dormant: 0,
    },
    customer_activity_detail: [],
  };
}

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

    // 🔥 PERUBAHAN DI SINI: izinkan ADMIN, MANAGER, STAFF
    const rawRole = (user.user_metadata as any)?.role || "";
    const role = String(rawRole).toUpperCase();

    if (!["ADMIN", "MANAGER", "STAFF"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const customerId = url.searchParams.get("customer_id");
    const salesFilter = url.searchParams.get("salesname");
    const membershipLevel = url.searchParams.get("membership");

    const adminClient = getServiceClient();

    // ============================
    // Tentukan allowedUserIds
    // ============================
    let allowedUserIds: string[] | null = null;

    // 1) filter 1 customer langsung
    if (customerId) {
      allowedUserIds = [customerId];
    }

    // 2) filter berdasarkan salesname
    if (salesFilter) {
      const { data: salesCustomers, error: salesErr } = await adminClient
        .from("customers")
        .select("user_id")
        .eq("salesname", salesFilter);

      if (salesErr) {
        return NextResponse.json({ error: salesErr.message }, { status: 500 });
      }

      const ids = (salesCustomers ?? []).map(
        (row: any) => row.user_id as string,
      );

      if (!ids.length) {
        return NextResponse.json(
          {
            data: emptyKpiResponse(),
            meta: {
              customers: [],
              sales: [],
              filters: { start, end, customerId, salesFilter, membershipLevel },
            },
          },
          { status: 200 },
        );
      }

      if (allowedUserIds === null) {
        allowedUserIds = ids;
      } else {
        allowedUserIds = intersect(allowedUserIds, ids);
      }
    }

    // 3) filter membership
    if (membershipLevel) {
      let mpQuery = adminClient
        .from("membership_periods")
        .select("user_id")
        .eq("tier", membershipLevel);

      if (!start && !end) {
        // tanpa filter tanggal -> pakai CURRENT
        mpQuery = mpQuery.eq("current_membership_status", "CURRENT");
      } else {
        const startDate = start ?? end!;
        const endDate = end ?? start!;
        // periode overlap dengan filter
        mpQuery = mpQuery
          .gte("period_end", startDate)
          .lte("period_start", endDate);
      }

      const { data: mpRows, error: mpErr } = await mpQuery;

      if (mpErr) {
        return NextResponse.json({ error: mpErr.message }, { status: 500 });
      }

      const ids = (mpRows ?? []).map((row: any) => row.user_id as string);

      if (!ids.length) {
        return NextResponse.json(
          {
            data: emptyKpiResponse(),
            meta: {
              customers: [],
              sales: [],
              filters: { start, end, customerId, salesFilter, membershipLevel },
            },
          },
          { status: 200 },
        );
      }

      if (allowedUserIds === null) {
        allowedUserIds = ids;
      } else {
        allowedUserIds = intersect(allowedUserIds, ids);
      }
    }

    if (allowedUserIds !== null && allowedUserIds.length === 0) {
      return NextResponse.json(
        {
          data: emptyKpiResponse(),
          meta: {
            customers: [],
            sales: [],
            filters: { start, end, customerId, salesFilter, membershipLevel },
          },
        },
        { status: 200 },
      );
    }

    // ============================
    // TRANSACTIONS (diskon & base)
    // ============================
    let txQuery = adminClient
      .from("transactions")
      .select("id, user_id, date, publish_rate, discount_amount");

    if (start) txQuery = txQuery.gte("date", start);
    if (end) txQuery = txQuery.lte("date", end);
    if (allowedUserIds) txQuery = txQuery.in("user_id", allowedUserIds);

    const { data: txRows, error: txErr } = await txQuery;

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 });
    }

    const tx = (txRows ?? []) as any[];

    const customerIdSet = new Set<string>();
    let totalTransactions = 0;
    let totalPublishRate = 0;
    let totalDiscount = 0;
    let discountBaseAmount = 0;

    const perUserRewards: Record<
      string,
      {
        discount: number;
        cashback: number;
        pointsValue: number;
        transactions: number;
        publishRate: number;
        salesname?: string | null;
        company_name?: string | null;
      }
    > = {};

    const ensureUserBucket = (userId: string) => {
      if (!perUserRewards[userId]) {
        perUserRewards[userId] = {
          discount: 0,
          cashback: 0,
          pointsValue: 0,
          transactions: 0,
          publishRate: 0,
        };
      }
      return perUserRewards[userId];
    };

    for (const row of tx) {
      const userId = row.user_id as string;
      const publishRate = Number(row.publish_rate) || 0;
      const discount = Number(row.discount_amount) || 0;

      totalTransactions += 1;
      totalPublishRate += publishRate;
      totalDiscount += discount;

      if (discount > 0) {
        discountBaseAmount += publishRate;
      }

      if (userId) customerIdSet.add(userId);

      const bucket = ensureUserBucket(userId);
      bucket.discount += discount;
      bucket.publishRate += publishRate;
      bucket.transactions += 1;
    }

    const totalCustomers = customerIdSet.size;

    // ============================
    // REWARD_LEDGERS (cashback & poin)
    // ============================
    let ledgerQuery = adminClient
      .from("reward_ledgers")
      .select("user_id, type, amount, points, created_at");

    if (start) ledgerQuery = ledgerQuery.gte("created_at", start);
    if (end) ledgerQuery = ledgerQuery.lte("created_at", end);
    if (allowedUserIds) ledgerQuery = ledgerQuery.in("user_id", allowedUserIds);

    const { data: ledgerRows, error: ledgerErr } = await ledgerQuery;

    if (ledgerErr) {
      return NextResponse.json({ error: ledgerErr.message }, { status: 500 });
    }

    const ledgers = (ledgerRows ?? []) as any[];

    let totalCashback = 0;
    let totalPointsEarned = 0;
    let totalPointsRedeemed = 0;

    for (const row of ledgers) {
      const type = String(row.type || "").toUpperCase();
      const amount = Number(row.amount) || 0;
      const pts = Number(row.points) || 0;
      const userId = row.user_id as string;
      if (!userId) continue;

      const bucket = ensureUserBucket(userId);

      // Cashback: ACTIVE_CASHBACK_3M
      if (type === "ACTIVE_CASHBACK_3M" && amount > 0) {
        totalCashback += amount;
        bucket.cashback += amount;
      }

      // Poin didapat: POINT_TX + WELCOME_BONUS (positif)
      if (type === "POINT_TX" || type === "WELCOME_BONUS") {
        if (pts > 0) {
          totalPointsEarned += pts;
          bucket.pointsValue += pts * POINT_VALUE;
        }
      }

      // Poin diredeem: ADJUST (negatif)
      if (type === "ADJUST" && pts < 0) {
        totalPointsRedeemed += -pts;
      }
    }

    const totalPointsRemaining = totalPointsEarned - totalPointsRedeemed;

    // ============================
    // CASHBACK BASE AMOUNT
    // ============================
    let mpCashbackQuery = adminClient
      .from("membership_periods")
      .select("total_spending, user_id, active_cashback_given")
      .eq("active_cashback_given", true);

    if (!start && !end) {
      mpCashbackQuery = mpCashbackQuery.eq(
        "current_membership_status",
        "CURRENT",
      );
    } else {
      const startDate = start ?? end!;
      const endDate = end ?? start!;
      mpCashbackQuery = mpCashbackQuery
        .gte("period_end", startDate)
        .lte("period_start", endDate);
    }

    if (allowedUserIds) {
      mpCashbackQuery = mpCashbackQuery.in("user_id", allowedUserIds);
    }

    const { data: mpCashbackRows, error: mpCashbackErr } =
      await mpCashbackQuery;
    let cashbackBaseAmount = 0;

    if (mpCashbackErr) {
      return NextResponse.json({ error: mpCashbackErr.message }, { status: 500 });
    }

    for (const row of (mpCashbackRows ?? []) as any[]) {
      cashbackBaseAmount += Number(row.total_spending) || 0;
    }

    // ============================
    // POINTS BASE AMOUNT
    // ============================
    let mpPointsQuery = adminClient
      .from("membership_periods")
      .select("total_spending, user_id");

    if (!start && !end) {
      mpPointsQuery = mpPointsQuery.eq("current_membership_status", "CURRENT");
    } else {
      const startDate = start ?? end!;
      const endDate = end ?? start!;
      mpPointsQuery = mpPointsQuery
        .gte("period_end", startDate)
        .lte("period_start", endDate);
    }

    if (allowedUserIds) {
      mpPointsQuery = mpPointsQuery.in("user_id", allowedUserIds);
    }

    const { data: mpPointsRows, error: mpPointsErr } = await mpPointsQuery;
    let pointsBaseAmount = 0;

    if (mpPointsErr) {
      return NextResponse.json({ error: mpPointsErr.message }, { status: 500 });
    }

    for (const row of (mpPointsRows ?? []) as any[]) {
      pointsBaseAmount += Number(row.total_spending) || 0;
    }

    // ============================
    // MEMBERSHIP COUNTS
    // ============================
    let mpCountQuery = adminClient
      .from("membership_periods")
      .select("user_id, tier");

    if (!start && !end) {
      mpCountQuery = mpCountQuery.eq("current_membership_status", "CURRENT");
    } else {
      const startDate = start ?? end!;
      const endDate = end ?? start!;
      mpCountQuery = mpCountQuery
        .gte("period_end", startDate)
        .lte("period_start", endDate);
    }

    if (allowedUserIds) {
      mpCountQuery = mpCountQuery.in("user_id", allowedUserIds);
    }

    const { data: mpCountRows, error: mpCountErr } = await mpCountQuery;

    if (mpCountErr) {
      return NextResponse.json({ error: mpCountErr.message }, { status: 500 });
    }

    const membershipCounts: MembershipCounts = {
      SILVER: 0,
      GOLD: 0,
      PLATINUM: 0,
    };

    const tierUserSet = new Set<string>();

    for (const row of (mpCountRows ?? []) as any[]) {
      const tier = String(row.tier || "").toUpperCase();
      const uId = row.user_id as string;
      if (!uId) continue;
      const key = `${tier}|${uId}`;
      if (tierUserSet.has(key)) continue;
      tierUserSet.add(key);

      if (tier === "SILVER") membershipCounts.SILVER += 1;
      else if (tier === "GOLD") membershipCounts.GOLD += 1;
      else if (tier === "PLATINUM") membershipCounts.PLATINUM += 1;
    }

    // ============================
    // CUSTOMER ACTIVITY (global, pakai last tx vs hari ini)
    // ============================
    const today = new Date();

    let lastTxQuery = adminClient
      .from("transactions")
      .select("user_id, date");

    if (allowedUserIds) {
      lastTxQuery = lastTxQuery.in("user_id", allowedUserIds);
    }

    const { data: lastTxData, error: lastTxErr } = await lastTxQuery;

    if (lastTxErr) {
      return NextResponse.json({ error: lastTxErr.message }, { status: 500 });
    }

    const lastMap = new Map<string, string>();

    for (const row of (lastTxData ?? []) as any[]) {
      const userId = row.user_id as string;
      const dateStr = row.date as string;

      if (!userId || !dateStr) continue;

      const prev = lastMap.get(userId);
      if (!prev || dateStr > prev) {
        lastMap.set(userId, dateStr);
      }
    }

    const activitySummary: CustomerActivitySummary = {
      active: 0,
      passive: 0,
      high_risk_dormant: 0,
      dormant: 0,
    };

    const activityDetail: CustomerActivityDetailRow[] = [];

    for (const [userId, lastDateStr] of lastMap.entries()) {
      const lastDate = new Date(lastDateStr);
      const diffMs = today.getTime() - lastDate.getTime();
      const daysSinceLast = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let status: CustomerActivityStatus;

      if (daysSinceLast < 15) {
        status = "ACTIVE";
        activitySummary.active += 1;
      } else if (daysSinceLast <= 30) {
        status = "PASSIVE";
        activitySummary.passive += 1;
      } else if (daysSinceLast <= 45) {
        status = "HIGH_RISK_DORMANT";
        activitySummary.high_risk_dormant += 1;
      } else {
        status = "DORMANT";
        activitySummary.dormant += 1;
      }

      activityDetail.push({
        user_id: userId,
        last_transaction_date: lastDateStr,
        days_since_last: daysSinceLast,
        status,
      });
    }

    // ============================
    // META: customers + sales
    // ============================
    const { data: allCustomers, error: customersErr } = await adminClient
      .from("customers")
      .select("user_id, company_name, salesname")
      .order("company_name", { ascending: true });

    if (customersErr) {
      return NextResponse.json({ error: customersErr.message }, { status: 500 });
    }

    const customersMeta = (allCustomers ?? []) as any[];
    const salesSet = new Set<string>();

    for (const c of customersMeta) {
      if (c.salesname) salesSet.add(String(c.salesname));
      const bucket = perUserRewards[c.user_id];
      if (bucket) {
        bucket.company_name = c.company_name;
        bucket.salesname = c.salesname;
      }
    }

    const salesMeta = Array.from(salesSet).sort();

    // ============================
    // TOP 5 CUSTOMER & TOP 5 SALES
    // ============================
    const top_customers: TopCustomerRow[] = Object.entries(perUserRewards)
      .map(([userId, v]) => ({
        user_id: userId,
        customer_name: v.company_name || userId.slice(0, 8),
        sales_name: v.salesname ?? null,
        total_transactions: v.transactions,
        total_publish_rate: v.publishRate,
        total_rewards: v.discount + v.cashback + v.pointsValue,
      }))
      .sort((a, b) => b.total_publish_rate - a.total_publish_rate)
      .slice(0, 5);

    const salesAgg: Record<
      string,
      { total_transactions: number; total_publish_rate: number; total_rewards: number }
    > = {};

    for (const [, v] of Object.entries(perUserRewards)) {
      const key = v.salesname || "Tanpa Sales";
      if (!salesAgg[key]) {
        salesAgg[key] = {
          total_transactions: 0,
          total_publish_rate: 0,
          total_rewards: 0,
        };
      }
      salesAgg[key].total_transactions += v.transactions;
      salesAgg[key].total_publish_rate += v.publishRate;
      salesAgg[key].total_rewards += v.discount + v.cashback + v.pointsValue;
    }

    const top_sales: TopSalesRow[] = Object.entries(salesAgg)
      .map(([sales_name, v]) => ({
        sales_name,
        total_transactions: v.total_transactions,
        total_publish_rate: v.total_publish_rate,
        total_rewards: v.total_rewards,
      }))
      .sort((a, b) => b.total_publish_rate - a.total_publish_rate)
      .slice(0, 5);

    const data: KpiResponse = {
      total_transactions: totalTransactions,
      total_publish_rate: totalPublishRate,
      total_discount: totalDiscount,
      total_cashback: totalCashback,
      total_points: totalPointsEarned,
      total_points_earned: totalPointsEarned,
      total_points_redeemed: totalPointsRedeemed,
      total_points_remaining: totalPointsRemaining,
      total_customers: totalCustomers,
      membership_counts: membershipCounts,
      discount_base_amount: discountBaseAmount,
      cashback_base_amount: cashbackBaseAmount,
      points_base_amount: pointsBaseAmount,
      top_customers,
      top_sales,
      customer_activity_summary: activitySummary,
      customer_activity_detail: activityDetail,
    };

    return NextResponse.json(
      {
        data,
        meta: {
          customers: customersMeta,
          sales: salesMeta,
          filters: { start, end, customerId, salesFilter, membershipLevel },
        },
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error("Error /api/admin/kpi:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

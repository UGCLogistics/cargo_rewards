import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const POINT_VALUE = 250; // 1 poin = 250 rupiah

type MembershipTier = "SILVER" | "GOLD" | "PLATINUM";

type MembershipCounts = {
  SILVER: number;
  GOLD: number;
  PLATINUM: number;
};

type TopCustomerRow = {
  user_id: string;
  customer_name: string | null;
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

type KpiData = {
  total_transactions: number;
  total_publish_rate: number;
  total_discount: number;
  total_cashback: number;
  total_points: number;
  total_customers: number;
  membership_counts: MembershipCounts;
  top_customers: TopCustomerRow[];
  top_sales: TopSalesRow[];
  // >>> baru
  discount_base_amount: number;  // total nilai transaksi yang kena diskon
  cashback_base_amount: number;  // total spending periode yang dapat cashback
};

type CustomerMeta = {
  user_id: string;
  company_name: string | null;
  salesname: string | null;
};

type PerUserAgg = {
  user_id: string;
  customer_name: string | null;
  sales_name: string | null;
  total_transactions: number;
  total_publish_rate: number;
  total_discount: number;
  total_cashback: number;
  total_points: number;
};

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

// Aturan membership berbasis total publish_rate di periode filter yang aktif.
function classifyMembership(total: number): MembershipTier {
  if (total >= 100_000_000) return "PLATINUM";
  if (total >= 50_000_000) return "GOLD";
  return "SILVER";
}

export async function GET(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isInternalRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceClient();

    // ====== BACA QUERY PARAM FILTER ======
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start"); // YYYY-MM-DD
    const end = searchParams.get("end"); // YYYY-MM-DD
    const customerId = searchParams.get("customer_id");
    const salesFilterRaw = searchParams.get("salesname") || "";
    const membershipFilterRaw = searchParams.get("membership") || "";

    const salesFilter = salesFilterRaw.trim();
    const membershipFilterUpper = membershipFilterRaw
      ? membershipFilterRaw.trim().toUpperCase()
      : "";

    const validTiers = ["SILVER", "GOLD", "PLATINUM"] as const;
    const membershipFilter: MembershipTier | "" = validTiers.includes(
      membershipFilterUpper as MembershipTier
    )
      ? (membershipFilterUpper as MembershipTier)
      : "";

    // ====== 1. AMBIL DATA CUSTOMER UNTUK META ======
    const { data: customerRows, error: customerError } = await supabase
      .from("customers")
      .select("user_id, company_name, salesname");

    if (customerError) {
      return NextResponse.json(
        { error: customerError.message },
        { status: 500 }
      );
    }

    const customerMap = new Map<string, CustomerMeta>();
    const salesSet = new Set<string>();

    (customerRows || []).forEach((c: any) => {
      const meta: CustomerMeta = {
        user_id: c.user_id,
        company_name: c.company_name ?? null,
        salesname: c.salesname ?? null,
      };
      customerMap.set(meta.user_id, meta);
      if (meta.salesname) salesSet.add(meta.salesname);
    });

    const salesOptions = Array.from(salesSet).sort((a, b) =>
      a.localeCompare(b)
    );

    // ====== 2A. TRANSAKSI (FILTER DATE & CUSTOMER) ======
    let trxQuery = supabase
      .from("transactions")
      .select(
        "user_id, publish_rate, discount_amount, cashback_amount, points_earned, date"
      );

    if (start) trxQuery = trxQuery.gte("date", start);
    if (end) trxQuery = trxQuery.lte("date", end);
    if (customerId) trxQuery = trxQuery.eq("user_id", customerId);

    const { data: trxRows, error: trxError } = await trxQuery;
    if (trxError) {
      return NextResponse.json({ error: trxError.message }, { status: 500 });
    }

    // ====== 2B. REWARD_LEDGERS (untuk cashback) ======
    let ledgerQuery = supabase
      .from("reward_ledgers")
      .select("user_id, type, amount, points, created_at");

    if (start) ledgerQuery = ledgerQuery.gte("created_at", start);
    if (end) ledgerQuery = ledgerQuery.lte("created_at", end);
    if (customerId) ledgerQuery = ledgerQuery.eq("user_id", customerId);

    const { data: ledgerRows, error: ledgerError } = await ledgerQuery;
    if (ledgerError) {
      return NextResponse.json(
        { error: ledgerError.message },
        { status: 500 }
      );
    }

    // ====== 3. AGREGAT PER USER DARI TRANSAKSI ======
    const perUserMap = new Map<string, PerUserAgg>();
    let discountBaseTotal = 0; // total publish rate dari transaksi yang kena diskon

    for (const row of trxRows || []) {
      const userId = (row as any).user_id as string | null;
      if (!userId) continue;

      const meta = customerMap.get(userId);
      const salesname = (meta?.salesname as string | null) ?? null;

      // Filter by Sales di level transaksi
      if (salesFilter && salesname !== salesFilter) {
        continue;
      }

      const publish = Number((row as any).publish_rate) || 0;
      const discount = Number((row as any).discount_amount) || 0;
      const cashbackTx = Number((row as any).cashback_amount) || 0;
      const points = Number((row as any).points_earned) || 0;

      if (discount > 0) {
        discountBaseTotal += publish;
      }

      let agg = perUserMap.get(userId);
      if (!agg) {
        agg = {
          user_id: userId,
          customer_name: (meta?.company_name as string | null) ?? null,
          sales_name: salesname,
          total_transactions: 0,
          total_publish_rate: 0,
          total_discount: 0,
          total_cashback: 0,
          total_points: 0,
        };
        perUserMap.set(userId, agg);
      }

      agg.total_transactions += 1;
      agg.total_publish_rate += publish;
      agg.total_discount += discount;
      agg.total_cashback += cashbackTx; // kalau suatu saat ada cashback per transaksi
      agg.total_points += points;
    }

    // ====== 3B. MERGE CASHBACK DARI REWARD_LEDGERS ======
    for (const row of ledgerRows || []) {
      const userId = (row as any).user_id as string | null;
      if (!userId) continue;

      const meta = customerMap.get(userId);
      const salesname = (meta?.salesname as string | null) ?? null;

      if (salesFilter && salesname !== salesFilter) {
        continue;
      }

      const amount = Number((row as any).amount) || 0;
      const typeStr = ((row as any).type as string | null) || "";
      const t = typeStr.toUpperCase();

      // dianggap cashback kalau amount > 0 dan type mengandung "CASHBACK" atau "CREDIT"
      const isCashback =
        amount > 0 && (t.includes("CASHBACK") || t === "CREDIT");

      if (!isCashback) continue;

      let agg = perUserMap.get(userId);
      if (!agg) {
        const fallbackMeta = customerMap.get(userId);
        agg = {
          user_id: userId,
          customer_name:
            (fallbackMeta?.company_name as string | null) ?? null,
          sales_name: (fallbackMeta?.salesname as string | null) ?? null,
          total_transactions: 0,
          total_publish_rate: 0,
          total_discount: 0,
          total_cashback: 0,
          total_points: 0,
        };
        perUserMap.set(userId, agg);
      }

      agg.total_cashback += amount;
    }

    // ====== 4. KLASIFIKASI MEMBERSHIP PER CUSTOMER ======
    const membershipCounts: MembershipCounts = {
      SILVER: 0,
      GOLD: 0,
      PLATINUM: 0,
    };
    const membershipByUser = new Map<string, MembershipTier>();

    for (const [userId, agg] of perUserMap.entries()) {
      const tier = classifyMembership(agg.total_publish_rate);
      membershipByUser.set(userId, tier);
    }

    // ====== 4B. BASE TRANSAKSI CASHBACK DARI membership_periods ======
    let cashbackBaseTotal = 0;

    let mpQuery = supabase
      .from("membership_periods")
      .select("user_id, period_end, total_spending, active_cashback_given")
      .eq("active_cashback_given", true);

    if (start) mpQuery = mpQuery.gte("period_end", start);
    if (end) mpQuery = mpQuery.lte("period_end", end);
    if (customerId) mpQuery = mpQuery.eq("user_id", customerId);

    const { data: mpRows, error: mpErr } = await mpQuery;
    if (mpErr) {
      return NextResponse.json({ error: mpErr.message }, { status: 500 });
    }

    for (const mp of mpRows || []) {
      const uid = (mp as any).user_id as string | null;
      if (!uid) continue;

      const meta = customerMap.get(uid);
      const salesname = meta?.salesname ?? null;
      if (salesFilter && salesname !== salesFilter) continue;

      const tier = membershipByUser.get(uid);
      if (membershipFilter && tier && tier !== membershipFilter) continue;

      cashbackBaseTotal += Number((mp as any).total_spending) || 0;
    }

    // ====== 5. HITUNG TOTAL KPI + TOP LIST (SETELAH FILTER MEMBERSHIP) ======
    const totals: KpiData = {
      total_transactions: 0,
      total_publish_rate: 0,
      total_discount: 0,
      total_cashback: 0,
      total_points: 0,
      total_customers: 0,
      membership_counts: membershipCounts,
      top_customers: [],
      top_sales: [],
      discount_base_amount: 0,
      cashback_base_amount: 0,
    };

    const includedCustomers: PerUserAgg[] = [];

    const perSalesMap = new Map<
      string,
      {
        sales_name: string;
        total_transactions: number;
        total_publish_rate: number;
        total_discount: number;
        total_cashback: number;
        total_points: number;
      }
    >();

    for (const [userId, agg] of perUserMap.entries()) {
      const tier = membershipByUser.get(userId)!;

      if (membershipFilter && tier !== membershipFilter) continue;

      totals.total_transactions += agg.total_transactions;
      totals.total_publish_rate += agg.total_publish_rate;
      totals.total_discount += agg.total_discount;
      totals.total_cashback += agg.total_cashback;
      totals.total_points += agg.total_points;

      membershipCounts[tier] += 1;
      includedCustomers.push(agg);

      const salesKey = agg.sales_name || "Tanpa Sales";
      let salesAgg = perSalesMap.get(salesKey);
      if (!salesAgg) {
        salesAgg = {
          sales_name: salesKey,
          total_transactions: 0,
          total_publish_rate: 0,
          total_discount: 0,
          total_cashback: 0,
          total_points: 0,
        };
        perSalesMap.set(salesKey, salesAgg);
      }

      salesAgg.total_transactions += agg.total_transactions;
      salesAgg.total_publish_rate += agg.total_publish_rate;
      salesAgg.total_discount += agg.total_discount;
      salesAgg.total_cashback += agg.total_cashback;
      salesAgg.total_points += agg.total_points;
    }

    totals.total_customers = includedCustomers.length;
    totals.discount_base_amount = discountBaseTotal;
    totals.cashback_base_amount = cashbackBaseTotal;

    // ====== 6. TOP 5 CUSTOMER (berdasarkan revenue) ======
    const topCustomers: TopCustomerRow[] = includedCustomers
      .map((agg) => ({
        user_id: agg.user_id,
        customer_name: agg.customer_name,
        sales_name: agg.sales_name,
        total_transactions: agg.total_transactions,
        total_publish_rate: agg.total_publish_rate,
        total_rewards:
          agg.total_discount +
          agg.total_cashback +
          agg.total_points * POINT_VALUE,
      }))
      .sort((a, b) => b.total_publish_rate - a.total_publish_rate)
      .slice(0, 5);

    // ====== 7. TOP 5 SALES (berdasarkan revenue customer) ======
    const topSales: TopSalesRow[] = Array.from(perSalesMap.values())
      .map((sAgg) => ({
        sales_name: sAgg.sales_name,
        total_transactions: sAgg.total_transactions,
        total_publish_rate: sAgg.total_publish_rate,
        total_rewards:
          sAgg.total_discount +
          sAgg.total_cashback +
          sAgg.total_points * POINT_VALUE,
      }))
      .sort((a, b) => b.total_publish_rate - a.total_publish_rate)
      .slice(0, 5);

    totals.top_customers = topCustomers;
    totals.top_sales = topSales;

    return NextResponse.json(
      {
        data: totals,
        meta: {
          customers: (customerRows || []).map((c: any) => ({
            user_id: c.user_id as string,
            company_name: c.company_name as string | null,
            salesname: c.salesname as string | null,
          })),
          sales: salesOptions,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

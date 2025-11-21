"use client";

import { useEffect, useState } from "react";
import { useAuth } from "context/AuthContext";
import {
  Package,
  CreditCard,
  Wallet,
  Users,
  BadgePercent,
  Gift,
  Receipt,
  Percent,
  BarChart3,
  PieChart,
  TrendingUp,
  ArrowDownCircle,
  Award,
  Trophy,
  Crown,
  Activity,
  Clock,
  AlertTriangle,
  Moon,
  CircleEqualIcon,
} from "lucide-react";

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

type KpiData = {
  total_transactions: number;
  total_publish_rate: number;
  total_discount: number;

  // Cashback: hanya ACTIVE_CASHBACK_3M
  total_cashback: number;

  // Poin
  total_points?: number;
  total_points_earned?: number;
  total_points_redeemed?: number;
  total_points_available?: number;

  total_customers: number;
  membership_counts: MembershipCounts;
  top_customers: TopCustomerRow[];
  top_sales: TopSalesRow[];

  // basis transaksi
  discount_base_amount?: number;
  cashback_base_amount?: number;
  points_base_amount?: number;

  // keaktifan customer (dari API)
  customer_activity_summary?: CustomerActivitySummary;
  customer_activity_detail?: CustomerActivityDetailRow[];
};

type CustomerOption = {
  user_id: string;
  company_name: string | null;
  salesname: string | null;
};

export default function AdminInternalKpiPage() {
  const { user } = useAuth();
  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = String(rawRole).toUpperCase();

  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [salesFilter, setSalesFilter] = useState("");
  const [membershipLevel, setMembershipLevel] = useState("");

  // dropdown options
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [salesOptions, setSalesOptions] = useState<string[]>([]);

  const fetchKpi = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
      if (customerId) params.set("customer_id", customerId);
      if (salesFilter) params.set("salesname", salesFilter);
      if (membershipLevel) params.set("membership", membershipLevel);

      const query = params.toString();
      const url = `/api/admin/kpi${query ? `?${query}` : ""}`;

      const res = await fetch(url, {
        headers: {
          "x-role": role,
        },
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg =
          (json && (json.error || json.message)) ||
          `Gagal memuat KPI admin (status ${res.status})`;
        throw new Error(msg);
      }

      setKpi((json?.data as KpiData) || null);

      if (json?.meta?.customers) {
        setCustomerOptions(json.meta.customers as CustomerOption[]);
      }
      if (json?.meta?.sales) {
        setSalesOptions(json.meta.sales as string[]);
      }
    } catch (err: any) {
      setError(err.message ?? "Terjadi kesalahan");
      setKpi(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchKpi();
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setCustomerId("");
    setSalesFilter("");
    setMembershipLevel("");
    fetchKpi();
  };

  // ====== ANALITIK TURUNAN DARI KPI ======
  const totalTransactions = kpi?.total_transactions ?? 0;
  const totalRevenue = kpi?.total_publish_rate ?? 0;
  const totalDiscount = kpi?.total_discount ?? 0;
  const totalCashback = kpi?.total_cashback ?? 0;
  const totalCustomers = kpi?.total_customers ?? 0;
  const membershipCounts: MembershipCounts = kpi?.membership_counts ?? {
    SILVER: 0,
    GOLD: 0,
    PLATINUM: 0,
  };

  // Points breakdown
  const totalPointsEarned =
    kpi?.total_points_earned ?? kpi?.total_points ?? 0;

  const totalPointsRedeemed = kpi?.total_points_redeemed ?? 0;

  const totalPointsAvailable =
    kpi?.total_points_available ??
    Math.max(totalPointsEarned - totalPointsRedeemed, 0);

  const totalPointsEarnedValue = totalPointsEarned * POINT_VALUE;
  const totalPointsRedeemedValue = totalPointsRedeemed * POINT_VALUE;
  const totalPointsAvailableValue = totalPointsAvailable * POINT_VALUE;

  // Untuk biaya rewards, gunakan poin yang

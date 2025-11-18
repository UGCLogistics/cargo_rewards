"use client";

import { useEffect, useState } from "react";
import { useAuth } from "context/AuthContext";

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

  // basis transaksi yang menerima masing-masing reward
  discount_base_amount?: number;
  cashback_base_amount?: number;
  points_base_amount?: number;
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

      // set dropdown options (diambil dari meta, tidak terpengaruh filter)
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
  const totalPoints = kpi?.total_points ?? 0;
  const totalCustomers = kpi?.total_customers ?? 0;
  const membershipCounts: MembershipCounts = kpi?.membership_counts ?? {
    SILVER: 0,
    GOLD: 0,
    PLATINUM: 0,
  };

  // basis transaksi
  const discountBaseAmount = kpi?.discount_base_amount ?? 0;
  const cashbackBaseAmount = kpi?.cashback_base_amount ?? 0;
  const pointsBaseAmount = kpi?.points_base_amount ?? 0;

  const totalPointsValue = totalPoints * POINT_VALUE;
  const totalRewards = totalDiscount + totalCashback + totalPointsValue;
  const netRevenue = Math.max(totalRevenue - totalRewards, 0);
  const rewardRatio =
    totalRevenue > 0 ? (totalRewards / totalRevenue) * 100 : 0;

  const avgRevenuePerTxn =
    totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  const avgRewardsPerTxn =
    totalTransactions > 0 ? totalRewards / totalTransactions : 0;
  const avgPointsPerTxn =
    totalTransactions > 0 ? totalPoints / totalTransactions : 0;

  const topCustomers = kpi?.top_customers ?? [];
  const topSales = kpi?.top_sales ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold text-white">
          Dashboard KPI Internal – Admin
        </h1>
        <p className="mt-1 text-sm text-slate-400 max-w-2xl">
          Ringkasan performa global program C.A.R.G.O Rewards untuk seluruh
          pelanggan dan transaksi. Data ini dapat dijadikan dasar review bisnis
          dan penentuan strategi.
        </p>
      </header>

      {/* Status */}
      {error && (
        <div className="glass border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {loading && !error && (
        <p className="text-sm text-slate-400">Memuat data KPI…</p>
      )}

      {/* Filter Bar */}
      <section className="glass rounded-2xl px-4 py-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-white">Filter Data</h2>
          <span className="text-[11px] text-slate-400">
            Filter akan mempengaruhi seluruh KPI, Top 5 Customer, dan Top 5
            Sales.
          </span>
        </div>

        <form
          onSubmit={handleFilterSubmit}
          className="grid gap-2 md:grid-cols-3 lg:grid-cols-6 items-end"
        >
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md bg-black/20 border border-white/10 px-2 py-1 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Tanggal Selesai
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md bg-black/20 border border-white/10 px-2 py-1 text-xs text-white"
            />
          </div>

          {/* Dropdown Customer */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Customer
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full rounded-md bg-black/20 border border-white/10 px-2 py-1 text-xs text-white"
            >
              <option value="">Semua Customer</option>
              {customerOptions.map((c) => (
                <option key={c.user_id} value={c.user_id}>
                  {c.company_name || c.user_id.substring(0, 8)}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Sales */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Sales
            </label>
            <select
              value={salesFilter}
              onChange={(e) => setSalesFilter(e.target.value)}
              className="w-full rounded-md bg-black/20 border border-white/10 px-2 py-1 text-xs text-white"
            >
              <option value="">Semua Sales</option>
              {salesOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Membership */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Level Membership
            </label>
            <select
              value={membershipLevel}
              onChange={(e) => setMembershipLevel(e.target.value)}
              className="w-full rounded-md bg-black/20 border border-white/10 px-2 py-1 text-xs text-white"
            >
              <option value="">Semua Level</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
              <option value="PLATINUM">Platinum</option>
            </select>
          </div>

          <div className="flex gap-2 justify-end md:col-span-3 lg:col-span-1 mt-1">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"
            >
              Reset
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#ff4600] text-white px-4 py-1.5 text-xs font-semibold hover:bg-[#ff5f24]"
            >
              Terapkan
            </button>
          </div>
        </form>
      </section>

      {/* KPI Cards utama */}
      {!loading && kpi && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {/* Total transaksi */}
          <div className="glass rounded-2xl px-4 py-3 flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Total Transaksi
            </span>
            <span className="text-xl font-semibold text-white">
              {totalTransactions.toLocaleString("id-ID")}
            </span>
          </div>

          {/* Total customer */}
          <div className="glass rounded-2xl px-4 py-3 flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Total Customer Aktif
            </span>
            <span className="text-xl font-semibold text-white">
              {totalCustomers.toLocaleString("id-ID")}
            </span>
          </div>

          {/* Revenue */}
          <div className="glass rounded-2xl px-4 py-3 flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Total Publish Rate
            </span>
            <span className="text-xl font-semibold text-white">
              Rp{" "}
              {totalRevenue.toLocaleString("id-ID", {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>

          {/* Diskon */}
          <div className="glass rounded-2xl px-4 py-3 flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Total Diskon
            </span>
            <span className="text-xl font-semibold text-emerald-300">
              Rp{" "}
              {totalDiscount.toLocaleString("id-ID", {
                maximumFractionDigits: 0,
              })}
            </span>
            {discountBaseAmount > 0 && (
              <span className="text-[11px] text-slate-400">
                Dari transaksi senilai{" "}
                {discountBaseAmount.toLocaleString("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  maximumFractionDigits: 0,
                })}
              </span>
            )}
          </div>

          {/* Cashback */}
          <div className="glass rounded-2xl px-4 py-3 flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Total Cashback
            </span>
            <span className="text-xl font-semibold text-amber-300">
              Rp{" "}
              {totalCashback.toLocaleString("id-ID", {
                maximumFractionDigits: 0,
              })}
            </span>
            {cashbackBaseAmount > 0 && (
              <span className="text-[11px] text-slate-400">
                Dari transaksi senilai{" "}
                {cashbackBaseAmount.toLocaleString("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  maximumFractionDigits: 0,
                })}
              </span>
            )}
          </div>

          {/* Poin */}
          <div className="glass rounded-2xl px-4 py-3 flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Total Poin Diberikan
            </span>
            <span className="text-xl font-semibold text-sky-300">
              {totalPoints.toLocaleString("id-ID")}
            </span>
            {pointsBaseAmount > 0 && (
              <span className="text-[11px] text-slate-400">
                Dari transaksi senilai{" "}
                {pointsBaseAmount.toLocaleString("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  maximumFractionDigits: 0,
                })}
              </span>
            )}
            <span className="text-[11px] text-slate-400">
              Nilai setara: Rp{" "}
              {totalPointsValue.toLocaleString("id-ID", {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        </section>
      )}

      {/* ===== Detail & Analitik Lanjutan ===== */}
      {!loading && kpi && (
        <section className="glass rounded-2xl px-4 py-4 mt-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-white">
              Detail & Analitik Lanjutan
            </h2>
            <span className="text-[11px] text-slate-400">
              Angka dihitung dari transaksi sesuai filter di atas.
            </span>
          </div>

          {/* Grid analitik turunan */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {/* Net revenue */}
            <div className="glass rounded-xl px-3 py-3 flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Net Revenue (setelah rewards)
              </span>
              <span className="text-lg font-semibold text-white">
                Rp{" "}
                {netRevenue.toLocaleString("id-ID", {
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="text-[11px] text-slate-400">
                Publish rate dikurangi total diskon, cashback, dan nilai poin.
              </span>
            </div>

            {/* Total rewards dalam Rp */}
            <div className="glass rounded-xl px-3 py-3 flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Total Rewards (Diskon + Cashback + Poin)
              </span>
            <span className="text-lg font-semibold text-emerald-300">
                Rp{" "}
                {totalRewards.toLocaleString("id-ID", {
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="text-[11px] text-slate-400">
                Menggabungkan seluruh insentif finansial yang diberikan.
              </span>
            </div>

            {/* Rasio rewards vs revenue */}
            <div className="glass rounded-xl px-3 py-3 flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Rasio Rewards terhadap Revenue
              </span>
              <span className="text-lg font-semibold text-amber-300">
                {rewardRatio.toFixed(2)}%
              </span>
              <span className="text-[11px] text-slate-400">
                (Diskon + cashback + nilai poin) dibagi total publish rate.
              </span>
            </div>

            {/* Rata-rata per transaksi */}
            <div className="glass rounded-xl px-3 py-3 flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Avg Revenue per Transaksi
              </span>
              <span className="text-lg font-semibold text-white">
                Rp{" "}
                {avgRevenuePerTxn.toLocaleString("id-ID", {
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="text-[11px] text-slate-400">
                Gambaran ticket size transaksi rata-rata.
              </span>
            </div>

            <div className="glass rounded-xl px-3 py-3 flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Avg Rewards per Transaksi
              </span>
              <span className="text-lg font-semibold text-emerald-300">
                Rp{" "}
                {avgRewardsPerTxn.toLocaleString("id-ID", {
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="text-[11px] text-slate-400">
                Rata-rata total rewards (diskon + cashback + poin) per
                transaksi.
              </span>
            </div>

            <div className="glass rounded-xl px-3 py-3 flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Avg Poin per Transaksi
              </span>
              <span className="text-lg font-semibold text-sky-300">
                {avgPointsPerTxn.toLocaleString("id-ID", {
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="text-[11px] text-slate-400">
                Menggambarkan intensitas pemberian poin di setiap transaksi.
              </span>
            </div>
          </div>

          {/* Breakdown membership */}
          <div className="mt-3">
            <h3 className="text-xs font-semibold text-white mb-2">
              Distribusi Customer per Membership (periode ter-filter)
            </h3>
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="glass rounded-xl px-3 py-3 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  Silver
                </span>
                <span className="text-lg font-semibold text-slate-100">
                  {membershipCounts.SILVER.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="glass rounded-xl px-3 py-3 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-yellow-500">
                  Gold
                </span>
                <span className="text-lg font-semibold text-yellow-300">
                  {membershipCounts.GOLD.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="glass rounded-xl px-3 py-3 flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-slate-200">
                  Platinum
                </span>
                <span className="text-lg font-semibold text-slate-50">
                  {membershipCounts.PLATINUM.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>

          {/* Top 5 Customer & Top 5 Sales */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2 text-xs">
            {/* Top 5 Customer */}
            <div>
              <h3 className="text-xs font-semibold text-white mb-2">
                Top 5 Customer (berdasarkan revenue)
              </h3>
              <div className="glass rounded-xl overflow-x-auto">
                <table className="min-w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Sales</th>
                      <th className="px-3 py-2 text-right">Transaksi</th>
                      <th className="px-3 py-2 text-right">Revenue</th>
                      <th className="px-3 py-2 text-right">Rewards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-2 text-center text-slate-400"
                        >
                          Tidak ada data customer.
                        </td>
                      </tr>
                    )}
                    {topCustomers.map((c) => (
                      <tr
                        key={c.user_id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="px-3 py-2">
                          {c.customer_name || c.user_id.substring(0, 8)}
                        </td>
                        <td className="px-3 py-2">
                          {c.sales_name || "-"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {c.total_transactions.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 text-right">
                          Rp{" "}
                          {c.total_publish_rate.toLocaleString("id-ID", {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          Rp{" "}
                          {c.total_rewards.toLocaleString("id-ID", {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top 5 Sales */}
            <div>
              <h3 className="text-xs font-semibold text-white mb-2">
                Top 5 Sales (berdasarkan revenue customer)
              </h3>
              <div className="glass rounded-xl overflow-x-auto">
                <table className="min-w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-3 py-2 text-left">Sales</th>
                      <th className="px-3 py-2 text-right">Transaksi</th>
                      <th className="px-3 py-2 text-right">Revenue</th>
                      <th className="px-3 py-2 text-right">Rewards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSales.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-2 text-center text-slate-400"
                        >
                          Tidak ada data sales.
                        </td>
                      </tr>
                    )}
                    {topSales.map((s) => (
                      <tr
                        key={s.sales_name}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="px-3 py-2">
                          {s.sales_name || "Tanpa Sales"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {s.total_transactions.toLocaleString("id-ID")}
                        </td>
                        <td className="px-3 py-2 text-right">
                          Rp{" "}
                          {s.total_publish_rate.toLocaleString("id-ID", {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          Rp{" "}
                          {s.total_rewards.toLocaleString("id-ID", {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

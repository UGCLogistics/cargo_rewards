"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "context/AuthContext";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Users,
  CreditCard,
  Activity as ActivityIcon,
  Clock,
  AlertTriangle,
  Moon,
} from "lucide-react";

type Tier = "SILVER" | "GOLD" | "PLATINUM";
type ActivityStatus = "ACTIVE" | "PASSIVE" | "RISK" | "DORMANT";

interface MembershipRow {
  user_id: string;
  user_code: string | null;
  company_code: string | null;
  company_name: string | null;
  salesname: string | null;
  total_spending: number;
  total_shipments: number;
  last_transaction_date: string | null;
  tier: Tier;
  amount_to_next_tier: number;
  activity_status: ActivityStatus;
}

const TIER_LABEL: Record<Tier, string> = {
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};

const TIER_COLORS: Record<Tier, string> = {
  SILVER: "#9CA3AF",
  GOLD: "#F59E0B",
  PLATINUM: "#FF4600",
};

const ACTIVITY_LABEL: Record<ActivityStatus, string> = {
  ACTIVE: "Aktif",
  PASSIVE: "Pasif",
  RISK: "Risk",
  DORMANT: "Dormant",
};

function formatIdr(value: number): string {
  return (
    "Rp " +
    (value || 0).toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    })
  );
}

export default function AdminMembershipPage() {
  const { user } = useAuth();
  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = String(rawRole).toUpperCase();

  // digunakan hanya untuk tombol "Reset 3 Bulan Terakhir"
  const today = new Date();

  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // default tanggal = KOSONG → semua data
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // filters
  const [tierFilter, setTierFilter] = useState<"ALL" | Tier>("ALL");
  const [salesFilter, setSalesFilter] = useState<string>("ALL");
  const [activityFilter, setActivityFilter] =
    useState<"ALL" | ActivityStatus>("ALL");
  const [search, setSearch] = useState("");

  const fetchMemberships = async (opts?: { start?: string; end?: string }) => {
    if (!user) return;

    const start = opts?.start ?? startDate;
    const end = opts?.end ?? endDate;

    setLoading(true);
    setError(null);

    try {
      let url = "/api/admin/membership";
      const params = new URLSearchParams();
      if (start) params.append("start", start);
      if (end) params.append("end", end);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: {
          "x-role": role,
        },
      });

      const contentType = res.headers.get("content-type") || "";
      let json: any = null;
      if (contentType.includes("application/json")) {
        json = await res.json();
      }

      if (!res.ok) {
        throw new Error(json?.error || "Gagal memuat membership");
      }

      setMemberships((json?.data as MembershipRow[]) || []);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  };

  // Load awal (tanpa filter tanggal → semua data)
  useEffect(() => {
    if (!user) return;
    fetchMemberships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const handleResetLast3Months = () => {
    const end = today.toISOString().slice(0, 10);
    const startDateObj = new Date(today);
    startDateObj.setMonth(startDateObj.getMonth() - 3);
    const start = startDateObj.toISOString().slice(0, 10);

    setStartDate(start);
    setEndDate(end);
    fetchMemberships({ start, end });
  };

  const periodLabel = (() => {
    if (!startDate && !endDate) return "Semua periode";
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      });

    if (startDate && endDate) return `${fmt(startDate)} - ${fmt(endDate)}`;
    if (startDate) return `≥ ${fmt(startDate)}`;
    return `≤ ${fmt(endDate!)}`;
  })();

  // unique sales list
  const salesOptions = useMemo(() => {
    const set = new Set<string>();
    memberships.forEach((m) => {
      if (m.salesname) set.add(m.salesname);
    });
    return Array.from(set).sort();
  }, [memberships]);

  // filtered data
  const filteredMemberships = useMemo(() => {
    return memberships.filter((m) => {
      if (tierFilter !== "ALL" && m.tier !== tierFilter) return false;
      if (
        salesFilter !== "ALL" &&
        (m.salesname || "").toLowerCase() !== salesFilter.toLowerCase()
      )
        return false;
      if (activityFilter !== "ALL" && m.activity_status !== activityFilter)
        return false;

      if (search) {
        const s = search.toLowerCase();
        const company = (m.company_name || "").toLowerCase();
        const uid = m.user_id.toLowerCase();
        const userCode = (m.user_code || "").toLowerCase();
        const companyCode = (m.company_code || "").toLowerCase();

        if (
          !company.includes(s) &&
          !uid.includes(s) &&
          !userCode.includes(s) &&
          !companyCode.includes(s)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [memberships, tierFilter, salesFilter, activityFilter, search]);

  // summary
  const totalMembers = filteredMemberships.length;
  const totalSpending = filteredMemberships.reduce(
    (sum, m) => sum + (m.total_spending || 0),
    0
  );
  const totalShipments = filteredMemberships.reduce(
    (sum, m) => sum + (m.total_shipments || 0),
    0
  );

  const tierAgg = useMemo(() => {
    const base: Record<
      Tier,
      { tier: Tier; count: number; total: number }
    > = {
      SILVER: { tier: "SILVER", count: 0, total: 0 },
      GOLD: { tier: "GOLD", count: 0, total: 0 },
      PLATINUM: { tier: "PLATINUM", count: 0, total: 0 },
    };
    filteredMemberships.forEach((m) => {
      base[m.tier].count++;
      base[m.tier].total += m.total_spending || 0;
    });
    return base;
  }, [filteredMemberships]);

  const activityAgg = useMemo(() => {
    const base: Record<ActivityStatus, number> = {
      ACTIVE: 0,
      PASSIVE: 0,
      RISK: 0,
      DORMANT: 0,
    };
    filteredMemberships.forEach((m) => {
      base[m.activity_status]++;
    });
    return base;
  }, [filteredMemberships]);

  // chart data
  const tierDistributionData = (["SILVER", "GOLD", "PLATINUM"] as Tier[]).map(
    (t) => ({
      name: TIER_LABEL[t],
      tier: t,
      value: tierAgg[t].count,
    })
  );

  const tierRevenueData = (["SILVER", "GOLD", "PLATINUM"] as Tier[]).map(
    (t) => ({
      name: TIER_LABEL[t],
      tier: t,
      value: tierAgg[t].total,
    })
  );

  const topCustomersData = [...filteredMemberships]
    .sort((a, b) => (b.total_spending || 0) - (a.total_spending || 0))
    .slice(0, 10)
    .map((m) => ({
      name:
        m.company_name ||
        m.company_code ||
        m.user_code ||
        m.user_id.substring(0, 8),
      tier: m.tier,
      value: m.total_spending || 0,
    }));

  const activityData: { status: ActivityStatus; name: string; value: number }[] =
    [
      {
        status: "ACTIVE",
        name: ACTIVITY_LABEL.ACTIVE,
        value: activityAgg.ACTIVE,
      },
      {
        status: "PASSIVE",
        name: ACTIVITY_LABEL.PASSIVE,
        value: activityAgg.PASSIVE,
      },
      { status: "RISK", name: ACTIVITY_LABEL.RISK, value: activityAgg.RISK },
      {
        status: "DORMANT",
        name: ACTIVITY_LABEL.DORMANT,
        value: activityAgg.DORMANT,
      },
    ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-semibold text-white">
          Membership (Admin)
        </h1>
        <span className="text-xs text-slate-400">
          Status member dihitung dari total transaksi (Rp) dalam periode yang
          dipilih.
        </span>
      </div>

      {error && (
        <div className="glass border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Filter blok - dibagi 2 baris biar lebih rapi */}
      <div className="space-y-2 text-xs">
        {/* Baris 1: tanggal + tombol */}
        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex items-center gap-1">
            <span>Start:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md bg-black/40 border border-white/10 px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="flex items-center gap-1">
            <span>End:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md bg-black/40 border border-white/10 px-2 py-1 text-xs text-white"
            />
          </label>
          <button
            onClick={() => fetchMemberships()}
            className="rounded-md bg-[#ff4600] hover:bg-[#ff5f24] text-white px-3 py-1 text-xs font-semibold"
          >
            Terapkan Filter
          </button>
          <button
            onClick={handleResetLast3Months}
            className="rounded-md border border-white/20 px-3 py-1 text-xs text-slate-200 hover:bg-white/5"
          >
            Reset 3 Bulan Terakhir
          </button>
        </div>

        {/* Baris 2: search + filter tier/sales/aktivitas */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search di kiri, full width di mobile */}
          <label className="flex items-center gap-1 flex-1 min-w-[180px]">
            <span>Cari:</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama perusahaan / Code / User ID"
              className="flex-1 rounded-md bg-black/40 border border-white/10 px-2 py-1 text-xs text-white"
            />
          </label>

          {/* Filter lainnya di kanan */}
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1">
              <span>Tier:</span>
              <select
                value={tierFilter}
                onChange={(e) =>
                  setTierFilter(e.target.value as "ALL" | Tier)
                }
                className="bg-black/40 border border-white/10 text-xs rounded-md px-2 py-1"
              >
                <option value="ALL">Semua</option>
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
                <option value="PLATINUM">Platinum</option>
              </select>
            </label>

            <label className="flex items-center gap-1">
              <span>Sales:</span>
              <select
                value={salesFilter}
                onChange={(e) => setSalesFilter(e.target.value)}
                className="bg-black/40 border border-white/10 text-xs rounded-md px-2 py-1"
              >
                <option value="ALL">Semua</option>
                {salesOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1">
              <span>Aktivitas:</span>
              <select
                value={activityFilter}
                onChange={(e) =>
                  setActivityFilter(e.target.value as "ALL" | ActivityStatus)
                }
                className="bg-black/40 border border-white/10 text-xs rounded-md px-2 py-1"
              >
                <option value="ALL">Semua</option>
                <option value="ACTIVE">Aktif (&le;15 hari)</option>
                <option value="PASSIVE">Pasif (16–30 hari)</option>
                <option value="RISK">Risk (31–45 hari)</option>
                <option value="DORMANT">Dormant (&gt;45 hari)</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Periode penilaian:{" "}
        <span className="font-medium text-slate-200">{periodLabel}</span>
      </p>

      {/* Summary cards */}
      <div className="space-y-3">
        {/* 2 kartu besar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Total Member */}
          <div className="glass rounded-xl px-4 py-3 text-xs flex items-center justify-between">
            <div>
              <p className="text-slate-400">Total Member</p>
              <p className="text-lg font-semibold text-white">
                {totalMembers.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-slate-400">
                {totalShipments.toLocaleString("id-ID")} shipment dalam periode.
              </p>
            </div>
            <div className="p-2 rounded-full bg-white/5">
              <Users className="w-7 h-7 text-slate-100" />
            </div>
          </div>

          {/* Total Transaksi Periode */}
          <div className="glass rounded-xl px-4 py-3 text-xs flex items-center justify-between">
            <div>
              <p className="text-slate-400">Total Transaksi Periode</p>
              <p className="text-lg font-semibold text-white">
                {formatIdr(totalSpending)}
              </p>
              <p className="text-[11px] text-slate-400">
                Akumulasi publish rate seluruh member pada periode ini.
              </p>
            </div>
            <div className="p-2 rounded-full bg-white/5">
              <CreditCard className="w-7 h-7 text-emerald-300" />
            </div>
          </div>
        </div>

        {/* 4 kartu kecil – sebaran aktivitas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Active */}
          <div className="glass rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-emerald-300 uppercase">
                Aktif (&lt; 15 hari)
              </p>
              <p className="text-lg font-semibold text-white">
                {activityAgg.ACTIVE.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-slate-400">
                Transaksi terakhir &lt; 15 hari yang lalu.
              </p>
            </div>
            <ActivityIcon className="w-6 h-6 text-emerald-300" />
          </div>

          {/* Passive */}
          <div className="glass rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-sky-300 uppercase">
                Pasif (15–30 hari)
              </p>
              <p className="text-lg font-semibold text-white">
                {activityAgg.PASSIVE.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-slate-400">
                Mulai jarang bertransaksi, perlu follow up.
              </p>
            </div>
            <Clock className="w-6 h-6 text-sky-300" />
          </div>

          {/* Risk */}
          <div className="glass rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-amber-300 uppercase">
                High Risk (31–45 hari)
              </p>
              <p className="text-lg font-semibold text-white">
                {activityAgg.RISK.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-slate-400">
                Beresiko dormant, butuh action segera.
              </p>
            </div>
            <AlertTriangle className="w-6 h-6 text-amber-300" />
          </div>

          {/* Dormant */}
          <div className="glass rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-red-300 uppercase">
                Dormant (&gt; 45 hari)
              </p>
              <p className="text-lg font-semibold text-white">
                {activityAgg.DORMANT.toLocaleString("id-ID")}
              </p>
              <p className="text-[11px] text-slate-400">
                Tidak bertransaksi &gt; 45 hari.
              </p>
            </div>
            <Moon className="w-6 h-6 text-red-300" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pie tier distribution */}
        <div className="glass rounded-2xl px-4 py-3 h-64">
          <p className="text-xs text-slate-300 mb-2">
            Distribusi Member per Tier
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={tierDistributionData}
                dataKey="value"
                nameKey="name"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
              >
                {tierDistributionData.map((entry, index) => (
                  <Cell
                    key={`cell-tier-${index}`}
                    fill={TIER_COLORS[entry.tier]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) =>
                  `${value.toLocaleString("id-ID")} member`
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar revenue per tier */}
        <div className="glass rounded-2xl px-4 py-3 h-64">
          <p className="text-xs text-slate-300 mb-2">
            Kontribusi Transaksi per Tier
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tierRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis
                stroke="#9CA3AF"
                tickFormatter={(v) =>
                  (v / 1_000_000).toLocaleString("id-ID") + " jt"
                }
              />
              <Tooltip
                formatter={(v: any) => formatIdr(Number(v))}
                labelFormatter={(label) => label}
              />
              <Bar dataKey="value">
                {tierRevenueData.map((entry, index) => (
                  <Cell
                    key={`bar-tier-${index}`}
                    fill={TIER_COLORS[entry.tier]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top customers */}
        <div className="glass rounded-2xl px-4 py-3 h-64">
          <p className="text-xs text-slate-300 mb-2">
            Top 10 Customer berdasarkan Transaksi
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topCustomersData}
              margin={{ left: -20, right: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="name"
                stroke="#9CA3AF"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-30}
                textAnchor="end"
              />
              <YAxis
                stroke="#9CA3AF"
                tickFormatter={(v) =>
                  (v / 1_000_000).toLocaleString("id-ID") + " jt"
                }
              />
              <Tooltip
                formatter={(v: any) => formatIdr(Number(v))}
                labelFormatter={(label) => label}
              />
              <Legend />
              <Bar dataKey="value">
                {topCustomersData.map((entry, index) => (
                  <Cell
                    key={`bar-cust-${index}`}
                    fill={TIER_COLORS[entry.tier]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabel hasil */}
      <section className="glass rounded-2xl px-4 py-4">
        {loading ? (
          <p className="text-sm text-slate-400">Memuat membership…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-slate-400">
                  <th className="px-3 py-2 text-left">No</th>
                  <th className="px-3 py-2 text-left">Perusahaan</th>
                  <th className="px-3 py-2 text-left">Sales</th>
                  <th className="px-3 py-2 text-left">Tier</th>
                  <th className="px-3 py-2 text-right">
                    Total Transaksi (Rp)
                  </th>
                  <th className="px-3 py-2 text-right">
                    Jumlah Shipment
                  </th>
                  <th className="px-3 py-2 text-right">Avg Ticket</th>
                  <th className="px-3 py-2 text-left">
                    Transaksi Terakhir
                  </th>
                  <th className="px-3 py-2 text-left">Aktivitas</th>
                  <th className="px-3 py-2 text-right">
                    Gap ke Next Tier
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMemberships.map((m, idx) => {
                  const avgTicket =
                    m.total_shipments > 0
                      ? m.total_spending / m.total_shipments
                      : 0;

                  const lastDateLabel = m.last_transaction_date
                    ? new Date(m.last_transaction_date).toLocaleDateString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                        }
                      )
                    : "-";

                  return (
                    <tr
                      key={m.user_id}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="px-3 py-2 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        <div className="font-semibold">
                          {m.company_name || "-"}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {m.company_code ||
                            m.user_code ||
                            m.user_id.substring(0, 8)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {m.salesname || "-"}
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {TIER_LABEL[m.tier]}
                      </td>
                      <td className="px-3 py-2 text-right text-[11px]">
                        {formatIdr(m.total_spending)}
                      </td>
                      <td className="px-3 py-2 text-right text-[11px]">
                        {m.total_shipments.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2 text-right text-[11px]">
                        {formatIdr(avgTicket)}
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {lastDateLabel}
                      </td>
                      <td className="px-3 py-2 text-[11px]">
                        {ACTIVITY_LABEL[m.activity_status]}
                      </td>
                      <td className="px-3 py-2 text-right text-[11px]">
                        {m.amount_to_next_tier > 0
                          ? formatIdr(m.amount_to_next_tier)
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
                {filteredMemberships.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-4 text-center text-slate-400"
                    >
                      Tidak ada data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

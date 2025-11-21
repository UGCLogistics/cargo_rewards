// app/dashboard/rewards/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "context/AuthContext";

interface RewardHistoryItem {
  id: string;
  source: "LEDGER" | "REDEMPTION" | string;
  category?: string;
  type?: string;
  title: string;
  note?: string | null;
  created_at: string;          // alias rewardDate
  transactionDate?: string | null;
  rewardDate?: string | null;
  pointsDelta?: number | null;
  baseAmount?: number | null;
  discountAmount?: number | null;
  cashbackAmount?: number | null;
  pointsMultiplier?: number | null; // 1 / 1.25 / 1.5
  status?: string | null;
  transaction?: {
    id: number;
    date?: string | null;
    service?: string | null;
    origin?: string | null;
    destination?: string | null;
  };
}

interface CustomerOption {
  id: string;
  user_id: string;
  company_name: string | null;
}

const ROWS_PER_PAGE = 20;

export default function RewardsHistoryPage() {
  const { user } = useAuth();

  const [role, setRole] = useState<"CUSTOMER" | "INTERNAL">("CUSTOMER");
  const [rawHistory, setRawHistory] = useState<RewardHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    rewardType: "ALL", // ALL | POINT_EARN | CASHBACK | BONUS | REDEMPTION
  });

  const [page, setPage] = useState(1);

  // role & default user
  useEffect(() => {
    if (!user) return;

    const rawRole =
      ((user.user_metadata as any)?.role as string | undefined) || "CUSTOMER";
    const r =
      String(rawRole).toUpperCase() === "CUSTOMER" ? "CUSTOMER" : "INTERNAL";

    setRole(r);
    setSelectedUserId((prev) => prev || user.id);
  }, [user]);

  // load customer list for internal
  useEffect(() => {
    if (role === "CUSTOMER") return;

    const loadCustomers = async () => {
      try {
        const res = await fetch("/api/customers-simple", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Gagal memuat customer");
        setCustomers(json.customers || []);
      } catch (err) {
        console.error(err);
      }
    };

    loadCustomers();
  }, [role]);

  // load history when selectedUserId changes
  useEffect(() => {
    if (!selectedUserId) return;

    const loadHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = `/api/rewards?userId=${encodeURIComponent(selectedUserId)}`;
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "Gagal memuat riwayat rewards");
        }

        setRawHistory(Array.isArray(json.history) ? json.history : []);
        setPage(1);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Gagal memuat riwayat rewards"
        );
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [selectedUserId]);

  // helpers
  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return value;
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleDateString("id-ID", {
        dateStyle: "medium",
      });
    } catch {
      return value;
    }
  };

  const formatCurrency = (value?: number | null) => {
    if (value == null) return "-";
    return value.toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    });
  };

  const formatPoints = (value?: number | null) => {
    if (value == null) return "-";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toLocaleString("id-ID")} pts`;
  };

  const formatMultiplier = (value?: number | null) => {
    if (value == null) return "-";
    return `${value.toFixed(2)}x`;
  };

  const statusClass = (category?: string, status?: string | null) => {
    if (category !== "REDEMPTION") {
      return "bg-gray-50/10 text-gray-300 ring-1 ring-gray-600/60";
    }
    const s = (status || "").toUpperCase();
    if (s === "APPROVED" || s === "PAID") {
      return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40";
    }
    if (s === "REJECTED") {
      return "bg-red-500/15 text-red-300 ring-1 ring-red-500/40";
    }
    return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40";
  };

  // filter & pagination
  const filteredHistory = useMemo(() => {
    let result = [...rawHistory];

    const { startDate, endDate, rewardType } = filters;

    if (startDate || endDate) {
      const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
      const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

      result = result.filter((item) => {
        const t = new Date(item.rewardDate ?? item.created_at);
        if (start && t < start) return false;
        if (end && t > end) return false;
        return true;
      });
    }

    if (rewardType !== "ALL") {
      result = result.filter(
        (item) => (item.category || "OTHER") === rewardType
      );
    }

    return result;
  }, [rawHistory, filters.startDate, filters.endDate, filters.rewardType]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredHistory.length / ROWS_PER_PAGE)
  );

  const paginatedHistory = useMemo(() => {
    const startIdx = (page - 1) * ROWS_PER_PAGE;
    const endIdx = startIdx + ROWS_PER_PAGE;
    return filteredHistory.slice(startIdx, endIdx);
  }, [filteredHistory, page]);

  useEffect(() => {
    setPage(1);
  }, [filters.startDate, filters.endDate, filters.rewardType]);

  // export CSV
  const handleExportCsv = () => {
    if (filteredHistory.length === 0) return;

    const escape = (value: any) => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes('"') || str.includes(",") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = [
      "Tanggal_Transaksi",
      "Tanggal_Rewards",
      "Kategori",
      "Tipe",
      "Judul",
      "Service",
      "Origin",
      "Destination",
      "Base_Transaksi",
      "Diskon",
      "Cashback",
      "Poin",
      "Multiplier",
      "Status",
      "Catatan",
    ];

    const rows = filteredHistory.map((item) => [
      formatDate(item.transactionDate ?? item.transaction?.date ?? null),
      formatDateTime(item.rewardDate ?? item.created_at),
      item.category ?? "",
      item.type ?? "",
      item.title ?? "",
      item.transaction?.service ?? "",
      item.transaction?.origin ?? "",
      item.transaction?.destination ?? "",
      item.baseAmount ?? "",
      item.discountAmount ?? "",
      item.cashbackAmount ?? "",
      item.pointsDelta ?? "",
      item.pointsMultiplier ?? "",
      item.status ?? "",
      item.note ?? "",
    ]);

    const csv =
      [header, ...rows]
        .map((row) => row.map(escape).join(","))
        .join("\r\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rewards_history_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const rewardTypeLabel = (value: string) => {
    switch (value) {
      case "POINT_EARN":
        return "Poin dari transaksi";
      case "CASHBACK":
        return "Cashback";
      case "BONUS":
        return "Bonus";
      case "REDEMPTION":
        return "Penukaran poin";
      default:
        return value || "-";
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-50">
          Riwayat Rewards
        </h1>
        <p className="text-sm text-gray-400">
          Lihat riwayat perolehan poin, diskon, cashback, dan penukaran
          rewards.
        </p>
      </header>

      {/* FILTER BAR */}
      <section className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-800 bg-slate-900/60 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-400">
            Tanggal awal (reward)
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, startDate: e.target.value }))
            }
            className="rounded-lg border border-gray-700 bg-slate-900 px-2 py-1 text-sm text-gray-100"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-400">
            Tanggal akhir (reward)
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, endDate: e.target.value }))
            }
            className="rounded-lg border border-gray-700 bg-slate-900 px-2 py-1 text-sm text-gray-100"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-400">
            Jenis rewards
          </label>
          <select
            value={filters.rewardType}
            onChange={(e) =>
              setFilters((f) => ({ ...f, rewardType: e.target.value }))
            }
            className="rounded-lg border border-gray-700 bg-slate-900 px-2 py-1 text-sm text-gray-100"
          >
            <option value="ALL">Semua rewards</option>
            <option value="POINT_EARN">Poin dari transaksi</option>
            <option value="CASHBACK">Cashback</option>
            <option value="BONUS">Bonus</option>
            <option value="REDEMPTION">Penukaran poin</option>
          </select>
        </div>

        {role === "INTERNAL" && (
          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-xs font-medium text-gray-400">
              Customer (perusahaan)
            </label>
            <select
              value={selectedUserId || ""}
              onChange={(e) => setSelectedUserId(e.target.value || null)}
              className="rounded-lg border border-gray-700 bg-slate-900 px-2 py-1 text-sm text-gray-100"
            >
              <option value="">Pilih customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.user_id}>
                  {c.company_name || "(tanpa nama)"} — {c.user_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setFilters({
                startDate: "",
                endDate: "",
                rewardType: "ALL",
              })
            }
            className="rounded-lg border border-gray-700 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-gray-800"
          >
            Reset filter
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-gray-900 hover:bg-amber-400"
          >
            Export CSV
          </button>
        </div>
      </section>

      {/* CONTENT */}
      {loading && (
        <div className="rounded-lg border border-gray-800 bg-slate-900 p-4 text-sm text-gray-300">
          Memuat riwayat rewards...
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && (
        <section className="space-y-3">
          {filteredHistory.length === 0 ? (
            <p className="text-sm text-gray-400">
              Belum ada aktivitas rewards yang sesuai filter.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-[#ff4600]/80 bg-slate-950/60">
                <table className="min-w-full text-left text-sm">
                  {/* HEADER GLASS EFFECT FF4600 */}
                  <thead className="bg-[#ff4600]/25 backdrop-blur-md text-xs font-semibold uppercase tracking-wide text-white border-b border-[#ff4600]/80">
                    <tr>
                      <th className="px-4 py-3">Tgl transaksi</th>
                      <th className="px-4 py-3">Tgl rewards</th>
                      <th className="px-4 py-3">Jenis</th>
                      <th className="px-4 py-3">Keterangan</th>
                      <th className="px-4 py-3">Base transaksi</th>
                      <th className="px-4 py-3">Diskon</th>
                      <th className="px-4 py-3">Cashback</th>
                      <th className="px-4 py-3">Poin (+/-)</th>
                      <th className="px-4 py-3">Poin multiplier</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {paginatedHistory.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-gray-200">
                          {item.transactionDate
                            ? formatDate(item.transactionDate)
                            : item.transaction?.date
                            ? formatDate(item.transaction.date)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-200">
                          {formatDateTime(item.rewardDate ?? item.created_at)}
                        </td>
                        <td className="px-4 py-3 text-gray-200">
                          {rewardTypeLabel(item.category || item.type || "")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-100">
                            {item.title}
                          </div>
                          {item.transaction && (
                            <div className="mt-0.5 text-xs text-gray-400">
                              {item.transaction.service || "LTL"} ·{" "}
                              {item.transaction.origin} →{" "}
                              {item.transaction.destination}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-100">
                          {item.baseAmount != null
                            ? formatCurrency(item.baseAmount)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-100">
                          {item.discountAmount != null
                            ? formatCurrency(item.discountAmount)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-100">
                          {item.cashbackAmount != null
                            ? formatCurrency(item.cashbackAmount)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-100">
                          {item.pointsDelta != null
                            ? formatPoints(item.pointsDelta)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-100">
                          {item.category === "POINT_EARN"
                            ? formatMultiplier(item.pointsMultiplier)
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {item.category === "REDEMPTION" ? (
                            <span
                              className={
                                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium " +
                                statusClass(item.category, item.status)
                              }
                            >
                              {item.status || "PENDING"}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <div>
                  Menampilkan{" "}
                  <span className="font-semibold text-gray-200">
                    {(page - 1) * ROWS_PER_PAGE + 1}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-gray-200">
                    {Math.min(
                      page * ROWS_PER_PAGE,
                      filteredHistory.length
                    )}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-gray-200">
                    {filteredHistory.length}
                  </span>{" "}
                  baris
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-gray-700 px-3 py-1 text-xs font-medium text-gray-200 disabled:opacity-40 hover:bg-gray-800 disabled:hover:bg-transparent"
                  >
                    Previous
                  </button>
                  <span>
                    Halaman{" "}
                    <span className="font-semibold text-gray-100">
                      {page}
                    </span>{" "}
                    /{" "}
                    <span className="font-semibold text-gray-100">
                      {totalPages}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="rounded-lg border border-gray-700 px-3 py-1 text-xs font-medium text-gray-200 disabled:opacity-40 hover:bg-gray-800 disabled:hover:bg-transparent"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

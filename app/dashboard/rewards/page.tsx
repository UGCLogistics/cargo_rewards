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
  created_at: string; // alias rewardDate
  transactionDate?: string | null;
  rewardDate?: string | null;
  pointsDelta?: number | null;
  baseAmount?: number | null;
  discountAmount?: number | null;
  cashbackAmount?: number | null;
  pointsMultiplier?: number | null;
  status?: string | null;
  transaction?: {
    id: number;
    date?: string | null;
    service?: string | null;
    origin?: string | null;
    destination?: string | null;
  };
  redemption?: {
    id?: string | number;
    user_id?: string;
    kind?: string;
    amount?: number | null;
    points_used?: number | null;
    status?: string | null;
    approved_at?: string | null;
    approved_by?: string | null;
    processed_at?: string | null;
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_account_holder?: string | null;
    voucher_code?: string | null;
    voucher_note?: string | null;
    voucher_proof_url?: string | null;
    reject_reason?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    [key: string]: any;
  };
}

interface RewardHistoryWithLink extends RewardHistoryItem {
  linkedAdjustment?: RewardHistoryItem | null;
}

interface CustomerOption {
  id: string;
  user_id: string;
  company_name: string | null;
}

type AppRole = "CUSTOMER" | "INTERNAL";

const ROWS_PER_PAGE = 20;

export default function RewardsHistoryPage() {
  const { user } = useAuth();

  const [role, setRole] = useState<AppRole>("CUSTOMER");
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

  // cache approver / processed_by: uuid → display "Nama - Company"
  const [approverCache, setApproverCache] = useState<
    Record<
      string,
      {
        name: string | null;
        companyname: string | null;
        role: string | null;
        display: string;
      }
    >
  >({});

  const [detailItem, setDetailItem] = useState<RewardHistoryWithLink | null>(
    null
  );

  // ==== ROLE & DEFAULT USER ====
  useEffect(() => {
    if (!user) return;

    const rawRole =
      ((user.user_metadata as any)?.role as string | undefined) || "CUSTOMER";
    const r: AppRole =
      String(rawRole).toUpperCase() === "CUSTOMER" ? "CUSTOMER" : "INTERNAL";

    setRole(r);
    setSelectedUserId((prev) => prev || user.id);
  }, [user]);

  // ==== LOAD CUSTOMER LIST UNTUK INTERNAL ====
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

  // ==== LOAD HISTORY REWARDS ====
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

  // ==== HELPERS FORMAT ====
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
    if ((category || "").toUpperCase() !== "REDEMPTION") {
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

  // ==== 1) LINK JURNAL ADJUST NEGATIF → REDEMPTION & FILTER ====
  const filteredHistory = useMemo<RewardHistoryWithLink[]>(() => {
    const items = [...rawHistory] as RewardHistoryWithLink[];
    if (items.length === 0) return [];

    const redemptions = items.filter(
      (item) => (item.category || "").toUpperCase() === "REDEMPTION"
    );

    const adjustNegative = items.filter((item) => {
      const src = (item.source || "").toUpperCase();
      const type = (item.type || "").toUpperCase();
      const pts = item.pointsDelta ?? null;
      return src === "LEDGER" && type === "ADJUST" && pts != null && pts < 0;
    });

    const linkedMap = new Map<string, RewardHistoryItem>();
    const consumedAdjustIds = new Set<string>();

    const getTime = (it: RewardHistoryItem) => {
      const v = it.rewardDate ?? it.created_at;
      const t = v ? new Date(v).getTime() : 0;
      return Number.isFinite(t) ? t : 0;
    };

    const MAX_DIFF_MS = 5 * 60 * 1000; // 5 menit

    for (const red of redemptions) {
      const ptsRed = red.pointsDelta;
      if (ptsRed == null) continue;
      const tRed = getTime(red);

      let best: RewardHistoryItem | null = null;
      let bestDiff = Infinity;

      for (const adj of adjustNegative) {
        if (consumedAdjustIds.has(adj.id)) continue;
        const ptsAdj = adj.pointsDelta ?? null;
        if (ptsAdj == null) continue;
        if (Math.abs(ptsAdj) !== Math.abs(ptsRed)) continue;

        const tAdj = getTime(adj);
        const diff = Math.abs(tAdj - tRed);
        if (diff <= MAX_DIFF_MS && diff < bestDiff) {
          bestDiff = diff;
          best = adj;
        }
      }

      if (best) {
        linkedMap.set(red.id, best);
        consumedAdjustIds.add(best.id);
      }
    }

    // buang jurnal ADJUST negatif yang sudah ter-link
    let result: RewardHistoryWithLink[] = items
      .filter((item) => !consumedAdjustIds.has(item.id))
      .map((item) => {
        if ((item.category || "").toUpperCase() === "REDEMPTION") {
          const linked = linkedMap.get(item.id) ?? null;
          return { ...item, linkedAdjustment: linked } as RewardHistoryWithLink;
        }
        return { ...item } as RewardHistoryWithLink;
      });

    // jaga-jaga: sembunyikan semua ledger ADJUST negatif dari tabel
    result = result.filter((item) => {
      const src = (item.source || "").toUpperCase();
      const type = (item.type || "").toUpperCase();
      const pts = item.pointsDelta ?? 0;
      if (src === "LEDGER" && type === "ADJUST" && pts < 0) {
        return false;
      }
      return true;
    });

    // filter tanggal & jenis
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

  const paginatedHistory = useMemo<RewardHistoryWithLink[]>(() => {
    const startIdx = (page - 1) * ROWS_PER_PAGE;
    const endIdx = startIdx + ROWS_PER_PAGE;
    return filteredHistory.slice(startIdx, endIdx);
  }, [filteredHistory, page]);

  useEffect(() => {
    setPage(1);
  }, [filters.startDate, filters.endDate, filters.rewardType]);

  // ==== EXPORT CSV ====
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

  const currentCompanyName =
    role === "INTERNAL"
      ? customers.find((c) => c.user_id === selectedUserId)?.company_name ?? ""
      : undefined;

  // ==== APPROVER DISPLAY (Nama - Company) ====
  const activeApproverId =
    detailItem?.redemption?.approved_by || detailItem?.redemption?.user_id;

  useEffect(() => {
    const targetId = activeApproverId;
    if (!targetId) return;
    if (approverCache[targetId]) return;

    const loadApprover = async () => {
      try {
        const res = await fetch(
          `/api/admin/user-brief?userId=${encodeURIComponent(targetId)}`
        );
        const json = await res.json();
        if (!res.ok || !json.user) return;

        const { name, companyname, role } = json.user as {
          name: string | null;
          companyname: string | null;
          role: string | null;
        };

        const main = name || role || targetId;
        const company = companyname || "";
        const display = company ? `${main} - ${company}` : main;

        setApproverCache((prev) => ({
          ...prev,
          [targetId]: {
            name: name ?? null,
            companyname: companyname ?? null,
            role: role ?? null,
            display,
          },
        }));
      } catch (err) {
        console.error("Failed to load approver info:", err);
      }
    };

    loadApprover();
  }, [activeApproverId, approverCache]);

  const approverDisplay =
    activeApproverId && approverCache[activeApproverId]
      ? approverCache[activeApproverId].display
      : activeApproverId || null;

  // ==== DATA PAYMENT UNTUK POPUP ====
  const detailLinkedAdjustment =
    detailItem && detailItem.linkedAdjustment ? detailItem.linkedAdjustment : null;

  // nominal pembayaran
  const paymentAmount =
    detailItem?.redemption?.amount ??
    detailItem?.redemption?.payout_amount ??
    detailItem?.cashbackAmount ??
    null;

  // tanggal pembayaran:
  // - PAID  → processed_at (fallback approved_at)
  // - APPROVED (belum diproses) → approved_at
  let paymentProcessedAt: string | null = null;
  if (detailItem?.redemption) {
    const st = (detailItem.redemption.status || "").toUpperCase();
    if (st === "PAID") {
      paymentProcessedAt =
        detailItem.redemption.processed_at ||
        detailItem.redemption.approved_at ||
        null;
    } else if (st === "APPROVED") {
      paymentProcessedAt = detailItem.redemption.approved_at || null;
    }
  }
  // kalau tetap kosong, fallback ke waktu jurnal ADJUST (kalau ada)
  if (!paymentProcessedAt && detailLinkedAdjustment) {
    paymentProcessedAt =
      detailLinkedAdjustment.rewardDate ||
      detailLinkedAdjustment.created_at ||
      null;
  }

  // catatan admin
  const paymentNotesAdmin =
    detailItem?.redemption?.voucher_note ||
    detailItem?.redemption?.payment_notes ||
    detailItem?.redemption?.payment_note ||
    detailLinkedAdjustment?.note ||
    null;

  const paymentRejectReason = detailItem?.redemption?.reject_reason ?? null;

  // bukti pembayaran
  const paymentProofUrl =
    detailItem?.redemption?.voucher_proof_url ||
    detailItem?.redemption?.payment_proof_url ||
    detailItem?.redemption?.payment_proof ||
    null;

  const statusUpper = (detailItem?.status || "").toUpperCase();

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
      <section className="flex flex-wrap items-end gap-4 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.85)]">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-300">
            Tanggal awal (reward)
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, startDate: e.target.value }))
            }
            className="rounded-lg border border-white/20 bg-slate-950/80 px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-300">
            Tanggal akhir (reward)
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, endDate: e.target.value }))
            }
            className="rounded-lg border border-white/20 bg-slate-950/80 px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-300">
            Jenis rewards
          </label>
          <select
            value={filters.rewardType}
            onChange={(e) =>
              setFilters((f) => ({ ...f, rewardType: e.target.value }))
            }
            className="rounded-lg border border-white/20 bg-slate-950/80 px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
          >
            <option value="ALL">Semua rewards</option>
            <option value="POINT_EARN">Poin dari transaksi</option>
            <option value="CASHBACK">Cashback</option>
            <option value="BONUS">Bonus</option>
            <option value="REDEMPTION">Penukaran poin</option>
          </select>
        </div>

        {/* Filter perusahaan untuk INTERNAL */}
        {role === "INTERNAL" && (
          <div className="flex flex-col gap-1 min-w-[220px]">
            <label className="text-xs font-medium text-gray-300">
              Perusahaan
            </label>
            <select
              value={selectedUserId || ""}
              onChange={(e) =>
                setSelectedUserId(e.target.value ? e.target.value : null)
              }
              className="rounded-lg border border-white/20 bg-slate-950/80 px-2 py-1 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
            >
              <option value="">Pilih perusahaan</option>
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
            className="rounded-lg border border-white/20 px-3 py-1 text-xs font-medium text-gray-200 hover:bg-white/10"
          >
            Reset filter
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="rounded-lg bg-[#ff4600] px-3 py-1 text-xs font-semibold text-white shadow-[0_10px_35px_rgba(255,70,0,0.65)] hover:bg-[#ff5d1f]"
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
                          {item.category === "REDEMPTION" &&
                            item.redemption?.voucher_code && (
                              <div className="mt-0.5 text-[11px] text-amber-300">
                                Voucher: {item.redemption.voucher_code}
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
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  "inline-flex rounded-full px-2 py-0.5 text-xs font-medium " +
                                  statusClass(item.category, item.status)
                                }
                              >
                                {(item.status || "PENDING").toUpperCase()}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setDetailItem(item as RewardHistoryWithLink)
                                }
                                className="rounded-lg border border-[#ff4600]/60 bg-[#ff4600]/10 px-2 py-0.5 text-[10px] font-medium text-amber-50 hover:bg-[#ff4600]/30"
                              >
                                Detail
                              </button>
                            </div>
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
                    {Math.min(page * ROWS_PER_PAGE, filteredHistory.length)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-gray-200">
                    {filteredHistory.length}
                  </span>{" "}
                  baris
                  {role === "INTERNAL" && currentCompanyName && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="text-gray-300">
                        Perusahaan:{" "}
                        <span className="font-semibold">
                          {currentCompanyName}
                        </span>
                      </span>
                    </>
                  )}
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
                    <span className="font-semibold text-gray-100">{page}</span>{" "}
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

      {/* POPUP DETAIL PENUKARAN POIN */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative mx-4 w-full max-w-lg rounded-2xl border border-[#ff4600]/70 bg-slate-950/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.95)]">
            <button
              type="button"
              onClick={() => setDetailItem(null)}
              className="absolute right-3 top-3 text-sm text-slate-400 hover:text-slate-100"
            >
              ✕
            </button>

            <h2 className="mb-3 text-lg font-semibold text-white">
              Detail Penukaran Poin
            </h2>

            <div className="space-y-3 text-sm text-gray-100">
              {/* INFO UTAMA */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <div className="text-xs text-gray-400">
                    Tanggal penukaran
                  </div>
                  <div className="font-medium">
                    {formatDateTime(
                      detailItem.rewardDate ?? detailItem.created_at
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Status</div>
                  <div
                    className={
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium " +
                      statusClass(detailItem.category, detailItem.status)
                    }
                  >
                    {statusUpper || "PENDING"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">
                    Tanggal disetujui
                  </div>
                  <div className="font-medium">
                    {detailItem.redemption?.approved_at
                      ? formatDateTime(detailItem.redemption.approved_at)
                      : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">
                    Disetujui / diproses oleh
                  </div>
                  <div className="font-medium">
                    {approverDisplay || "-"}
                  </div>
                </div>
              </div>

              {/* INFO POIN */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/10 pt-2">
                <div>
                  <div className="text-xs text-gray-400">
                    Poin yang ditukar
                  </div>
                  <div className="font-semibold text-amber-300">
                    {detailItem.pointsDelta != null
                      ? Math.abs(
                          detailItem.pointsDelta
                        ).toLocaleString("id-ID")
                      : "-"}{" "}
                    poin
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">
                    Nilai rewards (cashback/diskon)
                  </div>
                  <div className="font-semibold">
                    {formatCurrency(paymentAmount)}
                  </div>
                </div>
              </div>

              {/* INFO PEMBAYARAN */}
              <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/80 p-3">
                <div className="mb-2 text-xs font-semibold text-gray-200">
                  Info pembayaran rewards
                </div>
                <div className="space-y-1 text-xs text-gray-200">
                  {detailItem.redemption?.voucher_code && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Kode voucher</span>
                      <span className="font-semibold">
                        {detailItem.redemption.voucher_code}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-gray-400">Nominal dibayarkan</span>
                    <span className="font-semibold">
                      {paymentAmount != null
                        ? formatCurrency(paymentAmount)
                        : "-"}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Tanggal pembayaran</span>
                    <span>
                      {paymentProcessedAt
                        ? formatDateTime(paymentProcessedAt)
                        : statusUpper === "APPROVED"
                        ? "Waiting to be processed"
                        : "-"}
                    </span>
                  </div>

                  {paymentNotesAdmin && (
                    <div className="pt-1">
                      <div className="text-gray-400">
                        Catatan admin / pembayaran
                      </div>
                      <div>{paymentNotesAdmin}</div>
                    </div>
                  )}

                  {paymentRejectReason && (
                    <div className="pt-1">
                      <div className="text-gray-400">Alasan reject</div>
                      <div className="text-red-300">
                        {paymentRejectReason}
                      </div>
                    </div>
                  )}

                  {paymentProofUrl && (
                    <div className="pt-2">
                      <a
                        href={paymentProofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-lg border border-[#ff4600]/70 bg-[#ff4600]/15 px-3 py-1 text-[11px] font-medium text-amber-50 hover:bg-[#ff4600]/30"
                      >
                        Lihat bukti pembayaran
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* JURNAL ADJUST YANG DISATUKAN */}
              <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/80 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-200">
                    Jurnal sistem pengurangan poin
                  </span>
                  <span className="text-[10px] text-gray-400">
                    (sebelumnya tampil sebagai OTHER / ADJUST)
                  </span>
                </div>

                {detailLinkedAdjustment ? (
                  <div className="space-y-1 text-xs text-gray-200">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tanggal jurnal</span>
                      <span>
                        {formatDateTime(
                          detailLinkedAdjustment.rewardDate ??
                            detailLinkedAdjustment.created_at
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Poin berubah</span>
                      <span className="font-semibold text-amber-200">
                        {formatPoints(detailLinkedAdjustment.pointsDelta)}
                      </span>
                    </div>
                    {detailLinkedAdjustment.note && (
                      <div className="pt-1">
                        <div className="text-gray-400">Catatan</div>
                        <div>{detailLinkedAdjustment.note}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    Tidak ada jurnal ADJUST spesifik yang terdeteksi untuk
                    penukaran ini. Kemungkinan sistem mencatatnya secara
                    agregat.
                  </p>
                )}
              </div>

              {/* CATATAN FRONT OFFICE (kalau ada) */}
              {detailItem.note && (
                <div className="mt-2 rounded-xl border border-white/10 bg-slate-900/80 p-3 text-xs text-gray-200">
                  <div className="mb-1 text-[11px] font-semibold text-gray-300">
                    Catatan penukaran (front office)
                  </div>
                  <p>{detailItem.note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

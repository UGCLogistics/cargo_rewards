"use client";

import { useEffect, useState } from "react";
import { useAuth } from "context/AuthContext";

type Role = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";

interface Transaction {
  id: string;
  user_id: string;
  date: string;
  origin: string;
  destination: string;
  publish_rate: number;
  discount_amount: number | null;
  company_name?: string | null;
}

const PAGE_SIZE = 50;

export default function TransactionsPage() {
  const { user } = useAuth();

  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = (rawRole as string).toUpperCase() as Role;
  const isInternal =
    role === "ADMIN" || role === "MANAGER" || role === "STAFF";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0); // halaman mulai dari 0

  // filter perusahaan (dropdown)
  const [selectedCompany, setSelectedCompany] = useState<string>("ALL");

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();

      // role-based scope
      if (isInternal) {
        params.set("scope", "all");
      } else {
        params.set("scope", "self");
        params.set("userId", user.id);
      }

      // filter tanggal
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const qs = params.toString();
      const res = await fetch(`/api/transactions${qs ? `?${qs}` : ""}`, {
        method: "GET",
        cache: "no-store",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat transaksi");
      }

      setTransactions((json.data as Transaction[]) || []);
      setPage(0); // reset ke halaman pertama setiap kali fetch
      setSelectedCompany(isInternal ? "ALL" : ""); // internal -> ALL, customer -> nanti di-set dari data
    } catch (err: any) {
      setError(err.message || "Gagal memuat transaksi");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Untuk CUSTOMER: otomatis set perusahaan ke perusahaan miliknya saja
  useEffect(() => {
    if (!isInternal && transactions.length > 0) {
      const firstName = transactions[0].company_name || "Tanpa Nama";
      setSelectedCompany(firstName);
    }
  }, [isInternal, transactions]);

  // --- daftar opsi perusahaan (berdasarkan data yang sudah di-load) ---
  const companyOptions = (() => {
    const set = new Set<string>();
    transactions.forEach((trx) => {
      const label = trx.company_name || "Tanpa Nama";
      set.add(label);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  })();

  // --- apply filter perusahaan di client side ---
  const filteredTransactions = transactions.filter((trx) => {
    // Internal: kalau ALL -> tidak filter
    if (isInternal && selectedCompany === "ALL") return true;

    // Kalau selectedCompany masih kosong (customer sebelum efek jalan) -> tampilkan semua
    if (!selectedCompany) return true;

    const name = trx.company_name || "Tanpa Nama";
    return name === selectedCompany;
  });

  const totalPages =
    filteredTransactions.length === 0
      ? 1
      : Math.ceil(filteredTransactions.length / PAGE_SIZE);

  const currentPage = Math.min(page, totalPages - 1);
  const startIndex = currentPage * PAGE_SIZE;
  const paginated = filteredTransactions.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const from = filteredTransactions.length === 0 ? 0 : startIndex + 1;
  const to = startIndex + paginated.length;

  const handlePrevPage = () => {
    setPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  // --- Export ke "Excel" (CSV) — mengikuti filter perusahaan & tanggal ---
  const exportToCsv = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) return;

    const escapeCsv = (value: any) => {
      if (value === null || value === undefined) return '""';
      const str = String(value).replace(/"/g, '""');
      return `"${str}"`;
    };

    const header = [
      "No",
      "Company",
      "Date",
      "Origin",
      "Destination",
      "Ongkir",
      "PublishRate",
      "Discount",
      "UserId",
    ];

    const rows = filteredTransactions.map((trx, idx) => {
      const publish = Number(trx.publish_rate) || 0;
      const disc = Number(trx.discount_amount) || 0;
      const ongkir = publish - disc;

      return [
        idx + 1,
        trx.company_name || "",
        trx.date || "",
        trx.origin || "",
        trx.destination || "",
        ongkir,
        publish,
        disc,
        trx.user_id || "",
      ];
    });

    const csvContent =
      [header, ...rows]
        .map((row) => row.map(escapeCsv).join(","))
        .join("\r\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h1 className="text-xl font-semibold">Riwayat Transaksi</h1>

        <button
          onClick={exportToCsv}
          className="rounded-xl bg-white/10 px-3 py-1 text-xs hover:bg-white/20 border border-white/20 shadow-[0_10px_35px_rgba(15,23,42,0.7)]"
          disabled={filteredTransactions.length === 0}
        >
          Export Excel (.csv)
        </button>
      </div>

      {/* Filter tanggal + perusahaan (dark glassmorphism) */}
      <div className="glass flex flex-wrap items-end gap-3 text-xs rounded-2xl px-3 py-3 bg-slate-900/60 border border-white/10 shadow-[0_18px_45px_rgba(15,23,42,0.85)]">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-200">Start</span>
          <input
            type="date"
            className="bg-slate-900/80 border border-white/20 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-slate-200">End</span>
          <input
            type="date"
            className="bg-slate-900/80 border border-white/20 rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Dropdown perusahaan */}
        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-[11px] text-slate-200">Perusahaan</span>
          <select
            value={isInternal ? selectedCompany : selectedCompany || (companyOptions[0] ?? "")}
            onChange={(e) => setSelectedCompany(e.target.value)}
            disabled={!isInternal || companyOptions.length <= 1}
            className="rounded-lg bg-slate-900/80 border border-white/25 text-slate-100 px-2 py-1.5 text-xs shadow-[0_0_0_1px_rgba(148,163,184,0.35)] focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
          >
            {isInternal && (
              <option value="ALL" className="bg-slate-900 text-slate-100">
                Semua Perusahaan
              </option>
            )}
            {companyOptions.map((name) => (
              <option
                key={name}
                value={name}
                className="bg-slate-900 text-slate-100"
              >
                {name}
              </option>
            ))}
          </select>
          {!isInternal && (
            <p className="text-[10px] text-slate-400">
              (Customer hanya dapat melihat perusahaannya sendiri)
            </p>
          )}
        </div>

        <div className="ml-auto">
          <button
            onClick={fetchData}
            className="inline-flex items-center justify-center rounded-xl bg-[#ff4600] px-4 py-1.5 text-xs font-semibold text-white shadow-[0_10px_35px_rgba(255,70,0,0.65)] hover:bg-[#ff5d1f] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Terapkan Filter
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p>Memuat…</p>
      ) : paginated.length === 0 ? (
        <p className="text-sm text-slate-300">
          Tidak ada transaksi pada periode ini.
        </p>
      ) : (
        <>
          <div className="glass rounded-xl overflow-x-auto border border-white/10 bg-slate-900/60">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/5/40">
                  <th className="px-3 py-2 text-left">No</th>
                  <th className="px-3 py-2 text-left">Perusahaan</th>
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">Origin</th>
                  <th className="px-3 py-2 text-left">Destination</th>
                  <th className="px-3 py-2 text-right">Ongkir</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((trx, idx) => {
                  const publish = Number(trx.publish_rate) || 0;
                  const disc = Number(trx.discount_amount) || 0;
                  const ongkir = publish - disc;
                  const rowNo = startIndex + idx + 1;

                  return (
                    <tr
                      key={trx.id}
                      className="border-t border-white/10 hover:bg-white/5/40"
                    >
                      <td className="px-3 py-2">{rowNo}</td>
                      <td className="px-3 py-2">
                        {trx.company_name || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {trx.date
                          ? new Date(trx.date).toLocaleDateString("id-ID")
                          : "-"}
                      </td>
                      <td className="px-3 py-2">{trx.origin}</td>
                      <td className="px-3 py-2">{trx.destination}</td>
                      <td className="px-3 py-2 text-right">
                        Rp{" "}
                        {ongkir.toLocaleString("id-ID", {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-xs text-slate-300">
            <div>
              Menampilkan{" "}
              <span className="font-semibold">
                {from}-{to}
              </span>{" "}
              dari{" "}
              <span className="font-semibold">
                {filteredTransactions.length}
              </span>{" "}
              transaksi
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                className="px-2 py-1 rounded border border-white/20 disabled:opacity-40"
              >
                Prev
              </button>
              <span>
                Hal {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages - 1}
                className="px-2 py-1 rounded border border-white/20 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

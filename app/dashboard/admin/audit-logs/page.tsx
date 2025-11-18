"use client";

import { useEffect, useState } from "react";
import { useAuth } from "context/AuthContext";

type Role = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";

interface AuditLog {
  id: number;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | number | null;
  payload: any;
  created_at: string;
}

export default function AdminAuditLogsPage() {
  const { user } = useAuth();
  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = String(rawRole).toUpperCase() as Role;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [total, setTotal] = useState<number | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  const fetchLogs = async (opts?: { page?: number }) => {
    if (!user) return;

    const nextPage = opts?.page ?? page;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", String(pageSize));
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: {
          "x-role": role,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Gagal memuat audit logs");
      }

      setLogs((json?.data as AuditLog[]) || []);
      setTotal(json?.meta?.total ?? null);
      setPage(nextPage);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan");
      setLogs([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  };

  // load awal
  useEffect(() => {
    if (!user) return;
    fetchLogs({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const handleApplyFilter = () => {
    fetchLogs({ page: 1 });
  };

  const handleResetFilter = () => {
    setStartDate("");
    setEndDate("");
    setSearch("");
    fetchLogs({ page: 1 });
  };

  const totalPages =
    total && total > 0 ? Math.ceil(total / pageSize) : logs.length > 0 ? page : 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-white">
            Audit Logs
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Riwayat aktivitas sistem (misalnya approval redeem, perubahan user,
            dan lainnya) dari tabel{" "}
            <span className="font-mono">audit_logs</span>.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
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
        <label className="flex items-center gap-1 flex-1 min-w-[160px]">
          <span>Cari:</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="User ID / action / entity"
            className="flex-1 rounded-md bg-black/40 border border-white/10 px-2 py-1 text-xs text-white placeholder:text-slate-500"
          />
        </label>
        <button
          onClick={handleApplyFilter}
          className="rounded-md bg-[#ff4600] hover:bg-[#ff5f24] text-white px-3 py-1 text-xs font-semibold"
        >
          Terapkan Filter
        </button>
        <button
          onClick={handleResetFilter}
          className="rounded-md border border-white/20 px-3 py-1 text-xs text-slate-200 hover:bg-white/5"
        >
          Reset
        </button>
      </div>

      {/* Info jumlah */}
      <p className="text-xs text-slate-400">
        Menampilkan halaman{" "}
        <span className="font-semibold text-slate-200">{page}</span> dari{" "}
        <span className="font-semibold text-slate-200">{totalPages}</span>{" "}
        ({total ?? logs.length} log).
      </p>

      {error && (
        <div className="glass border border-red-500/40 text-red-200 text-xs px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Tabel */}
      <section className="glass rounded-2xl px-4 py-4">
        {loading ? (
          <p className="text-sm text-slate-400">Memuat audit logs…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-slate-300">Tidak ada data audit.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-slate-400">
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Entity</th>
                  <th className="px-3 py-2 text-left">Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const payloadText = log.payload
                    ? JSON.stringify(log.payload)
                    : "-";
                  const shortPayload =
                    payloadText.length > 100
                      ? payloadText.slice(0, 100) + "…"
                      : payloadText;

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="px-3 py-2">
                        {new Date(log.created_at).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[11px]">
                          {log.user_id?.substring(0, 8) || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {log.entity_type || "-"}{" "}
                        {log.entity_id != null && (
                          <span className="text-[10px] text-slate-400 ml-1">
                            #{String(log.entity_id)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-300">
                        {shortPayload}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
          <button
            onClick={() => fetchLogs({ page: page - 1 })}
            disabled={page <= 1 || loading}
            className="rounded-md border border-white/20 px-3 py-1 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span>
            Halaman{" "}
            <span className="font-semibold text-slate-100">{page}</span> /{" "}
            <span className="font-semibold text-slate-100">
              {totalPages}
            </span>
          </span>
          <button
            onClick={() => fetchLogs({ page: page + 1 })}
            disabled={page >= totalPages || loading}
            className="rounded-md border border-white/20 px-3 py-1 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

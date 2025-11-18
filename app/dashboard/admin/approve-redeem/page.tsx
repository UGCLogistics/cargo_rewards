"use client";

import { useState, useEffect } from "react";
import { useAuth } from "context/AuthContext";

interface Redemption {
  id: number;
  user_id: string;
  kind: string;
  points_used: number;
  amount: number;
  status: string;
  created_at: string;
}

function formatIdr(value: number) {
  return (
    "Rp " +
    (value || 0).toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    })
  );
}

/**
 * AdminApproveRedeemPage:
 * - hanya diakses via menu Admin (role sudah di-handle di layout)
 * - memanggil API /api/admin/redeem
 */
export default function AdminApproveRedeemPage() {
  const { user } = useAuth();
  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = String(rawRole).toUpperCase();

  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const fetchRedemptions = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/redeem", {
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
          `Gagal memuat data (status ${res.status})`;
        throw new Error(msg);
      }

      setRedemptions((json?.data as Redemption[]) || []);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
      setRedemptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRedemptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const handleAction = async (id: number, action: "approve" | "reject") => {
    if (!user) return;

    if (
      !confirm(
        `Yakin ingin ${action === "approve" ? "MENYETUJUI" : "MENOLAK"} redeem ini?`
      )
    ) {
      return;
    }

    setActionId(id);

    try {
      const res = await fetch("/api/admin/redeem", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-role": role, // hanya tambahan, route tetap pakai role dari body
        },
        body: JSON.stringify({
          id,
          action,
          role,
          user_id: user.id,
        }),
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
          `Gagal memperbarui status (status ${res.status})`;
        throw new Error(msg);
      }

      // reload list setelah approve/reject
      await fetchRedemptions();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-white">
            Approval Redeem
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Admin dapat menyetujui atau menolak permintaan redeem poin yang
            berstatus <span className="font-semibold">PENDING</span>.
          </p>
        </div>
        <button
          onClick={fetchRedemptions}
          disabled={loading}
          className="rounded-lg bg-[#ff4600] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_6px_20px_rgba(255,70,0,0.35)] hover:bg-[#ff5f24] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Memuat…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="glass border border-red-500/40 text-red-200 text-xs px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <section className="glass rounded-2xl px-4 py-4">
        {loading ? (
          <p className="text-sm text-slate-400">Memuat data redeem…</p>
        ) : redemptions.length === 0 ? (
          <p className="text-sm text-slate-300">
            Tidak ada permintaan redeem.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-slate-400">
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Jenis</th>
                  <th className="px-3 py-2 text-right">Poin</th>
                  <th className="px-3 py-2 text-right">Jumlah (Rp)</th>
                  <th className="px-3 py-2 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="px-3 py-2">
                      {new Date(r.created_at).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-[11px]">
                        {r.user_id.substring(0, 8)}
                      </span>
                    </td>
                    <td className="px-3 py-2 capitalize">{r.kind}</td>
                    <td className="px-3 py-2 text-right">
                      {r.points_used.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatIdr(r.amount)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleAction(r.id, "approve")}
                          disabled={actionId === r.id}
                          className="rounded-lg bg-emerald-500/90 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {actionId === r.id && "approve"}
                          {actionId === r.id ? "Memproses…" : "Approve"}
                        </button>
                        <button
                          onClick={() => handleAction(r.id, "reject")}
                          disabled={actionId === r.id}
                          className="rounded-lg bg-red-500/90 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {actionId === r.id ? "Memproses…" : "Reject"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

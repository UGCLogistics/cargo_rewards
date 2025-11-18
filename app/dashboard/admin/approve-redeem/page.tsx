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

/**
 * AdminApproveRedeemPage:
 * - hanya diakses via menu Admin (role sudah di-handle di layout)
 * - memanggil API admin/redeem dengan mengirim role & user_id
 */
export default function AdminApproveRedeemPage() {
  const { user } = useAuth();
  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = String(rawRole).toUpperCase();

  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      setRedemptions((json?.data as any[]) || []);
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
    try {
      const res = await fetch("/api/admin/redeem", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
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

      fetchRedemptions();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Approval Redeem</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {loading ? (
        <p>Memuat…</p>
      ) : error ? null : redemptions.length === 0 ? (
        <p>Tidak ada permintaan redeem.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th
                style={{
                  borderBottom: "1px solid var(--border)",
                  padding: "0.5rem",
                }}
              >
                Tanggal
              </th>
              <th
                style={{
                  borderBottom: "1px solid var(--border)",
                  padding: "0.5rem",
                }}
              >
                User ID
              </th>
              <th
                style={{
                  borderBottom: "1px solid var(--border)",
                  padding: "0.5rem",
                }}
              >
                Jenis
              </th>
              <th
                style={{
                  borderBottom: "1px solid var(--border)",
                  padding: "0.5rem",
                  textAlign: "right",
                }}
              >
                Poin
              </th>
              <th
                style={{
                  borderBottom: "1px solid var(--border)",
                  padding: "0.5rem",
                  textAlign: "right",
                }}
              >
                Jumlah (Rp)
              </th>
              <th
                style={{
                  borderBottom: "1px solid var(--border)",
                  padding: "0.5rem",
                }}
              >
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {redemptions.map((r) => (
              <tr key={r.id}>
                <td
                  style={{
                    borderBottom: "1px solid var(--border)",
                    padding: "0.5rem",
                  }}
                >
                  {new Date(r.created_at).toLocaleDateString("id-ID")}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid var(--border)",
                    padding: "0.5rem",
                  }}
                >
                  {r.user_id.substring(0, 8)}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid var(--border)",
                    padding: "0.5rem",
                  }}
                >
                  {r.kind}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid var(--border)",
                    padding: "0.5rem",
                    textAlign: "right",
                  }}
                >
                  {r.points_used.toLocaleString("id-ID")}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid var(--border)",
                    padding: "0.5rem",
                    textAlign: "right",
                  }}
                >
                  {r.amount.toLocaleString("id-ID", {
                    style: "currency",
                    currency: "IDR",
                  })}
                </td>
                <td
                  style={{
                    borderBottom: "1px solid var(--border)",
                    padding: "0.5rem",
                  }}
                >
                  <button
                    onClick={() => handleAction(r.id, "approve")}
                    style={{
                      marginRight: "0.5rem",
                      backgroundColor: "var(--accent)",
                      color: "#fff",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(r.id, "reject")}
                    style={{
                      backgroundColor: "#e53e3e",
                      color: "#fff",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

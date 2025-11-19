"use client";

import { useEffect, useState } from "react";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

interface Reward {
  id: number;
  name: string;
  cost: number;
  description: string | null;
}

export default function RedeemPage() {
  const { user } = useAuth();

  const metadata = user?.user_metadata || {};
  const rawRole = (metadata.role as string | undefined) || "CUSTOMER";
  const role = rawRole.toUpperCase();
  const isCustomer = role === "CUSTOMER";

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRewards = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
          .from("rewards")
          .select("*")
          .order("cost", { ascending: true });

        if (error) throw error;
        setRewards((data as Reward[]) || []);
      } catch (err: any) {
        console.error("Gagal memuat rewards:", err);
        setError("Gagal memuat daftar reward. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    };

    fetchRewards();
  }, []);

  const handleRedeem = async (reward: Reward) => {
    if (!isCustomer || !user) return; // internal tidak boleh redeem

    try {
      setError(null);

      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: reward.name,
          points_used: reward.cost,
          amount: reward.cost * 250, // contoh: 1 poin = Rp250, sesuaikan
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal mengajukan redeem");
      }

      alert("Pengajuan redeem berhasil dikirim. Menunggu approval.");
    } catch (err: any) {
      setError(err.message ?? "Terjadi kesalahan saat redeem");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Redeem Poin</h1>

      {!isCustomer && (
        <p className="text-xs text-slate-400">
          Anda login sebagai <span className="font-semibold">{role}</span>.
          Halaman ini menampilkan <b>katalog reward</b> untuk customer. Proses
          persetujuan / eksekusi redeem dilakukan melalui menu internal
          (Approval Redeem).
        </p>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p>Memuat…</p>
      ) : rewards.length === 0 ? (
        <p>Tidak ada item reward.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => (
            <div key={r.id} className="glass rounded-xl p-4 flex flex-col">
              <h3 className="text-base font-semibold mb-1">{r.name}</h3>
              <p className="text-xs text-slate-400 mb-2">
                {r.description || "-"}
              </p>
              <p className="text-sm font-semibold mb-3">
                Poin: {r.cost.toLocaleString("id-ID")}
              </p>

              {isCustomer ? (
                <button
                  onClick={() => handleRedeem(r)}
                  className="mt-auto rounded-lg bg-[var(--accent)] text-white py-2 text-sm hover:bg-[#ff5f24]"
                >
                  Redeem
                </button>
              ) : (
                <p className="mt-auto text-[11px] text-slate-400">
                  Hanya customer yang dapat mengajukan redeem dari halaman ini.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

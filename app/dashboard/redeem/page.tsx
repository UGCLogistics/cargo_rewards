"use client";

import { useEffect, useState } from "react";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

interface Reward {
  id: number;
  name: string;
  cost: number;
  description: string;
}

export default function RedeemPage() {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRewards() {
      try {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
          .from("rewards")
          .select("*")
          .order("cost", { ascending: true });
        if (error) throw error;
        setRewards((data as any[]) || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRewards();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Redeem Poin</h1>
      {error && <p className="text-red-500">{error}</p>}
      {loading ? (
        <p>Memuat…</p>
      ) : rewards.length === 0 ? (
        <p>Tidak ada item reward.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => (
            <div
              key={r.id}
              className="glass rounded-xl p-4 flex flex-col"
            >
              <h3 className="text-base font-semibold mb-1">{r.name}</h3>
              <p className="text-xs text-slate-400 mb-2">
                {r.description}
              </p>
              <p className="text-sm font-semibold mb-3">
                Poin: {r.cost.toLocaleString("id-ID")}
              </p>
              <button
                className="mt-auto rounded-lg bg-[var(--accent)] text-white py-2 text-sm hover:bg-[#ff5f24]"
                // Tambahkan handler redeem di sini
              >
                Redeem
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

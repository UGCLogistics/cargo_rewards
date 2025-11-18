// app/dashboard/admin/rewards-engine/page.tsx
"use client";

import { useState } from "react";
import { useAuth } from "context/AuthContext";

type EngineResult = {
  message?: string;
  [key: string]: any;
};

export default function AdminRewardsEnginePage() {
  const { user } = useAuth();
  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = String(rawRole).toUpperCase();

  const [initialResult, setInitialResult] = useState<EngineResult | null>(null);
  const [quarterlyResult, setQuarterlyResult] = useState<EngineResult | null>(
    null
  );
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingQuarterly, setLoadingQuarterly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callEngine = async (kind: "initial" | "quarterly") => {
    if (!user) {
      setError("Anda harus login sebagai ADMIN terlebih dahulu.");
      return;
    }

    if (role !== "ADMIN") {
      setError("Hanya ADMIN yang dapat menjalankan rewards engine.");
      return;
    }

    setError(null);

    const url =
      kind === "initial"
        ? "/api/admin/rewards/run-initial"
        : "/api/admin/rewards/run-quarterly";

    if (kind === "initial") {
      setLoadingInitial(true);
    } else {
      setLoadingQuarterly(true);
    }

    try {
      const res = await fetch(url, {
        method: "POST",
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
          `Gagal menjalankan engine (${res.status})`;
        throw new Error(msg);
      }

      if (kind === "initial") {
        setInitialResult(json || {});
      } else {
        setQuarterlyResult(json || {});
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      if (kind === "initial") {
        setLoadingInitial(false);
      } else {
        setLoadingQuarterly(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold text-white">
          Rewards Engine (Admin)
        </h1>
        <p className="mt-1 text-sm text-slate-400 max-w-2xl">
          Jalankan engine untuk menghitung Hello Discount (via import),
          cashback 3 bulan pertama, welcome bonus bulan ke-4, dan poin
          transaksi berdasarkan tier membership per kuartal. Engine ini
          dirancang idempoten sehingga aman dijalankan berulang.
        </p>
      </header>

      {error && (
        <div className="glass border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {/* Initial Engine */}
        <div className="glass rounded-2xl px-4 py-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">
            1. Initial Engine (3 Bulan Pertama)
          </h2>
          <p className="text-xs text-slate-400">
            Menghitung dan mencatat:
            <br />
            • Total transaksi 3 bulan pertama per customer
            <br />
            • Active Cashback 3 bulan pertama (sekali, jika memenuhi syarat)
            <br />
            • Welcome Bonus poin di awal bulan ke-4 (sekali per customer)
          </p>
          <button
            onClick={() => callEngine("initial")}
            disabled={loadingInitial}
            className="mt-1 rounded-lg bg-[#ff4600] text-white px-4 py-1.5 text-xs font-semibold hover:bg-[#ff5f24] disabled:opacity-60"
          >
            {loadingInitial ? "Memproses…" : "Run Initial Engine"}
          </button>

          {initialResult && (
            <div className="mt-3 text-[11px] text-slate-300 bg-black/30 border border-white/10 rounded-lg p-2 overflow-x-auto">
              <div className="font-semibold mb-1">Hasil Initial Engine:</div>
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(initialResult, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Quarterly Engine */}
        <div className="glass rounded-2xl px-4 py-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">
            2. Quarterly Engine (Update Tier + Poin Transaksi)
          </h2>
          <p className="text-xs text-slate-400">
            Fungsi:
            <br />
            • Membuat / melengkapi periode membership per kuartal
            (kalender)
            <br />
            • Tier kuartal ditentukan dari total transaksi kuartal
            sebelumnya
            <br />
            • Memberi poin untuk transaksi yang berada di kuartal dengan
            tier aktif, tanpa double count
          </p>
          <button
            onClick={() => callEngine("quarterly")}
            disabled={loadingQuarterly}
            className="mt-1 rounded-lg bg-[#22c55e] text-black px-4 py-1.5 text-xs font-semibold hover:bg-[#4ade80] disabled:opacity-60"
          >
            {loadingQuarterly ? "Memproses…" : "Run Quarterly Engine"}
          </button>

          {quarterlyResult && (
            <div className="mt-3 text-[11px] text-slate-300 bg-black/30 border border-white/10 rounded-lg p-2 overflow-x-auto">
              <div className="font-semibold mb-1">Hasil Quarterly Engine:</div>
              <pre className="whitespace-pre-wrap break-all">
                {JSON.stringify(quarterlyResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </section>

      <section className="glass rounded-2xl px-4 py-3">
        <h2 className="text-xs font-semibold text-white mb-1">
          Catatan Operasional
        </h2>
        <ul className="list-disc pl-4 text-[11px] text-slate-400 space-y-1">
          <li>
            <span className="font-semibold">Hello Discount</span> dihitung
            saat import transaksi pertama (hari pertama) dan tidak diulang di
            engine.
          </li>
          <li>
            <span className="font-semibold">Initial Engine</span> aman
            dijalankan berulang. Cashback & welcome bonus hanya diberikan
            sekali per customer berdasarkan flag di tabel{" "}
            <code>membership_periods</code>.
          </li>
          <li>
            <span className="font-semibold">Quarterly Engine</span> hanya
            membuat membership untuk kuartal yang sudah selesai dan hanya
            memberikan poin ke transaksi yang belum memiliki poin.
          </li>
          <li>
            Anda bisa menjalankan kedua engine ini setiap hari untuk menjaga
            konsistensi tanpa khawatir double perhitungan.
          </li>
        </ul>
      </section>
    </div>
  );
}

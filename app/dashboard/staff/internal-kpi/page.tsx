'use client';

import { useEffect, useState } from 'react';

type KpiData = {
  total_transactions: number;
  total_publish_rate: number;
  total_discount: number;
  total_cashback: number;
  total_points: number;
};

export default function StaffInternalKpiPage() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/staff/kpi');
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || 'Gagal memuat KPI staff');
        }

        setKpi(json.data as KpiData);
      } catch (err: any) {
        setError(err.message ?? 'Terjadi kesalahan');
        setKpi(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold text-white">
          Dashboard KPI Internal – Staff
        </h1>
        <p className="mt-1 text-sm text-slate-400 max-w-2xl">
          Ringkasan KPI untuk memantau workload, jumlah transaksi yang telah
          diproses, dan nilai rewards yang sudah ter-posting.
        </p>
      </header>

      {error && (
        <div className="glass border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {loading && !error && (
        <p className="text-sm text-slate-400">Memuat data KPI…</p>
      )}

      {!loading && kpi && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Total Transaksi
            </p>
            <p className="text-xl font-semibold text-white">
              {kpi.total_transactions.toLocaleString('id-ID')}
            </p>
          </div>

          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Total Publish Rate
            </p>
            <p className="text-xl font-semibold text-white">
              Rp{' '}
              {kpi.total_publish_rate.toLocaleString('id-ID', {
                maximumFractionDigits: 0,
              })}
            </p>
          </div>

          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Total Diskon
            </p>
            <p className="text-xl font-semibold text-emerald-300">
              Rp{' '}
              {kpi.total_discount.toLocaleString('id-ID', {
                maximumFractionDigits: 0,
              })}
            </p>
          </div>

          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Total Cashback
            </p>
            <p className="text-xl font-semibold text-amber-300">
              Rp{' '}
              {kpi.total_cashback.toLocaleString('id-ID', {
                maximumFractionDigits: 0,
              })}
            </p>
          </div>

          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-xs text-slate-400 uppercase tracking-wide">
              Total Poin
            </p>
            <p className="text-xl font-semibold text-sky-300">
              {kpi.total_points.toLocaleString('id-ID')}
            </p>
          </div>
        </section>
      )}

      <section className="glass rounded-2xl px-4 py-4 mt-2">
        <h2 className="text-sm font-semibold text-white mb-2">
          Aktivitas Operasional
        </h2>
        <p className="text-xs text-slate-400">
          Ke depan, bagian ini bisa berisi daftar quick-link untuk impor
          transaksi, koreksi data, dan status batch kalkulasi.
        </p>
      </section>
    </div>
  );
}

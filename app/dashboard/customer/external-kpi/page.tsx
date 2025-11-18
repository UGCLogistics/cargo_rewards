"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface DetailRow {
  date: string;
  count: number;
  total_publish_rate: number;
  total_discount: number;
  total_cashback: number;
  total_points: number;
}

interface KpiTotals {
  total_transactions: number;
  total_publish_rate: number;
  total_discount: number;
  total_cashback: number;
  total_points: number;
}

export default function CustomerExternalKpiPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [detailData, setDetailData] = useState<DetailRow[]>([]);
  const [kpiTotals, setKpiTotals] = useState<KpiTotals | null>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFilters = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);

      // Detail per tanggal (RLS memastikan hanya data milik customer)
      const detailRes = await fetch(
        `/api/customer/kpi/detail?${params.toString()}`
      );
      const detailJson = await detailRes.json();
      if (!detailRes.ok) {
        throw new Error(detailJson.error || "Gagal memuat detail KPI");
      }
      const detail: DetailRow[] = detailJson.data || [];
      setDetailData(detail);

      // Total KPI
      const kpiRes = await fetch(`/api/customer/kpi?${params.toString()}`);
      const kpiJson = await kpiRes.json();
      if (!kpiRes.ok) {
        throw new Error(kpiJson.error || "Gagal memuat KPI");
      }
      setKpiTotals(kpiJson.data || null);

      // Aggregasi ke grafik
      const aggByDate: Record<
        string,
        {
          total_transactions: number;
          total_publish_rate: number;
          total_discount: number;
          total_cashback: number;
          total_points: number;
        }
      > = {};

      detail.forEach((row) => {
        const date = row.date;
        if (!aggByDate[date]) {
          aggByDate[date] = {
            total_transactions: 0,
            total_publish_rate: 0,
            total_discount: 0,
            total_cashback: 0,
            total_points: 0,
          };
        }
        aggByDate[date].total_transactions += Number(row.count) || 0;
        aggByDate[date].total_publish_rate +=
          Number(row.total_publish_rate) || 0;
        aggByDate[date].total_discount += Number(row.total_discount) || 0;
        aggByDate[date].total_cashback += Number(row.total_cashback) || 0;
        aggByDate[date].total_points += Number(row.total_points) || 0;
      });

      const dates = Object.keys(aggByDate).sort();
      const publishData = dates.map((d) => aggByDate[d].total_publish_rate);
      const discountData = dates.map((d) => aggByDate[d].total_discount);
      const cashbackData = dates.map((d) => aggByDate[d].total_cashback);
      const pointsData = dates.map((d) => aggByDate[d].total_points);
      const transactionsData = dates.map(
        (d) => aggByDate[d].total_transactions
      );

      setChartData({
        labels: dates,
        datasets: [
          {
            label: "Publish Rate",
            data: publishData,
            borderColor: "rgba(255,70,0,0.9)",
            backgroundColor: "rgba(255,70,0,0.3)",
            tension: 0.3,
            yAxisID: "y",
          },
          {
            label: "Diskon Diterima",
            data: discountData,
            borderColor: "rgba(16,185,129,0.9)",
            backgroundColor: "rgba(16,185,129,0.3)",
            tension: 0.3,
            yAxisID: "y",
          },
          {
            label: "Cashback Diterima",
            data: cashbackData,
            borderColor: "rgba(251,191,36,0.9)",
            backgroundColor: "rgba(251,191,36,0.3)",
            tension: 0.3,
            yAxisID: "y",
          },
          {
            label: "Poin",
            data: pointsData,
            borderColor: "rgba(59,130,246,0.9)",
            backgroundColor: "rgba(59,130,246,0.3)",
            tension: 0.3,
            yAxisID: "y1",
          },
          {
            label: "Jumlah Pengiriman",
            data: transactionsData,
            borderColor: "rgba(168,85,247,0.9)",
            backgroundColor: "rgba(168,85,247,0.3)",
            tension: 0.3,
            yAxisID: "y2",
          },
        ],
      });
    } catch (err: any) {
      setError(err.message);
      setChartData(null);
      setKpiTotals(null);
      setDetailData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* HEADER + FILTER */}
      <header className="space-y-3">
        <div>
          <h1 className="text-lg md:text-xl font-semibold">
            Dashboard KPI Eksternal
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
            Pantau performa diskon, cashback, publish rate, dan poin
            berdasarkan periode yang Anda pilih.
          </p>
        </div>

        {/* Form Filter */}
        <div className="glass rounded-2xl p-3 sm:p-4 flex flex-wrap gap-3 sm:gap-4 items-end">
          <div className="flex flex-col text-[11px] md:text-xs">
            <label
              htmlFor="start-date"
              className="mb-1 text-slate-300 font-medium"
            >
              Mulai
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-xs md:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            />
          </div>
          <div className="flex flex-col text-[11px] md:text-xs">
            <label
              htmlFor="end-date"
              className="mb-1 text-slate-300 font-medium"
            >
              Selesai
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-xs md:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            />
          </div>
          <div className="ml-auto">
            <button
              onClick={applyFilters}
              disabled={loading}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-xs md:text-sm font-semibold text-white shadow-[0_8px_24px_rgba(255,70,0,0.45)] hover:bg-[#ff5f24] disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? "Memuat…" : "Terapkan Filter"}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs md:text-sm text-red-400">
            {error.includes("Unexpected end of JSON")
              ? "Data KPI belum tersedia atau respons API tidak valid."
              : error}
          </p>
        )}
      </header>

      {/* CHART */}
      <section className="glass rounded-2xl p-3 sm:p-4 lg:p-5">
        {chartData ? (
          <div className="w-full h-64 sm:h-80 lg:h-96">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                stacked: false,
                plugins: {
                  legend: {
                    labels: { color: "#e5e7eb", font: { size: 10 } },
                  },
                  title: {
                    display: true,
                    text: "Pergerakan KPI per Tanggal",
                    color: "#f9fafb",
                    font: { size: 14 },
                  },
                },
                scales: {
                  x: {
                    ticks: { color: "#9ca3af" },
                    grid: { color: "rgba(148,163,184,0.15)" },
                  },
                  y: {
                    type: "linear",
                    display: true,
                    position: "left",
                    ticks: {
                      color: "#9ca3af",
                      callback: (value) =>
                        `Rp ${Number(value).toLocaleString("id-ID")}`,
                    },
                    grid: { color: "rgba(148,163,184,0.15)" },
                  },
                  y1: {
                    type: "linear",
                    display: true,
                    position: "right",
                    grid: { drawOnChartArea: false },
                    ticks: {
                      color: "#9ca3af",
                      callback: (value) =>
                        `${Number(value).toLocaleString("id-ID")}`,
                    },
                  },
                  y2: {
                    type: "linear",
                    display: false,
                    position: "right",
                  },
                },
              }}
            />
          </div>
        ) : (
          <p className="text-xs md:text-sm text-slate-400">
            Belum ada data untuk periode yang dipilih.
          </p>
        )}
      </section>

      {/* RINGKASAN TOTAL */}
      {kpiTotals && (
        <section className="space-y-3">
          <h2 className="text-sm md:text-base font-semibold">
            Ringkasan Periode Terpilih
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="glass rounded-2xl px-3 py-3 md:px-4 md:py-4 flex flex-col gap-1">
              <span className="text-xs text-slate-400">
                Total Pengiriman
              </span>
              <span className="text-base md:text-lg font-semibold">
                {kpiTotals.total_transactions.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="glass rounded-2xl px-3 py-3 md:px-4 md:py-4 flex flex-col gap-1">
              <span className="text-xs text-slate-400">
                Total Publish Rate
              </span>
              <span className="text-base md:text-lg font-semibold">
                Rp{" "}
                {kpiTotals.total_publish_rate.toLocaleString("id-ID", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="glass rounded-2xl px-3 py-3 md:px-4 md:py-4 flex flex-col gap-1">
              <span className="text-xs text-slate-400">
                Total Diskon
              </span>
              <span className="text-base md:text-lg font-semibold">
                Rp{" "}
                {kpiTotals.total_discount.toLocaleString("id-ID", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="glass rounded-2xl px-3 py-3 md:px-4 md:py-4 flex flex-col gap-1">
              <span className="text-xs text-slate-400">
                Total Cashback
              </span>
              <span className="text-base md:text-lg font-semibold">
                Rp{" "}
                {kpiTotals.total_cashback.toLocaleString("id-ID", {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="glass rounded-2xl px-3 py-3 md:px-4 md:py-4 flex flex-col gap-1">
              <span className="text-xs text-slate-400">
                Total Poin
              </span>
              <span className="text-base md:text-lg font-semibold">
                {kpiTotals.total_points.toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* DETAIL HARIAN */}
      {detailData.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm md:text-base font-semibold">
            Detail Harian
          </h2>
          <div className="glass rounded-2xl overflow-x-auto">
            <table className="min-w-full text-[11px] md:text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-300">
                  <th className="px-3 py-2 text-left font-medium">
                    Tanggal
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Pengiriman
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Publish Rate
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Diskon
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Cashback
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Poin
                  </th>
                </tr>
              </thead>
              <tbody>
                {detailData.map((row) => (
                  <tr
                    key={row.date}
                    className="border-t border-white/5 hover:bg-white/5"
                  >
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2 text-right">
                      {row.count.toLocaleString("id-ID")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      Rp{" "}
                      {row.total_publish_rate.toLocaleString("id-ID", {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      Rp{" "}
                      {row.total_discount.toLocaleString("id-ID", {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      Rp{" "}
                      {row.total_cashback.toLocaleString("id-ID", {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.total_points.toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

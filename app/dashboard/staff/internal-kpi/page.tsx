"use client";

import { useEffect, useState } from 'react';
import DashboardLayout from '../../layout';
import { Line } from 'react-chartjs-2';
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
} from 'chart.js';

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

export default function StaffInternalKpiPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [detailData, setDetailData] = useState<DetailRow[]>([]);
  const [kpiTotals, setKpiTotals] = useState<{ total_transactions: number; total_publish_rate: number; total_discount: number; total_cashback: number; total_points: number } | null>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFilters = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      // detail data for staff (RLS restricts to current user)
      const detailRes = await fetch(`/api/staff/kpi/detail?${params.toString()}`);
      const detailJson = await detailRes.json();
      if (!detailRes.ok) throw new Error(detailJson.error || 'Gagal memuat detail KPI');
      const detail: DetailRow[] = detailJson.data || [];
      setDetailData(detail);
      // totals
      const kpiRes = await fetch(`/api/staff/kpi?${params.toString()}`);
      const kpiJson = await kpiRes.json();
      if (!kpiRes.ok) throw new Error(kpiJson.error || 'Gagal memuat KPI');
      setKpiTotals(kpiJson.data || null);
      // aggregate by date
      const aggByDate: Record<string, { total_transactions: number; total_publish_rate: number; total_discount: number; total_cashback: number; total_points: number }> = {};
      detail.forEach((row) => {
        const date = row.date;
        if (!aggByDate[date]) {
          aggByDate[date] = { total_transactions: 0, total_publish_rate: 0, total_discount: 0, total_cashback: 0, total_points: 0 };
        }
        aggByDate[date].total_transactions += Number(row.count) || 0;
        aggByDate[date].total_publish_rate += Number(row.total_publish_rate) || 0;
        aggByDate[date].total_discount += Number(row.total_discount) || 0;
        aggByDate[date].total_cashback += Number((row as any).total_cashback) || 0;
        aggByDate[date].total_points += Number(row.total_points) || 0;
      });
      const dates = Object.keys(aggByDate).sort();
      const publishData = dates.map((d) => aggByDate[d].total_publish_rate);
      const discountData = dates.map((d) => aggByDate[d].total_discount);
      const cashbackData = dates.map((d) => aggByDate[d].total_cashback);
      const pointsData = dates.map((d) => aggByDate[d].total_points);
      const transactionsData = dates.map((d) => aggByDate[d].total_transactions);
      setChartData({
        labels: dates,
        datasets: [
          {
            label: 'Publish Rate',
            data: publishData,
            borderColor: 'rgba(255,70,0,0.8)',
            backgroundColor: 'rgba(255,70,0,0.4)',
            yAxisID: 'y',
          },
          {
            label: 'Diskon',
            data: discountData,
            borderColor: 'rgba(0,200,150,0.8)',
            backgroundColor: 'rgba(0,200,150,0.4)',
            yAxisID: 'y',
          },
          {
            label: 'Cashback',
            data: cashbackData,
            borderColor: 'rgba(255,165,0,0.8)',
            backgroundColor: 'rgba(255,165,0,0.4)',
            yAxisID: 'y',
          },
          {
            label: 'Poin',
            data: pointsData,
            borderColor: 'rgba(100,150,255,0.8)',
            backgroundColor: 'rgba(100,150,255,0.4)',
            yAxisID: 'y1',
          },
          {
            label: 'Jumlah Transaksi',
            data: transactionsData,
            borderColor: 'rgba(180,100,255,0.8)',
            backgroundColor: 'rgba(180,100,255,0.4)',
            yAxisID: 'y2',
          },
        ],
      });
    } catch (err: any) {
      setError(err.message);
      setChartData(null);
      setKpiTotals(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardLayout>
      <h1>Dashboard KPI Internal (Staff)</h1>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="start-date">Mulai</label>
          <input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="end-date">Selesai</label>
          <input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button onClick={applyFilters} disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Memuat…' : 'Terapkan Filter'}
          </button>
        </div>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {chartData && (
        <div style={{ marginBottom: '2rem' }}>
          <Line
            data={chartData}
            options={{
              responsive: true,
              interaction: { mode: 'index', intersect: false },
              stacked: false,
              plugins: { title: { display: true, text: 'KPI dari Waktu ke Waktu' } },
              scales: {
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  ticks: { callback: (value) => `Rp ${Number(value).toLocaleString('id-ID')}` },
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  grid: { drawOnChartArea: false },
                  ticks: { callback: (value) => `${Number(value).toLocaleString()}` },
                },
                y2: {
                  type: 'linear',
                  display: false,
                  position: 'right',
                },
              },
            }}
          />
        </div>
      )}
      {kpiTotals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="glass" style={{ padding: '1rem', borderRadius: '8px' }}>
            <h3>Total Transaksi</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{kpiTotals.total_transactions.toLocaleString()}</p>
          </div>
          <div className="glass" style={{ padding: '1rem', borderRadius: '8px' }}>
            <h3>Total Publish Rate</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Rp {kpiTotals.total_publish_rate.toLocaleString('id-ID')}</p>
          </div>
          <div className="glass" style={{ padding: '1rem', borderRadius: '8px' }}>
            <h3>Total Diskon</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Rp {kpiTotals.total_discount.toLocaleString('id-ID')}</p>
          </div>
          <div className="glass" style={{ padding: '1rem', borderRadius: '8px' }}>
            <h3>Total Cashback</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Rp {kpiTotals.total_cashback.toLocaleString('id-ID')}</p>
          </div>
          <div className="glass" style={{ padding: '1rem', borderRadius: '8px' }}>
            <h3>Total Poin</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{kpiTotals.total_points.toLocaleString()}</p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
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

// Register chart components globally. Without registration ChartJS
// will not render charts properly in React. This can safely be
// called multiple times as ChartJS caches registrations.
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

interface AggregatedDetail {
  date: string;
  user_id: string;
  count: number;
  total_publish_rate: number;
  total_discount: number;
  total_cashback: number;
  total_points: number;
}

interface UserRecord {
  id: string;
  name: string | null;
  role: string;
  status: string;
}

interface MembershipRecord {
  user_id: string;
  membership: string;
  total_points: number;
}

/**
 * AdminInternalKpiPage provides an interactive dashboard for
 * administrators. It supports filtering KPI data by date range,
 * membership tier and sales staff. The page fetches transactional
 * aggregates grouped by date and user from the server and uses
 * react-chartjs-2 to render a line chart. Summary cards update
 * automatically when filters are applied.
 */
export default function AdminInternalKpiPage() {
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [membershipFilter, setMembershipFilter] = useState('ALL');
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  // Data
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [membershipMap, setMembershipMap] = useState<Record<string, string>>({});
  const [detailData, setDetailData] = useState<AggregatedDetail[]>([]);
  const [kpiTotals, setKpiTotals] = useState<{ total_transactions: number; total_publish_rate: number; total_discount: number; total_cashback: number; total_points: number } | null>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Fetch user list on mount for sales filter
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/admin/users');
        const json = await res.json();
        if (res.ok) {
          setUsers(json.data || []);
        }
      } catch (err) {
        // ignore errors – user list is optional
      }
    };
    fetchUsers();
  }, []);

  // Handle filter application. This function fetches detailed
  // transactional data and membership mappings and constructs chart
  // series and summary statistics. It is invoked when the user
  // clicks the Apply Filters button.
  const applyFilters = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query parameters for date range
      const params = new URLSearchParams();
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      // Fetch detail aggregated by date and user
      const detailRes = await fetch(`/api/admin/kpi/user-detail?${params.toString()}`);
      const detailJson = await detailRes.json();
      if (!detailRes.ok) throw new Error(detailJson.error || 'Gagal memuat detail KPI');
      const detail: AggregatedDetail[] = detailJson.data || [];
      // Fetch membership classifications
      const membershipRes = await fetch(`/api/admin/membership?${params.toString()}`);
      const memberJson = await membershipRes.json();
      if (!membershipRes.ok) throw new Error(memberJson.error || 'Gagal memuat membership');
      const membershipList: MembershipRecord[] = memberJson.data || [];
      const membershipMapLocal: Record<string, string> = {};
      membershipList.forEach((m) => {
        membershipMapLocal[m.user_id] = m.membership;
      });
      setMembershipMap(membershipMapLocal);
      // Filter by membership tier if not ALL
      let filteredDetail = detail;
      if (membershipFilter !== 'ALL') {
        filteredDetail = filteredDetail.filter((row) => {
          return membershipMapLocal[row.user_id] === membershipFilter;
        });
      }
      // Filter by selected sales names if any
      if (selectedSales.length > 0) {
        const selectedIds = users
          .filter((u) => selectedSales.includes(u.name || ''))
          .map((u) => u.id);
        filteredDetail = filteredDetail.filter((row) => selectedIds.includes(row.user_id));
      }
      setDetailData(filteredDetail);
      // Aggregate by date for chart and summary
      const aggByDate: Record<string, { total_transactions: number; total_publish_rate: number; total_discount: number; total_cashback: number; total_points: number }> = {};
      filteredDetail.forEach((row) => {
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
      // Create chart dataset sorted by date ascending
      const dates = Object.keys(aggByDate).sort();
      const publishData = dates.map((d) => aggByDate[d].total_publish_rate);
      const discountData = dates.map((d) => aggByDate[d].total_discount);
      const cashbackData = dates.map((d) => aggByDate[d].total_cashback || 0);
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
      // Compute overall KPI totals including cashback
      const totals = { total_transactions: 0, total_publish_rate: 0, total_discount: 0, total_cashback: 0, total_points: 0 };
      filteredDetail.forEach((row) => {
        totals.total_transactions += Number(row.count) || 0;
        totals.total_publish_rate += Number(row.total_publish_rate) || 0;
        totals.total_discount += Number(row.total_discount) || 0;
        totals.total_cashback += Number(row.total_cashback) || 0;
        totals.total_points += Number(row.total_points) || 0;
      });
      setKpiTotals(totals);
    } catch (err: any) {
      setError(err.message);
      setChartData(null);
      setKpiTotals(null);
    } finally {
      setLoading(false);
    }
  };

  // Convert current filtered detail data to a CSV and trigger download.
  const exportCsv = () => {
    if (!detailData || detailData.length === 0) return;
    setExportingCsv(true);
    try {
      // Build header
      const header = ['Tanggal', 'User', 'Membership', 'Jumlah Transaksi', 'Publish Rate', 'Diskon', 'Poin'];
      // Map user IDs to names for convenience
      const userNameMap: Record<string, string> = {};
      users.forEach((u) => { userNameMap[u.id] = u.name || u.id; });
      const rows = detailData.map((row) => {
        const name = userNameMap[row.user_id] || row.user_id;
        const membership = membershipMap[row.user_id] || '';
        return [
          row.date,
          name,
          membership,
          row.count,
          row.total_publish_rate,
          row.total_discount,
          row.total_points,
        ];
      });
      const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'kpi_detail.csv';
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  };

  // Load data initially with no filters (all data)
  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardLayout>
      <h1>Dashboard KPI Internal</h1>
      {/* Filter Controls */}
      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <label htmlFor="start-date">Mulai</label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ display: 'block' }}
          />
        </div>
        <div>
          <label htmlFor="end-date">Selesai</label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ display: 'block' }}
          />
        </div>
        <div>
          <label htmlFor="membership">Membership</label>
          <select
            id="membership"
            value={membershipFilter}
            onChange={(e) => setMembershipFilter(e.target.value)}
            style={{ display: 'block' }}
          >
            <option value="ALL">Semua</option>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
            <option value="PLATINUM">Platinum</option>
          </select>
        </div>
        <div>
          <label htmlFor="sales">Sales</label>
          <select
            id="sales"
            multiple
            value={selectedSales}
            onChange={(e) => {
              const options = Array.from(e.target.selectedOptions).map((opt) => opt.value);
              setSelectedSales(options);
            }}
            style={{ display: 'block', minWidth: '150px', height: '6rem' }}
          >
            {users.map((u) => (
              <option key={u.id} value={u.name || ''}>{u.name || u.id}</option>
            ))}
          </select>
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button onClick={applyFilters} disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Memuat…' : 'Terapkan Filter'}
          </button>
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button onClick={exportCsv} disabled={exportingCsv || detailData.length === 0} style={{ padding: '0.5rem 1rem' }}>
            {exportingCsv ? 'Mengunduh…' : 'Unduh CSV'}
          </button>
        </div>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {/* Chart */}
      {chartData && (
        <div style={{ marginBottom: '2rem' }}>
          <Line
            data={chartData}
            options={{
              responsive: true,
              interaction: { mode: 'index', intersect: false },
              stacked: false,
              plugins: {
                title: { display: true, text: 'KPI dari Waktu ke Waktu' },
              },
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
      {/* Summary cards */}
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
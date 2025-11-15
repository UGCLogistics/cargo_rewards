"use client";

import { useEffect, useState } from 'react';
import DashboardLayout from '../../layout';

interface MembershipRow {
  user_id: string;
  membership: string;
  total_points: number;
}

/**
 * AdminMembershipPage displays the computed membership tier for all users.
 * Administrators can optionally filter by a start and end date to
 * examine membership accrual within a specific range. The data is
 * fetched from `/api/admin/membership` and rendered in a simple table.
 */
export default function AdminMembershipPage() {
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchMemberships = async () => {
    setLoading(true);
    try {
      let url = '/api/admin/membership';
      const params = new URLSearchParams();
      if (startDate) params.append('start', startDate);
      if (endDate) params.append('end', endDate);
      if (params.toString()) url += `?${params.toString()}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat membership');
      setMemberships(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardLayout>
      <h1>Membership</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <label>
          Start:
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ marginLeft: '0.25rem' }} />
        </label>
        <label>
          End:
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ marginLeft: '0.25rem' }} />
        </label>
        <button onClick={fetchMemberships} style={{ padding: '0.25rem 0.75rem' }}>Filter</button>
      </div>
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>User ID</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Tier</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Total Poin</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((m) => (
              <tr key={m.user_id}>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>{m.user_id.substring(0, 8)}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{m.membership}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{m.total_points}</td>
              </tr>
            ))}
            {memberships.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '1rem', textAlign: 'center' }}>Tidak ada data</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </DashboardLayout>
  );
}
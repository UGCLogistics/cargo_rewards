"use client";

import { useState, useEffect } from 'react';
import DashboardLayout from '../layout';

interface Redemption {
  id: number;
  kind: string;
  amount: number;
  points_used: number;
  status: string;
  created_at: string;
}

/**
 * RedeemPage allows customers to request a redemption of their points as
 * shipping credit or cash out. It also lists previous redemption
 * requests along with their statuses. Approval/rejection is performed by
 * managers via the admin interface, not by this page.
 */
export default function RedeemPage() {
  const [kind, setKind] = useState('CREDIT');
  const [points, setPoints] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const fetchRedemptions = async () => {
    try {
      const res = await fetch('/api/redeem');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal memuat data');
      }
      setRedemptions(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchRedemptions();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = {
        kind,
        points_used: Number(points),
        amount: Number(amount),
      };
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal mengirim permintaan redeem');
      }
      // Refresh list
      fetchRedemptions();
      setKind('CREDIT');
      setPoints('');
      setAmount('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <h1>Redeem Poin</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem', maxWidth: '600px' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="kind">Jenis</label><br />
          <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: '100%', padding: '0.5rem' }}>
            <option value="CREDIT">Kredit Pengiriman</option>
            <option value="CASH_OUT">Cash Out</option>
          </select>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="points">Poin yang digunakan</label><br />
          <input id="points" type="number" value={points} onChange={(e) => setPoints(e.target.value)} required min="1000" step="100" style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="amount">Nilai Rupiah (Rp)</label><br />
          <input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required min="0" style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px' }}>
          {loading ? 'Mengirim…' : 'Ajukan Redeem'}
        </button>
      </form>
      <h2>Riwayat Redeem</h2>
      {loadingList ? (
        <p>Memuat…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Tanggal</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Jenis</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>Poin</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>Jumlah (Rp)</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {redemptions.map((r) => (
              <tr key={r.id}>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{r.kind}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', textAlign: 'right' }}>{r.points_used}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', textAlign: 'right' }}>{r.amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashboardLayout>
  );
}
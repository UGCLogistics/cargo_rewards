"use client";

import { useState, useEffect } from 'react';
import DashboardLayout from '../../layout';

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
 * AdminApproveRedeemPage lists all pending redemption requests and lets
 * administrators approve or reject them. On approval you could add
 * logic to adjust the ledger and mark the request as PAID or
 * APPROVED; on rejection you can restore the points. Currently the
 * API simply updates the status.
 */
export default function AdminApproveRedeemPage() {
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRedemptions = async () => {
    try {
      const res = await fetch('/api/admin/redeem');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat data');
      setRedemptions(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRedemptions();
  }, []);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      const res = await fetch('/api/admin/redeem', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memperbarui status');
      // reload list
      fetchRedemptions();
    } catch (err) {
      alert((err as any).message);
    }
  };

  return (
    <DashboardLayout>
      <h1>Approval Redeem</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem' }}>Tanggal</th>
              <th style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem' }}>User ID</th>
              <th style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem' }}>Jenis</th>
              <th style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem', textAlign: 'right' }}>Poin</th>
              <th style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem', textAlign: 'right' }}>Jumlah (Rp)</th>
              <th style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {redemptions.map((r) => (
              <tr key={r.id}>
                <td style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem' }}>{new Date(r.created_at).toLocaleDateString()}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem' }}>{r.user_id.substring(0, 8)}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem' }}>{r.kind}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem', textAlign: 'right' }}>{r.points_used}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem', textAlign: 'right' }}>{r.amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</td>
                <td style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem' }}>
                  <button
                    onClick={() => handleAction(r.id, 'approve')}
                    style={{ marginRight: '0.5rem', backgroundColor: 'var(--accent)', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px', border: 'none' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(r.id, 'reject')}
                    style={{ backgroundColor: '#e53e3e', color: '#fff', padding: '0.25rem 0.5rem', borderRadius: '4px', border: 'none' }}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashboardLayout>
  );
}
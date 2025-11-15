"use client";

import { useEffect, useState } from 'react';
import DashboardLayout from '../layout';

interface LedgerItem {
  id: number;
  type: string;
  amount: number | null;
  points: number | null;
  note: string | null;
  created_at: string;
}

/**
 * RewardsPage displays the reward ledger for the current user. It lists
 * all point and credit movements, along with a running balance summary.
 */
export default function RewardsPage() {
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLedger = async () => {
      try {
        const res = await fetch('/api/rewards');
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Gagal memuat ledger');
        }
        setLedger(json.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLedger();
  }, []);

  return (
    <DashboardLayout>
      <h1>Ledger Reward & Poin</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Tanggal</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Tipe</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>Jumlah (Rp)</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>Poin</th>
              <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem' }}>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((item) => (
              <tr key={item.id}>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{new Date(item.created_at).toLocaleDateString()}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{item.type}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', textAlign: 'right' }}>{item.amount ? item.amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-'}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', textAlign: 'right' }}>{item.points ?? '-'}</td>
                <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{item.note || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashboardLayout>
  );
}
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../layout';
import { useAuth } from '../../../context/AuthContext';

interface Transaction {
  id: number;
  date: string;
  service: string;
  origin: string;
  destination: string;
  publish_rate: number;
  discount_amount: number | null;
  cashback_amount: number | null;
  points_earned: number | null;
}

/**
 * TransactionsPage shows a list of the authenticated user’s transactions.
 * It fetches data from the API route using fetch() on mount. The UI
 * includes a link to create a new transaction.
 */
export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch('/api/transactions');
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Gagal memuat data');
        }
        setTransactions(json.data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  return (
    <DashboardLayout>
      <h1>Data Transaksi</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <Link href="/dashboard/transactions/create" style={{ padding: '0.5rem 1rem', backgroundColor: '#0070f3', color: '#fff', borderRadius: '4px' }}>Buat Transaksi</Link>
            <Link href="/dashboard/transactions/import" style={{ marginLeft: '0.5rem', padding: '0.5rem 1rem', backgroundColor: '#e5e5e5', color: '#333', borderRadius: '4px' }}>Impor CSV/XLSX</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Tanggal</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Layanan</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Origin</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem', textAlign: 'left' }}>Destination</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>Rate</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>Diskon</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>Cashback</th>
                <th style={{ borderBottom: '1px solid #ddd', padding: '0.5rem', textAlign: 'right' }}>Poin</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{new Date(t.date).toLocaleDateString()}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{t.service}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{t.origin}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem' }}>{t.destination}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', textAlign: 'right' }}>{t.publish_rate.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', textAlign: 'right' }}>{t.discount_amount ? t.discount_amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-'}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', textAlign: 'right' }}>{t.cashback_amount ? t.cashback_amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' }) : '-'}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '0.5rem', textAlign: 'right' }}>{t.points_earned ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
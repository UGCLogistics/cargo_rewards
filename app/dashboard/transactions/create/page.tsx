"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../layout';

/**
 * CreateTransactionPage renders a form for users to enter new
 * transaction data. On submission the data is posted to the API and
 * the user is redirected back to the transactions list on success.
 */
export default function CreateTransactionPage() {
  const router = useRouter();
  const [date, setDate] = useState('');
  const [service, setService] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [publishRate, setPublishRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = {
        date,
        service,
        origin,
        destination,
        publish_rate: Number(publishRate),
      };
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal membuat transaksi');
      }
      router.push('/dashboard/transactions');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <h1>Buat Transaksi Baru</h1>
      <form onSubmit={handleSubmit} style={{ maxWidth: '600px' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="date">Tanggal</label><br />
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="service">Layanan</label><br />
          <input id="service" type="text" value={service} onChange={(e) => setService(e.target.value)} required style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="origin">Origin</label><br />
          <input id="origin" type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} required style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="destination">Destination</label><br />
          <input id="destination" type="text" value={destination} onChange={(e) => setDestination(e.target.value)} required style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="publishRate">Tarif Publish (Rp)</label><br />
          <input id="publishRate" type="number" value={publishRate} onChange={(e) => setPublishRate(e.target.value)} required min="0" style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px' }}>
          {loading ? 'Menyimpan…' : 'Simpan'}
        </button>
      </form>
    </DashboardLayout>
  );
}
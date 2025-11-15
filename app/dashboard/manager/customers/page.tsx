"use client";

import { useEffect, useState } from 'react';
import DashboardLayout from '../../layout';

interface CustomerRow {
  id: number;
  company_name: string;
  tax_id: string | null;
  businessfield: string | null;
  pic_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  salesname: string | null;
  created_at: string;
}

/**
 * ManagerCustomersPage lists all registered customers for managers. It
 * does not provide a form to create new customers; managers may only
 * view customer details. Data is fetched from `/api/manager/customers`.
 */
export default function ManagerCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/manager/customers');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat pelanggan');
      setCustomers(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return (
    <DashboardLayout>
      <h1>Data Pelanggan</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>ID</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Perusahaan</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>PIC</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Telepon</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Email</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Sales</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>{c.id}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{c.company_name}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{c.pic_name || '-'}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{c.phone || '-'}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{c.email || '-'}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{c.salesname || '-'}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '1rem', textAlign: 'center' }}>Tidak ada pelanggan terdaftar</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </DashboardLayout>
  );
}
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
 * AdminCustomersPage lists all registered customers and provides a form
 * for creating new customers. Only users with the ADMIN role can
 * access this page (guarded via middleware). The page fetches
 * customers from `/api/admin/customers` and submits new records to
 * the same endpoint via POST.
 */
export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    company_name: '',
    tax_id: '',
    businessfield: '',
    pic_name: '',
    phone: '',
    email: '',
    address: '',
    salesname: '',
  });
  const [saving, setSaving] = useState(false);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/admin/customers');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) {
      alert('Nama perusahaan harus diisi');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menambah pelanggan');
      // Clear form and refresh list
      setForm({ company_name: '', tax_id: '', businessfield: '', pic_name: '', phone: '', email: '', address: '', salesname: '' });
      await fetchCustomers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <h1>Data Pelanggan</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
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
                  <td colSpan={6} style={{ padding: '1rem', textAlign: 'center' }}>Belum ada pelanggan terdaftar</td>
                </tr>
              )}
            </tbody>
          </table>
          <h2>Tambah Pelanggan</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <input
              type="text"
              placeholder="Nama perusahaan*"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
              required
            />
            <input
              type="text"
              placeholder="NPWP / Tax ID"
              value={form.tax_id}
              onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            />
            <input
              type="text"
              placeholder="Bidang usaha"
              value={form.businessfield}
              onChange={(e) => setForm({ ...form, businessfield: e.target.value })}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            />
            <input
              type="text"
              placeholder="PIC name"
              value={form.pic_name}
              onChange={(e) => setForm({ ...form, pic_name: e.target.value })}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            />
            <input
              type="text"
              placeholder="Telepon"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            />
            <input
              type="text"
              placeholder="Alamat"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            />
            <input
              type="text"
              placeholder="Sales name"
              value={form.salesname}
              onChange={(e) => setForm({ ...form, salesname: e.target.value })}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
            />
            <button type="submit" disabled={saving} style={{ gridColumn: '1 / -1', padding: '0.5rem 1rem', backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px' }}>
              {saving ? 'Menyimpan…' : 'Tambah Pelanggan'}
            </button>
          </form>
        </>
      )}
    </DashboardLayout>
  );
}
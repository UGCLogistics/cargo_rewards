"use client";

import { useAuth } from '../../context/AuthContext';
import DashboardLayout from './layout';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import supabase from '../../lib/supabaseClient';

interface KpiData {
  total_transactions: number;
  total_publish_rate: number;
  total_discount: number;
  total_cashback: number;
  total_points: number;
}

/**
 * DashboardHome renders a personalized welcome message along with
 * summarized KPI metrics and quick links to the most commonly used
 * modules. It automatically fetches the correct KPI endpoint based
 * on the user role (ADMIN, MANAGER, STAFF, CUSTOMER) and displays
 * totals such as total transactions, publish rate, discounts,
 * cashback and points. The current date and the user’s company name
 * are also shown for additional context.
 */
export default function DashboardHome() {
  const { user } = useAuth();
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Determine KPI endpoint based on role
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const role = (user.user_metadata as any)?.role || 'CUSTOMER';
      let endpoint: string;
      if (role === 'ADMIN') endpoint = '/api/admin/kpi';
      else if (role === 'MANAGER') endpoint = '/api/manager/kpi';
      else if (role === 'STAFF') endpoint = '/api/staff/kpi';
      else endpoint = '/api/customer/kpi';
      try {
        setLoading(true);
        const res = await fetch(endpoint);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Gagal memuat KPI');
        setKpi(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Fetch company name from users table if present
  useEffect(() => {
    const fetchCompany = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('users')
          .select('companyname')
          .eq('id', user.id)
          .single();
        if (!error) {
          setCompany(data?.companyname ?? null);
        }
      } catch {
        // ignore errors silently
      }
    };
    fetchCompany();
  }, [user]);

  const today = new Date().toLocaleDateString('id-ID', { dateStyle: 'full' });
  const name = user?.user_metadata?.name || user?.email || '';
  const companyName = company || (user?.user_metadata as any)?.companyname || '-';

  // Build quick links depending on role
  const role = (user?.user_metadata as any)?.role || 'CUSTOMER';
  const quickLinks: { href: string; label: string; description: string }[] = [
    { href: '/dashboard/transactions', label: 'Transaksi', description: 'Kelola dan lihat transaksi Anda' },
    { href: '/dashboard/rewards', label: 'Poin & Ledger', description: 'Lihat saldo poin dan riwayat' },
    { href: '/dashboard/redeem', label: 'Redeem', description: 'Tukarkan poin Anda' },
  ];
  // Add KPI link as an essential module depending on role
  let kpiLink: string;
  if (role === 'ADMIN') kpiLink = '/dashboard/admin/internal-kpi';
  else if (role === 'MANAGER') kpiLink = '/dashboard/manager/internal-kpi';
  else if (role === 'STAFF') kpiLink = '/dashboard/staff/internal-kpi';
  else kpiLink = '/dashboard/customer/external-kpi';
  quickLinks.push({ href: kpiLink, label: 'KPI', description: 'Lihat analitik kinerja' });

  return (
    <DashboardLayout>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Hi, {name}</h1>
        <p style={{ margin: 0, opacity: 0.8 }}>{companyName}</p>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--accent)' }}>{today}</p>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading || !kpi ? (
        <p>Memuat ringkasan KPI…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="glass" style={{ padding: '1rem', borderRadius: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Transaksi</h3>
            <p style={{ fontSize: '1.4rem', fontWeight: 600 }}>{kpi.total_transactions?.toLocaleString('id-ID')}</p>
          </div>
          <div className="glass" style={{ padding: '1rem', borderRadius: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Publish Rate</h3>
            <p style={{ fontSize: '1.4rem', fontWeight: 600 }}>
              {kpi.total_publish_rate?.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}
            </p>
          </div>
          <div className="glass" style={{ padding: '1rem', borderRadius: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Diskon</h3>
            <p style={{ fontSize: '1.4rem', fontWeight: 600 }}>
              {kpi.total_discount?.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}
            </p>
          </div>
          <div className="glass" style={{ padding: '1rem', borderRadius: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Cashback</h3>
            <p style={{ fontSize: '1.4rem', fontWeight: 600 }}>
              {kpi.total_cashback?.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}
            </p>
          </div>
          <div className="glass" style={{ padding: '1rem', borderRadius: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Poin</h3>
            <p style={{ fontSize: '1.4rem', fontWeight: 600 }}>{kpi.total_points?.toLocaleString('id-ID')}</p>
          </div>
        </div>
      )}
      {/* Quick Links */}
      <div style={{ marginTop: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem' }}>Menu Utama</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '1rem' }}>
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="glass" style={{ padding: '1rem', borderRadius: '8px', display: 'block', textDecoration: 'none' }}>
              <h3 style={{ margin: 0, marginBottom: '0.5rem', color: 'var(--accent)' }}>{link.label}</h3>
              <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.8 }}>{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
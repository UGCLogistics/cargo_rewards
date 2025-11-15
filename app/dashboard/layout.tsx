"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import MembershipCard from '../../components/MembershipCard';
import supabase from '../../lib/supabaseClient';

/**
 * The dashboard layout provides a consistent navigation bar across all
 * dashboard sub-pages. It displays the logged-in user’s email and exposes
 * links to core modules like Transaksi, Poin, Redeem, dan Admin. The
 * available links can be customized based on user.role in future
 * iterations.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const role = (user?.user_metadata as any)?.role || 'CUSTOMER';

  // Fetch company name for display in header. If not present in metadata, query the users table.
  const [companyName, setCompanyName] = useState<string>('');
  const name = user?.user_metadata?.name || user?.email || '';
  useEffect(() => {
    const getCompany = async () => {
      if (!user) return;
      const metaCompany = (user.user_metadata as any)?.companyname;
      if (metaCompany) {
        setCompanyName(metaCompany);
      } else {
        try {
          const { data, error } = await supabase.from('users').select('companyname').eq('id', user.id).single();
          if (!error) setCompanyName(data?.companyname || '');
        } catch {
          // ignore
        }
      }
    };
    getCompany();
  }, [user]);
  // Build a navigation structure based on the user role. You can adjust
  // these arrays to add or remove modules per the access matrix from
  // the business brief. All users see Home, Transaksi, Ledger & Redeem.
  const navItems: { href: string; label: string }[] = [
    { href: '/dashboard', label: 'Home' },
    { href: '/dashboard/transactions', label: 'Transaksi' },
    { href: '/dashboard/rewards', label: 'Poin & Ledger' },
    { href: '/dashboard/redeem', label: 'Redeem' },
    // Account pages are available to all roles
    { href: '/dashboard/account/info', label: 'Account Info' },
    { href: '/dashboard/account/settings', label: 'Pengaturan Akun' },
  ];
  if (role === 'ADMIN') {
    navItems.push(
      { href: '/dashboard/admin/users', label: 'Manajemen User' },
      { href: '/dashboard/admin/program-config', label: 'Konfigurasi Program' },
      { href: '/dashboard/admin/import', label: 'Impor Transaksi' },
      // Additional administrative modules
      { href: '/dashboard/admin/customers', label: 'Data Pelanggan' },
      { href: '/dashboard/admin/users/create', label: 'Tambah User' },
      { href: '/dashboard/admin/approve-redeem', label: 'Approval Redeem' },
      { href: '/dashboard/admin/internal-kpi', label: 'Dashboard KPI Internal' },
      { href: '/dashboard/admin/membership', label: 'Membership' },
      { href: '/dashboard/admin/audit-logs', label: 'Audit Log' }
    );
  } else if (role === 'MANAGER') {
    navItems.push(
      // Managers have nearly the same modules as admins but without transaction import or user/customer creation
      { href: '/dashboard/manager/approve-redeem', label: 'Approval Redeem' },
      { href: '/dashboard/manager/internal-kpi', label: 'Dashboard KPI Internal' },
      { href: '/dashboard/manager/program-config', label: 'Konfigurasi Program' },
      { href: '/dashboard/manager/customers', label: 'Data Pelanggan' },
      { href: '/dashboard/manager/membership', label: 'Membership' }
    );
  } else if (role === 'STAFF') {
    navItems.push(
      { href: '/dashboard/staff/import', label: 'Impor Transaksi' },
      { href: '/dashboard/staff/internal-kpi', label: 'Dashboard KPI Internal' }
    );
  } else if (role === 'CUSTOMER') {
    navItems.push({ href: '/dashboard/customer/external-kpi', label: 'Dashboard KPI Eksternal' });
  }
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside className="glass" style={{ width: '240px', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        {/* Header: UGC logo, user name and company */}
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>UGC LOGISTICS</div>
          {name && <div style={{ fontSize: '0.9rem' }}>{name}</div>}
          {companyName && <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{companyName}</div>}
        </div>
        {/* Membership card below header */}
        <MembershipCard />
        <h2 style={{ fontSize: '1.2rem', marginTop: '1rem', marginBottom: '0.5rem' }}>Menu</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexGrow: 1 }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', color: 'var(--accent)' }}>{item.label}</Link>
          ))}
        </nav>
        <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
          {user && <p style={{ marginBottom: '0.5rem' }}>Masuk sebagai:<br />{user.email}</p>}
          <button onClick={async () => { await signOut(); }} style={{ width: '100%' }}>Keluar</button>
        </div>
      </aside>
      <main style={{ flexGrow: 1, padding: '2rem' }}>
        {children}
      </main>
    </div>
  );
}
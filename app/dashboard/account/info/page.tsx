"use client";

import { useAuth } from '../../../../context/AuthContext';
import DashboardLayout from '../../layout';
import supabase from '../../../../lib/supabaseClient';
import { useEffect, useState } from 'react';

/**
 * AccountInfo displays detailed information about the currently
 * authenticated user. It fetches the corresponding row from the
 * `public.users` table (via RLS) to retrieve profile fields such as
 * company name, role and status. It also shows the creation date
 * (member since) and the last login timestamp from the auth session.
 */
export default function AccountInfoPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        if (error) throw error;
        setProfile(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  // Format a timestamp into a human readable date/time string in local
  // timezone. If the value is null/undefined, return '-'.
  function formatDate(val: any): string {
    if (!val) return '-';
    const d = new Date(val);
    return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  }

  return (
    <DashboardLayout>
      <h1>Informasi Akun</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <div className="glass" style={{ padding: '1rem', borderRadius: '8px', maxWidth: '480px' }}>
          <h2 style={{ marginTop: 0 }}>Detail Profil</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>Nama</td>
                <td style={{ padding: '0.5rem' }}>{profile?.name || user?.user_metadata?.name || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>Email</td>
                <td style={{ padding: '0.5rem' }}>{user?.email}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>Perusahaan</td>
                <td style={{ padding: '0.5rem' }}>{profile?.companyname || user?.user_metadata?.companyname || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>Peran</td>
                <td style={{ padding: '0.5rem' }}>{profile?.role || (user?.user_metadata as any)?.role}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>Status</td>
                <td style={{ padding: '0.5rem' }}>{profile?.status || '-'}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>Member Sejak</td>
                <td style={{ padding: '0.5rem' }}>{formatDate(profile?.created_at)}</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>Terakhir Login</td>
                <td style={{ padding: '0.5rem' }}>{formatDate(user?.last_sign_in_at)}</td>
              </tr>
              {/* Display the raw creation timestamp separately for clarity */}
              <tr>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>Tanggal Dibuat</td>
                <td style={{ padding: '0.5rem' }}>{formatDate(profile?.created_at)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
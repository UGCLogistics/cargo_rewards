"use client";

"use client";

import { useState, useEffect } from 'react';
import DashboardLayout from '../../layout';

interface UserRow {
  id: string;
  name: string | null;
  role: string;
  status: string;
  created_at: string;
}

/**
 * AdminUserManagementPage lists all users from the extended `users` table and
 * allows the administrator to update their roles or status. The page
 * fetches the user list from the `/api/admin/users` endpoint and
 * presents a table with editable role dropdowns. Changes are saved
 * immediately when a role is selected. This is a minimal example and
 * does not yet support creating or deleting users.
 */
export default function AdminUserManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat users');
      setUsers(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (id: string, newRole: string) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, newRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memperbarui peran');
      // refresh user list
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <DashboardLayout>
      <h1>Manajemen User &amp; Role</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>ID</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Nama</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Peran</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Status</th>
              <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem' }}>{u.id.substring(0, 8)}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{u.name ?? '-'}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)} style={{ padding: '0.25rem', borderRadius: '4px' }}>
                    <option value="ADMIN">ADMIN</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="STAFF">STAFF</option>
                    <option value="CUSTOMER">CUSTOMER</option>
                  </select>
                </td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{u.status}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashboardLayout>
  );
}
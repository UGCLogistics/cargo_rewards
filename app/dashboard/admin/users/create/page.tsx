"use client";

import { useState } from 'react';

/**
 * AdminAddUserPage provides a form for administrators to create new
 * users. The form collects email, password, name and role. On
 * submission it sends a POST request to `/api/admin/users/create`.
 */
export default function AdminAddUserPage() {
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'CUSTOMER' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      alert('Email dan password harus diisi');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal membuat user');
      setMessage('User berhasil dibuat');
      // Reset form
      setForm({ email: '', password: '', name: '', role: 'CUSTOMER' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1>Tambah User</h1>
      {message && <p style={{ color: 'var(--accent)' }}>{message}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
        <input
          type="email"
          placeholder="Email*"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
          required
        />
        <input
          type="password"
          placeholder="Password*"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
          required
        />
        <input
          type="text"
          placeholder="Nama lengkap"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)' }}
        >
          <option value="CUSTOMER">CUSTOMER</option>
          <option value="STAFF">STAFF</option>
          <option value="MANAGER">MANAGER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button type="submit" disabled={saving} style={{ padding: '0.5rem', backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px' }}>
          {saving ? 'Menyimpan…' : 'Buat User'}
        </button>
      </form>
    </div>
  );
}
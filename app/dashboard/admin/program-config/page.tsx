"use client";

"use client";

import { useState, useEffect } from 'react';
import DashboardLayout from '../../layout';

interface ConfigRow {
  id: number;
  key: string;
  value: any;
  created_at: string;
  updated_at: string;
}

/**
 * AdminProgramConfigPage allows administrators to view and modify
 * program configuration values stored in the `program_configs` table.
 * Each configuration entry has a unique key (e.g. `hello_discount`)
 * and a JSON value representing the settings. The page lists all
 * current configs, shows the JSON in a textarea, and lets the admin
 * update the value. When saved, a PUT request is sent to
 * `/api/admin/program-config`.
 */
export default function AdminProgramConfigPage() {
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/admin/program-config');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat konfigurasi');
      // Convert each value to a JSON string for editing
      const rows: ConfigRow[] = (json.data || []).map((cfg: any) => ({
        ...cfg,
        value: JSON.stringify(cfg.value, null, 2),
      }));
      setConfigs(rows);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleSave = async (key: string, valueString: string) => {
    setSaving(true);
    try {
      let parsed;
      try {
        parsed = JSON.parse(valueString);
      } catch (err) {
        throw new Error('Nilai harus berupa JSON valid');
      }
      const res = await fetch('/api/admin/program-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: parsed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan konfigurasi');
      await fetchConfigs();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <h1>Konfigurasi Program</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {configs.map((cfg) => (
            <div key={cfg.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem', background: 'rgba(255,255,255,0.05)' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>{cfg.key}</h3>
              <textarea
                style={{ width: '100%', height: '6rem', marginBottom: '0.5rem', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}
                value={cfg.value}
                onChange={(e) => {
                  const newConfigs = configs.map((c) =>
                    c.id === cfg.id ? { ...c, value: e.target.value } : c
                  );
                  setConfigs(newConfigs);
                }}
              />
              <button
                onClick={() => handleSave(cfg.key, cfg.value)}
                disabled={saving}
                style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px' }}
              >
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          ))}
          {configs.length === 0 && <p>Tidak ada konfigurasi. Anda dapat menambahkannya melalui Supabase SQL.</p>}
        </div>
      )}
    </DashboardLayout>
  );
}
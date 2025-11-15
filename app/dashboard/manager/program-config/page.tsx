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
 * ManagerProgramConfigPage allows managers to view program configuration
 * values without modifying them. The page fetches configs from
 * `/api/admin/program-config` because the manager API does not have
 * a separate endpoint. Editing is disabled: the JSON is shown in
 * read-only textareas and there is no save button.
 */
export default function ManagerProgramConfigPage() {
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/admin/program-config');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memuat konfigurasi');
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

  return (
    <DashboardLayout>
      <h1>Konfigurasi Program (Read Only)</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {configs.map((cfg) => (
            <div key={cfg.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem', background: 'rgba(255,255,255,0.05)' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>{cfg.key}</h3>
              <textarea
                readOnly
                style={{ width: '100%', height: '6rem', marginBottom: '0.5rem', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}
                value={cfg.value}
                onChange={() => {}}
              />
            </div>
          ))}
          {configs.length === 0 && <p>Tidak ada konfigurasi.</p>}
        </div>
      )}
    </DashboardLayout>
  );
}
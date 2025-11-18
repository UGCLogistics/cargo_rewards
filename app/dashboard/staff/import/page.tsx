"use client";

"use client";

import { useState } from 'react';
import * as XLSX from 'xlsx';

/**
 * StaffImportPage allows staff to import their own transactions from a
 * CSV/XLSX file. The server will assign all imported rows to the
 * currently logged-in staff user. Required columns: date, service,
 * origin, destination, publish_rate, invoice_no (optional). Unlike
 * the admin import, user_id is ignored and overridden on the server.
 */
export default function StaffImportPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;
      try {
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        setRows(json);
      } catch (err) {
        setError('Gagal membaca file. Pastikan format CSV atau Excel valid.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/staff/import-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengimpor transaksi');
      setMessage(`Berhasil mengimpor ${json.data.length} transaksi.`);
      setRows([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1>Impor Transaksi (Staff)</h1>
      <p>Unggah file CSV atau Excel dengan kolom: <code>date</code>, <code>service</code>, <code>origin</code>, <code>destination</code>, <code>publish_rate</code>, [<code>invoice_no</code>]. Semua baris akan disimpan atas nama Anda.</p>
      <input type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFile} />
      {error && <p style={{ color: 'red', marginTop: '0.5rem' }}>{error}</p>}
      {message && <p style={{ color: 'green', marginTop: '0.5rem' }}>{message}</p>}
      {rows.length > 0 && (
        <>
          <p style={{ marginTop: '1rem' }}>Pratinjau {rows.length} baris:</p>
          <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((key) => (
                    <th key={key} style={{ padding: '0.25rem', borderBottom: '1px solid var(--border)' }}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, idx) => (
                  <tr key={idx}>
                    {Object.keys(row).map((key) => (
                      <td key={key} style={{ padding: '0.25rem', borderBottom: '1px solid var(--border)' }}>{String(row[key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={handleImport} disabled={loading} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px' }}>
            {loading ? 'Mengimpor…' : 'Import Sekarang'}
          </button>
        </>
      )}
    </div>
  );
}
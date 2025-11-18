"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "context/AuthContext";

type Row = Record<string, any>;

export default function AdminImportTransactionsPage() {
  const { user } = useAuth();
  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = String(rawRole).toUpperCase();

  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(null);
    setError(null);
    setProgress(0);
    setTotal(0);

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;
      try {
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(firstSheet, {
          defval: "",
        });

        const normalized = json.map((row) => {
          // --- normalisasi tanggal → yyyy-mm-dd ---
          let dateValue = row.date ?? row.tanggal ?? row.Date;
          let dateStr = "";

          if (dateValue instanceof Date) {
            dateStr = dateValue.toISOString().slice(0, 10);
          } else if (typeof dateValue === "number") {
            const base = new Date(1899, 11, 30);
            const d = new Date(
              base.getTime() + dateValue * 24 * 60 * 60 * 1000
            );
            dateStr = d.toISOString().slice(0, 10);
          } else if (typeof dateValue === "string" && dateValue) {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) {
              dateStr = d.toISOString().slice(0, 10);
            } else {
              dateStr = dateValue.slice(0, 10);
            }
          }

          // --- normalisasi publish_rate → number ---
          const rawPublish =
            row.publish_rate ??
            row.publish ??
            row.publishrate ??
            row.PUBLISH_RATE;
          const publishNum =
            Number(
              String(rawPublish)
                .replace(/\./g, "")
                .replace(/,/g, "")
                .trim()
            ) || 0;

          return {
            ...row,
            date: dateStr,
            publish_rate: publishNum,
          };
        });

        setRows(normalized);
        setTotal(normalized.length);
      } catch (err) {
        console.error(err);
        setError(
          "Gagal membaca file. Pastikan format CSV/Excel dan nama kolom sudah benar."
        );
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;

    setLoading(true);
    setError(null);
    setMessage(null);
    setProgress(0);
    setTotal(rows.length);

    const totalRows = rows.length;

    // fake progress supaya kelihatan jalan
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= totalRows - 1) return prev;
        return prev + 1;
      });
    }, 250);

    try {
      const res = await fetch("/api/admin/import-transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-role": role,
        },
        body: JSON.stringify({ rows }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal mengimpor transaksi");
      }

      setProgress(totalRows);
      setMessage(`Berhasil mengimpor ${json.data.length} transaksi.`);
      setRows([]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal mengimpor transaksi");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1>Impor Transaksi (Admin)</h1>
      <p>
        Unggah file CSV atau Excel dengan kolom:{" "}
        <code>user_id</code>, <code>date</code>, <code>service</code>,{" "}
        <code>origin</code>, <code>destination</code>,{" "}
        <code>publish_rate</code>, <code>invoice_no</code> (opsional). <br />
        Tambahkan salah satu identitas customer: <code>user_id</code> atau{" "}
        <code>customer_id</code>/<code>company_id</code> atau{" "}
        <code>company_name</code>. <br />
        Tanggal akan dinormalisasi ke format <b>YYYY-MM-DD</b> dan publish rate
        ke angka tanpa pemisah ribuan.
      </p>

      <input
        type="file"
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        onChange={handleFile}
      />

      {error && (
        <p style={{ color: "red", marginTop: "0.5rem", fontSize: "0.85rem" }}>
          {error}
        </p>
      )}
      {message && (
        <p
          style={{
            color: "limegreen",
            marginTop: "0.5rem",
            fontSize: "0.85rem",
          }}
        >
          {message}
        </p>
      )}

      {rows.length > 0 && (
        <>
          <p style={{ marginTop: "1rem" }}>
            Pratinjau {rows.length} baris (maks. 5 baris pertama):
          </p>
          <div
            style={{
              maxHeight: "220px",
              overflow: "auto",
              marginBottom: "1rem",
              border: "1px solid var(--border, #374151)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.75rem",
              }}
            >
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((key) => (
                    <th
                      key={key}
                      style={{
                        padding: "0.25rem 0.5rem",
                        borderBottom: "1px solid var(--border, #374151)",
                        textAlign: "left",
                        position: "sticky",
                        top: 0,
                        background: "#111827",
                        zIndex: 1,
                      }}
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, idx) => (
                  <tr key={idx}>
                    {Object.keys(rows[0]).map((key) => {
                      let value = (row as any)[key];
                      if (key === "date" && value) {
                        value = String(value).slice(0, 10);
                      }
                      if (
                        key === "publish_rate" &&
                        value !== undefined &&
                        value !== null
                      ) {
                        value = Number(value).toLocaleString("id-ID");
                      }
                      return (
                        <td
                          key={key}
                          style={{
                            padding: "0.25rem 0.5rem",
                            borderBottom:
                              "1px solid var(--border, #374151)",
                          }}
                        >
                          {String(value ?? "")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading && total > 0 && (
            <p style={{ fontSize: "0.8rem", marginBottom: "0.25rem" }}>
              Mengimpor {Math.min(progress, total)} dari {total} baris…
            </p>
          )}

          <button
            onClick={handleImport}
            disabled={loading}
            style={{
              padding: "0.5rem 1.25rem",
              backgroundColor: "var(--accent, #ff4600)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Mengimpor…" : "Import Sekarang"}
          </button>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "context/AuthContext";

interface ConfigRow {
  id: number;
  key: string;
  value: string; // disimpan sebagai string JSON di UI
  created_at: string;
  updated_at: string;
}

/**
 * AdminProgramConfigPage
 * - Menampilkan & edit config JSON dari tabel program_configs.
 */
export default function AdminProgramConfigPage() {
  const { user } = useAuth();
  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = String(rawRole).toUpperCase();

  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchConfigs = async () => {
    if (!user) return;

    try {
      setError(null);
      setLoading(true);

      const res = await fetch("/api/admin/program-config", {
        headers: {
          "x-role": role,
        },
      });

      const contentType = res.headers.get("content-type") || "";
      let json: any = null;
      if (contentType.includes("application/json")) {
        json = await res.json();
      }

      if (!res.ok) {
        throw new Error(json?.error || "Gagal memuat konfigurasi");
      }

      const rows: ConfigRow[] = (json?.data || []).map((cfg: any) => ({
        id: cfg.id,
        key: cfg.key,
        // tampilkan value sebagai pretty JSON string
        value: JSON.stringify(cfg.value ?? {}, null, 2),
        created_at: cfg.created_at,
        updated_at: cfg.updated_at,
      }));

      setConfigs(rows);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memuat konfigurasi");
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const handleSave = async (key: string, valueString: string) => {
    if (!user) return;

    setSavingKey(key);
    try {
      let parsed;
      try {
        parsed = JSON.parse(valueString);
      } catch {
        throw new Error("Nilai harus berupa JSON valid");
      }

      const res = await fetch("/api/admin/program-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-role": role,
        },
        body: JSON.stringify({ key, value: parsed }),
      });

      const contentType = res.headers.get("content-type") || "";
      let json: any = null;
      if (contentType.includes("application/json")) {
        json = await res.json();
      }

      if (!res.ok) {
        throw new Error(json?.error || "Gagal menyimpan konfigurasi");
      }

      await fetchConfigs();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat menyimpan konfigurasi");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-semibold text-white">
        Konfigurasi Program
      </h1>

      {error && (
        <p className="text-sm text-red-400 font-medium">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Memuat konfigurasi…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {configs.map((cfg) => (
            <div
              key={cfg.id}
              className="glass rounded-2xl px-4 py-3 border border-white/10"
            >
              {/* Header "kolom" kecil: key + timestamps */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {cfg.key}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Dibuat:{" "}
                    {new Date(cfg.created_at).toLocaleString("id-ID")} •
                    Diupdate:{" "}
                    {new Date(cfg.updated_at).toLocaleString("id-ID")}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  JSON Value
                </span>
              </div>

              <textarea
                className="w-full rounded-md bg-black/40 border border-white/15
                           px-3 py-2 text-xs font-mono text-slate-100
                           placeholder:text-slate-500 min-h-[120px]
                           focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                value={cfg.value}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setConfigs((prev) =>
                    prev.map((c) =>
                      c.id === cfg.id ? { ...c, value: newValue } : c
                    )
                  );
                }}
              />

              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => handleSave(cfg.key, cfg.value)}
                  disabled={savingKey === cfg.key}
                  className="rounded-lg bg-[#ff4600] hover:bg-[#ff5f24]
                             text-white text-xs font-semibold px-4 py-1.5
                             disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingKey === cfg.key ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </div>
          ))}

          {configs.length === 0 && (
            <p className="text-sm text-slate-200">
              Tidak ada konfigurasi. Anda dapat menambahkannya melalui Supabase
              SQL.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

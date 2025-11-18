"use client";

import { useState } from "react";
import { useAuth } from "context/AuthContext";

type Role = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";

export default function AdminAddUserPage() {
  const { user } = useAuth();
  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = String(rawRole).toUpperCase() as Role;

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "CUSTOMER" as Role,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Email dan password wajib diisi.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-role": role, // kirim role pemanggil
        },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Gagal membuat user.");
        return;
      }

      setMessage("User berhasil dibuat.");
      setForm({
        email: "",
        password: "",
        name: "",
        role: "CUSTOMER",
      });
    } catch (err: any) {
      console.error(err);
      setError("Terjadi kesalahan saat membuat user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl md:text-2xl font-semibold text-white">
        Tambah User
      </h1>
      <p className="text-xs text-slate-400 mb-2">
        Hanya ADMIN yang boleh menambahkan user baru. User akan dibuat di{" "}
        <span className="font-mono">auth.users</span>,{" "}
        <span className="font-mono">public.users</span>, dan untuk role{" "}
        <span className="font-mono">CUSTOMER</span> juga dibuat di{" "}
        <span className="font-mono">public.customers</span>.
      </p>

      {error && (
        <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-md space-y-3 glass rounded-2xl px-4 py-4"
      >
        <div className="space-y-1">
          <label className="text-[11px] text-slate-300">
            Email<span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
            placeholder="nama@perusahaan.com"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-slate-300">
            Password<span className="text-red-400">*</span>
          </label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
            placeholder="Minimal 6 karakter"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-slate-300">Nama lengkap</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
            placeholder="Nama PIC / karyawan"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-slate-300">Role</label>
          <select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as Role })
            }
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
          >
            <option value="CUSTOMER">CUSTOMER</option>
            <option value="STAFF">STAFF</option>
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-[#ff4600] px-3 py-2 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(255,70,0,0.35)] hover:bg-[#ff5f24] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {saving ? "Menyimpan…" : "Buat User"}
        </button>
      </form>
    </div>
  );
}

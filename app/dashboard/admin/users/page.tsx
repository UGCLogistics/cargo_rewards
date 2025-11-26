"use client";

import { useEffect, useState } from "react";
import { useAuth } from "context/AuthContext";

type Role = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";

interface AdminUserRow {
  id: string;
  email: string | null;
  name: string | null;
  companyname: string | null;
  role: Role;
  status: string | null;
  created_at: string;
  updated_at: string | null;
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = String(rawRole).toUpperCase() as Role;

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = async () => {
    if (!user) return; // pastikan udah login

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        headers: {
          "x-role": role, // ← kirim role ke backend
        },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gagal memuat data user.");
        return;
      }
      setUsers(json.data || []);
    } catch (err: any) {
      console.error(err);
      setError("Terjadi kesalahan saat memuat data user.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const handleChangeName = (id: string, newName: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, name: newName } : u))
    );
  };

  const handleChangeCompany = (id: string, newCompany: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, companyname: newCompany } : u))
    );
  };

  const handleChangeRole = (id: string, newRole: Role) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
    );
  };

  const handleChangeStatus = (id: string, newStatus: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: newStatus } : u))
    );
  };

  const handleSave = async (userRow: AdminUserRow) => {
    if (!user) return;

    setSavingId(userRow.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-role": role, // ← kirim role ke backend
        },
        body: JSON.stringify({
          id: userRow.id,
          name: userRow.name,
          companyname: userRow.companyname,
          newRole: userRow.role,
          status: userRow.status ?? undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Gagal menyimpan perubahan.");
        return;
      }

      if (json.warning) {
        setMessage(
          `Perubahan tersimpan, tetapi ada peringatan: ${json.warning}`
        );
      } else {
        setMessage("Perubahan profil/role/status berhasil disimpan.");
      }

      // opsional: refresh biar sync sama DB
      // await loadUsers();
    } catch (err: any) {
      console.error(err);
      setError("Terjadi kesalahan saat menyimpan perubahan.");
    } finally {
      setSavingId(null);
    }
  };

  const handleResetPassword = async (id: string) => {
    if (!user) return;

    setResettingId(id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-role": role,
        },
        body: JSON.stringify({ id }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Gagal mengirim email reset password.");
        return;
      }

      setMessage(json.message || "Email reset password berhasil dikirim.");
    } catch (err: any) {
      console.error(err);
      setError("Terjadi kesalahan saat mengirim email reset password.");
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] text-slate-100 px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold mb-2">Manajemen User</h1>
        <p className="text-xs text-slate-400 mb-4">
          Hanya ADMIN yang boleh mengakses halaman ini. Perubahan di sini akan
          otomatis mengubah{" "}
          <span className="font-mono">public.users</span> dan{" "}
          <span className="font-mono">auth.users.user_metadata.role</span>.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="rounded-lg bg-[#ff4600] px-3 py-1.5 text-xs font-semibold shadow-[0_6px_20px_rgba(255,70,0,0.35)] hover:bg-[#ff5f24] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Memuat…" : "Refresh Data"}
          </button>
          {loading && (
            <span className="text-[11px] text-slate-400">
              Mengambil data user…
            </span>
          )}
        </div>

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

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-900/60">
              <tr className="text-left">
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Perusahaan</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Dibuat</th>
                <th className="px-3 py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-4 text-center text-slate-400"
                  >
                    Tidak ada data user.
                  </td>
                </tr>
              )}

              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-white/5 hover:bg-white/5"
                >
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      value={u.name ?? ""}
                      onChange={(e) =>
                        handleChangeName(u.id, e.target.value)
                      }
                      placeholder="Nama lengkap"
                      className="mb-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                    />
                    <div className="text-[10px] text-slate-300">
                      {u.email || "(tanpa email)"}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {u.id}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      value={u.companyname ?? ""}
                      onChange={(e) =>
                        handleChangeCompany(u.id, e.target.value)
                      }
                      placeholder="Nama perusahaan"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        handleChangeRole(u.id, e.target.value as Role)
                      }
                      className="rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="STAFF">STAFF</option>
                      <option value="CUSTOMER">CUSTOMER</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      value={u.status || ""}
                      onChange={(e) =>
                        handleChangeStatus(u.id, e.target.value)
                      }
                      placeholder="mis. ACTIVE / INACTIVE"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                    />
                  </td>
                  <td className="px-3 py-2 align-top text-[10px] text-slate-400">
                    {new Date(u.created_at).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleSave(u)}
                        disabled={savingId === u.id || resettingId === u.id}
                        className="rounded-lg bg-[#ff4600] px-2 py-1 text-[11px] font-semibold hover:bg-[#ff5f24] disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {savingId === u.id ? "Menyimpan…" : "Simpan"}
                      </button>
                      <button
                        onClick={() => handleResetPassword(u.id)}
                        disabled={resettingId === u.id || savingId === u.id}
                        className="rounded-lg border border-slate-600 bg-slate-900/60 px-2 py-1 text-[10px] font-medium hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {resettingId === u.id
                          ? "Mengirim reset…"
                          : "Reset Password"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "context/AuthContext";

interface AccountProfile {
  name: string | null;
  companyname: string | null;
  status: string | null;
  created_at: string | null;
}

export default function AccountSettingsPage() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/account/settings");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Gagal memuat profil akun");
      }

      const data = (json?.data || {}) as AccountProfile;
      setProfile(data);
      setNameInput(data.name || "");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!nameInput.trim()) {
      setError("Nama tidak boleh kosong.");
      return;
    }

    setSavingProfile(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Gagal menyimpan profil");
      }

      setMessage("Profil berhasil diperbarui.");
      setProfile((prev) =>
        prev ? { ...prev, name: nameInput.trim() } : prev
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan saat menyimpan profil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;

    setError(null);
    setMessage(null);

    if (!newPassword || !confirmPassword) {
      setError("Password baru dan konfirmasi harus diisi.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password baru minimal 6 karakter.");
      return;
    }

    setSavingPassword(true);

    try {
      const res = await fetch("/api/account/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Gagal mengubah password");
      }

      setMessage("Password berhasil diperbarui.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan saat mengubah password.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-white">Pengaturan Akun</h1>
        <p className="text-sm text-slate-300">
          Anda harus login untuk mengakses pengaturan akun.
        </p>
      </div>
    );
  }

  const role = String((user.user_metadata as any)?.role || "CUSTOMER").toUpperCase();
  const email = user.email || "-";

  return (
    <div className="space-y-4">
      <h1 className="text-xl md:text-2xl font-semibold text-white">
        Pengaturan Akun
      </h1>
      <p className="text-xs text-slate-400">
        Kelola informasi profil dan password akun Anda.
      </p>

      {error && (
        <div className="glass border border-red-500/40 text-red-200 text-xs px-4 py-3 rounded-xl">
          {error}
        </div>
      )}
      {message && (
        <div className="glass border border-emerald-500/40 text-emerald-200 text-xs px-4 py-3 rounded-xl">
          {message}
        </div>
      )}

      {/* Info dasar */}
      <section className="glass rounded-2xl px-4 py-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Informasi Akun</h2>

        {loading ? (
          <p className="text-sm text-slate-400">Memuat profil…</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[11px] text-slate-400">Email</p>
                <p className="text-sm text-slate-100 font-mono">{email}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] text-slate-400">Role</p>
                <p className="text-sm text-slate-100">{role}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] text-slate-400">Perusahaan</p>
                <p className="text-sm text-slate-100">
                  {profile?.companyname || "-"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] text-slate-400">Status</p>
                <p className="text-sm text-slate-100">
                  {profile?.status || "ACTIVE"}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] text-slate-400">Dibuat</p>
                <p className="text-sm text-slate-100">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleString("id-ID")
                    : "-"}
                </p>
              </div>
            </div>

            <div className="space-y-1 pt-3 border-t border-white/5 mt-2">
              <label className="text-[11px] text-slate-300">
                Nama lengkap
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                placeholder="Nama PIC / nama lengkap"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="rounded-lg bg-[#ff4600] px-4 py-1.5 text-xs font-semibold text-white shadow-[0_6px_20px_rgba(255,70,0,0.35)] hover:bg-[#ff5f24] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingProfile ? "Menyimpan…" : "Simpan Perubahan"}
              </button>
            </div>
          </>
        )}
      </section>

      {/* Ganti password */}
      <section className="glass rounded-2xl px-4 py-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Ubah Password</h2>
        <p className="text-[11px] text-slate-400">
          Password baru minimal 6 karakter. Setelah diubah, Anda akan tetap
          login pada sesi saat ini.
        </p>

        <div className="space-y-2 max-w-md">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-300">
              Password baru
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300">
              Konfirmasi password baru
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
              placeholder="Ulangi password baru"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleChangePassword}
            disabled={savingPassword}
            className="rounded-lg bg-[#ff4600] px-4 py-1.5 text-xs font-semibold text-white shadow-[0_6px_20px_rgba(255,70,0,0.35)] hover:bg-[#ff5f24] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {savingPassword ? "Mengubah…" : "Ubah Password"}
          </button>
        </div>
      </section>
    </div>
  );
}

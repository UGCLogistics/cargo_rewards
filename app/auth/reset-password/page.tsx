"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "../../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [verifying, setVerifying] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Verifikasi token dari URL (token_hash)
  useEffect(() => {
    const verify = async () => {
      setVerifying(true);
      setLinkError(null);

      const tokenHash = searchParams.get("token_hash");
      const type = (searchParams.get("type") || "recovery") as
        | "recovery"
        | "email"
        | "invite"
        | "email_change";

      if (!tokenHash) {
        setLinkError(
          "Link reset password tidak valid atau sudah kedaluwarsa. Silakan minta reset password lagi."
        );
        setVerifying(false);
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (error) {
        console.error("verifyOtp error:", error);
        setLinkError(
          "Link reset password tidak valid atau sudah kedaluwarsa. Silakan minta reset password lagi."
        );
        setVerifying(false);
        return;
      }

      // Jika sukses, session Supabase sudah aktif di browser
      setVerifying(false);
    };

    verify();
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!password || password.length < 8) {
      setFormError("Password minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Konfirmasi password tidak sama.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error("updateUser error:", error);
        setFormError(error.message || "Gagal mengubah password.");
        return;
      }

      setSuccess(true);

      // Setelah berhasil, arahkan kembali ke halaman login
      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setFormError("Terjadi kesalahan saat mengubah password.");
    } finally {
      setSaving(false);
    }
  };

  // UI
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/60 shadow-[0_24px_80px_rgba(0,0,0,0.85)] backdrop-blur-xl p-6">
        <h1 className="text-xl font-semibold mb-1">Reset Password</h1>
        <p className="text-xs text-slate-400 mb-4">
          Silakan buat password baru untuk akun CARGO Rewards Anda.
        </p>

        {/* Status verifikasi link */}
        {verifying && (
          <div className="mb-4 rounded-xl border border-slate-700/60 bg-slate-800/70 px-3 py-2 text-xs text-slate-300">
            Memverifikasi link reset password…
          </div>
        )}

        {linkError && !verifying && (
          <div className="mb-4 rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {linkError}
          </div>
        )}

        {/* Form hanya tampil kalau link valid */}
        {!verifying && !linkError && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                Password Baru
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                placeholder="Minimal 8 karakter"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                Konfirmasi Password Baru
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                placeholder="Ulangi password baru"
              />
            </div>

            {formError && (
              <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {formError}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                Password berhasil diubah. Anda akan diarahkan ke halaman login…
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mt-1 w-full rounded-lg bg-[#ff4600] px-3 py-2 text-sm font-semibold hover:bg-[#ff5f24] disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_10px_35px_rgba(255,70,0,0.45)]"
            >
              {saving ? "Menyimpan…" : "Simpan Password Baru"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

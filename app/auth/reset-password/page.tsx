"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
// SESUAIKAN kalau kamu pakai alias "@/lib/supabaseClient"
import supabase from "../../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [loadingUser, setLoadingUser] = useState(true);
  const [userValid, setUserValid] = useState(false);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // STEP 1: tukar ?code=... dari URL menjadi session Supabase
  useEffect(() => {
    const init = async () => {
      setLoadingUser(true);
      setError(null);

      try {
        // ambil kode dari query param
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        // kalau ada code, pakai PKCE → exchange ke session dulu
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error("exchangeCodeForSession error:", exchangeError);
            setUserValid(false);
            setError(
              "Link reset password tidak valid atau sudah kedaluwarsa. Silakan minta reset password lagi."
            );
            setLoadingUser(false);
            return;
          }
        }

        // STEP 2: setelah exchange (atau implicit flow), cek user
        const { data, error } = await supabase.auth.getUser();

        if (error || !data.user) {
          console.error("Reset password: getUser error", error);
          setUserValid(false);
          setError(
            "Link reset password tidak valid atau sudah kedaluwarsa. Silakan minta reset password lagi."
          );
        } else {
          setUserValid(true);
        }
      } catch (err) {
        console.error("Reset password init error:", err);
        setUserValid(false);
        setError(
          "Terjadi kesalahan saat memproses link reset password. Silakan minta reset password lagi."
        );
      } finally {
        setLoadingUser(false);
      }
    };

    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userValid) return;

    setError(null);
    setMessage(null);

    if (!password || password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        console.error("updateUser error:", error);
        setError(error.message || "Gagal mengganti password.");
        return;
      }

      setMessage(
        "Password berhasil diubah. Silakan login kembali dengan password baru."
      );

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      console.error(err);
      setError("Terjadi kesalahan saat mengganti password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.75)]">
        <h1 className="text-xl font-semibold mb-2">Reset Password</h1>
        <p className="text-xs text-slate-400 mb-4">
          Silakan buat password baru untuk akun CARGO Rewards Anda.
        </p>

        {loadingUser && (
          <div className="text-xs text-slate-300 mb-2">
            Memvalidasi link reset password…
          </div>
        )}

        {!loadingUser && !userValid && (
          <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error ||
              "Link reset password tidak valid atau sudah kedaluwarsa. Silakan minta reset password lagi."}
          </div>
        )}

        {!loadingUser && userValid && (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {message}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-slate-300">Password baru</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                placeholder="Minimal 8 karakter"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300">
                Konfirmasi password baru
              </label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                placeholder="Ulangi password baru"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-2 w-full rounded-lg bg-[#ff4600] px-4 py-2 text-xs font-semibold hover:bg-[#ff5f24] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Menyimpan…" : "Simpan Password Baru"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email || !password) {
      setErrorMsg("Email dan password wajib diisi.");
      return;
    }

    try {
      setIsLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message || "Gagal login. Periksa kembali email & password.");
        return;
      }

      if (!data?.session) {
        setErrorMsg("Gagal membuat sesi login. Silakan coba lagi.");
        return;
      }

      // Login sukses → arahkan ke dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      setErrorMsg("Terjadi kesalahan saat login. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email) {
      setErrorMsg("Masukkan email terlebih dahulu sebelum reset password.");
      return;
    }

    try {
      setResetLoading(true);

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        setErrorMsg(
          error.message || "Gagal mengirim link reset password. Coba lagi beberapa saat."
        );
        return;
      }

      setInfoMsg(
        "Link reset password sudah dikirim ke email (jika terdaftar). Silakan cek inbox/spam."
      );
    } catch (err: any) {
      console.error("Reset password error:", err);
      setErrorMsg("Terjadi kesalahan saat mengirim link reset password.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full relative">
        {/* Glow background */}
        <div className="absolute inset-0 blur-3xl opacity-40 bg-gradient-to-br from-orange-500 via-amber-400 to-sky-500 pointer-events-none" />

        <div className="relative bg-slate-900/80 border border-slate-700/70 shadow-2xl shadow-black/50 rounded-2xl p-8 backdrop-blur-xl">
          <div className="mb-6 text-center">
            <h1 className="text-sm font-semibold tracking-[0.3em] text-slate-400 uppercase">
              CARGO Rewards
            </h1>
            <h2 className="mt-3 text-2xl font-semibold text-slate-50">
              Login Portal
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Masuk untuk melihat transaksi, poin, dan rewards Anda.
            </p>
          </div>

          {/* Alert error */}
          {errorMsg && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-sm text-red-100">
              {errorMsg}
            </div>
          )}

          {/* Alert info */}
          {infoMsg && (
            <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-100">
              {infoMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                placeholder="nama@perusahaan.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                placeholder="Masukkan password"
              />
            </div>

            {/* Lupa password */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Lupa password?
              </span>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetLoading}
                className="text-orange-400 hover:text-orange-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {resetLoading ? "Mengirim link..." : "Kirim link reset ke email"}
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-orange-900/40 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? "Memproses..." : "Masuk ke Portal"}
            </button>
          </form>

          <p className="mt-4 text-[11px] text-center text-slate-500">
            Powered by UGC Logistics – CARGO Rewards Portal
          </p>
        </div>
      </div>
    </div>
  );
}

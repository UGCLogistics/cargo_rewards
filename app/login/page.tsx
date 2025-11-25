"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import supabase from "../../lib/supabaseClient";
import ugcLogo from "public/logougcorangewhite.png";

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
        setErrorMsg(
          error.message || "Gagal login. Periksa kembali email & password."
        );
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
          error.message ||
            "Gagal mengirim link reset password. Coba lagi beberapa saat."
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
    // h-full + overflow-auto biar bisa scroll di dalam layout
    <div className="h-full overflow-auto px-4">
      {/* PADDING ATAS–BAWAH DI SINI */}
      <div className="mx-auto flex max-w-md items-start justify-center py-10 md:py-16">
        <div className="relative w-full">
          {/* Glow background senada register */}
          <div className="pointer-events-none absolute -inset-x-10 -top-16 -bottom-10 -z-10 opacity-40 blur-3xl bg-[radial-gradient(circle_at_top,_rgba(255,70,0,0.7)_0,_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(15,23,42,0.9)_0,_transparent_60%)]" />

          {/* CARD LOGIN – pakai glass-card */}
          <div className="glass-card px-7 py-8 md:px-7 md:py-8">
            {/* Logo */}
            <div className="mb-4 flex items-center justify-center">
              <Image
                src={ugcLogo}
                alt="UGC Logistics"
                width={260}
                height={68}
                className="h-14 w-auto md:h-16"
                priority
              />
            </div>

            {/* Heading & copy */}
            <div className="mb-6 text-center">
              <p className="mb-1 text-[10px] uppercase tracking-[0.26em] text-slate-400">
                C.A.R.G.O Rewards
              </p>
              <h1 className="text-2xl font-semibold text-slate-50">
                Login ke Portal Rewards
              </h1>
              <p className="mt-1 text-[11px] text-slate-400">
                Masuk untuk memantau{" "}
                <span className="font-medium text-slate-100">
                  transaksi, poin, dan benefit
                </span>{" "}
                CARGO Rewards yang Anda dapatkan bersama UGC Logistics.
              </p>
            </div>

            {/* Alert error */}
            {errorMsg && (
              <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                {errorMsg}
              </div>
            )}

            {/* Alert info */}
            {infoMsg && (
              <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
                {infoMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-200">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#ff4600]"
                  placeholder="nama@perusahaan.com"
                />
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-200">
                  Password
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#ff4600]"
                  placeholder="Masukkan password"
                />
              </div>

              {/* Lupa password */}
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  Lupa password? Masukkan email lalu kirim link reset.
                </span>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className="text-[#ffb366] hover:text-[#ffd0a0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetLoading ? "Mengirim…" : "Kirim link reset"}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary mt-2 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Memproses..." : "Masuk ke Portal"}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] text-slate-400">
              Belum punya akun?{" "}
              <Link
                href="/register"
                className="font-medium text-[#ffb366] hover:text-[#ffd0a0]"
              >
                Daftar sebagai pelanggan baru
              </Link>
            </p>

            <p className="mt-2 text-center text-[10px] text-slate-500">
              Powered by UGC Logistics – CARGO Rewards Portal
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
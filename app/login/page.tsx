'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '../../lib/supabaseClient'; // sesuaikan kalau path berbeda

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!email || !password) {
      setErrorMsg('Email dan kata sandi wajib diisi.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) {
      console.error(error);
      setErrorMsg(error.message || 'Gagal masuk. Periksa kembali data Anda.');
      return;
    }

    router.push('/dashboard');
  };

  const handleForgotPassword = async () => {
    setErrorMsg('');
    setInfoMsg('');

    if (!email) {
      setErrorMsg('Masukkan dulu email yang terdaftar untuk reset kata sandi.');
      return;
    }

    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email /* , {
      // redirectTo: `${window.location.origin}/reset-password`,
    } */);
    setResetLoading(false);

    if (error) {
      console.error(error);
      setErrorMsg(error.message || 'Gagal mengirim email reset kata sandi.');
      return;
    }

    setInfoMsg(
      'Link untuk reset kata sandi sudah dikirim ke email Anda. Silakan cek inbox/spam.'
    );
  };

  return (
    <div className="min-h-screen bg-[#050816] flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        {/* Glow background */}
        <div className="pointer-events-none absolute inset-0 -z-10 blur-3xl opacity-40 bg-[radial-gradient(circle_at_top,_#ff4600_0,_transparent_55%),_radial-gradient(circle_at_bottom,_#0ea5e9_0,_transparent_55%)]" />

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_0_40px_rgba(15,23,42,0.8)] px-7 py-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <p className="text-[10px] tracking-[0.25em] text-slate-400 uppercase mb-1">
              C.A.R.G.O Rewards
            </p>
            <h1 className="text-2xl font-semibold text-white">
              Masuk ke Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Gunakan email dan kata sandi yang telah terdaftar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
              />
            </div>

            {/* Password + lupa password */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Kata sandi
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
              />
              <div className="mt-2 flex justify-end">
                {/* ⬇️ Tombol Lupa Password dengan style baru */}
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-[11px] px-3 py-1 rounded-full border border-[#ff4600] bg-white text-[#ff4600] hover:bg-[#ff4600] hover:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {resetLoading ? 'Mengirim link reset…' : 'Lupa kata sandi?'}
                </button>
              </div>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-[11px] text-red-300">
                {errorMsg}
              </div>
            )}

            {/* Info message */}
            {infoMsg && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 px-3 py-2 text-[11px] text-emerald-300">
                {infoMsg}
              </div>
            )}

            {/* Button masuk */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-[#ff4600] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(255,70,0,0.45)] hover:bg-[#ff5f24] disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Memproses…' : 'Masuk'}
            </button>
          </form>

          <div className="mt-5 flex flex-col items-center gap-1">
            <p className="text-[11px] text-slate-400">
              Belum punya akun?{' '}
              <a
                href="/register"
                className="font-medium text-[#ffb366] hover:text-[#ffd0a0]"
              >
                Daftar
              </a>
            </p>
            <a
              href="/"
              className="text-[11px] text-slate-500 hover:text-slate-300"
            >
              ← Kembali ke halaman utama
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

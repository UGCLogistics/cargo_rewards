'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '../../lib/supabaseClient'; // kalau file ini di app/(auth)/register/, path ini biasanya benar

type AccountType = 'CUSTOMER' | 'INTERNAL';

type FormState = {
  picName: string;
  email: string;
  password: string;
  companyName: string;
  taxId: string;
  businessField: string;
  phone: string;
  address: string;
  accountType: AccountType;
};

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    picName: '',
    email: '',
    password: '',
    companyName: '',
    taxId: '',
    businessField: '',
    phone: '',
    address: '',
    accountType: 'CUSTOMER',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!form.picName || !form.email || !form.password || !form.companyName) {
      setErrorMsg('Nama PIC, email, kata sandi, dan nama perusahaan wajib diisi.');
      return;
    }
    if (form.password.length < 8) {
      setErrorMsg('Kata sandi minimal 8 karakter.');
      return;
    }

    setLoading(true);
    try {
      const userRole: 'CUSTOMER' | 'STAFF' =
        form.accountType === 'INTERNAL' ? 'STAFF' : 'CUSTOMER';

      // 1) Daftarkan user ke Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            name: form.picName,
            companyname: form.companyName,
            role: userRole,
            phone: form.phone,
            tax_id: form.taxId,
            businessfield: form.businessField,
            address: form.address,
            account_type: form.accountType,
          },
        },
      });

      if (error) {
        console.error(error);
        setErrorMsg(error.message || 'Gagal mendaftarkan akun.');
        return;
      }

      const newUserId = data.user?.id;

      // 2) Kalau customer → auto buat data pelanggan
      if (newUserId && form.accountType === 'CUSTOMER') {
        const { error: customerError } = await supabase.from('customers').insert({
          user_id: newUserId,
          company_name: form.companyName,
          tax_id: form.taxId || null,
          businessfield: form.businessField || null,
          pic_name: form.picName,
          phone: form.phone || null,
          email: form.email,
          address: form.address || null,
          salesname: null,
        });

        if (customerError) {
          console.error(customerError);
          setSuccessMsg(
            'Akun berhasil dibuat, tetapi data pelanggan belum tersimpan penuh. Mohon hubungi admin.'
          );
          setLoading(false);
          return;
        }
      }

      setSuccessMsg('Akun berhasil dibuat. Mengarahkan ke halaman masuk…');
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (err) {
      console.error(err);
      setErrorMsg('Terjadi kesalahan tak terduga saat mendaftar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        {/* Glow background */}
        <div className="pointer-events-none absolute inset-0 -z-10 blur-3xl opacity-40 bg-[radial-gradient(circle_at_top,_#ff4600_0,_transparent_55%),_radial-gradient(circle_at_bottom,_#0ea5e9_0,_transparent_55%)]" />

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_0_40px_rgba(15,23,42,0.8)] px-6 py-7">
          {/* Header */}
          <div className="mb-5 text-center">
            <p className="text-[10px] tracking-[0.25em] text-slate-400 uppercase mb-1">
              C.A.R.G.O Rewards
            </p>
            <h1 className="text-2xl font-semibold text-white">
              Registrasi Pelanggan Baru
            </h1>
            <p className="text-[11px] text-slate-400 mt-1">
              Data ini otomatis menjadi profil pelanggan di sistem loyalty UGC Logistics.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* PIC */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Nama PIC / Contact person
              </label>
              <input
                type="text"
                name="picName"
                value={form.picName}
                onChange={handleChange}
                placeholder="Mis: Dani Budiarto"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Email kerja (untuk login)
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="nama@perusahaan.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Kata sandi
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimal 8 karakter"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
              />
            </div>

            {/* HP */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                No. HP / WhatsApp
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="08xxxxxxxxxx"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
              />
            </div>

            {/* Perusahaan */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Nama perusahaan
              </label>
              <input
                type="text"
                name="companyName"
                value={form.companyName}
                onChange={handleChange}
                placeholder="Mis: PT Utama Globalindo Cargo"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
              />
            </div>

            {/* NPWP */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                NPWP / Tax ID (opsional)
              </label>
              <input
                type="text"
                name="taxId"
                value={form.taxId}
                onChange={handleChange}
                placeholder="Isi jika diperlukan"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
              />
            </div>

            {/* Bidang usaha */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Bidang usaha
              </label>
              <input
                type="text"
                name="businessField"
                value={form.businessField}
                onChange={handleChange}
                placeholder="Mis: FMCG, Fashion, Elektronik"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
              />
            </div>

            {/* Alamat */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Alamat lengkap
              </label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={2}
                placeholder="Alamat kantor / gudang utama"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent resize-none"
              />
            </div>

            {/* Tipe akun */}
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Tipe akun
              </label>
              <select
                name="accountType"
                value={form.accountType}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#ff4600] focus:border-transparent"
              >
                <option value="CUSTOMER">Customer / Shipper</option>
                <option value="INTERNAL">Internal UGC (sales / staff)</option>
              </select>
            </div>

            {/* Error / success */}
            {errorMsg && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-3 py-2 text-[11px] text-red-300">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/40 px-3 py-2 text-[11px] text-emerald-300">
                {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-[#ff4600] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(255,70,0,0.45)] hover:bg-[#ff5f24] disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Memproses…' : 'Daftar'}
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] text-slate-400">
            Sudah punya akun?{' '}
            <a
              href="/login"
              className="font-medium text-[#ffb366] hover:text-[#ffd0a0]"
            >
              Masuk di sini
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import supabase from "../../lib/supabaseClient";
import ugcLogo from "public/logougcorangewhite.png";

type AccountType = "CUSTOMER" | "INTERNAL";

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
    picName: "",
    email: "",
    password: "",
    companyName: "",
    taxId: "",
    businessField: "",
    phone: "",
    address: "",
    accountType: "CUSTOMER",
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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
    setErrorMsg("");
    setSuccessMsg("");

    if (!form.picName || !form.email || !form.password || !form.companyName) {
      setErrorMsg(
        "Nama PIC, email, kata sandi, dan nama perusahaan wajib diisi."
      );
      return;
    }

    if (form.password.length < 8) {
      setErrorMsg("Kata sandi minimal 8 karakter.");
      return;
    }

    setLoading(true);

    try {
      const userRole: "CUSTOMER" | "STAFF" = "CUSTOMER";

      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

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
            account_type: "CUSTOMER",
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error("signUp error", error);
        setErrorMsg(error.message || "Gagal mendaftarkan akun.");
        return;
      }

      if (!data?.user?.id) {
        setErrorMsg(
          "Akun tidak berhasil dibuat di Auth. Silakan coba lagi atau hubungi admin."
        );
        return;
      }

      // Mulai sini, trigger di database akan otomatis isi public.users dan public.customers
      setSuccessMsg(
        "Akun berhasil dibuat. Silakan cek email Anda untuk konfirmasi sebelum login."
      );

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      console.error(err);
      setErrorMsg("Terjadi kesalahan tak terduga saat mendaftar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-auto px-4">
      <div className="mx-auto flex max-w-md items-start justify-center py-16 md:py-16">
        <div className="relative w-full">
          <div className="pointer-events-none absolute -inset-x-10 -top-16 -bottom-10 -z-10 opacity-40 blur-3xl bg-[radial-gradient(circle_at_top,_rgba(255,70,0,0.7)_0,_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(15,23,42,0.9)_0,_transparent_60%)]" />

          <div className="glass-card px-6 py-7 md:px-7 md:py-8">
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

            <div className="mb-6 text-center">
              <p className="mb-1 text-[10px] uppercase tracking-[0.26em] text-slate-400">
                C.A.R.G.O Rewards
              </p>
              <h1 className="text-2xl font-semibold text-slate-50">
                Registrasi Pelanggan Baru
              </h1>
              <p className="mt-1 text-[11px] text-slate-400">
                Data yang Anda isi akan otomatis menjadi profil pelanggan di
                sistem loyalty{" "}
                <span className="font-medium text-slate-100">
                  UGC Logistics
                </span>
                , sehingga tim sales dan account management kami bisa
                memonitor benefit dan histori pengiriman Anda dengan lebih
                akurat.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-200">
                  Nama PIC / Contact person
                </label>
                <input
                  type="text"
                  name="picName"
                  value={form.picName}
                  onChange={handleChange}
                  placeholder="Mis: Dani Budiarto"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#ff4600]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-200">
                  Email kerja (untuk login)
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="nama@perusahaan.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#ff4600]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-200">
                  Kata sandi
                </label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Minimal 8 karakter"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#ff4600]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-200">
                  No. HP / WhatsApp
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="08xxxxxxxxxx"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#ff4600]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-200">
                  Nama perusahaan
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  placeholder="Mis: PT Utama Globalindo Cargo"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#ff4600]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-200">
                  NPWP / Tax ID (opsional)
                </label>
                <input
                  type="text"
                  name="taxId"
                  value={form.taxId}
                  onChange={handleChange}
                  placeholder="Isi jika diperlukan"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#ff4600]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-200">
                  Bidang usaha
                </label>
                <input
                  type="text"
                  name="businessField"
                  value={form.businessField}
                  onChange={handleChange}
                  placeholder="Mis: FMCG, Fashion, Elektronik"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#ff4600]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-200">
                  Alamat lengkap
                </label>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Alamat kantor / gudang utama"
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#ff4600]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-200">
                  Tipe akun
                </label>
                <select
                  name="accountType"
                  value={form.accountType}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#ff4600]"
                >
                  <option value="CUSTOMER">Customer / Shipper</option>
                </select>
                <p className="mt-1 text-[10px] text-slate-500">
                  Akun internal UGC (sales / staff) dibuat dan divalidasi oleh
                  admin, bukan melalui form ini.
                </p>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary mt-2 w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Memproses..." : "Daftar"}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] text-slate-400">
              Sudah punya akun?{" "}
              <Link
                href="/login"
                className="font-medium text-[#ffb366] hover:text-[#ffd0a0]"
              >
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "context/AuthContext";

interface CustomerRow {
  id: number;
  company_name: string;
  tax_id: string | null;
  businessfield: string | null;
  pic_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  salesname: string | null;
  created_at: string;
  // optional: kalau di-select juga, bisa ditambah
  // updated_at?: string | null;
  // first_transaction_date?: string | null;
  // company_code?: string | null;
}

type EditPicState = {
  id: number;
  pic_name: string;
  phone: string;
  email: string;
} | null;

export default function AdminCustomersPage() {
  const { user } = useAuth();
  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = String(rawRole).toUpperCase();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    company_name: "",
    tax_id: "",
    businessfield: "",
    pic_name: "",
    phone: "",
    email: "",
    address: "",
    salesname: "",
  });

  // NEW: state untuk edit PIC
  const [editingPic, setEditingPic] = useState<EditPicState>(null);

  const fetchCustomers = async () => {
    if (!user) return;

    try {
      setError(null);
      const res = await fetch("/api/admin/customers", {
        headers: {
          "x-role": role,
        },
      });

      const contentType = res.headers.get("content-type") || "";
      let json: any = null;
      if (contentType.includes("application/json")) {
        json = await res.json();
      }

      if (!res.ok) {
        throw new Error(json?.error || "Gagal memuat pelanggan");
      }

      setCustomers((json?.data as CustomerRow[]) || []);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat memuat pelanggan");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) {
      alert("Nama perusahaan harus diisi");
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-role": role,
        },
        body: JSON.stringify(form),
      });

      const contentType = res.headers.get("content-type") || "";
      let json: any = null;
      if (contentType.includes("application/json")) {
        json = await res.json();
      }

      if (!res.ok) {
        throw new Error(json?.error || "Gagal menambah pelanggan");
      }

      setForm({
        company_name: "",
        tax_id: "",
        businessfield: "",
        pic_name: "",
        phone: "",
        email: "",
        address: "",
        salesname: "",
      });

      await fetchCustomers();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat menambah pelanggan");
    } finally {
      setSaving(false);
    }
  };

  // NEW: mulai edit PIC untuk 1 customer
  const startEditPic = (c: CustomerRow) => {
    setEditingPic({
      id: c.id,
      pic_name: c.pic_name || "",
      phone: c.phone || "",
      email: c.email || "",
    });
  };

  // NEW: submit perubahan PIC (ke API PATCH)
  const handleUpdatePic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPic || !user) return;

    if (!editingPic.pic_name.trim()) {
      alert("Nama PIC tidak boleh kosong");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-role": role,
        },
        body: JSON.stringify({
          customer_id: editingPic.id,
          pic_name: editingPic.pic_name.trim(),
          phone: editingPic.phone.trim() || null,
          email: editingPic.email.trim() || null,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let json: any = null;
      if (contentType.includes("application/json")) {
        json = await res.json();
      }

      if (!res.ok) {
        throw new Error(json?.error || "Gagal mengubah data PIC");
      }

      setEditingPic(null);
      await fetchCustomers();
    } catch (err: any) {
      alert(err?.message || "Terjadi kesalahan saat mengubah data PIC");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold text-white">
          Data Pelanggan
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Daftar seluruh pelanggan yang terdaftar di program C.A.R.G.O Rewards.
        </p>
      </header>

      {/* Error */}
      {error && (
        <div className="glass border border-red-500/40 text-red-200 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Tabel pelanggan */}
      <section className="glass rounded-2xl px-4 py-4">
        <h2 className="text-sm font-semibold text-white mb-3">
          Daftar Pelanggan
        </h2>

        {loading ? (
          <p className="text-sm text-slate-400">Memuat data pelanggan…</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-slate-200">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] text-slate-400">
                    <th className="px-3 py-2 text-left">ID</th>
                    <th className="px-3 py-2 text-left">Perusahaan</th>
                    <th className="px-3 py-2 text-left">PIC</th>
                    <th className="px-3 py-2 text-left">Telepon</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Sales</th>
                    <th className="px-3 py-2 text-left">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-4 text-center text-slate-400"
                      >
                        Belum ada pelanggan terdaftar
                      </td>
                    </tr>
                  )}
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="px-3 py-2 text-[11px] text-slate-400">
                        {c.id}
                      </td>
                      <td className="px-3 py-2">{c.company_name}</td>
                      <td className="px-3 py-2">{c.pic_name || "-"}</td>
                      <td className="px-3 py-2">{c.phone || "-"}</td>
                      <td className="px-3 py-2">{c.email || "-"}</td>
                      <td className="px-3 py-2">{c.salesname || "-"}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => startEditPic(c)}
                          className="text-[11px] text-amber-300 hover:text-[#ff4600] underline"
                        >
                          Ubah PIC
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Form edit PIC */}
            {editingPic && (
              <form
                onSubmit={handleUpdatePic}
                className="mt-4 grid gap-3 md:grid-cols-4 items-end border-t border-white/10 pt-4"
              >
                <div className="md:col-span-4 text-[11px] text-slate-400 mb-1">
                  Ubah data PIC untuk customer ID{" "}
                  <span className="font-semibold text-white">
                    {editingPic.id}
                  </span>
                </div>

                <input
                  type="text"
                  placeholder="Nama PIC"
                  value={editingPic.pic_name}
                  onChange={(e) =>
                    setEditingPic((prev) =>
                      prev ? { ...prev, pic_name: e.target.value } : prev
                    )
                  }
                  className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2
                             text-xs md:text-sm text-white placeholder:text-slate-500
                             focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                  required
                />
                <input
                  type="text"
                  placeholder="Telepon PIC"
                  value={editingPic.phone}
                  onChange={(e) =>
                    setEditingPic((prev) =>
                      prev ? { ...prev, phone: e.target.value } : prev
                    )
                  }
                  className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2
                             text-xs md:text-sm text-white placeholder:text-slate-500
                             focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                />
                <input
                  type="email"
                  placeholder="Email PIC"
                  value={editingPic.email}
                  onChange={(e) =>
                    setEditingPic((prev) =>
                      prev ? { ...prev, email: e.target.value } : prev
                    )
                  }
                  className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2
                             text-xs md:text-sm text-white placeholder:text-slate-500
                             focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
                />

                <div className="md:col-span-4 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingPic(null)}
                    className="rounded-lg border border-white/20 px-4 py-2 text-xs md:text-sm text-slate-200 hover:bg-white/10"
                    disabled={saving}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-[#ff4600] hover:bg-[#ff5f24]
                               text-white text-xs md:text-sm font-semibold px-6 py-2
                               disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? "Menyimpan…" : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>

      {/* Form tambah pelanggan */}
      <section className="glass rounded-2xl px-4 py-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-white">
            Tambah Pelanggan
          </h2>
          <span className="text-[11px] text-slate-400">
            Isi minimal nama perusahaan. Field lain opsional.
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-3 md:grid-cols-4 items-start"
        >
          <input
            type="text"
            placeholder="Nama perusahaan*"
            value={form.company_name}
            onChange={(e) =>
              setForm({ ...form, company_name: e.target.value })
            }
            required
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2
                       text-xs md:text-sm text-white placeholder:text-slate-500
                       focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
          />
          <input
            type="text"
            placeholder="NPWP / Tax ID"
            value={form.tax_id}
            onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2
                       text-xs md:text-sm text-white placeholder:text-slate-500
                       focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
          />
          <input
            type="text"
            placeholder="Bidang usaha"
            value={form.businessfield}
            onChange={(e) =>
              setForm({ ...form, businessfield: e.target.value })
            }
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2
                       text-xs md:text-sm text-white placeholder:text-slate-500
                       focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
          />
          <input
            type="text"
            placeholder="PIC name"
            value={form.pic_name}
            onChange={(e) => setForm({ ...form, pic_name: e.target.value })}
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2
                       text-xs md:text-sm text-white placeholder:text-slate-500
                       focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
          />

          <input
            type="text"
            placeholder="Telepon"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2
                       text-xs md:text-sm text-white placeholder:text-slate-500
                       focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2
                       text-xs md:text-sm text-white placeholder:text-slate-500
                       focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
          />
          <input
            type="text"
            placeholder="Alamat"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2
                       text-xs md:text-sm text-white placeholder:text-slate-500
                       focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
          />
          <input
            type="text"
            placeholder="Sales name"
            value={form.salesname}
            onChange={(e) => setForm({ ...form, salesname: e.target.value })}
            className="w-full rounded-md bg-black/40 border border-white/10 px-3 py-2
                       text-xs md:text-sm text-white placeholder:text-slate-500
                       focus:outline-none focus:ring-1 focus:ring-[#ff4600]"
          />

          <div className="md:col-span-4 flex justify-end mt-1">
            <button
              type="submit"
              disabled={saving}
              className="w-full md:w-auto rounded-lg bg-[#ff4600] hover:bg-[#ff5f24]
                         text-white text-xs md:text-sm font-semibold px-6 py-2
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? "Menyimpan…" : "Tambah Pelanggan"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

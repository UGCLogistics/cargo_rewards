"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "context/AuthContext";
import supabase from "lib/supabaseClient";
import MembershipCard from "components/MembershipCard";
import type { LucideIcon } from "lucide-react";
import {
  LineChart,
  ListChecks,
  Users,
  IdCard,
  SlidersHorizontal,
  ShieldCheck,
  FileSpreadsheet,
  ClipboardList,
  Building2,
  User as UserIcon,
} from "lucide-react";

type Role = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";

type Shortcut = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export default function DashboardHome() {
  const { user } = useAuth();

  const [company, setCompany] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rawRole = (user?.user_metadata as any)?.role as string | undefined;
  const role: Role = (rawRole ? rawRole.toUpperCase() : "CUSTOMER") as Role;

  // Ambil nama perusahaan dari metadata / tabel users
  useEffect(() => {
    const fetchCompany = async () => {
      if (!user) return;
      try {
        const metaCompany = (user.user_metadata as any)?.companyname;
        if (metaCompany) {
          setCompany(metaCompany);
          return;
        }

        const { data, error } = await supabase
          .from("users")
          .select("companyname")
          .eq("id", user.id)
          .single();

        if (error) {
          setError("Gagal memuat data perusahaan");
          return;
        }

        setCompany(data?.companyname ?? null);
      } catch {
        setError("Gagal memuat data perusahaan");
      }
    };

    fetchCompany();
  }, [user]);

  const today = new Date().toLocaleDateString("id-ID", { dateStyle: "full" });
  const name = user?.user_metadata?.name || user?.email || "";
  const companyName =
    company || (user?.user_metadata as any)?.companyname || "-";

  // ===========================
  // Shortcuts untuk INTERNAL
  // ===========================
  let shortcuts: Shortcut[] = [];

  if (role === "ADMIN") {
    shortcuts = [
      {
        href: "/dashboard/admin/internal-kpi",
        label: "Dashboard",
        description: "Lihat performa program C.A.R.G.O Rewards secara global.",
        icon: LineChart,
      },
      {
        href: "/dashboard/transactions",
        label: "History Transaksi Customer",
        description: "Monitor dan validasi transaksi yang masuk.",
        icon: ListChecks,
      },
      {
        href: "/dashboard/admin/customers",
        label: "Data Pelanggan",
        description: "Kelola profil customer dan penanggung jawab.",
        icon: Users,
      },
      {
        href: "/dashboard/admin/membership",
        label: "Membership",
        description: "Pantau tier dan status keanggotaan pelanggan.",
        icon: IdCard,
      },
      {
        href: "/dashboard/admin/program-config",
        label: "Konfigurasi Program",
        description: "Atur rules diskon, cashback, dan poin.",
        icon: SlidersHorizontal,
      },
      {
        href: "/dashboard/admin/approve-redeem",
        label: "Approval Redeem",
        description: "Proses pengajuan redeem poin & cashback.",
        icon: ShieldCheck,
      },
      {
        href: "/dashboard/admin/import",
        label: "Impor Transaksi",
        description: "Upload file CSV/XLSX transaksi pelanggan.",
        icon: FileSpreadsheet,
      },
      {
        href: "/dashboard/admin/audit-logs",
        label: "Audit Log",
        description: "Lihat jejak perubahan & aktivitas penting.",
        icon: ClipboardList,
      },
    ];
  } else if (role === "MANAGER") {
    shortcuts = [
      {
        href: "/dashboard/manager/internal-kpi",
        label: "Dashbord",
        description: "Ringkasan performa bisnis & rewards.",
        icon: LineChart,
      },
      {
        href: "/dashboard/transactions",
        label: "History Transaksi Customer",
        description: "Review transaksi & pola revenue customer.",
        icon: ListChecks,
      },
      {
        href: "/dashboard/manager/customers",
        label: "Data Pelanggan",
        description: "Lihat portofolio customer per sales.",
        icon: Building2,
      },
      {
        href: "/dashboard/manager/membership",
        label: "Membership",
        description: "Monitoring tier & aktivitas membership.",
        icon: IdCard,
      },
      {
        href: "/dashboard/manager/approve-redeem",
        label: "Approval Redeem",
        description: "Setujui atau tolak permintaan redeem.",
        icon: ShieldCheck,
      },
      {
        href: "/dashboard/manager/program-config",
        label: "Konfigurasi Program",
        description: "Sesuaikan parameter program rewards.",
        icon: SlidersHorizontal,
      },
    ];
  } else if (role === "STAFF") {
    shortcuts = [
      {
        href: "/dashboard/staff/internal-kpi",
        label: "Dashboard",
        description: "Ringkasan performa bisnis & rewards.",
        icon: LineChart,
      },
      {
        href: "/dashboard/transactions",
        label: "History Transaksi Customer",
        description: "cek transaksi customer.",
        icon: ListChecks,
      },
      {
        href: "/dashboard/account/info",
        label: "Profil Akun",
        description: "Perbarui informasi akun dan kontak Anda.",
        icon: UserIcon,
      },
    ];
  }

  return (
    <div className="space-y-4">
      {/* HEADER (semua role) */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">
          C.A.R.G.O Rewards
        </p>
        <h1 className="text-xl md:text-2xl font-semibold">Hi, {name}</h1>
        <p className="text-sm text-slate-300">{companyName}</p>
        <p className="text-xs text-[var(--accent)]">{today}</p>
        {error && (
          <p className="text-xs text-red-400 mt-1">
            {error}
          </p>
        )}
      </div>

      {/* CUSTOMER: judul + kartu membership rata kiri dengan lebar dibatasi */}
      {role === "CUSTOMER" && (
        <section className="space-y-3">
          <h2 className="text-sm md:text-base font-semibold">
            Kartu Membership Digital
          </h2>

          <div className="w-full max-w-4x1 md:max-w-4x1">
            <MembershipCard />
          </div>
        </section>
      )}

      {/* INTERNAL ROLES: shortcut cards */}
      {role !== "CUSTOMER" && shortcuts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm md:text-base font-semibold">
            Shortcut Utama
          </h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
            Akses cepat ke modul yang paling sering digunakan sesuai peran
            Anda di program C.A.R.G.O Rewards.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shortcuts.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="glass rounded-2xl px-3 py-3 md:px-4 md:py-4 flex items-start gap-3 hover:bg-white/10 transition-colors"
                >
                  <div className="mt-1">
                    <Icon className="w-5 h-5 md:w-6 md:h-6 text-[var(--accent)]" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-semibold mb-1">
                      {item.label}
                    </h3>
                    <p className="text-xs md:text-sm text-slate-300">
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

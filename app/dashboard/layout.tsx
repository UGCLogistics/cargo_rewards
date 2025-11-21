"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import supabase from "../../lib/supabaseClient";
import type { LucideIcon } from "lucide-react";
import {
  Home,
  ListChecks,
  BadgePercent,
  Gift,
  User,
  Settings,
  Users,
  SlidersHorizontal,
  FileSpreadsheet,
  Building2,
  UserPlus,
  ShieldCheck,
  LineChart,
  IdCard,
  ClipboardList,
  CheckCircle,
  GitGraphIcon,
  ListFilterPlusIcon,
  LineChartIcon,
  HomeIcon,
  FileLineChartIcon,
  IdCardIcon,
  LogOutIcon,
} from "lucide-react";

type Role = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const rawRole = (user?.user_metadata as any)?.role as string | undefined;
  const role: Role = (rawRole ? rawRole.toUpperCase() : "CUSTOMER") as Role;

  const [companyName, setCompanyName] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const name = user?.user_metadata?.name || user?.email || "";

  // Ambil nama perusahaan (metadata → fallback ke tabel public.users)
  useEffect(() => {
    const getCompany = async () => {
      if (!user) return;
      const metaCompany = (user.user_metadata as any)?.companyname;
      if (metaCompany) {
        setCompanyName(metaCompany);
      } else {
        try {
          const { data, error } = await supabase
            .from("users")
            .select("companyname")
            .eq("id", user.id)
            .single();
          if (!error) setCompanyName(data?.companyname || "");
        } catch {
          // abaikan error kecil
        }
      }
    };
    getCompany();
  }, [user]);

  // Item umum bagian bawah (akun)
  const accountItems: NavItem[] = [
    { href: "/dashboard/account/info", label: "Account Info", icon: User },
    {
      href: "/dashboard/account/settings",
      label: "Pengaturan Akun",
      icon: Settings,
    },
  ];

  let navItems: NavItem[] = [];

  // =========================
  // MENU PER ROLE
  // =========================

  if (role === "ADMIN") {
    // INTERNAL - ADMIN: semua akses, TAPI TIDAK ADA REDEEM CUSTOMER DI MENU
    navItems = [
      {
        href: "/dashboard",
        label: "Home",
        icon: HomeIcon,
      },
      {
        href: "/dashboard/admin/internal-kpi",
        label: "Dashboard",
        icon: LineChartIcon,
      },
      {
        href: "/dashboard/transactions",
        label: "Transaksi Customer",
        icon: ListChecks,
      },
      {
        href: "/dashboard/admin/customers",
        label: "Data Pelanggan",
        icon: Building2,
      },
      {
        href: "/dashboard/admin/membership",
        label: "Membership",
        icon: IdCard,
      },
      {
        href: "/dashboard/admin/rewards-engine",
        label: "Re-generate Rewards",
        icon: CheckCircle,
      },
      {
        href: "/dashboard/admin/program-config",
        label: "Konfigurasi Program",
        icon: SlidersHorizontal,
      },
      {
        href: "/dashboard/admin/import",
        label: "Impor Transaksi",
        icon: FileSpreadsheet,
      },
      {
        href: "/dashboard/admin/users",
        label: "Manajemen User",
        icon: Users,
      },
      {
        href: "/dashboard/admin/users/create",
        label: "Tambah User",
        icon: UserPlus,
      },
      {
        href: "/dashboard/admin/approve-redeem",
        label: "Approval Redeem",
        icon: ShieldCheck,
      },
      {
        href: "/dashboard/admin/audit-logs",
        label: "Audit Log",
        icon: ClipboardList,
      },
      ...accountItems,
    ];
  } else if (role === "MANAGER") {
    // INTERNAL - MANAGER: TIDAK ADA REDEEM CUSTOMER DI MENU
    navItems = [
      {
        href: "/dashboard",
        label: "Home",
        icon: HomeIcon,
      },
      {
        href: "/dashboard/manager/internal-kpi",
        label: "Dashboard",
        icon: LineChartIcon,
      },
      {
        href: "/dashboard/transactions",
        label: "Transaksi Customer",
        icon: ListChecks,
      },
      {
        href: "/dashboard/manager/customers",
        label: "Data Pelanggan",
        icon: Building2,
      },
      {
        href: "/dashboard/manager/membership",
        label: "Membership",
        icon: IdCard,
      },
      {
        href: "/dashboard/manager/program-config",
        label: "Konfigurasi Program",
        icon: SlidersHorizontal,
      },
      {
        href: "/dashboard/manager/approve-redeem",
        label: "Approval Redeem",
        icon: ShieldCheck,
      },
      ...accountItems,
    ];
  } else if (role === "STAFF") {
    // INTERNAL - STAFF: fokus ke dashboard & transaksi saja, TANPA menu redeem
    navItems = [
      {
        href: "/dashboard",
        label: "Home",
        icon: HomeIcon,
      },
      {
        href: "/dashboard/staff/internal-kpi",
        label: "Dashboard",
        icon: LineChartIcon,
      },
      {
        href: "/dashboard/transactions",
        label: "Transaksi Customer",
        icon: ListChecks,
      },
      ...accountItems,
    ];
  } else {
    // EXTERNAL - CUSTOMER: punya Riwayat Rewards & Penukaran Poin
    navItems = [
      {
        href: "/dashboard",
        label: "Digital Card",
        icon: IdCardIcon,
      },
      {
        href: "/dashboard/customer/external-kpi",
        label: "Dashboard",
        icon: LineChartIcon,
      },
      {
        href: "/dashboard/transactions",
        label: "Riwayat Transaksi",
        icon: ListChecks,
      },
      {
        href: "/dashboard/rewards",
        label: "Riwayat Rewards",
        icon: BadgePercent,
      },
      {
        href: "/dashboard/redeem",
        label: "Penukaran Poin",
        icon: Gift,
      },
      ...accountItems,
    ];
  }

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error during sign out:", error);
    } finally {
      // Setelah logout, paksa ke landing page
      router.replace("/");
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--text)]">
      {/* SIDEBAR */}
      <aside
        className={`glass sticky top-0 h-screen flex flex-col shrink-0 p-3 sm:p-4 transition-all duration-300 ease-in-out ${
          collapsed ? "w-16 sm:w-16" : "w-60 sm:w-64"
        }`}
      >
        {/* Header + collapse button */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div
            className={`flex flex-col ${
              collapsed ? "items-center text-center" : "items-start"
            }`}
          >
            <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-slate-400">
              UGC
            </span>
            {!collapsed && (
              <>
                <span className="text-sm font-semibold">UGC Logistics</span>
                {name && <span className="text-xs">{name}</span>}
                {companyName && (
                  <span className="text-[11px] text-slate-400">
                    {companyName}
                  </span>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="glass border border-white/10 rounded-full w-7 h-7 flex items-center justify-center text-[11px] hover:bg-white/10"
            aria-label={collapsed ? "Buka menu" : "Tutup menu"}
          >
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Label kategori menu: INTERNAL vs CUSTOMER */}
        <div className="mt-1 mb-1">
          {!collapsed && (
            <p className="px-1 text-[10px] uppercase tracking-wide text-slate-500">
              {role === "CUSTOMER" ? "Menu Customer" : "Menu Internal"}
            </p>
          )}
        </div>

        {/* NAV - scrollable */}
        <nav className="mt-1 flex-1 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center rounded-lg px-2 py-2 text-xs md:text-sm transition-colors
                  ${
                    collapsed
                      ? "justify-center"
                      : "justify-start gap-2 md:gap-3"
                  }
                  ${
                    active
                      ? "bg-[#ff4600]/15 text-[#ff4600]"
                      : "text-slate-200 hover:bg-white/5"
                  }
                `}
                aria-label={item.label}
              >
                <Icon
                  className="w-4 h-4 md:w-5 md:h-5"
                  color={active ? "#ff4600" : "#ffffff"}
                />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer & Logout */}
        <div className="pt-3 mt-3 border-t border-white/10 text-[10px] md:text-xs">
          {!collapsed && user && (
            <p className="mb-2 opacity-70 leading-snug">
              Masuk sebagai:
              <br />
              {user.email}
            </p>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg bg-[#ff4600] text-white py-2 flex items-center justify-center hover:bg-[#ff5f24] transition"
            aria-label="Logout"
          >
            <LogOutIcon className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </aside>

      {/* KONTEN */}
      <main className="flex-1 min-w-0 px-3 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-x-hidden">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}

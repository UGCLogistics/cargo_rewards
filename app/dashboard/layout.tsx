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

const UGC_FULL_LOGO =
  "https://mhzymxqcfrmswjdydtbt.supabase.co/storage/v1/object/public/graphics/logo/logougcorangewhite.png";
const UGC_ICON_LOGO =
  "https://mhzymxqcfrmswjdydtbt.supabase.co/storage/v1/object/public/graphics/logo/ugclogo.png";

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

  const displayedName = user?.user_metadata?.name || user?.email || "";

  // ambil nama perusahaan
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
          // ignore
        }
      }
    };
    getCompany();
  }, [user]);

  const accountItems: NavItem[] = [
    { href: "/dashboard/account/info", label: "Account Info", icon: User },
    {
      href: "/dashboard/account/settings",
      label: "Pengaturan Akun",
      icon: Settings,
    },
  ];

  let navItems: NavItem[] = [];

  if (role === "ADMIN") {
    navItems = [
      { href: "/dashboard", label: "Home", icon: HomeIcon },
      {
        href: "/dashboard/admin/internal-kpi",
        label: "Dashboard",
        icon: LineChartIcon,
      },
      {
        href: "/dashboard/admin/import",
        label: "Impor Transaksi",
        icon: FileSpreadsheet,
      },
      {
        href: "/dashboard/transactions",
        label: "Transaksi Customer",
        icon: ListChecks,
      },
      {
        href: "/dashboard/admin/approve-redeem",
        label: "Approval Redeem",
        icon: ShieldCheck,
      },
      {
        href: "/dashboard/rewards",
        label: "Riwayat Rewards",
        icon: BadgePercent,
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
        href: "/dashboard/admin/audit-logs",
        label: "Audit Log",
        icon: ClipboardList,
      },
      {
        href: "/dashboard/admin/program-config",
        label: "Konfigurasi Program",
        icon: SlidersHorizontal,
      },
      ...accountItems,
    ];
  } else if (role === "MANAGER") {
    navItems = [
      { href: "/dashboard", label: "Home", icon: HomeIcon },
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
        href: "/dashboard/manager/approve-redeem",
        label: "Approval Redeem",
        icon: ShieldCheck,
      },
      {
        href: "/dashboard/rewards",
        label: "Riwayat Rewards",
        icon: BadgePercent,
      },
      {
        href: "/dashboard/manager/program-config",
        label: "Konfigurasi Program",
        icon: SlidersHorizontal,
      },
      ...accountItems,
    ];
  } else if (role === "STAFF") {
    navItems = [
      { href: "/dashboard", label: "Home", icon: HomeIcon },
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
      {
        href: "/dashboard/rewards",
        label: "Riwayat Rewards",
        icon: BadgePercent,
      },
      ...accountItems,
    ];
  } else {
    navItems = [
      { href: "/dashboard", label: "Digital Card", icon: IdCardIcon },
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
      router.replace("/");
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--text)]">
      {/* SIDEBAR */}
      <aside
        className={`glass sticky top-0 h-screen shrink-0 transition-all duration-300 ease-in-out ${
          collapsed ? "w-16 sm:w-16" : "w-60 sm:w-64"
        }`}
      >
        <div className="flex h-full flex-col px-3 pt-3 pb-10 sm:px-4 sm:pt-4 sm:pb-12">
          {/* atas: header + nav */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* HEADER BRAND + TOGGLE */}
            <div className="mb-3 flex items-center gap-2">
              <div className="flex items-center gap-2">
                <img
                  src={collapsed ? UGC_ICON_LOGO : UGC_FULL_LOGO}
                  alt="UGC Logistics"
                  className={
                    collapsed
                      ? "h-8 w-8 shrink-0 object-contain"
                      : "h-8 w-auto shrink-0 object-contain"
                  }
                />
                {!collapsed && (
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                      C.A.R.G.O Rewards
                    </span>
                    <span className="text-[11px] text-slate-400">
                      UGC Logistics
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/20 text-[11px] text-slate-200 hover:bg-white/10"
                aria-label={collapsed ? "expand" : "collapse"}
              >
                {collapsed ? "›" : "‹"}
              </button>
            </div>

            {/* INFO USER */}
            {!collapsed && (
              <div className="mb-3 space-y-0.5 text-left">
                {displayedName && (
                  <p className="text-xs font-semibold text-slate-50">
                    {displayedName}
                  </p>
                )}
                {companyName && (
                  <p className="text-[11px] text-slate-400">
                    {companyName}
                  </p>
                )}
                {user?.email && (
                  <p className="text-[10px] text-slate-500">{user.email}</p>
                )}
              </div>
            )}

            {!collapsed && (
              <div className="mb-1 mt-1">
                <p className="px-1 text-[10px] uppercase tracking-wide text-slate-500">
                  {role === "CUSTOMER" ? "Menu Customer" : "Menu Internal"}
                </p>
              </div>
            )}

            {/* NAV */}
            <nav className="mt-1 flex-1 space-y-1 overflow-y-auto glass-scroll">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center rounded-lg px-2 py-2 text-xs md:text-sm transition-colors ${
                      collapsed
                        ? "justify-center"
                        : "justify-start gap-2 md:gap-3"
                    } ${
                      active
                        ? "bg-[#ff4600]/15 text-[#ff4600]"
                        : "text-slate-200 hover:bg-white/5"
                    }`}
                    aria-label={item.label}
                  >
                    <Icon
                      className="h-4 w-4 md:h-5 md:w-5"
                      color={active ? "#ff4600" : "#ffffff"}
                    />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* FOOTER SIDEBAR */}
          <footer className="mt-2 shrink-0 border-t border-white/10 pt-3 text-[10px] md:text-xs">
            <button
              type="button"
              onClick={handleLogout}
              className={`flex items-center justify-center rounded-lg bg-[#ff4600] text-white transition hover:bg-[#ff5f24] ${
                collapsed ? "mx-auto h-9 w-9" : "w-full py-2"
              }`}
              aria-label="Logout"
            >
              <LogOutIcon className="h-4 w-4 md:h-5 md:w-5" />
            </button>

            {!collapsed && (
              <div className="mt-3 text-left text-[9px] text-slate-500">
                <div className="mb-1 lowercase tracking-[0.2em]">
                  presented by
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <img
                    src={UGC_FULL_LOGO}
                    alt="UGC Logistics"
                    className="h-9 w-auto object-contain"
                  />
                </div>
                <div className="font-bold text-[10px] text-[#ff4600]">
                  PT UTAMA GLOBALINDO CARGO &copy; 2025
                </div>
              </div>
            )}
          </footer>
        </div>
      </aside>

      {/* KONTEN KANAN – punya scroll sendiri + padding bawah */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto overflow-x-hidden px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6 pb-12">
          {children}
        </div>
      </main>
    </div>
  );
}

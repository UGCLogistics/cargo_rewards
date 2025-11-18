"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "context/AuthContext";
import supabase from "lib/supabaseClient";
import MembershipCard from "components/MembershipCard";

interface KpiData {
  total_transactions: number;
  total_publish_rate: number;
  total_discount: number;
  total_cashback: number;
  total_points: number;
}

export default function DashboardHome() {
  const { user } = useAuth();
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const role = (user?.user_metadata as any)?.role || "CUSTOMER";

  // Ambil KPI
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      let endpoint = "/api/customer/kpi";
      if (role === "ADMIN") endpoint = "/api/admin/kpi";
      else if (role === "MANAGER") endpoint = "/api/manager/kpi";
      else if (role === "STAFF") endpoint = "/api/staff/kpi";

      try {
        setLoading(true);
        setError(null);
        const res = await fetch(endpoint);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat KPI");
        setKpi(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, role]);

  // Ambil nama perusahaan
  useEffect(() => {
    const fetchCompany = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("users")
          .select("companyname")
          .eq("id", user.id)
          .single();
        if (!error) {
          setCompany(data?.companyname ?? null);
        }
      } catch {
        // abaikan
      }
    };
    fetchCompany();
  }, [user]);

  const today = new Date().toLocaleDateString("id-ID", {
    dateStyle: "full",
  });
  const name = user?.user_metadata?.name || user?.email || "";
  const companyName =
    company || (user?.user_metadata as any)?.companyname || "-";

  // Quick links
  const quickLinks: { href: string; label: string; description: string }[] = [
    {
      href: "/dashboard/transactions",
      label: "Transaksi",
      description: "Kelola dan lihat transaksi Anda",
    },
    {
      href: "/dashboard/rewards",
      label: "Poin & Ledger",
      description: "Lihat saldo poin dan riwayat",
    },
    {
      href: "/dashboard/redeem",
      label: "Redeem",
      description: "Tukarkan poin Anda",
    },
  ];

  let kpiLink = "/dashboard/customer/external-kpi";
  if (role === "ADMIN") kpiLink = "/dashboard/admin/internal-kpi";
  else if (role === "MANAGER") kpiLink = "/dashboard/manager/internal-kpi";
  else if (role === "STAFF") kpiLink = "/dashboard/staff/internal-kpi";
  quickLinks.push({
    href: kpiLink,
    label: "KPI",
    description: "Lihat analitik kinerja",
  });

  return (
    <div className="space-y-6">
      {/* Header + kartu membership */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1.1fr)] items-start">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">
            C.A.R.G.O Rewards
          </p>
          <h1 className="text-xl md:text-2xl font-semibold">Hi, {name}</h1>
          <p className="text-sm text-slate-300">{companyName}</p>
          <p className="text-xs text-[var(--accent)]">{today}</p>
          {error && (
            <p className="text-xs text-red-400 mt-2">{error}</p>
          )}
        </div>
        <div className="glass rounded-2xl p-3 sm:p-4">
          <MembershipCard />
        </div>
      </div>

      {/* KPI */}
      <section className="space-y-3">
        <h2 className="text-sm md:text-base font-semibold">
          Ringkasan KPI
        </h2>
        {loading || !kpi ? (
          <p className="text-xs md:text-sm text-slate-400">
            Memuat ringkasan KPI…
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="glass rounded-2xl px-3 py-3 md:px-4 md:py-4 flex flex-col gap-1">
              <span className="text-xs text-slate-400">Transaksi</span>
              <span className="text-base md:text-lg font-semibold">
                {kpi.total_transactions?.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="glass rounded-2xl px-3 py-3 md:px-4 md:py-4 flex flex-col gap-1">
              <span className="text-xs text-slate-400">
                Publish Rate
              </span>
              <span className="text-base md:text-lg font-semibold">
                {kpi.total_publish_rate?.toLocaleString("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="glass rounded-2xl px-3 py-3 md:px-4 md:py-4 flex flex-col gap-1">
              <span className="text-xs text-slate-400">Diskon</span>
              <span className="text-base md:text-lg font-semibold">
                {kpi.total_discount?.toLocaleString("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="glass rounded-2xl px-3 py-3 md:px-4 md:py-4 flex flex-col gap-1">
              <span className="text-xs text-slate-400">Cashback</span>
              <span className="text-base md:text-lg font-semibold">
                {kpi.total_cashback?.toLocaleString("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="glass rounded-2xl px-3 py-3 md:px-4 md:py-4 flex flex-col gap-1">
              <span className="text-xs text-slate-400">Poin</span>
              <span className="text-base md:text-lg font-semibold">
                {kpi.total_points?.toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Quick links */}
      <section className="space-y-3">
        <h2 className="text-sm md:text-base font-semibold">
          Menu Utama
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="glass rounded-2xl px-3 py-3 md:px-4 md:py-4 block hover:bg-white/10 transition-colors"
            >
              <h3 className="text-sm md:text-base font-semibold text-[var(--accent)] mb-1">
                {link.label}
              </h3>
              <p className="text-xs md:text-sm text-slate-300">
                {link.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

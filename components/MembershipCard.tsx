"use client";

import { useEffect, useState, useRef } from "react";
import html2canvas from "html2canvas";
import { useAuth } from "../context/AuthContext";
import supabase from "../lib/supabaseClient";

type Profile = {
  companyname?: string;
  created_at?: string;
};

type Tier = "SILVER" | "GOLD" | "PLATINUM";

interface MembershipSummary {
  tier: Tier;
  totalSpending3M: number;
  periodStart: string; // ISO yyyy-mm-dd
  periodEnd: string;   // ISO yyyy-mm-dd
}

const POINT_VALUE_IDR = 250; // 1 poin = Rp 250

/**
 * Helper: hitung tier berdasarkan total transaksi 3 bulan terakhir.
 * SILVER  : default
 * GOLD    : >= 50 juta
 * PLATINUM: >= 150 juta
 *
 * SESUAIKAN angka threshold ini dengan kebijakan program kamu.
 */
function getTierFromSpending(totalSpending: number): Tier {
  if (totalSpending >= 150_000_000) return "PLATINUM";
  if (totalSpending >= 50_000_000) return "GOLD";
  return "SILVER";
}

export default function MembershipCard() {
  const { user } = useAuth();
  const [points, setPoints] = useState<number>(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // metadata & role bisa dihitung walau user belum ada
  const metadata = user?.user_metadata || {};
  const rawRole = (metadata.role as string | undefined) || "CUSTOMER";
  const role = rawRole.toUpperCase();

  // -----------------------------
  // 1) Load profile (company, created_at) dari tabel users
  // -----------------------------
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("companyname, created_at")
          .eq("id", user.id)
          .single();

        if (!error) setProfile(data as Profile);
      } catch {
        // abaikan error kecil
      }
    };

    loadProfile();
  }, [user]);

  // -----------------------------
  // 2) Load total poin customer dari reward_ledgers
  // -----------------------------
  useEffect(() => {
    if (!user) return;

    const loadPoints = async () => {
      try {
        const { data, error } = await supabase
          .from("reward_ledgers") // pastikan nama tabel ini sama persis dengan di Supabase
          .select("points")
          .eq("user_id", user.id);

        if (error) throw error;

        const total =
          (data || []).reduce(
            (sum: number, row: any) => sum + (Number(row.points) || 0),
            0
          ) || 0;

        setPoints(total);
      } catch (e) {
        console.error("Gagal load points:", e);
      }
    };

    loadPoints();
  }, [user]);

  // -----------------------------
  // 3) Hitung total transaksi 3 bulan terakhir & tier
  //    via /api/customer/kpi/detail
  // -----------------------------
  useEffect(() => {
    if (!user) return;

    const loadMembership = async () => {
      try {
        const today = new Date();

        // end = hari ini
        const periodEnd = today.toISOString().slice(0, 10);

        // start = 3 bulan ke belakang (rolling 3 bulan)
        const startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - 3);
        const periodStart = startDate.toISOString().slice(0, 10);

        const params = new URLSearchParams();
        params.set("start", periodStart);
        params.set("end", periodEnd);

        const res = await fetch(
          `/api/customer/kpi/detail?${params.toString()}`
        );
        if (!res.ok) return;

        const json = await res.json();

        // Diasumsikan API mengembalikan array dengan field total_publish
        // (sum(publish_rate) as total_publish). Jika namanya berbeda,
        // sesuaikan di reduce di bawah.
        const totalSpending3M = (json.data || []).reduce(
          (sum: number, row: any) =>
            sum + (row.total_publish ?? row.total_revenue ?? 0),
          0
        );

        const tier = getTierFromSpending(totalSpending3M);

        setMembership({
          tier,
          totalSpending3M,
          periodStart,
          periodEnd,
        });
      } catch {
        // abaikan error kecil
      }
    };

    loadMembership();
  }, [user]);

  // Kalau belum login atau bukan CUSTOMER (internal tidak punya kartu)
  if (!user || role !== "CUSTOMER") {
    return null;
  }

  // -----------------------------
  // Derived display values
  // -----------------------------
  const name = metadata.name || user.email;
  const company =
    profile?.companyname || (metadata as any).companyname || "-";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("id-ID", {
        dateStyle: "medium",
      })
    : "-";

  const tier: Tier = membership?.tier ?? "SILVER";
  const totalSpending3M = membership?.totalSpending3M ?? 0;

  const tierColor =
    tier === "PLATINUM"
      ? "#e5e4e2"
      : tier === "GOLD"
      ? "#d4af37"
      : "#c0c0c0";

  const memberId = user.id?.substring(0, 8).toUpperCase();

  const pointValueIdr = points * POINT_VALUE_IDR;

  const periodLabel =
    membership &&
    `${new Date(membership.periodStart).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    })} - ${new Date(membership.periodEnd).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    })}`;

  // -----------------------------
  // Export kartu ke PNG
  // -----------------------------
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const element = cardRef.current;
      if (!element) return;
      const canvas = await html2canvas(element, { backgroundColor: null });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `membership_card_${memberId}.png`;
      link.click();
    } catch (e) {
      console.error("Failed to export card", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div
        ref={cardRef}
        className="glass rounded-xl p-4 text-[var(--text)] border-2 shadow-md"
        style={{ borderColor: tierColor }}
      >
        {/* Header logo + tier */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-slate-400">
              UGC Logistics
            </p>
            <p className="text-xs text-slate-400">Membership Card</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase text-slate-400">Tier</p>
            <p className="text-sm font-semibold" style={{ color: tierColor }}>
              {tier}
            </p>
          </div>
        </div>

        {/* Nama & perusahaan */}
        <div className="mb-3">
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-slate-300">
            Perusahaan: <span className="font-normal">{company}</span>
          </p>
          <p className="text-xs text-slate-300">
            ID Member: <span className="font-mono">{memberId}</span>
          </p>
        </div>

        {/* Info tambahan */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-slate-400">
              Member Sejak
            </p>
            <p className="text-sm">{memberSince}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-slate-400">
              Periode Penilaian
            </p>
            <p className="text-[11px] leading-tight">
              {periodLabel || "-"}
            </p>
          </div>
        </div>

        {/* Transaksi 3 bulan & poin */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-slate-400">
              Total Transaksi 3 Bulan
            </p>
            <p className="text-sm">
              Rp {totalSpending3M.toLocaleString("id-ID")}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-slate-400">
              Total Poin
            </p>
            <p className="text-lg font-semibold text-[var(--accent)]">
              {points.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-slate-400">
              Estimasi nilai: Rp{" "}
              {pointValueIdr.toLocaleString("id-ID")}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={exporting}
        className="w-full rounded-lg border border-white/15 bg-white/5 py-2 text-[11px] font-medium hover:bg-white/10 disabled:opacity-60"
      >
        {exporting ? "Mengekspor…" : "Unduh Kartu PNG"}
      </button>
    </div>
  );
}

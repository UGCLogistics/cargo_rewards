"use client";

import { useEffect, useState, useRef } from "react";
import html2canvas from "html2canvas";
import { useAuth } from "../context/AuthContext";
import supabase from "../lib/supabaseClient";

type Profile = {
  companyname?: string;
  member_since?: string; // tanggal transaksi pertama
};

type Tier = "SILVER" | "GOLD" | "PLATINUM";

interface MembershipSummary {
  tier: Tier;
  totalSpending3M: number;
  periodStart: string; // ISO yyyy-mm-dd
  periodEnd: string;   // ISO yyyy-mm-dd
}

const POINT_VALUE_IDR = 250; // 1 poin = Rp 250

function getTierFromSpending(totalSpending: number): Tier {
  if (totalSpending >= 150_000_000) return "PLATINUM";
  if (totalSpending >= 50_000_000) return "GOLD";
  return "SILVER";
}

export default function MembershipCard() {
  const { user } = useAuth();
  const [points, setPoints] = useState<number>(0); // poin SISA
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const metadata = user?.user_metadata || {};
  const rawRole = (metadata.role as string | undefined) || "CUSTOMER";
  const role = rawRole.toUpperCase();

  // 1) Profile user (company & member since = transaksi pertama)
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const [userRes, firstTrxRes] = await Promise.all([
          supabase
            .from("users")
            .select("companyname")
            .eq("id", user.id)
            .single(),
          supabase
            .from("transactions")
            .select("date")
            .eq("user_id", user.id)
            .order("date", { ascending: true })
            .limit(1),
        ]);

        const companyname = userRes.data?.companyname ?? undefined;
        const member_since =
          firstTrxRes.data && firstTrxRes.data.length > 0
            ? firstTrxRes.data[0].date
            : undefined;

        setProfile({ companyname, member_since });
      } catch (e) {
        console.error("Gagal load profile:", e);
      }
    };

    loadProfile();
  }, [user]);

  // 2) Poin sisa (poin belum diredeem)
  useEffect(() => {
    if (!user) return;

    const loadPoints = async () => {
      try {
        // Total poin earned dari semua transaksi
        const { data: txData, error: txError } = await supabase
          .from("transactions")
          .select("points_earned")
          .eq("user_id", user.id);

        if (txError) throw txError;

        const earned =
          (txData || []).reduce(
            (sum: number, row: any) =>
              sum + (Number(row.points_earned) || 0),
            0
          ) || 0;

        // Penyesuaian / redeem dari ledger (points negatif)
        const { data: ledgerData, error: ledgerError } = await supabase
          .from("reward_ledgers")
          .select("type, points")
          .eq("user_id", user.id);

        if (ledgerError) throw ledgerError;

        let redeemedOrAdjust = 0;
        for (const row of ledgerData || []) {
          const type = (row.type || "").toUpperCase();
          const pts = Number(row.points) || 0;

          if ((type === "POINT" || type === "ADJUST") && pts < 0) {
            redeemedOrAdjust += pts; // negatif
          }
        }

        const remainingRaw = earned + redeemedOrAdjust;
        const remaining = remainingRaw > 0 ? remainingRaw : 0;

        setPoints(remaining);
      } catch (e) {
        console.error("Gagal load points tersedia:", e);
      }
    };

    loadPoints();
  }, [user]);

  // 3) Transaksi 3 bulan terakhir & tier (start = max(firstTx, today-3M))
  useEffect(() => {
    if (!user) return;

    const loadMembership = async () => {
      try {
        // Cari transaksi pertama
        const { data: firstTrx, error: firstErr } = await supabase
          .from("transactions")
          .select("date")
          .eq("user_id", user.id)
          .order("date", { ascending: true })
          .limit(1);

        if (firstErr) throw firstErr;

        const today = new Date();
        const todayISO = today.toISOString().slice(0, 10);

        let periodStartDate = new Date(today);
        periodStartDate.setMonth(periodStartDate.getMonth() - 3); // 3 bulan ke belakang

        if (firstTrx && firstTrx.length > 0) {
          const firstDate = new Date(firstTrx[0].date);
          // start = tanggal yang lebih baru antara firstDate & (today - 3 bulan)
          if (firstDate > periodStartDate) {
            periodStartDate = firstDate;
          }
        }

        const periodStartISO = periodStartDate.toISOString().slice(0, 10);

        const { data, error } = await supabase
          .from("transactions")
          .select("publish_rate, date")
          .eq("user_id", user.id)
          .gte("date", periodStartISO)
          .lte("date", todayISO);

        if (error) throw error;

        const totalSpending3M = (data || []).reduce(
          (sum: number, row: any) =>
            sum + (Number(row.publish_rate) || 0),
          0
        );

        const tier = getTierFromSpending(totalSpending3M);

        setMembership({
          tier,
          totalSpending3M,
          periodStart: periodStartISO,
          periodEnd: todayISO,
        });
      } catch (e) {
        console.error("Gagal load membership summary:", e);
      }
    };

    loadMembership();
  }, [user]);

  // Internal tidak punya kartu
  if (!user || role !== "CUSTOMER") {
    return null;
  }

  const name = (metadata as any).name || user.email;
  const company =
    profile?.companyname || (metadata as any).companyname || "-";
  const memberSince = profile?.member_since
    ? new Date(profile.member_since).toLocaleDateString("id-ID", {
        dateStyle: "medium",
      })
    : "-";

  const tier: Tier = membership?.tier ?? "SILVER";
  const totalSpending3M = membership?.totalSpending3M ?? 0;

  const tierColor =
    tier === "PLATINUM"
      ? "#434343ff"
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
              Total Poin Tersedia
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

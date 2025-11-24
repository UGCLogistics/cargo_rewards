"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import html2canvas from "html2canvas";
import { useAuth } from "../context/AuthContext";
import supabase from "../lib/supabaseClient";

import silverCardBg from "./silver.png";
import goldCardBg from "./gold.png";
import platinumCardBg from "./platinum.png";
import ugcLogo from "./logougcorangewhite.png";

type Profile = {
  companyname?: string;
};

type Tier = "SILVER" | "GOLD" | "PLATINUM" | "NEW";

interface MembershipSummary {
  tier: Tier;
  memberSince: string | null;
  lastEvalStart: string | null;
  lastEvalEnd: string | null;
  lastPeriodSpending: number;
  currentStart: string | null;
  currentEnd: string | null;
  lifetimeSpending: number;
}

type PointsInfo = {
  totalEarned: number;    // semua poin yang pernah diperoleh
  totalRedeemed: number;  // poin yang sudah dipakai (cashout/discount/adjust) – angka positif
  remaining: number;      // sisa poin
};

const POINT_VALUE_IDR = 250;

export default function MembershipCard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [pointsInfo, setPointsInfo] = useState<PointsInfo>({
    totalEarned: 0,
    totalRedeemed: 0,
    remaining: 0,
  });
  const [exporting, setExporting] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const metadata = user?.user_metadata || {};
  const rawRole = (metadata.role as string | undefined) || "CUSTOMER";
  const role = rawRole.toUpperCase();

  // ---------- 1) Profile user ----------
  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("companyname")
          .eq("id", user.id)
          .single();
        if (error) throw error;
        const companyname = data?.companyname ?? undefined;
        setProfile({ companyname });
      } catch (e) {
        console.error("Gagal load profile:", e);
      }
    };
    loadProfile();
  }, [user]);

  // ---------- 2) Points (total, redeemed, remaining) ----------
  useEffect(() => {
    if (!user) return;

    const loadPoints = async () => {
      try {
        // 2a. Coba ambil dari reward_ledgers
        let earned = 0;
        let redeemed = 0;

        const { data: ledgerData, error: ledgerError } = await supabase
          .from("reward_ledgers")
          .select("points")
          .eq("user_id", user.id);

        const hasLedger =
          !ledgerError && Array.isArray(ledgerData) && ledgerData.length > 0;

        if (hasLedger) {
          for (const row of ledgerData!) {
            const pts = Number((row as any).points) || 0;
            if (pts > 0) earned += pts;
            else if (pts < 0) redeemed += -pts; // simpan sebagai positif
          }
        } else {
          // 2b. Fallback: dari transactions.points_earned
          const { data: txData, error: txError } = await supabase
            .from("transactions")
            .select("points_earned")
            .eq("user_id", user.id);

          if (!txError && txData && txData.length > 0) {
            earned =
              txData.reduce(
                (sum: number, row: any) =>
                  sum + (Number(row.points_earned) || 0),
                0
              ) || 0;
            redeemed = 0;
          }
        }

        const remaining = Math.max(earned - redeemed, 0);

        setPointsInfo({
          totalEarned: earned,
          totalRedeemed: redeemed,
          remaining,
        });
      } catch (e) {
        console.error("Gagal load points:", e);
      }
    };

    loadPoints();
  }, [user]);

  // ---------- 3) Membership ----------
  useEffect(() => {
    if (!user) return;
    const loadMembership = async () => {
      try {
        const [periodsRes, txRes] = await Promise.all([
          supabase
            .from("membership_periods")
            .select(
              "period_start, period_end, tier, total_spending, prev_period_start, prev_period_end, first_transaction_date"
            )
            .eq("user_id", user.id)
            .order("period_start", { ascending: true }),
          supabase
            .from("transactions")
            .select("publish_rate, date")
            .eq("user_id", user.id),
        ]);

        if (periodsRes.error) throw periodsRes.error;
        if (txRes.error) throw txRes.error;

        const periods = (periodsRes.data || []) as any[];
        const txs = (txRes.data || []) as any[];

        let memberSinceISO: string | null = null;
        if (txs.length > 0) {
          const sortedTx = [...txs].sort((a, b) =>
            String(a.date || "").localeCompare(String(b.date || ""))
          );
          memberSinceISO = sortedTx[0]?.date ?? null;
        } else if (periods.length > 0) {
          memberSinceISO =
            periods[0].first_transaction_date ?? periods[0].period_start ?? null;
        }

        const lifetimeSpending = txs.reduce(
          (sum: number, row: any) =>
            sum + (Number(row.publish_rate) || 0),
          0
        );

        const sortedPeriods = [...periods].sort((a, b) =>
          String(a.period_start || "").localeCompare(
            String(b.period_start || "")
          )
        );

        const count = sortedPeriods.length;
        const currentPeriod = count > 0 ? sortedPeriods[count - 1] : null;
        const previousPeriod = count > 1 ? sortedPeriods[count - 2] : null;

        const tier: Tier =
          currentPeriod && currentPeriod.tier
            ? (String(currentPeriod.tier).toUpperCase() as Tier)
            : "NEW";

        let lastEvalStart: string | null = null;
        let lastEvalEnd: string | null = null;
        let lastPeriodSpending = 0;

        if (currentPeriod) {
          if (currentPeriod.prev_period_start && currentPeriod.prev_period_end) {
            lastEvalStart = currentPeriod.prev_period_start;
            lastEvalEnd = currentPeriod.prev_period_end;
            lastPeriodSpending = Number(currentPeriod.total_spending) || 0;
          } else if (previousPeriod) {
            lastEvalStart = previousPeriod.period_start;
            lastEvalEnd = previousPeriod.period_end;
            lastPeriodSpending = Number(previousPeriod.total_spending) || 0;
          }
        }

        const currentStart: string | null =
          currentPeriod?.period_start ?? null;
        const currentEnd: string | null =
          currentPeriod?.period_end ?? null;

        setMembership({
          tier,
          memberSince: memberSinceISO,
          lastEvalStart,
          lastEvalEnd,
          lastPeriodSpending,
          currentStart,
          currentEnd,
          lifetimeSpending,
        });
      } catch (e) {
        console.error("Gagal load membership:", e);
      }
    };
    loadMembership();
  }, [user]);

  // ---------- 4) Render & export ----------
  if (!user || role !== "CUSTOMER") return null;

  const name = (metadata as any).name || user.email;
  const company =
    profile?.companyname || (metadata as any).companyname || "-";

  const memberSince = membership?.memberSince
    ? new Date(membership.memberSince).toLocaleDateString("id-ID", {
        dateStyle: "medium",
      })
    : "-";

  const tier: Tier = membership?.tier ?? "NEW";
  const tierColor =
    tier === "PLATINUM"
      ? "#ff4600"
      : tier === "GOLD"
      ? "#d4af37"
      : tier === "SILVER"
      ? "#c0c0c0"
      : "#6ddaebff";

  const prettyTierLabel =
    tier === "NEW"
      ? "New"
      : tier.charAt(0) + tier.slice(1).toLowerCase();

  const memberId = user.id?.substring(0, 8).toUpperCase();

  const formatRange = (start?: string | null, end?: string | null) => {
    if (!start || !end) return "-";
    try {
      const startStr = new Date(start).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      });
      const endStr = new Date(end).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      });
      return `${startStr} - ${endStr}`;
    } catch {
      return "-";
    }
  };

  const lastEvalPeriodLabel = formatRange(
    membership?.lastEvalStart,
    membership?.lastEvalEnd
  );
  const currentPeriodLabel = formatRange(
    membership?.currentStart,
    membership?.currentEnd
  );

  const lifetimeSpending =
    membership?.lifetimeSpending != null
      ? membership.lifetimeSpending
      : 0;

  const lastPeriodSpending =
    membership?.lastPeriodSpending != null
      ? membership.lastPeriodSpending
      : 0;

  let bgImage = silverCardBg;
  if (tier === "GOLD") bgImage = goldCardBg;
  if (tier === "PLATINUM") bgImage = platinumCardBg;

  const totalPoints = pointsInfo.totalEarned;
  const pointsRedeemed = pointsInfo.totalRedeemed;
  const pointsAvailable = pointsInfo.remaining;

  const redeemedValueIdr = pointsRedeemed * POINT_VALUE_IDR;
  const availableValueIdr = pointsAvailable * POINT_VALUE_IDR;

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const now = new Date();
      const formatted = now.toLocaleString("id-ID", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setGeneratedAt(formatted);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const element = cardRef.current;
      if (!element) return;

      const scale =
        typeof window !== "undefined" && window.devicePixelRatio
          ? Math.max(2, window.devicePixelRatio)
          : 2;

      const canvas = await html2canvas(element, {
        backgroundColor: null,
        scale,
      });

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `membership_card_${memberId}.png`;
      link.click();
    } catch (e) {
      console.error("Failed to export card", e);
    } finally {
      setGeneratedAt(null);
      setExporting(false);
    }
  };

  return (
    <div className="space-y-2 w-full">
      <div className="grid w-full gap-4 lg:gap-6 grid-cols-[1.22fr_1fr]">
        {/* KIRI: kartu digital, rasio 16:10 (1600x1000) */}
        <div
          ref={cardRef}
          className="relative w-full aspect-[16/10] rounded-xl bg-black/0 overflow-hidden"
        >
          <Image
            src={bgImage}
            alt={`${prettyTierLabel} membership card`}
            fill
            className="object-contain"
            priority
          />

          {/* overlay text */}
          <div className="absolute left-[8%] bottom-[20%] max-w-[70%] flex flex-col gap-1 text-left text-white">
            <p className="text-sm md:text-base font-semibold tracking-wide uppercase">
              {company}
            </p>
            <p className="text-xs font-medium opacity-90">
              {name}
            </p>
            <p className="text-[10px] font-mono opacity-80">
              ID: {memberId}
            </p>
            {generatedAt && (
              <p className="text-[9px] font-mono opacity-75">
                generated at {generatedAt}
              </p>
            )}
          </div>
        </div>

        {/* KANAN: kartu detail */}
        <div className="relative w-full h-full">
          <div
            className="glass rounded-xl px-4 py-3 md:px-5 md:py-4 text-[var(--text)] border-2 shadow-md flex flex-col justify-between w-full h-full"
            style={{ borderColor: tierColor }}
          >
            {/* Header: logo + tier */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Image
                  src={ugcLogo}
                  alt="UGC Logistics"
                  width={72}
                  height={24}
                  className="h-5 w-auto"
                  priority
                />
                <div>
                  <p className="text-[9px] tracking-[0.25em] uppercase text-slate-400">
                    C.A.R.G.O Rewards
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Memberships Card
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-slate-400">
                  Tier Membership
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: tierColor }}
                >
                  {prettyTierLabel}
                </p>
              </div>
            </div>

            {/* Nama & perusahaan */}
            <div className="mb-2">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-[11px] text-slate-300 truncate">
                {company}
              </p>
              <p className="text-[10px] text-slate-400">
                Member ID:{" "}
                <span className="font-mono tracking-wide">
                  {memberId}
                </span>
              </p>
            </div>

            {/* Member since + current period */}
            <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase text-slate-400">
                  Member Since
                </p>
                <p>{memberSince}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase text-slate-400">
                  Current Period
                </p>
                <p className="leading-tight">{currentPeriodLabel}</p>
              </div>
            </div>

            {/* Points summary & lifetime spending */}
            <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase text-slate-400">
                  Points Summary
                </p>
                <div className="space-y-0.5">
                  <p>
                    Total:{" "}
                    <span className="font-semibold">
                      {totalPoints.toLocaleString("id-ID")} pts
                    </span>
                  </p>
                  <p>
                    Redeemed:{" "}
                    <span className="font-semibold">
                      {pointsRedeemed.toLocaleString("id-ID")} pts
                    </span>{" "}
                    (≈ Rp{" "}
                    {redeemedValueIdr.toLocaleString("id-ID", {
                      maximumFractionDigits: 0,
                    })}
                    )
                  </p>
                  <p>
                    Available:{" "}
                    <span className="font-semibold text-[var(--accent)]">
                      {pointsAvailable.toLocaleString("id-ID")} pts
                    </span>{" "}
                    (≈ Rp{" "}
                    {availableValueIdr.toLocaleString("id-ID", {
                      maximumFractionDigits: 0,
                    })}
                    )
                  </p>
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase text-slate-400">
                  Lifetime Spending
                </p>
                <p>
                  Rp {lifetimeSpending.toLocaleString("id-ID")}
                </p>
              </div>
            </div>

            {/* Last evaluation period & last period spending */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase text-slate-400">
                  Last Evaluation Period
                </p>
                <p className="leading-tight">{lastEvalPeriodLabel}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase text-slate-400">
                  Total Last Period Spending
                </p>
                <p>
                  Rp {lastPeriodSpending.toLocaleString("id-ID")}
                </p>
              </div>
            </div>
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

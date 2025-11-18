// lib/rewardsConfig.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type MembershipTier = "SILVER" | "GOLD" | "PLATINUM";

export interface HelloDiscountConfig {
  enabled: boolean;
  first_shipment_only: boolean;
  tiers: {
    code: string;
    label: string;
    min_publish: number;
    max_publish: number | null;
    discount_percent: number; // 5, 10, 15 (bukan 0.05)
  }[];
}

export interface CashbackRulesConfig {
  enabled: boolean;
  window_months: number; // 3
  tiers: {
    code: string;
    label: string;
    min_total: number;
    max_total: number | null;
    cashback_percent: number; // 5, 7.5, ...
  }[];
}

export interface PointsConfig {
  enabled: boolean;
  base_amount_per_point: number; // 10_000
  point_value_rupiah: number;    // 250
  multipliers_by_membership: Record<MembershipTier, number>; // { SILVER:1, ... }
  welcome_bonus_points: Record<MembershipTier, number>;      // { SILVER:1000, ... }
}

export interface MembershipTiersConfig {
  period: string; // "quarter"
  silver: { min_spend: number; max_spend: number | null };
  gold: { min_spend: number; max_spend: number | null };
  platinum: { min_spend: number; max_spend: number | null };
}

export interface ProgramConfigs {
  hello_discount?: HelloDiscountConfig;
  cashback_rules?: CashbackRulesConfig;
  points_config?: PointsConfig;
  membership_tiers?: MembershipTiersConfig;
  membership_benefits?: any;
}

/** Service-role Supabase client untuk dipakai di API route admin */
export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

/** Load semua program_configs → object { key: value } */
export async function loadProgramConfigs(
  client?: SupabaseClient
): Promise<ProgramConfigs> {
  const supabase = client ?? getServiceClient();

  const { data, error } = await supabase
    .from("program_configs")
    .select("key, value");

  if (error) {
    throw new Error(`Failed to load program_configs: ${error.message}`);
  }

  const map: any = {};
  for (const row of data || []) {
    map[row.key] = row.value;
  }
  return map as ProgramConfigs;
}

/** Tentukan tier dari total spending berdasarkan membership_tiers */
export function getTierFromSpending(
  total: number,
  tiersCfg?: MembershipTiersConfig
): MembershipTier {
  if (!tiersCfg) return "SILVER";

  const inRange = (t: { min_spend: number; max_spend: number | null }) => {
    const min = t.min_spend ?? 0;
    const max = t.max_spend ?? null;
    return total >= min && (max === null || total <= max);
  };

  if (tiersCfg.platinum && inRange(tiersCfg.platinum)) return "PLATINUM";
  if (tiersCfg.gold && inRange(tiersCfg.gold)) return "GOLD";
  return "SILVER";
}

/** Cashback % dari total 3 bulan berdasarkan cashback_rules */
export function getActiveCashbackPercent(
  total: number,
  cashbackCfg?: CashbackRulesConfig
): number {
  if (!cashbackCfg || cashbackCfg.enabled === false) return 0;
  const tiers = cashbackCfg.tiers || [];

  for (const t of tiers) {
    const min = t.min_total ?? 0;
    const max = t.max_total ?? null;
    if (total >= min && (max === null || total <= max)) {
      return t.cashback_percent ?? 0;
    }
  }

  return 0;
}

/** Welcome bonus poin per tier dari points_config */
export function getWelcomeBonusPoints(
  tier: MembershipTier,
  pointsCfg?: PointsConfig
): number {
  if (!pointsCfg || pointsCfg.enabled === false) return 0;
  const map = pointsCfg.welcome_bonus_points || {};
  const val = map[tier];
  return typeof val === "number" ? val : 0;
}

// lib/rewardsConfig.ts

// ... (isi file kamu sekarang tetap, cukup tambahkan fungsi ini)

// Hitung persen Hello Discount (bukan 0.15 tapi 15) dari total publish first day
export function getHelloDiscountPercentForAmount(
  totalPublish: number,
  cfg?: HelloDiscountConfig
): number {
  if (!cfg || cfg.enabled === false) return 0;
  const tiers = cfg.tiers || [];

  for (const t of tiers) {
    const min = t.min_publish ?? 0;
    const max = t.max_publish ?? null;
    if (totalPublish >= min && (max === null || totalPublish <= max)) {
      // di config kita simpan 5, 10, 15
      return t.discount_percent ?? 0;
    }
  }
  return 0;
}

/** Hello Discount % berdasarkan total publish hari pertama */
export function getHelloDiscountPercent(
  totalPublish: number,
  cfg?: HelloDiscountConfig
): number {
  if (!cfg || cfg.enabled === false) return 0;
  const tiers = cfg.tiers || [];

  for (const t of tiers) {
    const min = t.min_publish ?? 0;
    const max = t.max_publish ?? null;
    if (totalPublish >= min && (max === null || totalPublish <= max)) {
      return t.discount_percent ?? 0;
    }
  }
  return 0;
}

/** Helper: tambah beberapa bulan ke sebuah tanggal */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

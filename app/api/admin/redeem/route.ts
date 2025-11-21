import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


type Role = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER" | string;
type AdminAction = "approve" | "reject" | "paid";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function isAdminRole(role: unknown): boolean {
  const r = String(role || "").toUpperCase();
  return r === "ADMIN" || r === "MANAGER";
}

function generateVoucherCode(kind: string): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const datePart = `${dd}${mm}${yy}`;
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");

  const k = String(kind || "").toUpperCase();
  const prefix = k === "CASH_OUT" ? "CASHH" : "DSCD"; // CREDIT = DSCD..., CASH_OUT = CASHH...

  return `${prefix}${datePart}${random}`;
}

// GET: list redeem untuk admin (PENDING / APPROVED / PAID)
export async function GET() {
  try {
    const routeSupabase = createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await routeSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawRole = (user.user_metadata as any)?.role || "CUSTOMER";
    if (!isAdminRole(rawRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("redemptions")
      .select(
        `
        id,
        user_id,
        kind,
        amount,
        points_used,
        status,
        approved_by,
        approved_at,
        bank_name,
        bank_account_number,
        bank_account_holder,
        voucher_code,
        voucher_note,
        voucher_proof_url,
        processed_at,
        created_at
      `
      )
      .in("status", ["PENDING", "APPROVED", "PAID"])
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/admin/redeem error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: approve / reject / paid
export async function PATCH(request: Request) {
  try {
    const routeSupabase = createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await routeSupabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawRole = (user.user_metadata as any)?.role || "CUSTOMER";
    if (!isAdminRole(rawRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      id,
      action,
      voucher_note,
      voucher_proof_url,
      processed_at,
    }: {
      id: number;
      action: AdminAction;
      voucher_note?: string | null;
      voucher_proof_url?: string | null;
      processed_at?: string | null;
    } = body || {};

    if (!id || !action) {
      return NextResponse.json(
        { error: "Missing id or action" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // ambil redemption
    const { data: redemption, error: fetchError } = await supabase
      .from("redemptions")
      .select("id, user_id, kind, amount, points_used, status")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (!redemption) {
      return NextResponse.json(
        { error: "Redemption not found" },
        { status: 404 }
      );
    }

    const currentStatus = String(redemption.status || "PENDING").toUpperCase();

    // APPROVE
    if (action === "approve") {
      if (currentStatus !== "PENDING") {
        return NextResponse.json(
          { error: "Hanya redemption PENDING yang bisa di-approve" },
          { status: 400 }
        );
      }

      const voucherCode = generateVoucherCode(redemption.kind);
      const approvedAt = new Date().toISOString();

      // 1) Insert ledger (kurangi poin)
      const pointsUsed = Number(redemption.points_used || 0);
      if (pointsUsed > 0) {
        const { error: ledgerErr } = await supabase
          .from("reward_ledgers")
          .insert({
            user_id: redemption.user_id,
            type: "ADJUST", // sesuai constraint ('POINT','CREDIT','CASHBACK','ADJUST')
            amount: redemption.amount,
            points: -pointsUsed,
            ref_id: redemption.id,
            note: `Redeem ${redemption.kind} APPROVED, voucher ${voucherCode}`,
          });

        if (ledgerErr) {
          console.error("Error insert reward_ledgers:", ledgerErr);
          return NextResponse.json(
            { error: "Gagal mencatat pengurangan poin" },
            { status: 500 }
          );
        }
      }

      // 2) Update redemptions → APPROVED
      const { data: updated, error: updErr } = await supabase
        .from("redemptions")
        .update({
          status: "APPROVED",
          approved_by: user.id,
          approved_at: approvedAt,
          voucher_code: voucherCode,
          updated_at: approvedAt,
        })
        .eq("id", id)
        .select()
        .single();

      if (updErr) {
        console.error("Error update redemptions APPROVED:", updErr);
        return NextResponse.json(
          { error: updErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ data: updated }, { status: 200 });
    }

    // REJECT
    if (action === "reject") {
      if (currentStatus !== "PENDING") {
        return NextResponse.json(
          { error: "Hanya redemption PENDING yang bisa di-reject" },
          { status: 400 }
        );
      }

      const nowIso = new Date().toISOString();

      const { data: updated, error: updErr } = await supabase
        .from("redemptions")
        .update({
          status: "REJECTED",
          approved_by: user.id,
          approved_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", id)
        .select()
        .single();

      if (updErr) {
        console.error("Error update redemptions REJECTED:", updErr);
        return NextResponse.json(
          { error: updErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ data: updated }, { status: 200 });
    }

    // PAID
    if (action === "paid") {
      if (currentStatus !== "APPROVED") {
        return NextResponse.json(
          { error: "Hanya redemption APPROVED yang bisa di-set PAID" },
          { status: 400 }
        );
      }

      const processedAt =
        processed_at && String(processed_at).length > 0
          ? processed_at
          : new Date().toISOString();
      const nowIso = new Date().toISOString();

      const { data: updated, error: updErr } = await supabase
        .from("redemptions")
        .update({
          status: "PAID",
          voucher_note: voucher_note ?? null,
          voucher_proof_url: voucher_proof_url ?? null,
          processed_at: processedAt,
          updated_at: nowIso,
        })
        .eq("id", id)
        .select()
        .single();

      if (updErr) {
        console.error("Error update redemptions PAID:", updErr);
        return NextResponse.json(
          { error: updErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ data: updated }, { status: 200 });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("PATCH /api/admin/redeem error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

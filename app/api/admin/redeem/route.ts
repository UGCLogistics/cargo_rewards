import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function isInternalRole(role: unknown) {
  if (!role) return false;
  const r = String(role).toUpperCase();
  return r === "ADMIN" || r === "MANAGER";
}

/**
 * GET /api/admin/redeem
 * Mengembalikan semua permintaan redeem dengan status PENDING.
 * Hanya menerima request dari role INTERNAL (ADMIN / MANAGER).
 */
export async function GET(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");

    if (!isInternalRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("redemptions")
      .select("*")
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/redeem
 * Body: { id, action: "approve" | "reject", user_id }
 * Hanya menerima role INTERNAL (ADMIN / MANAGER).
 */
export async function PATCH(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isInternalRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { id, action, user_id } = body as {
      id: number | string;
      action: "approve" | "reject";
      user_id?: string;
    };

    if (!id || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 }
      );
    }

    if (!user_id) {
      return NextResponse.json(
        { error: "Missing user_id" },
        { status: 400 }
      );
    }

    const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
    const supabase = getServiceClient();

    const { error: updateErr } = await supabase
      .from("redemptions")
      .update({
        status: newStatus,
        approved_by: user_id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message },
        { status: 500 }
      );
    }

    // Audit log (boleh gagal tanpa menggagalkan response utama)
    try {
      await supabase.from("audit_logs").insert({
        user_id,
        action: action === "approve" ? "REDEEM_APPROVED" : "REDEEM_REJECTED",
        entity_type: "REDEMPTION",
        entity_id: id,
        payload: { status: newStatus },
      });
    } catch {
      // ignore
    }

    return NextResponse.json(
      { success: true, status: newStatus },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";




export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  return r === "ADMIN" || r === "MANAGER" || r === "STAFF";
}

/**
 * GET /api/admin/customers
 * Mengambil list customers.
 */
export async function GET(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isInternalRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = getServiceClient();
    const { data, error } = await adminClient
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/admin/customers error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/customers
 * Menambah customer baru. Hanya ADMIN.
 */
export async function POST(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    const role = String(roleHeader || "").toUpperCase();
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      company_name,
      tax_id,
      businessfield,
      pic_name,
      phone,
      email: customer_email,
      address,
      salesname,
      user_id,
    } = body;

    if (!company_name || !String(company_name).trim()) {
      return NextResponse.json(
        { error: "company_name is required" },
        { status: 400 }
      );
    }

    const adminClient = getServiceClient();
    const { data, error } = await adminClient
      .from("customers")
      .insert({
        company_name,
        tax_id: tax_id || null,
        businessfield: businessfield || null,
        pic_name: pic_name || null,
        phone: phone || null,
        email: customer_email || null,
        address: address || null,
        salesname: salesname || null,
        user_id: user_id || null,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/admin/customers error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

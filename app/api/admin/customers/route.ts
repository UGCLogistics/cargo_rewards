import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/**
 * PATCH /api/admin/customers
 * Ubah PIC (nama / email / telepon) + sinkron ke public.users & auth.users
 * Role: ADMIN & MANAGER
 */
export async function PATCH(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    const role = String(roleHeader || "").toUpperCase();

    if (role !== "ADMIN" && role !== "MANAGER") {
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

    const { customer_id, pic_name, phone, email } = body;

    if (!customer_id) {
      return NextResponse.json(
        { error: "customer_id is required" },
        { status: 400 }
      );
    }

    const adminClient = getServiceClient();

    // Ambil customer untuk dapat user_id dan data lain
    const { data: customer, error: fetchCustomerError } = await adminClient
      .from("customers")
      .select("id, user_id, company_name, businessfield, address")
      .eq("id", customer_id)
      .single();

    if (fetchCustomerError || !customer) {
      return NextResponse.json(
        { error: fetchCustomerError?.message || "Customer not found" },
        { status: 404 }
      );
    }

    // Payload update untuk tabel customers
    const updatePayload: Record<string, any> = {};
    if (typeof pic_name !== "undefined") updatePayload.pic_name = pic_name || null;
    if (typeof phone !== "undefined") updatePayload.phone = phone || null;
    if (typeof email !== "undefined") updatePayload.email = email || null;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Update tabel customers
    const { data: updatedCustomer, error: updateError } = await adminClient
      .from("customers")
      .update(updatePayload)
      .eq("id", customer_id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Sinkron ke public.users & auth.users kalau ada user_id
    if (customer.user_id) {
      const userId = customer.user_id as string;

      // 1) Update public.users (kolom 'name' sebagai PIC name)
      try {
        if (typeof pic_name !== "undefined") {
          const { error: userTableError } = await adminClient
            .from("users")
            .update({ name: pic_name || null })
            .eq("id", userId);

          if (userTableError) {
            console.error(
              "PATCH /api/admin/customers sync public.users error:",
              userTableError
            );
          }
        }
      } catch (e) {
        console.error(
          "PATCH /api/admin/customers public.users update exception:",
          e
        );
      }

      // 2) Update auth.users (email + raw_user_meta_data)
      try {
        const { data: userRes, error: getUserError } =
          await adminClient.auth.admin.getUserById(userId);

        if (getUserError) {
          console.error("getUserById error:", getUserError);
        } else if (userRes?.user) {
          const currentMeta =
            (userRes.user.user_metadata as Record<string, any>) || {};

          const newMeta: Record<string, any> = {
            ...currentMeta,
          };

          if (typeof pic_name !== "undefined") {
            newMeta.name = pic_name || null;
          }
          if (typeof email !== "undefined") {
            newMeta.email = email || null;
          }
          if (typeof phone !== "undefined") {
            newMeta.phone = phone || null;
          }

          // Sinkron juga identitas perusahaan & alamat dari customers
          newMeta.companyname =
            updatedCustomer.company_name ??
            currentMeta.companyname ??
            null;
          newMeta.businessfield =
            updatedCustomer.businessfield ??
            currentMeta.businessfield ??
            null;
          newMeta.address =
            updatedCustomer.address ?? currentMeta.address ?? null;

          const adminUpdatePayload: any = {
            user_metadata: newMeta,
          };

          // kalau email diganti → update juga kolom email di auth.users
          if (typeof email !== "undefined" && email) {
            adminUpdatePayload.email = email;
          }

          const { error: updateUserError } =
            await adminClient.auth.admin.updateUserById(
              userId,
              adminUpdatePayload
            );

          if (updateUserError) {
            console.error(
              "PATCH /api/admin/customers sync auth.users error:",
              updateUserError
            );
          }
        }
      } catch (authErr) {
        console.error(
          "PATCH /api/admin/customers auth admin error:",
          authErr
        );
      }
    }

    return NextResponse.json({ data: updatedCustomer }, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/admin/customers error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";




export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ["ADMIN", "MANAGER", "STAFF", "CUSTOMER"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function isAdminRole(roleHeader: string | null) {
  if (!roleHeader) return false;
  return roleHeader.toUpperCase() === "ADMIN";
}

/**
 * POST /api/admin/users/create
 *
 * Body: { email, password, name?, role? }
 * - Hanya ADMIN (x-role: ADMIN) yang boleh memanggil.
 * - Buat user di auth.users
 * - Insert row di public.users
 * - Jika role === CUSTOMER → insert minimal row di public.customers
 */
export async function POST(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isAdminRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const email: string | undefined = body.email;
    const password: string | undefined = body.password;
    const name: string | undefined = body.name;
    const requestedRole: Role = (body.role || "CUSTOMER").toUpperCase();

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(requestedRole)) {
      return NextResponse.json(
        {
          error:
            "Role tidak valid. Gunakan ADMIN / MANAGER / STAFF / CUSTOMER.",
        },
        { status: 400 }
      );
    }

    const adminClient = getServiceClient();

    // 1. Buat user di auth.users via admin API
    const { data: created, error: createErr } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: requestedRole,
          name: name || null,
        },
      });

    if (createErr) {
      console.error("createUser error:", createErr);
      return NextResponse.json(
        { error: createErr.message },
        { status: 500 }
      );
    }

    const newUserId = created?.user?.id;
    if (!newUserId) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    // 2. Insert ke public.users
    const { data: userRow, error: insertErr } = await adminClient
      .from("users")
      .insert({
        id: newUserId,
        name: name || null,
        role: requestedRole,
        status: "ACTIVE",
      })
      .select("*")
      .single();

    if (insertErr) {
      console.error("Insert public.users error:", insertErr);
      return NextResponse.json(
        { error: insertErr.message },
        { status: 500 }
      );
    }

    // 3. Kalau role CUSTOMER → buat juga di public.customers
    if (requestedRole === "CUSTOMER") {
      const { error: custErr } = await adminClient.from("customers").insert({
        user_id: newUserId,
        email,
        pic_name: name || null,
        // field lain dibiarkan null dulu, bisa dilengkapi dari halaman Data Pelanggan
      });

      if (custErr) {
        console.warn("Insert public.customers warning:", custErr);
        // tidak kita jadikan fatal, cukup warning di response
        return NextResponse.json(
          {
            data: userRow,
            warning:
              "User berhasil dibuat, tetapi insert ke public.customers gagal. Silakan cek manual jika diperlukan.",
          },
          { status: 201 }
        );
      }
    }

    return NextResponse.json({ data: userRow }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/admin/users/create error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


const ALLOWED_ROLES = ["ADMIN", "MANAGER", "STAFF", "CUSTOMER"] as const;
type Role = (typeof ALLOWED_ROLES)[number];

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase service role environment variables are not set"
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isAdminRole(roleHeader: string | null) {
  if (!roleHeader) return false;
  return roleHeader.toUpperCase() === "ADMIN";
}

/* ------------------------------------------------------------------ */
/* GET  → list semua user dari public.users (hanya ADMIN)             */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isAdminRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = getServiceClient();

    const { data, error } = await adminClient
      .from("users")
      .select("id, name, companyname, role, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /api/admin/users error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/admin/users unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/* PATCH: ubah role + status                                          */
/* body: { id, newRole, status? }                                     */
/* Sinkron ke:                                                        */
/*   - public.users.role & public.users.status                        */
/*   - auth.users.user_metadata.role                                  */
/*   (opsional: update timestamp di public.customers)                  */
/* ------------------------------------------------------------------ */

export async function PATCH(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isAdminRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = getServiceClient();

    const body = await request.json();
    const id: string | undefined = body.id;
    const newRole: Role | undefined = body.newRole;
    const status: string | undefined = body.status;

    if (!id || !newRole) {
      return NextResponse.json(
        { error: "Missing id or newRole" },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(newRole)) {
      return NextResponse.json(
        {
          error:
            "Role tidak valid. Gunakan ADMIN / MANAGER / STAFF / CUSTOMER.",
        },
        { status: 400 }
      );
    }

    // 1. Update di public.users
    const updates: Record<string, any> = {
      role: newRole,
      updated_at: new Date().toISOString(),
    };
    if (typeof status === "string") {
      updates.status = status;
    }

    const { error: updateProfileErr } = await adminClient
      .from("users")
      .update(updates)
      .eq("id", id);

    if (updateProfileErr) {
      console.error("Update public.users error:", updateProfileErr);
      return NextResponse.json(
        { error: updateProfileErr.message },
        { status: 500 }
      );
    }

    // 2. (opsional) sentuh updated_at di public.customers kalau user_id cocok
    //    ini hanya untuk sync timestamp, karena tabel customers tidak punya kolom role/status.
    await adminClient
      .from("customers")
      .update({ updated_at: new Date().toISOString() })
      .eq("user_id", id);

    // 3. Ambil user di auth.users
    const { data: userData, error: getUserErr } =
      await adminClient.auth.admin.getUserById(id);

    if (getUserErr || !userData?.user) {
      console.warn("getUserById error:", getUserErr);
      return NextResponse.json(
        {
          success: true,
          warning:
            "Role di public.users sudah berubah, tetapi gagal membaca user di auth.users untuk update metadata.",
        },
        { status: 200 }
      );
    }

    const currentMeta = userData.user.user_metadata || {};
    const newMeta = { ...currentMeta, role: newRole };

    // 4. Update metadata di auth.users
    const { error: updateMetaErr } = await adminClient.auth.admin.updateUserById(
      id,
      {
        user_metadata: newMeta,
      }
    );

    if (updateMetaErr) {
      console.warn("Failed to update user metadata:", updateMetaErr);
      return NextResponse.json(
        {
          success: true,
          warning:
            "Role di public.users sudah diubah, tetapi update metadata di auth.users gagal. Silakan cek manual di Auth jika perlu.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        id,
        role: newRole,
        status: status ?? null,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("PATCH /api/admin/users unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

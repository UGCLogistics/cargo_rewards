import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
/*      (tanpa kolom email, karena tidak ada di public.users)         */
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
      .select(
        "id, name, companyname, role, status, created_at, updated_at"
      )
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
/* PATCH: ubah nama, perusahaan, role, status                         */
/* body: { id, name?, companyname?, newRole, status? }                */
/* Sinkron ke:                                                        */
/*   - public.users (name, companyname, role, status)                 */
/*   - auth.users.user_metadata (role, name, companyname, status)     */
/*   - sentuh updated_at di public.customers (kalau ada)              */
/* ------------------------------------------------------------------ */

export async function PATCH(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isAdminRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminClient = getServiceClient();

    const body = (await request.json()) as {
      id?: string;
      newRole?: Role;
      status?: string;
      name?: string | null;
      companyname?: string | null;
    };

    const { id, newRole, status, name, companyname } = body;

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

    if (typeof status !== "undefined") {
      updates.status = status;
    }
    if (typeof name !== "undefined") {
      updates.name = name;
    }
    if (typeof companyname !== "undefined") {
      updates.companyname = companyname;
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
    await adminClient
      .from("customers")
      .update({ updated_at: new Date().toISOString() })
      .eq("user_id", id);

    // 3. Ambil user di auth.users untuk update metadata
    const { data: userData, error: getUserErr } =
      await adminClient.auth.admin.getUserById(id);

    if (getUserErr || !userData?.user) {
      console.warn("getUserById error:", getUserErr);
      return NextResponse.json(
        {
          success: true,
          warning:
            "Data di public.users sudah berubah, tetapi gagal membaca user di auth.users untuk update metadata.",
        },
        { status: 200 }
      );
    }

    const currentMeta = userData.user.user_metadata || {};

    // cuma overwrite field yang memang dikirim dari frontend
    const metaUpdates: Record<string, any> = {
      role: newRole,
    };

    if (typeof name !== "undefined") {
      metaUpdates.name = name;
    }
    if (typeof companyname !== "undefined") {
      metaUpdates.companyname = companyname;
    }
    if (typeof status !== "undefined") {
      metaUpdates.status = status;
    }

    const newMeta = { ...currentMeta, ...metaUpdates };

    // 4. Update metadata di auth.users
    const { error: updateMetaErr } =
      await adminClient.auth.admin.updateUserById(id, {
        user_metadata: newMeta,
      });

    if (updateMetaErr) {
      console.warn("Failed to update user metadata:", updateMetaErr);
      return NextResponse.json(
        {
          success: true,
          warning:
            "Data di public.users sudah diubah, tetapi update metadata di auth.users gagal. Silakan cek manual di Auth jika perlu.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        id,
        role: newRole,
        status: typeof status !== "undefined" ? status : null,
        name: typeof name !== "undefined" ? name : null,
        companyname:
          typeof companyname !== "undefined" ? companyname : null,
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

/* ------------------------------------------------------------------ */
/* POST: kirim email reset password ke user                           */
/* body: { id }                                                       */
/* Mekanisme:                                                         */
/*   - amb
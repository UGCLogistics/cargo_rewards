import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// --- helper ambil user_id dari cookie Supabase (sb-access-token) ---

function getAccessTokenFromCookies(): string | null {
  const store = cookies();
  const all = store.getAll();

  const accessCookie =
    all.find((c) => c.name === "sb-access-token") ||
    all.find((c) => c.name.endsWith("-access-token"));

  return accessCookie?.value ?? null;
}

function decodeJwtPayload(token: string): any {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("Invalid JWT");

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json);
}

function getUserIdFromCookies(): string | null {
  try {
    const token = getAccessTokenFromCookies();
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    return (payload.sub as string) || null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------
// GET: ambil profil dari public.users untuk user aktif
// ----------------------------------------------------
export async function GET() {
  try {
    const userId = getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("users")
      .select("name, companyname, status, created_at")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = row not found
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: data || { name: null, companyname: null, status: null, created_at: null } },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("GET /api/account/settings error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------
// PATCH: update nama dan/atau password user sendiri
// body: { name?: string; newPassword?: string }
// ----------------------------------------------------
export async function PATCH(request: Request) {
  try {
    const userId = getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const name: string | undefined = body.name;
    const newPassword: string | undefined = body.newPassword;

    if (!name && !newPassword) {
      return NextResponse.json(
        { error: "Tidak ada perubahan yang dikirim." },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // 1) kalau ada perubahan nama → update di public.users
    if (typeof name === "string" && name.trim().length > 0) {
      const { error: updErr } = await supabase
        .from("users")
        .update({ name: name.trim() })
        .eq("id", userId);

      if (updErr) {
        return NextResponse.json(
          { error: updErr.message },
          { status: 500 }
        );
      }
    }

    // 2) update di auth.users (metadata + password)
    if (name || newPassword) {
      const { data: userData, error: getUserErr } =
        await supabase.auth.admin.getUserById(userId);

      if (getUserErr || !userData?.user) {
        console.warn("getUserById error", getUserErr);
        return NextResponse.json(
          {
            error:
              "Gagal membaca data auth user untuk update metadata/password.",
          },
          { status: 500 }
        );
      }

      const currentMeta = userData.user.user_metadata || {};
      const newMeta =
        typeof name === "string" && name.trim().length > 0
          ? { ...currentMeta, name: name.trim() }
          : currentMeta;

      const updatePayload: any = { user_metadata: newMeta };
      if (newPassword) {
        updatePayload.password = newPassword;
      }

      const { error: updMetaErr } = await supabase.auth.admin.updateUserById(
        userId,
        updatePayload
      );

      if (updMetaErr) {
        console.warn("Failed to update auth user", updMetaErr);
        return NextResponse.json(
          {
            error:
              "Perubahan di auth.users gagal. Silakan coba lagi atau hubungi admin.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        name: name ?? null,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("PATCH /api/account/settings error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

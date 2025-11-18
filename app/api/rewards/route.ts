import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase service client (bypass RLS).
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Ambil access token Supabase dari cookie.
 */
function getAccessTokenFromCookies(): string | null {
  const store = cookies();
  const all = store.getAll();

  const accessCookie =
    all.find((c) => c.name === "sb-access-token") ||
    all.find((c) => c.name.endsWith("-access-token"));

  return accessCookie?.value ?? null;
}

/**
 * Decode payload JWT supaya bisa ambil `sub` (user id).
 */
function decodeJwtPayload(token: string): any {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("Invalid JWT");

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json);
}

/**
 * Ambil user_id dari cookie Supabase.
 */
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

/**
 * GET /api/rewards
 * Mengembalikan semua baris ledger reward user yang sedang login
 * dari tabel `reward_ledgers`.
 */
export async function GET() {
  try {
    const userId = getUserIdFromCookies();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("reward_ledgers")
      .select("*")
      .eq("user_id", userId)
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

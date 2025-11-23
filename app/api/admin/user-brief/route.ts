// app/api/admin/user-brief/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/admin/user-brief?userId=<uuid>
 *
 * Balikkan:
 * {
 *   user: {
 *     id,
 *     name,
 *     companyname,
 *     role,
 *     status
 *   }
 * }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("users")
      .select("id, name, companyname, role, status")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.error("GET /api/admin/user-brief error:", error?.message);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user: data }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/admin/user-brief fatal:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

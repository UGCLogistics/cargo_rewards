import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";



export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("redemptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 200 });
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    kind: rawKind,
    points_used,
    amount,
    bank_name,
    bank_account_number,
    bank_account_holder,
  } = body;

  if (!points_used || !amount) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Normalisasi kind agar selalu valid terhadap constraint
  let kind: "CREDIT" | "CASH_OUT";
  if (typeof rawKind === "string") {
    const upper = rawKind.toUpperCase();
    if (upper === "CREDIT" || upper === "CASH_OUT") {
      kind = upper as "CREDIT" | "CASH_OUT";
    } else if (upper.includes("CASHOUT") || upper.includes("CASH OUT")) {
      kind = "CASH_OUT";
    } else {
      kind = "CREDIT";
    }
  } else {
    kind = "CREDIT";
  }

  if (kind === "CASH_OUT") {
    if (!bank_name || !bank_account_number || !bank_account_holder) {
      return NextResponse.json(
        {
          error:
            "Nama Bank, Nomor Rekening, dan Nama Pemilik Rekening wajib diisi untuk cash out.",
        },
        { status: 400 }
      );
    }
  }

  const payload: any = {
    user_id: user.id,
    kind,
    points_used,
    amount,
    status: "PENDING",
  };

  if (kind === "CASH_OUT") {
    payload.bank_name = bank_name;
    payload.bank_account_number = bank_account_number;
    payload.bank_account_holder = bank_account_holder;
  }

  const { data: inserted, error } = await supabase
    .from("redemptions")
    .insert(payload)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: inserted }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      userId,
      companyName,
      picName,
      businessField,
      taxId,
      phone,
      email,
      address,
    } = body as {
      userId?: string;
      companyName?: string;
      picName?: string;
      businessField?: string;
      taxId?: string;
      phone?: string;
      email?: string;
      address?: string;
    };

    if (!userId || !companyName || !picName || !email) {
      return NextResponse.json(
        {
          error:
            "Field userId, companyName, picName, dan email wajib diisi di API register-profile.",
        },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const userRole: "CUSTOMER" | "STAFF" = "CUSTOMER";

    // Insert ke public.users
    const { error: userInsertError } = await supabase.from("users").insert({
      id: userId,
      companyname: companyName,
      name: picName,
      role: userRole,
      status: "ACTIVE",
    });

    if (userInsertError) {
      console.error("service users insert error", userInsertError);
      return NextResponse.json(
        {
          error:
            "Gagal menyimpan profil user di tabel users: " +
            (userInsertError.message ?? ""),
        },
        { status: 500 }
      );
    }

    // Insert ke public.customers
    const { error: customerError } = await supabase.from("customers").insert({
      user_id: userId,
      company_name: companyName,
      tax_id: taxId || null,
      businessfield: businessField || null,
      pic_name: picName,
      phone: phone || null,
      email,
      address: address || null,
      salesname: null,
    });

    if (customerError) {
      console.error("service customers insert error", customerError);
      return NextResponse.json(
        {
          error:
            "Profil user tersimpan, tetapi gagal menyimpan data pelanggan: " +
            (customerError.message ?? ""),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("register-profile API error", err);
    return NextResponse.json(
      {
        error: "Terjadi kesalahan server saat menyimpan profil.",
      },
      { status: 500 }
    );
  }
}

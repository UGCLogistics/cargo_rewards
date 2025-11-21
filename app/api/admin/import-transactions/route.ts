
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// app/api/admin/import-transactions/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {


  loadProgramConfigs,
  HelloDiscountConfig,
} from "lib/rewardsConfig";

// ===== Helpers =====

function isInternalRole(role: unknown) {
  if (!role) return false;
  const r = String(role).toUpperCase();
  return r === "ADMIN" || r === "MANAGER" || r === "STAFF";
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Ambil persen Hello Discount (0.05, 0.1, dst) dari config. */
function getHelloDiscountFraction(total: number, cfg?: HelloDiscountConfig) {
  if (!cfg || cfg.enabled === false) return 0;
  const tiers = cfg.tiers || [];

  for (const t of tiers) {
    const min = t.min_publish ?? 0;
    const max = t.max_publish ?? null;
    if (total >= min && (max === null || total <= max)) {
      return (t.discount_percent ?? 0) / 100;
    }
  }
  return 0;
}

// ===== Types =====

type CsvRow = {
  user_id?: string;
  customer_id?: number | string;
  company_id?: number | string;
  company_name?: string;
  date: string;
  service: string;
  origin: string;
  destination: string;
  publish_rate: number | string;
  invoice_no?: string;
};

type NormalizedRow = {
  idx: number;
  user_id: string;
  date: string;
  service: string;
  origin: string;
  destination: string;
  publish_rate: number;
  invoice_no: string | null;
};

// ===== Handler =====

export async function POST(request: Request) {
  try {
    const roleHeader = request.headers.get("x-role");
    if (!isInternalRole(roleHeader)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const rows = body.rows as CsvRow[];

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const requiredCore: (keyof CsvRow)[] = [
      "date",
      "service",
      "origin",
      "destination",
      "publish_rate",
    ];

    const customerIdSet = new Set<number>();
    const companyNameSet = new Set<string>();

    // --- 1. Validasi basic & kumpulkan id/nama customer ---
    rows.forEach((row, idx) => {
      for (const field of requiredCore) {
        if (!(row as any)[field]) {
          throw new Error(`Missing field ${String(field)} on row ${idx + 1}`);
        }
      }

      const hasUserId = row.user_id && String(row.user_id).trim() !== "";
      const rawCustomerId = row.customer_id ?? row.company_id ?? null;
      const hasCustomerId =
        rawCustomerId !== null &&
        rawCustomerId !== undefined &&
        String(rawCustomerId).trim() !== "";

      const hasCompanyName =
        row.company_name && String(row.company_name).trim() !== "";

      if (!hasUserId && !hasCustomerId && !hasCompanyName) {
        throw new Error(
          `Row ${idx + 1} must have user_id or customer_id/company_id or company_name`
        );
      }

      if (hasCustomerId) {
        const cid = Number(rawCustomerId);
        if (Number.isNaN(cid)) {
          throw new Error(
            `Invalid customer_id/company_id on row ${idx + 1}`
          );
        }
        customerIdSet.add(cid);
      }

      if (hasCompanyName) {
        companyNameSet.add(String(row.company_name).trim());
      }
    });

    const supabase = getServiceClient();
    const configs = await loadProgramConfigs(supabase);
    const helloCfg = configs.hello_discount;

    // --- 2. Load mapping customers → user_id ---
    const customerIdToUserId = new Map<number, string>();
    const nameToUserId = new Map<string, string>();

    const customerIdList = Array.from(customerIdSet);
    if (customerIdList.length > 0) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, user_id")
        .in("id", customerIdList);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      for (const c of data || []) {
        if (!c.user_id) {
          return NextResponse.json(
            { error: `Customer id ${c.id} belum punya user_id` },
            { status: 400 }
          );
        }
        customerIdToUserId.set(c.id as number, c.user_id as string);
      }
    }

    const companyNameList = Array.from(companyNameSet);
    if (companyNameList.length > 0) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, user_id, company_name")
        .in("company_name", companyNameList);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const seenNames = new Set<string>();

      for (const c of data || []) {
        const name = (c.company_name || "").trim();
        if (!name) continue;

        if (!c.user_id) {
          return NextResponse.json(
            { error: `Customer "${name}" belum punya user_id` },
            { status: 400 }
          );
        }

        if (seenNames.has(name)) {
          return NextResponse.json(
            {
              error: `company_name "${name}" dipakai >1 baris di customers. Gunakan customer_id/company_id atau user_id.`,
            },
            { status: 400 }
          );
        }

        seenNames.add(name);
        nameToUserId.set(name, c.user_id as string);
      }

      for (const n of companyNameList) {
        if (!nameToUserId.has(n)) {
          return NextResponse.json(
            { error: `company_name "${n}" tidak ditemukan di customers` },
            { status: 400 }
          );
        }
      }
    }

    // --- 3. Normalisasi rows (punya user_id & publish_rate number) ---
    const normalizedRows: NormalizedRow[] = [];

    rows.forEach((row, idx) => {
      const {
        user_id: rawUserId,
        customer_id,
        company_id,
        company_name,
        date,
        service,
        origin,
        destination,
        publish_rate,
        invoice_no,
      } = row;

      let userId: string | null =
        rawUserId && String(rawUserId).trim() !== ""
          ? String(rawUserId).trim()
          : null;

      const rawCid = customer_id ?? company_id ?? null;
      if (!userId && rawCid !== null && rawCid !== undefined) {
        const cid = Number(rawCid);
        userId = customerIdToUserId.get(cid) || null;
      }

      if (!userId && company_name) {
        const name = String(company_name).trim();
        userId = nameToUserId.get(name) || null;
      }

      if (!userId) {
        throw new Error(
          `Row ${idx + 1}: tidak bisa menentukan user_id (cek customer_id/company_id/company_name)`
        );
      }

      const dateStr = String(date).slice(0, 10);
      const publishNum = Number(publish_rate) || 0;

      normalizedRows.push({
        idx,
        user_id: userId,
        date: dateStr,
        service: String(service),
        origin: String(origin),
        destination: String(destination),
        publish_rate: publishNum,
        invoice_no:
          invoice_no && String(invoice_no).trim() !== ""
            ? String(invoice_no).trim()
            : null,
      });
    });

    if (normalizedRows.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada baris valid setelah normalisasi" },
        { status: 400 }
      );
    }

    // --- 4. Cari user yang sudah punya transaksi (tidak dapat Hello Discount lagi) ---
    const userIdSet = new Set<string>();
    for (const r of normalizedRows) userIdSet.add(r.user_id);
    const userIdList = Array.from(userIdSet);

    const usersWithExistingTx = new Set<string>();
    if (userIdList.length > 0) {
      const { data: existingTx, error: existingErr } = await supabase
        .from("transactions")
        .select("user_id")
        .in("user_id", userIdList);

      if (existingErr) {
        return NextResponse.json(
          { error: existingErr.message },
          { status: 500 }
        );
      }

      for (const tx of existingTx || []) {
        if (tx.user_id) {
          usersWithExistingTx.add(tx.user_id as string);
        }
      }
    }

    // --- 5. Hitung Hello Discount per idx baris ---
    const rowsByUser = new Map<string, NormalizedRow[]>();
    for (const r of normalizedRows) {
      const arr = rowsByUser.get(r.user_id) || [];
      arr.push(r);
      rowsByUser.set(r.user_id, arr);
    }

    const helloDiscountByIdx = new Map<number, number>();

    for (const [userId, list] of rowsByUser.entries()) {
      if (usersWithExistingTx.has(userId)) continue;
      if (!helloCfg || helloCfg.enabled === false) continue;

      // tanggal pertama di file import
      let firstDate = list[0].date;
      for (const r of list) {
        if (r.date < firstDate) firstDate = r.date;
      }

      // total publish di tanggal pertama
      let totalFirstDay = 0;
      for (const r of list) {
        if (r.date === firstDate) totalFirstDay += r.publish_rate;
      }

      const fraction = getHelloDiscountFraction(totalFirstDay, helloCfg);
      if (fraction <= 0) continue;

      for (const r of list) {
        if (r.date === firstDate) {
          const disc = Math.round(r.publish_rate * fraction);
          if (disc > 0) {
            helloDiscountByIdx.set(r.idx, disc);
          }
        }
      }
    }

    // --- 6. Bulk insert transaksi sekali panggil ---
    const payload = normalizedRows.map((r) => ({
      user_id: r.user_id,
      date: r.date,
      service: r.service,
      origin: r.origin,
      destination: r.destination,
      publish_rate: r.publish_rate,
      discount_amount: helloDiscountByIdx.get(r.idx) ?? 0,
      cashback_amount: null,
      points_earned: 0,
      invoice_no: r.invoice_no,
    }));

    const { data: insertedRows, error: insertErr } = await supabase
      .from("transactions")
      .insert(payload)
      .select();

    if (insertErr) {
      return NextResponse.json(
        { error: insertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: insertedRows }, { status: 201 });
  } catch (err: any) {
    console.error("import-transactions error", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

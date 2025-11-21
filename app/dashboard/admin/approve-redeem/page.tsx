"use client";

import { useState, useEffect } from "react";
import { useAuth } from "context/AuthContext";
import supabase from "lib/supabaseClient";

interface Redemption {
  id: number;
  user_id: string;
  kind: string;
  points_used: number;
  amount: number;
  status: string;
  created_at: string;
  approved_at: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  voucher_code: string | null;
  voucher_note: string | null;
  voucher_proof_url: string | null;
  processed_at: string | null;
}

interface UserInfo {
  userName: string | null;
  companyName: string | null;
}

type AdminAction = "approve" | "reject" | "paid";

function formatIdr(value: number) {
  return (
    "Rp " +
    (value || 0).toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    })
  );
}

export default function AdminApproveRedeemPage() {
  const { user } = useAuth();
  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = String(rawRole).toUpperCase();

  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [userInfoMap, setUserInfoMap] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const [noteMap, setNoteMap] = useState<Record<number, string>>({});
  const [fileMap, setFileMap] = useState<Record<number, File | null>>({});
  const [processedDateMap, setProcessedDateMap] = useState<
    Record<number, string>
  >({});

  const handleNoteChange = (id: number, value: string) => {
    setNoteMap((prev) => ({ ...prev, [id]: value }));
  };

  const handleFileChange = (id: number, file: File | null) => {
    setFileMap((prev) => ({ ...prev, [id]: file }));
  };

  const handleProcessedDateChange = (id: number, value: string) => {
    setProcessedDateMap((prev) => ({ ...prev, [id]: value }));
  };

  const fetchUserInfos = async (rows: Redemption[]) => {
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    if (userIds.length === 0) {
      setUserInfoMap({});
      return;
    }

    try {
      const [{ data: usersData }, { data: customersData }] = await Promise.all([
        supabase
          .from("users")
          .select("id, name, companyname")
          .in("id", userIds),
        supabase
          .from("customers")
          .select("user_id, company_name, pic_name")
          .in("user_id", userIds),
      ]);

      const usersMap = new Map<
        string,
        { name: string | null; companyname: string | null }
      >();
      (usersData || []).forEach((u: any) => {
        usersMap.set(u.id, {
          name: u.name ?? null,
          companyname: u.companyname ?? null,
        });
      });

      const customersMap = new Map<
        string,
        { company_name: string | null; pic_name: string | null }
      >();
      (customersData || []).forEach((c: any) => {
        customersMap.set(c.user_id, {
          company_name: c.company_name ?? null,
          pic_name: c.pic_name ?? null,
        });
      });

      const infoMap: Record<string, UserInfo> = {};
      for (const uid of userIds) {
        const u = usersMap.get(uid);
        const c = customersMap.get(uid);

        infoMap[uid] = {
          companyName: c?.company_name ?? u?.companyname ?? null,
          userName: u?.name ?? c?.pic_name ?? null,
        };
      }

      setUserInfoMap(infoMap);
    } catch (err) {
      console.error("Error fetching user infos:", err);
    }
  };

  const fetchRedemptions = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/redeem", {
        headers: {
          "x-role": role,
        },
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg =
          (json && (json.error || json.message)) ||
          `Gagal memuat data (status ${res.status})`;
        throw new Error(msg);
      }

      const list = (json?.data as Redemption[]) || [];
      setRedemptions(list);
      await fetchUserInfos(list);

      const newNoteMap: Record<number, string> = {};
      const newProcessedDateMap: Record<number, string> = {};

      list.forEach((r) => {
        if (r.voucher_note) {
          newNoteMap[r.id] = r.voucher_note;
        }
        if (r.processed_at) {
          newProcessedDateMap[r.id] = r.processed_at.slice(0, 10);
        } else if (r.status === "APPROVED") {
          newProcessedDateMap[r.id] = new Date().toISOString().slice(0, 10);
        }
      });

      setNoteMap(newNoteMap);
      setProcessedDateMap(newProcessedDateMap);
      setFileMap({});
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
      setRedemptions([]);
      setUserInfoMap({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRedemptions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const handleAction = async (id: number, action: AdminAction) => {
    if (!user) return;

    let confirmText = "";
    if (action === "approve") confirmText = "Yakin ingin MENYETUJUI redeem ini?";
    if (action === "reject") confirmText = "Yakin ingin MENOLAK redeem ini?";
    if (action === "paid")
      confirmText = "Yakin ingin menandai voucher ini sebagai SUDAH DIBAYAR (PAID)?";

    if (!confirm(confirmText)) {
      return;
    }

    setActionId(id);

    try {
      let voucherNote: string | null = null;
      let voucherProofUrl: string | null = null;
      let processedAt: string | null = null;

      // Untuk PAID, kita upload bukti + kirim note & tanggal proses
      if (action === "paid") {
        voucherNote = (noteMap[id] ?? "").trim() || null;

        // tanggal proses
        const dateStr = processedDateMap[id];
        if (dateStr && dateStr.length === 10) {
          processedAt = dateStr; // 'YYYY-MM-DD' → PostgreSQL akan parse ke timestamptz
        }

        const file = fileMap[id] ?? null;
        if (file) {
          const ext = file.name.split(".").pop() || "bin";
          const path = `${id}/${Date.now()}.${ext}`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("redeem-proofs")
            .upload(path, file, { upsert: true });

          if (uploadErr) {
            throw new Error("Gagal upload bukti: " + uploadErr.message);
          }

          const { data: publicData } = supabase.storage
            .from("redeem-proofs")
            .getPublicUrl(uploadData.path);

          voucherProofUrl = publicData.publicUrl || null;
        }
      }

      const res = await fetch("/api/admin/redeem", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-role": role,
        },
        body: JSON.stringify({
          id,
          action,
          voucher_note: voucherNote,
          voucher_proof_url: voucherProofUrl,
          processed_at: processedAt,
        }),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg =
          (json && (json.error || json.message)) ||
          `Gagal memperbarui status (status ${res.status})`;
        throw new Error(msg);
      }

      await fetchRedemptions();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-white">
            Approval Redeem
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Admin menyetujui permintaan redeem poin{" "}
            <span className="font-semibold">(PENDING → APPROVED → PAID)</span>.
          </p>
        </div>
        <button
          onClick={fetchRedemptions}
          disabled={loading}
          className="rounded-lg bg-[#ff4600] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_6px_20px_rgba(255,70,0,0.35)] hover:bg-[#ff5f24] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Memuat…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="glass border border-red-500/40 text-red-200 text-xs px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <section className="glass rounded-2xl px-4 py-4">
        {loading ? (
          <p className="text-sm text-slate-400">Memuat data redeem…</p>
        ) : redemptions.length === 0 ? (
          <p className="text-sm text-slate-300">
            Tidak ada permintaan redeem.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-slate-200">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-slate-400">
                  <th className="px-3 py-2 text-left">Tanggal Request</th>
                  <th className="px-3 py-2 text-left">Perusahaan</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Jenis</th>
                  <th className="px-3 py-2 text-right">Poin</th>
                  <th className="px-3 py-2 text-right">Jumlah (Rp)</th>
                  <th className="px-3 py-2 text-left">Nama Bank</th>
                  <th className="px-3 py-2 text-left">No. Rekening</th>
                  <th className="px-3 py-2 text-left">Pemilik Rekening</th>
                  <th className="px-3 py-2 text-left">Kode Voucher</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">
                    Keterangan / Bukti / Tgl Proses
                  </th>
                  <th className="px-3 py-2 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r) => {
                  const info = userInfoMap[r.user_id] || {
                    userName: null,
                    companyName: null,
                  };
                  const isCashOut =
                    String(r.kind || "").toUpperCase() === "CASH_OUT";
                  const kindLabel = isCashOut ? "Cash Out" : "Credit";

                  const statusUpper = String(r.status || "").toUpperCase();
                  const isPending = statusUpper === "PENDING";
                  const isApproved = statusUpper === "APPROVED";
                  const isPaid = statusUpper === "PAID";

                  const note = noteMap[r.id] ?? "";
                  const file = fileMap[r.id] ?? null;
                  const processedDate =
                    processedDateMap[r.id] ||
                    (r.processed_at
                      ? r.processed_at.slice(0, 10)
                      : "");

                  return (
                    <tr
                      key={r.id}
                      className="border-b border-white/5 hover:bg-white/5 align-top"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {info.companyName || "-"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {info.userName || "-"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {kindLabel}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {r.points_used.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatIdr(r.amount)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isCashOut && r.bank_name
                          ? r.bank_name
                          : isCashOut
                          ? "-"
                          : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isCashOut && r.bank_account_number
                          ? r.bank_account_number
                          : isCashOut
                          ? "-"
                          : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {isCashOut && r.bank_account_holder
                          ? r.bank_account_holder
                          : isCashOut
                          ? "-"
                          : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px]">
                        {r.voucher_code || (isApproved || isPaid ? "-" : "—")}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={
                            statusUpper === "PENDING"
                              ? "text-amber-300"
                              : statusUpper === "APPROVED"
                              ? "text-emerald-300"
                              : statusUpper === "PAID"
                              ? "text-sky-300"
                              : "text-slate-200"
                          }
                        >
                          {statusUpper}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {isApproved || isPaid ? (
                          <div className="flex flex-col gap-2 min-w-[210px]">
                            <textarea
                              className="rounded-lg border border-slate-600 bg-slate-900/60 px-2 py-1 text-[10px] resize-none h-14 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                              placeholder="Catatan proses (mis: transfer tgl 20 Nov, jam 14.00)"
                              value={note}
                              onChange={(e) =>
                                handleNoteChange(r.id, e.target.value)
                              }
                              disabled={isPaid}
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={processedDate}
                                onChange={(e) =>
                                  handleProcessedDateChange(
                                    r.id,
                                    e.target.value
                                  )
                                }
                                className="rounded-lg border border-slate-600 bg-slate-900/60 px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                                disabled={isPaid}
                              />
                              {r.voucher_proof_url && isPaid && (
                                <a
                                  href={r.voucher_proof_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[10px] underline text-sky-300"
                                >
                                  Lihat bukti
                                </a>
                              )}
                            </div>
                            {!isPaid && (
                              <>
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  onChange={(e) =>
                                    handleFileChange(
                                      r.id,
                                      e.target.files?.[0] || null
                                    )
                                  }
                                  className="text-[10px] file:text-[10px]"
                                />
                                {file && (
                                  <span className="text-[10px] text-slate-400 truncate">
                                    File: {file.name}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            Catatan & bukti diisi setelah status{" "}
                            <span className="font-semibold">APPROVED</span>.
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col items-center gap-2">
                          {isPending && (
                            <>
                              <button
                                onClick={() =>
                                  handleAction(r.id, "approve")
                                }
                                disabled={actionId === r.id}
                                className="w-20 rounded-lg bg-emerald-500/90 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {actionId === r.id
                                  ? "Memproses…"
                                  : "Approve"}
                              </button>
                              <button
                                onClick={() =>
                                  handleAction(r.id, "reject")
                                }
                                disabled={actionId === r.id}
                                className="w-20 rounded-lg bg-red-500/90 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {actionId === r.id
                                  ? "Memproses…"
                                  : "Reject"}
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <button
                              onClick={() => handleAction(r.id, "paid")}
                              disabled={actionId === r.id}
                              className="w-24 rounded-lg bg-sky-500/90 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {actionId === r.id
                                ? "Memproses…"
                                : "Mark Paid"}
                            </button>
                          )}

                          {isPaid && (
                            <span className="text-[10px] text-slate-400">
                              Sudah PAID
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

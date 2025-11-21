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
  reject_reason: string | null;
}

interface UserInfo {
  userName: string | null;
  companyName: string | null;
}

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
  const [previewMap, setPreviewMap] = useState<Record<number, string | null>>(
    {}
  );

  // Filter state
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterCompany, setFilterCompany] = useState("");

  // Modal state
  const [rejectModal, setRejectModal] = useState<{
    id: number;
    reason: string;
  } | null>(null);

  const [processModalId, setProcessModalId] = useState<number | null>(null);
  const [paidDetail, setPaidDetail] = useState<Redemption | null>(null);

  const handleNoteChange = (id: number, value: string) => {
    setNoteMap((prev) => ({ ...prev, [id]: value }));
  };

  const handleFileChange = (id: number, file: File | null) => {
    setFileMap((prev) => ({ ...prev, [id]: file ?? null }));

    setPreviewMap((prev) => {
      const next = { ...prev };

      // revoke url sebelumnya bila ada
      if (prev[id]) {
        try {
          URL.revokeObjectURL(prev[id] as string);
        } catch {
          // ignore
        }
      }

      if (file && file.type.startsWith("image/")) {
        next[id] = URL.createObjectURL(file);
      } else {
        next[id] = null;
      }

      return next;
    });
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
      const params = new URLSearchParams();
      if (filterStartDate) params.set("start", filterStartDate);
      if (filterEndDate) params.set("end", filterEndDate);
      if (filterCompany) params.set("company", filterCompany);

      const query = params.toString();
      const url = `/api/admin/redeem${query ? `?${query}` : ""}`;

      const res = await fetch(url, {
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
      setPreviewMap({});
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
      setRedemptions([]);
      setUserInfoMap({});
      setPreviewMap({});
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

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRedemptions();
  };

  const handleResetFilters = () => {
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterCompany("");
    fetchRedemptions();
  };

  const handleApprove = async (id: number) => {
    if (!user) return;
    if (!confirm("Yakin ingin MENYETUJUI redeem ini?")) return;

    setActionId(id);

    try {
      const res = await fetch("/api/admin/redeem", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-role": role,
        },
        body: JSON.stringify({
          id,
          action: "approve",
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

  const openRejectModal = (id: number) => {
    setRejectModal({ id, reason: "" });
  };

  const handleRejectConfirm = async () => {
    if (!user || !rejectModal) return;

    const reason = rejectModal.reason.trim();
    if (!reason) {
      alert("Mohon isi alasan penolakan.");
      return;
    }

    setActionId(rejectModal.id);

    try {
      const res = await fetch("/api/admin/redeem", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-role": role,
        },
        body: JSON.stringify({
          id: rejectModal.id,
          action: "reject",
          reject_reason: reason,
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

      setRejectModal(null);
      await fetchRedemptions();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan");
    } finally {
      setActionId(null);
    }
  };

  const openProcessModal = (id: number) => {
    setProcessModalId(id);
  };

  const handlePaidConfirm = async () => {
    if (!user || processModalId == null) return;

    const id = processModalId;
    setActionId(id);

    try {
      let voucherNote: string | null = null;
      let voucherProofUrl: string | null = null;
      let processedAt: string | null = null;

      voucherNote = (noteMap[id] ?? "").trim() || null;

      const dateStr = processedDateMap[id];
      if (dateStr && dateStr.length === 10) {
        processedAt = dateStr;
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

      const res = await fetch("/api/admin/redeem", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-role": role,
        },
        body: JSON.stringify({
          id,
          action: "paid",
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

      setProcessModalId(null);
      await fetchRedemptions();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan");
    } finally {
      setActionId(null);
    }
  };

  const pendingRedemptions = redemptions.filter(
    (r) => String(r.status || "").toUpperCase() === "PENDING"
  );
  const approvedRedemptions = redemptions.filter(
    (r) => String(r.status || "").toUpperCase() === "APPROVED"
  );
  const paidRedemptions = redemptions.filter(
    (r) => String(r.status || "").toUpperCase() === "PAID"
  );
  const rejectedRedemptions = redemptions.filter(
    (r) => String(r.status || "").toUpperCase() === "REJECTED"
  );

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getInfo = (r: Redemption): UserInfo => {
    return (
      userInfoMap[r.user_id] || {
        userName: null,
        companyName: null,
      }
    );
  };

  const isPdfUrl = (url: string | null) => {
    if (!url) return false;
    const lower = url.split("?")[0].toLowerCase();
    return lower.endsWith(".pdf");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-white">
            Approval Redeem
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Alur:{" "}
            <span className="font-semibold">
              PENDING → APPROVED (Process Rewards) → PAID / REJECTED
            </span>
            .
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

      {/* Filter bar */}
      <section className="glass rounded-2xl px-4 py-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-white">
            Filter Permintaan Redeem
          </h2>
          <span className="text-[11px] text-slate-400">
            Filter berdasarkan tanggal request dan nama perusahaan.
          </span>
        </div>

        <form
          onSubmit={handleFilterSubmit}
          className="grid gap-2 md:grid-cols-4 items-end"
        >
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Tanggal Request (Mulai)
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full rounded-md bg-black/20 border border-white/10 px-2 py-1 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Tanggal Request (Selesai)
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full rounded-md bg-black/20 border border-white/10 px-2 py-1 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Nama Perusahaan
            </label>
            <input
              type="text"
              placeholder="Cari nama perusahaan…"
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="w-full rounded-md bg-black/20 border border-white/10 px-2 py-1 text-xs text-white"
            />
          </div>
          <div className="flex gap-2 justify-end mt-1">
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5"
            >
              Reset
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#ff4600] text-white px-4 py-1.5 text-xs font-semibold hover:bg-[#ff5f24]"
            >
              Terapkan
            </button>
          </div>
        </form>
      </section>

      {/* Content sections */}
      <section className="space-y-4">
        {loading ? (
          <p className="text-sm text-slate-400">Memuat data redeem…</p>
        ) : (
          <>
            {pendingRedemptions.length === 0 &&
              approvedRedemptions.length === 0 &&
              paidRedemptions.length === 0 &&
              rejectedRedemptions.length === 0 && (
                <p className="text-sm text-slate-300">
                  Tidak ada permintaan redeem untuk filter yang dipilih.
                </p>
              )}

            {/* 1. Pending – card */}
            <section className="glass rounded-2xl px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">
                  1. Redemption Pending Approval
                </h2>
                <span className="text-[11px] text-slate-400">
                  {pendingRedemptions.length} permintaan
                </span>
              </div>
              {pendingRedemptions.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Tidak ada redemption pending.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {pendingRedemptions.map((r) => {
                    const info = getInfo(r);
                    const isCashOut =
                      String(r.kind || "").toUpperCase() === "CASH_OUT";
                    const kindLabel = isCashOut ? "Cash Out" : "Credit";
                    const statusUpper = String(r.status || "").toUpperCase();

                    return (
                      <div
                        key={r.id}
                        className="glass rounded-xl px-4 py-3 flex flex-col gap-2 border border-white/10"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] text-slate-400">
                              Tanggal Request
                            </p>
                            <p className="text-xs text-slate-100">
                              {formatDateTime(r.created_at)}
                            </p>
                          </div>
                          <span className="text-[11px] text-amber-300 font-semibold">
                            {statusUpper}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
                          <div>
                            <p className="text-slate-400">Perusahaan</p>
                            <p className="font-medium">
                              {info.companyName || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400">User</p>
                            <p>{info.userName || "-"} </p>
                          </div>
                          <div>
                            <p className="text-slate-400">Jenis</p>
                            <p>{kindLabel}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Poin</p>
                            <p>{r.points_used.toLocaleString("id-ID")}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Jumlah (Rp)</p>
                            <p className="font-medium">
                              {formatIdr(r.amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400">Nama Bank</p>
                            <p>
                              {isCashOut && r.bank_name
                                ? r.bank_name
                                : isCashOut
                                ? "-"
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400">No. Rekening</p>
                            <p>
                              {isCashOut && r.bank_account_number
                                ? r.bank_account_number
                                : isCashOut
                                ? "-"
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400">Pemilik Rekening</p>
                            <p>
                              {isCashOut && r.bank_account_holder
                                ? r.bank_account_holder
                                : isCashOut
                                ? "-"
                                : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => openRejectModal(r.id)}
                            disabled={actionId === r.id}
                            className="rounded-lg bg-red-500/90 px-3 py-1 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {actionId === r.id && rejectModal?.id === r.id
                              ? "Memproses…"
                              : "Reject"}
                          </button>
                          <button
                            onClick={() => handleApprove(r.id)}
                            disabled={actionId === r.id}
                            className="rounded-lg bg-emerald-500/90 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {actionId === r.id &&
                            (!rejectModal || rejectModal.id !== r.id)
                              ? "Memproses…"
                              : "Approve"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 2. Approved – card */}
            <section className="glass rounded-2xl px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">
                  2. Redemption Menunggu Dibayarkan (APPROVED)
                </h2>
                <span className="text-[11px] text-slate-400">
                  {approvedRedemptions.length} permintaan
                </span>
              </div>
              {approvedRedemptions.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Tidak ada redemption yang menunggu pembayaran.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {approvedRedemptions.map((r) => {
                    const info = getInfo(r);
                    const isCashOut =
                      String(r.kind || "").toUpperCase() === "CASH_OUT";
                    const kindLabel = isCashOut ? "Cash Out" : "Credit";
                    const statusUpper = String(r.status || "").toUpperCase();

                    return (
                      <div
                        key={r.id}
                        className="glass rounded-xl px-4 py-3 flex flex-col gap-2 border border-white/10"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] text-slate-400">
                              Tanggal Request
                            </p>
                            <p className="text-xs text-slate-100">
                              {formatDateTime(r.created_at)}
                            </p>
                          </div>
                          <span className="text-[11px] text-emerald-300 font-semibold">
                            {statusUpper}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-300">
                          <div>
                            <p className="text-slate-400">Perusahaan</p>
                            <p className="font-medium">
                              {info.companyName || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400">User</p>
                            <p>{info.userName || "-"}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Jenis</p>
                            <p>{kindLabel}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Poin</p>
                            <p>{r.points_used.toLocaleString("id-ID")}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Jumlah (Rp)</p>
                            <p className="font-medium">
                              {formatIdr(r.amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400">Nama Bank</p>
                            <p>
                              {isCashOut && r.bank_name
                                ? r.bank_name
                                : isCashOut
                                ? "-"
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400">No. Rekening</p>
                            <p>
                              {isCashOut && r.bank_account_number
                                ? r.bank_account_number
                                : isCashOut
                                ? "-"
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400">Pemilik Rekening</p>
                            <p>
                              {isCashOut && r.bank_account_holder
                                ? r.bank_account_holder
                                : isCashOut
                                ? "-"
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400">Kode Voucher</p>
                            <p className="font-mono text-[11px]">
                              {r.voucher_code || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-400">Approved At</p>
                            <p>{formatDateTime(r.approved_at)}</p>
                          </div>
                        </div>

                        <div className="flex justify-end mt-2">
                          <button
                            onClick={() => openProcessModal(r.id)}
                            disabled={actionId === r.id}
                            className="rounded-lg bg-sky-500/90 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {actionId === r.id && processModalId === r.id
                              ? "Memproses…"
                              : "Process Rewards"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 3. Paid – table */}
            <section className="glass rounded-2xl px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">
                  3. Redemption Sudah Dibayarkan (PAID)
                </h2>
                <span className="text-[11px] text-slate-400">
                  {paidRedemptions.length} transaksi
                </span>
              </div>
              {paidRedemptions.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Belum ada redemption yang dibayarkan.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-slate-200">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] text-slate-400">
                        <th className="px-3 py-2 text-left">
                          Tanggal Dibayarkan
                        </th>
                        <th className="px-3 py-2 text-left">Perusahaan</th>
                        <th className="px-3 py-2 text-left">Jenis</th>
                        <th className="px-3 py-2 text-right">Poin</th>
                        <th className="px-3 py-2 text-right">Jumlah (Rp)</th>
                        <th className="px-3 py-2 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paidRedemptions.map((r) => {
                        const info = getInfo(r);
                        const isCashOut =
                          String(r.kind || "").toUpperCase() === "CASH_OUT";
                        const kindLabel = isCashOut ? "Cash Out" : "Credit";

                        const paidDate =
                          r.processed_at || r.approved_at || r.created_at;

                        return (
                          <tr
                            key={r.id}
                            className="border-b border-white/5 hover:bg-white/5"
                          >
                            <td className="px-3 py-2 whitespace-nowrap">
                              {formatDate(paidDate)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {info.companyName || "-"}
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
                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              <button
                                onClick={() => setPaidDetail(r)}
                                className="rounded-lg bg-white/10 px-3 py-1 text-[11px] text-slate-100 hover:bg-white/20"
                              >
                                Detail
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 4. Rejected – table */}
            <section className="glass rounded-2xl px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">
                  4. Redemption Ditolak (REJECTED)
                </h2>
                <span className="text-[11px] text-slate-400">
                  {rejectedRedemptions.length} transaksi
                </span>
              </div>
              {rejectedRedemptions.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Belum ada redemption yang ditolak.
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
                        <th className="px-3 py-2 text-left">Alasan Reject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rejectedRedemptions.map((r) => {
                        const info = getInfo(r);
                        const isCashOut =
                          String(r.kind || "").toUpperCase() === "CASH_OUT";
                        const kindLabel = isCashOut ? "Cash Out" : "Credit";

                        return (
                          <tr
                            key={r.id}
                            className="border-b border-white/5 hover:bg-white/5"
                          >
                            <td className="px-3 py-2 whitespace-nowrap">
                              {formatDateTime(r.created_at)}
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
                            <td className="px-3 py-2 whitespace-pre-wrap">
                              {r.reject_reason || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </section>

      {/* Modal: Reject reason */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="glass rounded-2xl px-4 py-4 w-full max-w-md border border-red-500/40">
            <h3 className="text-sm font-semibold text-red-200 mb-2">
              Alasan Penolakan Redeem
            </h3>
            <p className="text-[11px] text-slate-300 mb-2">
              Mohon isi alasan mengapa permintaan redeem ini ditolak. Alasan ini
              akan tersimpan sebagai catatan audit.
            </p>
            <textarea
              className="w-full rounded-lg border border-slate-600 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 resize-none h-24 focus:outline-none focus:ring-1 focus:ring-red-400"
              placeholder="Contoh: Data rekening tidak valid, nominal tidak sesuai, dsb."
              value={rejectModal.reason}
              onChange={(e) =>
                setRejectModal((prev) =>
                  prev ? { ...prev, reason: e.target.value } : prev
                )
              }
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setRejectModal(null)}
                disabled={actionId === rejectModal.id}
                className="rounded-lg border border-white/30 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-white/5 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={actionId === rejectModal.id}
                className="rounded-lg bg-red-500/90 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {actionId === rejectModal.id ? "Memproses…" : "Tolak Redeem"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Process Rewards (PAID) */}
      {processModalId != null &&
        (() => {
          const r = redemptions.find((x) => x.id === processModalId);
          if (!r) return null;
          const info = getInfo(r);
          const isCashOut =
            String(r.kind || "").toUpperCase() === "CASH_OUT";
          const kindLabel = isCashOut ? "Cash Out" : "Credit";
          const note = noteMap[r.id] ?? "";
          const processedDate =
            processedDateMap[r.id] ||
            (r.processed_at ? r.processed_at.slice(0, 10) : "");
          const file = fileMap[r.id] ?? null;
          const previewUrl = previewMap[r.id] ?? null;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="glass rounded-2xl px-4 py-4 w-full max-w-xl border border-sky-400/40 space-y-3">
                <h3 className="text-sm font-semibold text-sky-200">
                  Process Rewards – Tandai sebagai PAID
                </h3>
                <p className="text-[11px] text-slate-300">
                  Isi keterangan proses, tanggal dibayarkan, dan upload bukti
                  transfer / dokumentasi lain. Data ini akan tersimpan sebagai
                  catatan permanen.
                </p>

                {/* Detail kartu */}
                <div className="glass rounded-xl px-3 py-3 text-[11px] text-slate-200 border border-white/10">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div>
                      <p className="text-slate-400">Tanggal Request</p>
                      <p>{formatDateTime(r.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Perusahaan</p>
                      <p>{info.companyName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">User</p>
                      <p>{info.userName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Jenis</p>
                      <p>{kindLabel}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Poin</p>
                      <p>{r.points_used.toLocaleString("id-ID")}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Jumlah (Rp)</p>
                      <p>{formatIdr(r.amount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Nama Bank</p>
                      <p>
                        {isCashOut && r.bank_name
                          ? r.bank_name
                          : isCashOut
                          ? "-"
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">No. Rekening</p>
                      <p>
                        {isCashOut && r.bank_account_number
                          ? r.bank_account_number
                          : isCashOut
                          ? "-"
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Pemilik Rekening</p>
                      <p>
                        {isCashOut && r.bank_account_holder
                          ? r.bank_account_holder
                          : isCashOut
                          ? "-"
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Kode Voucher</p>
                      <p className="font-mono text-[11px]">
                        {r.voucher_code || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Status</p>
                      <p className="text-emerald-300 font-semibold">
                        {String(r.status || "").toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Input keterangan / bukti / tgl proses */}
                <div className="space-y-2">
                  <label className="block text-[11px] text-slate-400">
                    Keterangan Proses
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-slate-600 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 resize-none h-20 focus:outline-none focus:ring-1 focus:ring-sky-400"
                    placeholder="Contoh: Transfer pada 20 Des 2025, jam 14.00 WIB dari rekening BCA UGC."
                    value={note}
                    onChange={(e) => handleNoteChange(r.id, e.target.value)}
                  />
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <div className="flex flex-col gap-1">
                      <span className="block text-[11px] text-slate-400">
                        Tanggal Dibayarkan
                      </span>
                      <input
                        type="date"
                        value={processedDate}
                        onChange={(e) =>
                          handleProcessedDateChange(r.id, e.target.value)
                        }
                        className="rounded-lg border border-slate-600 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-400"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="block text-[11px] text-slate-400">
                        Upload Bukti (opsional)
                      </span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) =>
                          handleFileChange(
                            r.id,
                            e.target.files?.[0] || null
                          )
                        }
                        className="text-[11px] file:text-[11px]"
                      />
                      {file && (
                        <span className="text-[10px] text-slate-400 truncate">
                          File: {file.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* preview bukti pembayaran (jika image) */}
                  {previewUrl && (
                    <div className="mt-3">
                      <p className="text-[11px] text-slate-400 mb-1">
                        Preview Bukti Pembayaran
                      </p>
                      <div className="glass rounded-xl border border-white/20 p-2 bg-black/40 flex justify-center">
                        <img
                          src={previewUrl}
                          alt="Bukti pembayaran"
                          className="max-h-80 w-auto object-contain rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => setProcessModalId(null)}
                    disabled={actionId === r.id}
                    className="rounded-lg border border-white/30 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-white/5 disabled:opacity-60"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handlePaidConfirm}
                    disabled={actionId === r.id}
                    className="rounded-lg bg-sky-500/90 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {actionId === r.id ? "Memproses…" : "Simpan & Tandai PAID"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Modal: Detail PAID */}
      {paidDetail &&
        (() => {
          const r = paidDetail;
          const info = getInfo(r);
          const isCashOut =
            String(r.kind || "").toUpperCase() === "CASH_OUT";
          const kindLabel = isCashOut ? "Cash Out" : "Credit";
          const hasProof = !!r.voucher_proof_url;
          const proofIsPdf = isPdfUrl(r.voucher_proof_url);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="glass rounded-2xl px-4 py-4 w-full max-w-xl border border-white/30 space-y-3">
                <h3 className="text-sm font-semibold text-white">
                  Detail Redemption – PAID
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-200">
                  <div>
                    <p className="text-slate-400">Tanggal Request</p>
                    <p>{formatDateTime(r.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Tanggal Dibayarkan</p>
                    <p>{formatDate(r.processed_at || r.approved_at)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Perusahaan</p>
                    <p>{info.companyName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">User</p>
                    <p>{info.userName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Jenis</p>
                    <p>{kindLabel}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Poin</p>
                    <p>{r.points_used.toLocaleString("id-ID")}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Jumlah (Rp)</p>
                    <p>{formatIdr(r.amount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Nama Bank</p>
                    <p>
                      {isCashOut && r.bank_name
                        ? r.bank_name
                        : isCashOut
                        ? "-"
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">No. Rekening</p>
                    <p>
                      {isCashOut && r.bank_account_number
                        ? r.bank_account_number
                        : isCashOut
                        ? "-"
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Pemilik Rekening</p>
                    <p>
                      {isCashOut && r.bank_account_holder
                        ? r.bank_account_holder
                        : isCashOut
                        ? "-"
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Kode Voucher</p>
                    <p className="font-mono text-[11px]">
                      {r.voucher_code || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Status</p>
                    <p className="text-sky-300 font-semibold">
                      {String(r.status || "").toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="mt-2 text-[11px] text-slate-200 space-y-1">
                  <p className="font-semibold text-slate-300">
                    Keterangan / Bukti / Tgl Proses
                  </p>
                  <p>
                    <span className="text-slate-400">Keterangan: </span>
                    {r.voucher_note || "-"}
                  </p>
                  <p>
                    <span className="text-slate-400">Tanggal Proses: </span>
                    {formatDate(r.processed_at)}
                  </p>
                  <p>
                    <span className="text-slate-400">Bukti: </span>
                    {hasProof ? (
                      <a
                        href={r.voucher_proof_url as string}
                        target="_blank"
                        rel="noreferrer"
                        className="underline text-sky-300"
                      >
                        Buka di tab baru
                      </a>
                    ) : (
                      "-"
                    )}
                  </p>
                </div>

                {/* Tampilkan bukti pembayaran besar di popup */}
                {hasProof && !proofIsPdf && (
                  <div className="mt-3">
                    <p className="text-[11px] text-slate-400 mb-1">
                      Bukti Pembayaran
                    </p>
                    <div className="glass rounded-xl border border-white/20 p-2 bg-black/40 flex justify-center">
                      <img
                        src={r.voucher_proof_url as string}
                        alt="Bukti pembayaran"
                        className="max-h-80 w-auto object-contain rounded-lg"
                      />
                    </div>
                  </div>
                )}

                {hasProof && proofIsPdf && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[11px] text-slate-400">
                      Bukti dalam bentuk PDF (klik link di atas untuk membuka).
                    </p>
                    <div className="glass rounded-xl border border-white/20 bg-black/40 p-2">
                      <iframe
                        src={r.voucher_proof_url as string}
                        className="w-full h-80 rounded-lg"
                        title="Bukti pembayaran PDF"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => setPaidDetail(null)}
                    className="rounded-lg border border-white/30 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-white/5"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";

interface Reward {
  id: number;
  name: string;
  cost: number;
  description: string | null;
}

type BankInfo = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

const isCashOutReward = (name: string) => {
  const lower = name.toLowerCase();
  return lower.includes("cashout") || lower.includes("cash out");
};

export default function RedeemPage() {
  const { user } = useAuth();

  const metadata = user?.user_metadata || {};
  const rawRole = (metadata.role as string | undefined) || "CUSTOMER";
  const role = rawRole.toUpperCase();
  const isCustomer = role === "CUSTOMER";

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // bank info per reward (cash out only)
  const [bankInfoMap, setBankInfoMap] = useState<Record<number, BankInfo>>({});
  // reward cash out mana yang lagi dibuka form bank-nya
  const [confirmingCashoutId, setConfirmingCashoutId] = useState<number | null>(
    null
  );

  const updateBankInfo = (
    rewardId: number,
    field: keyof BankInfo,
    value: string
  ) => {
    setBankInfoMap((prev) => ({
      ...prev,
      [rewardId]: {
        bankName: prev[rewardId]?.bankName ?? "",
        accountNumber: prev[rewardId]?.accountNumber ?? "",
        accountHolder: prev[rewardId]?.accountHolder ?? "",
        [field]: value,
      },
    }));
  };

  useEffect(() => {
    const fetchRewards = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error } = await supabase
          .from("rewards")
          .select("*")
          .order("cost", { ascending: true });

        if (error) throw error;
        setRewards((data as Reward[]) || []);
      } catch (err: any) {
        console.error("Gagal memuat rewards:", err);
        setError("Gagal memuat daftar reward. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    };

    fetchRewards();
  }, []);

  const handleRedeem = async (reward: Reward) => {
    if (!isCustomer || !user) return;

    try {
      setError(null);

      const lower = reward.name.toLowerCase();
      const kind: "CREDIT" | "CASH_OUT" =
        lower.includes("cashout") || lower.includes("cash out")
          ? "CASH_OUT"
          : "CREDIT";

      let bankInfo: BankInfo | undefined;
      if (kind === "CASH_OUT") {
        bankInfo = bankInfoMap[reward.id];
        if (
          !bankInfo ||
          !bankInfo.bankName.trim() ||
          !bankInfo.accountNumber.trim() ||
          !bankInfo.accountHolder.trim()
        ) {
          setError(
            "Untuk redeem cash out, isi dulu Nama Bank, Nomor Rekening, dan Nama Pemilik Rekening."
          );
          return;
        }
      }

      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          reward_name: reward.name,
          points_used: reward.cost,
          amount: reward.cost * 250, // 1 poin = Rp 250
          bank_name: bankInfo?.bankName ?? null,
          bank_account_number: bankInfo?.accountNumber ?? null,
          bank_account_holder: bankInfo?.accountHolder ?? null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal mengajukan redeem");
      }

      alert("Pengajuan redeem berhasil dikirim. Menunggu approval.");
      // reset state setelah sukses
      setConfirmingCashoutId(null);
      setBankInfoMap((prev) => {
        const clone = { ...prev };
        delete clone[reward.id];
        return clone;
      });
    } catch (err: any) {
      setError(err.message ?? "Terjadi kesalahan saat redeem");
    }
  };

  // pisah reward per kategori
  const cashOutRewards = rewards.filter((r) => isCashOutReward(r.name));
  const discountRewards = rewards.filter((r) => !isCashOutReward(r.name));

  const renderRewardCard = (r: Reward, isCashOut: boolean) => {
    const bankInfo = bankInfoMap[r.id] || {
      bankName: "",
      accountNumber: "",
      accountHolder: "",
    };
    const isConfirmingThis = isCashOut && confirmingCashoutId === r.id;

    const onButtonClick = () => {
      if (!isCustomer) return;
      if (isCashOut && !isConfirmingThis) {
        // klik pertama: buka form bank untuk voucher ini
        setConfirmingCashoutId(r.id);
        setError(null);
        return;
      }
      // klik kedua (atau voucher diskon): kirim redeem
      handleRedeem(r);
    };

    return (
      <div key={r.id} className="glass rounded-xl p-4 flex flex-col">
        <h3 className="text-base font-semibold mb-1">{r.name}</h3>
        <p className="text-xs text-slate-400 mb-2">
          {r.description || (isCashOut ? "Cash out ke rekening bank." : "-")}
        </p>
        <p className="text-sm font-semibold mb-3">
          Poin: {r.cost.toLocaleString("id-ID")}
        </p>

        {isCashOut && isConfirmingThis && (
          <div className="space-y-2 mb-3 text-[11px] md:text-xs">
            <div className="flex flex-col">
              <label className="mb-1 text-slate-300">Nama Bank</label>
              <input
                type="text"
                value={bankInfo.bankName}
                onChange={(e) =>
                  updateBankInfo(r.id, "bankName", e.target.value)
                }
                className="rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-transparent"
                placeholder="Contoh: BCA, BRI, Mandiri"
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-slate-300">Nomor Rekening</label>
              <input
                type="text"
                value={bankInfo.accountNumber}
                onChange={(e) =>
                  updateBankInfo(r.id, "accountNumber", e.target.value)
                }
                className="rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-transparent"
                placeholder="Nomor rekening tujuan"
              />
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-slate-300">
                Nama Pemilik Rekening
              </label>
              <input
                type="text"
                value={bankInfo.accountHolder}
                onChange={(e) =>
                  updateBankInfo(r.id, "accountHolder", e.target.value)
                }
                className="rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-transparent"
                placeholder="Nama sesuai buku tabungan"
              />
            </div>
          </div>
        )}

        {isCustomer ? (
          <button
            onClick={onButtonClick}
            className="mt-auto rounded-lg bg-[var(--accent)] text-white py-2 text-sm hover:bg-[#ff5f24]"
          >
            {isCashOut
              ? isConfirmingThis
                ? "Kirim Pengajuan Cash Out"
                : "Redeem (Cash Out)"
              : "Redeem"}
          </button>
        ) : (
          <p className="mt-auto text-[11px] text-slate-400">
            Hanya customer yang dapat mengajukan redeem dari halaman ini.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Redeem Poin</h1>

      {!isCustomer && (
        <p className="text-xs text-slate-400">
          Anda login sebagai <span className="font-semibold">{role}</span>.
          Halaman ini menampilkan <b>katalog reward</b> untuk customer. Proses
          persetujuan / eksekusi redeem dilakukan melalui menu internal
          (Approval Redeem).
        </p>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? (
        <p>Memuat…</p>
      ) : rewards.length === 0 ? (
        <p>Tidak ada item reward.</p>
      ) : (
        <div className="space-y-6">
          {/* CASH OUT REDEMPTION */}
          {cashOutRewards.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm md:text-base font-semibold">
                Cash Out Redemption
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cashOutRewards.map((r) => renderRewardCard(r, true))}
              </div>
            </section>
          )}

          {/* DISCOUNT REDEMPTION */}
          {discountRewards.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm md:text-base font-semibold">
                Discount Redemption
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {discountRewards.map((r) => renderRewardCard(r, false))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

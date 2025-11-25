"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../context/AuthContext";
import SEO from "../components/SEO";
import ugcLogo from "public/logougcorangewhite.png";

type InitialRewardsResult = {
  helloDiscount: number;
  helloTier: string;
  helloRate: string;
  cashback: number;
  cashbackTier: string;
  cashbackRate: string;
};

type PointsTier = "Silver" | "Gold" | "Platinum";

type PointsResult = {
  tier: PointsTier;
  multiplier: number;
  welcomeBonus: number;
  multipliedPoints: number;
  totalPoints: number;
  rewardValue: number;
};

type FeatureCard = {
  title: string;
  desc: string;
};

type StepCard = {
  label: string;
  title: string;
  desc: string;
  points: string[];
};

const CARGO_REWARDS_LOGO =
  "https://mhzymxqcfrmswjdydtbt.supabase.co/storage/v1/object/public/graphics/logo/logorewardswhiteorange.png";

export default function HomePage() {
  const { user } = useAuth();

  // --- state kalkulator Hello Discount + Active Cashback ---
  const [firstTrx, setFirstTrx] = useState("");
  const [total3M, setTotal3M] = useState("");
  const [initialError, setInitialError] = useState<string | null>(null);
  const [initialResult, setInitialResult] =
    useState<InitialRewardsResult | null>(null);

  // --- state kalkulator Unlimited Points ---
  const [rev3M, setRev3M] = useState("");
  const [revNext, setRevNext] = useState("");
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [pointsResult, setPointsResult] = useState<PointsResult | null>(null);

  // --- state linimasa kemitraan ---
  const [activePhase, setActivePhase] = useState<number | null>(1);

  // helper angka
  function parseNumber(value: string): number {
    const onlyDigits = value.replace(/[^0-9]/g, "");
    if (!onlyDigits) return NaN;
    return parseInt(onlyDigits, 10);
  }

  function formatInput(value: string): string {
    const onlyDigits = value.replace(/[^0-9]/g, "");
    if (!onlyDigits) return "";
    return onlyDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  function formatRupiah(value: number): string {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  }

  // --- hitung Hello Discount + Active Cashback ---
  function handleCalculateInitial() {
    const first = parseNumber(firstTrx);
    const total = total3M ? parseNumber(total3M) : first;

    setInitialError(null);
    setInitialResult(null);

    if (isNaN(first) || first <= 0) {
      setInitialError("Nilai transaksi pertama tidak valid.");
      return;
    }
    if (isNaN(total) || total < first) {
      setInitialError(
        "Total 3 bulan harus lebih besar dari transaksi pertama."
      );
      return;
    }

    let helloDiscount = 0;
    let helloTier = "-";
    let helloRate = "0%";

    if (first >= 15_000_000) {
      helloDiscount = first * 0.15;
      helloTier = "T-3";
      helloRate = "15%";
    } else if (first >= 5_000_000) {
      helloDiscount = first * 0.1;
      helloTier = "T-2";
      helloRate = "10%";
    } else if (first >= 1_000_000) {
      helloDiscount = first * 0.05;
      helloTier = "T-1";
      helloRate = "5%";
    }

    let cashback = 0;
    let cashbackTier = "-";
    let cashbackRate = "0%";

    if (total >= 50_000_000) {
      cashback = total * 0.075;
      cashbackTier = "T-2";
      cashbackRate = "7,5%";
    } else if (total >= 20_000_000) {
      cashback = total * 0.05;
      cashbackTier = "T-1";
      cashbackRate = "5%";
    }

    setInitialResult({
      helloDiscount,
      helloTier,
      helloRate,
      cashback,
      cashbackTier,
      cashbackRate,
    });
  }

  // --- hitung Unlimited Points ---
  function handleCalculatePoints() {
    const initial = parseNumber(rev3M);
    const next = parseNumber(revNext);

    setPointsError(null);
    setPointsResult(null);

    if (isNaN(initial) || initial < 0) {
      setPointsError("Total 3 bulan pertama tidak valid.");
      return;
    }
    if (isNaN(next) || next <= 0) {
      setPointsError("Estimasi transaksi kuartal berikutnya tidak valid.");
      return;
    }

    let tier: PointsTier = "Silver";
    let multiplier = 1;
    let welcomeBonus = 1000;

    if (initial > 100_000_000) {
      tier = "Platinum";
      multiplier = 1.5;
      welcomeBonus = 2000;
    } else if (initial > 50_000_000) {
      tier = "Gold";
      multiplier = 1.25;
      welcomeBonus = 1500;
    }

    const recurringPoints = Math.floor(next / 10_000);
    const multipliedPoints = Math.floor(recurringPoints * multiplier);
    const totalPoints = multipliedPoints + welcomeBonus;
    const rewardValue = totalPoints * 250;

    setPointsResult({
      tier,
      multiplier,
      welcomeBonus,
      multipliedPoints,
      totalPoints,
      rewardValue,
    });
  }

  function togglePhase(phase: number) {
    setActivePhase((current) => (current === phase ? null : phase));
  }

  const featureCards: FeatureCard[] = [
    {
      title: "Hemat Biaya Pengiriman",
      desc: "Optimalkan biaya kirim cargo domestik dengan kombinasi harga kompetitif, diskon, dan cashback yang terukur.",
    },
    {
      title: "Cashback & Loyalty Points",
      desc: "Setiap transaksi menghasilkan poin loyalty dan cashback yang bisa di-reinvest untuk pengiriman berikutnya.",
    },
    {
      title: "Partner Logistik Jangka Panjang",
      desc: "Bukan sekadar vendor, tapi partner yang siap support ekspansi dan kebutuhan pengiriman harian Anda.",
    },
    {
      title: "Siap Scale Up Nasional",
      desc: "Cocok untuk bisnis dengan cabang, warehouse, atau distribusi multi-kota di seluruh Indonesia.",
    },
  ];

  const stepCards: StepCard[] = [
    {
      label: "Langkah 1",
      title: "Registrasi & Hello Discount",
      desc: "Begitu onboard, pengiriman pertama Anda langsung dapat Hello Discount:",
      points: [
        "5% untuk Rp 1 - 4,99 juta",
        "10% untuk Rp 5 - 14,99 juta",
        "15% untuk ≥ Rp 15 juta",
      ],
    },
    {
      label: "Langkah 2",
      title: "Aktivasi Volume & Active Cashback",
      desc: "Akumulasi pengiriman 3 bulan pertama dikonversi menjadi cashback:",
      points: [
        "5% untuk total Rp 20 - 49,99 juta",
        "7,5% untuk total ≥ Rp 50 juta",
      ],
    },
    {
      label: "Langkah 3",
      title: "Retensi & Unlimited Points",
      desc: "Setiap Rp 10.000 pengiriman = 1 poin. 1 poin = Rp 250. Level Silver / Gold / Platinum mengalikan poin & bonus Anda.",
      points: [],
    },
  ];

  return (
    <>
      <SEO
        title="Program Loyalitas Logistik & Pengiriman Cargo | CARGO Rewards"
        description="CARGO Rewards adalah program loyalitas logistik dari UGC Logistics untuk bisnis yang rutin menggunakan jasa pengiriman cargo di seluruh Indonesia. Hemat biaya pengiriman dengan diskon, cashback, dan poin loyalty di setiap transaksi."
        keywords={[
          "program loyalitas logistik",
          "jasa pengiriman cargo",
          "hemat biaya pengiriman",
          "logistik bisnis Indonesia",
          "cashback pengiriman",
          "loyalty program logistik",
          "UGC Logistics",
          "rewards cargo",
        ]}
        url="https://ugc-logistics-rewards.com"
        image="/og-image.png"
      />

      {/* Frame khusus landing: konten saja */}
      <div className="flex h-full flex-col">
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl space-y-16 px-4 py-10">
            {/* HERO – glass card, logo di dalam card */}
            <section className="flex items-center justify-center">
              <div className="relative w-full max-w-5xl py-8 md:py-10">
                <div className="glass-card relative mx-auto max-w-4xl px-6 py-8 md:px-10 md:py-10">
                  {/* LOGO DI DALAM HERO CARD – CENTERED */}
                  <div className="mb-6 flex flex-col items-center gap-3">
                    {/* Logo CARGO Rewards (utama) */}
                    <Image
                      src={CARGO_REWARDS_LOGO}
                      alt="CARGO Rewards"
                      width={220}
                      height={60}
                      className="h-10 w-auto md:h-12"
                      priority
                    />

                    {/* Powered by UGC Logistics */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400">
                        Powered by
                      </span>
                      <Image
                        src={ugcLogo}
                        alt="UGC Logistics"
                        width={120}
                        height={36}
                        className="h-6 w-auto md:h-7"
                      />
                    </div>
                  </div>

                  <p
                    className="mb-2 text-[10px] text-center uppercase tracking-[0.3em]"
                    style={{ color: "rgba(247,248,250,0.6)" }}
                  >
                    PROGRAM LOYALITAS LOGISTIK • CARGO REWARDS PORTAL
                  </p>

                  <h1 className="mb-4 text-center text-3xl font-extrabold leading-tight md:text-5xl">
                    Ubah Biaya Logistik Jadi{" "}
                    <span style={{ color: "var(--accent)" }}>
                      Aset yang Menghasilkan
                    </span>
                    .
                  </h1>

                  <p
                    className="mx-auto mb-8 max-w-2xl text-center text-sm md:text-base"
                    style={{ color: "rgba(247,248,250,0.8)" }}
                  >
                    CARGO Rewards adalah{" "}
                    <strong>program loyalitas logistik</strong> dari{" "}
                    <strong>UGC Logistics</strong> untuk bisnis yang rutin
                    menggunakan{" "}
                    <strong>jasa pengiriman cargo di Indonesia</strong>. Setiap
                    pengiriman barang Anda kembali lagi dalam bentuk{" "}
                    <strong>diskon, cashback, dan poin loyalty</strong> yang
                    membantu menekan biaya pengiriman secara terukur.
                  </p>

                  {/* HERO BUTTONS – conditional by login */}
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
                    {user ? (
                      <>
                        <Link href="/dashboard">
                          <button className="btn-primary">
                            Buka Dashboard Saya
                          </button>
                        </Link>
                        <a href="#program">
                          <button className="btn-outline">
                            Pelajari lebih lanjut
                          </button>
                        </a>
                      </>
                    ) : (
                      <>
                        <a href="#program">
                          <button className="btn-primary">
                            Pelajari lebih lanjut
                          </button>
                        </a>
                        <Link href="/login">
                          <button className="btn-outline">
                            Saya sudah punya akun
                          </button>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* INTRO PROGRAM – target "Pelajari lebih lanjut" */}
            <section className="space-y-8" id="program">
              <div className="space-y-2 text-center">
                <h2
                  className="text-2xl font-bold md:text-3xl"
                  style={{ color: "var(--accent)" }}
                >
                  Program Loyalitas Logistik untuk Bisnis yang Serius Bertumbuh
                </h2>
                <p
                  className="text-xs md:text-sm"
                  style={{ color: "rgba(247,248,250,0.7)" }}
                >
                  Dirancang untuk perusahaan yang rutin melakukan{" "}
                  <strong>pengiriman cargo</strong>, butuh partner logistik yang
                  bukan cuma kirim barang, tapi juga bantu{" "}
                  <strong>optimasi cost dan cashflow</strong>.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* card kiri besar */}
                <div className="glass space-y-4 p-6 md:p-7">
                  <h3 className="text-lg font-semibold md:text-xl">
                    Kenapa CARGO Rewards Relevan untuk Bisnis Anda?
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: "rgba(247,248,250,0.9)" }}
                  >
                    Di era persaingan yang makin ketat,{" "}
                    <strong>biaya logistik</strong> jadi salah satu komponen
                    terbesar di struktur biaya. Harga murah saja tidak cukup,
                    Anda perlu <strong>struktur benefit</strong> yang jelas,
                    terukur, dan bisa di-present ke manajemen.
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: "rgba(247,248,250,0.9)" }}
                  >
                    Dengan CARGO Rewards, setiap pengiriman melalui{" "}
                    <strong>UGC Logistics</strong> akan tercatat sebagai{" "}
                    <strong>nilai balik</strong> dalam bentuk diskon, cashback,
                    dan poin. Semua bisa Anda monitor dari dashboard, sehingga{" "}
                    <strong>ROI aktivitas logistik</strong> lebih mudah
                    dijelaskan.
                  </p>
                </div>

                {/* 4 card kecil */}
                <div className="grid grid-cols-2 gap-4">
                  {featureCards.map((item) => (
                    <div key={item.title} className="glass space-y-1 p-4">
                      <h4
                        className="text-sm font-semibold"
                        style={{ color: "var(--accent)" }}
                      >
                        {item.title}
                      </h4>
                      <p
                        className="text-xs"
                        style={{ color: "rgba(247,248,250,0.8)" }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 3 LANGKAH + KALKULATOR */}
            <section className="space-y-10" id="simulasi">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold md:text-3xl">
                  3 Langkah Simple Maksimalkan Loyalty Rewards Logistik
                </h2>
                <p
                  className="text-sm"
                  style={{ color: "rgba(247,248,250,0.8)" }}
                >
                  Mulai dari <strong>diskon sambutan</strong>,{" "}
                  <strong>cashback 3 bulan pertama</strong>, sampai{" "}
                  <strong>poin berulang</strong> untuk setiap pengiriman cargo
                  bisnis Anda.
                </p>
              </div>

              {/* 3 langkah ringkas */}
              <div className="grid gap-6 md:grid-cols-3">
                {stepCards.map((step) => (
                  <div key={step.label} className="glass space-y-2 p-5">
                    <p
                      className="text-[11px] uppercase tracking-[0.2em]"
                      style={{ color: "rgba(247,248,250,0.6)" }}
                    >
                      {step.label}
                    </p>
                    <h3
                      className="text-sm font-semibold"
                      style={{ color: "var(--accent)" }}
                    >
                      {step.title}
                    </h3>
                    <p
                      className="text-xs"
                      style={{ color: "rgba(247,248,250,0.9)" }}
                    >
                      {step.desc}
                    </p>
                    {step.points.length > 0 && (
                      <ul
                        className="space-y-1 text-xs"
                        style={{ color: "rgba(247,248,250,0.8)" }}
                      >
                        {step.points.map((pt) => (
                          <li key={pt}>• {pt}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>

              {/* Kalkulator Hello Discount + Active Cashback */}
              <div className="glass space-y-4 p-6">
                <h3 className="text-center text-base font-semibold md:text-lg">
                  Simulasi Diskon &amp; Cashback Pengiriman Cargo Anda
                </h3>

                <div className="grid items-start gap-4 md:grid-cols-3">
                  <div className="space-y-4 md:col-span-2">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs md:text-sm">
                          Nilai Transaksi Pertama (Rp)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={firstTrx}
                          onChange={(e) =>
                            setFirstTrx(formatInput(e.target.value))
                          }
                          className="w-full rounded-md px-3 py-2 text-sm"
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "var(--text)",
                          }}
                          placeholder="mis. 6.000.000"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs md:text-sm">
                          Total Transaksi 3 Bulan (Rp)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={total3M}
                          onChange={(e) =>
                            setTotal3M(formatInput(e.target.value))
                          }
                          className="w-full rounded-md px-3 py-2 text-sm"
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "var(--text)",
                          }}
                          placeholder="mis. 55.000.000"
                        />
                        <p
                          className="text-[11px]"
                          style={{ color: "rgba(247,248,250,0.6)" }}
                        >
                          Jika dikosongkan, sistem menganggap sama dengan
                          transaksi pertama.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCalculateInitial}
                      className="btn-ghost mt-1"
                    >
                      Hitung Diskon &amp; Cashback
                    </button>
                  </div>

                  <div className="glass min-h-[120px] p-4 text-xs md:text-sm">
                    {initialError && (
                      <p style={{ color: "#ff8a80" }}>{initialError}</p>
                    )}
                    {!initialError && initialResult && (
                      <div className="space-y-1">
                        <p className="flex justify-between gap-2">
                          <span>
                            Diskon Hello ({initialResult.helloTier},{" "}
                            {initialResult.helloRate})
                          </span>
                          <span
                            style={{
                              color: "var(--accent)",
                              fontWeight: 600,
                            }}
                          >
                            {formatRupiah(initialResult.helloDiscount)}
                          </span>
                        </p>
                        <p className="flex justify-between gap-2">
                          <span>
                            Cashback Aktif ({initialResult.cashbackTier},{" "}
                            {initialResult.cashbackRate})
                          </span>
                          <span
                            style={{
                              color: "var(--accent)",
                              fontWeight: 600,
                            }}
                          >
                            {formatRupiah(initialResult.cashback)}
                          </span>
                        </p>
                        <hr
                          style={{
                            borderColor: "rgba(255,255,255,0.15)",
                            margin: "0.5rem 0",
                          }}
                        />
                        <p
                          className="flex justify-between gap-2"
                          style={{ fontWeight: 600 }}
                        >
                          <span>Total Reward Awal</span>
                          <span>
                            {formatRupiah(
                              initialResult.helloDiscount +
                                initialResult.cashback
                            )}
                          </span>
                        </p>
                      </div>
                    )}
                    {!initialError && !initialResult && (
                      <p style={{ color: "rgba(247,248,250,0.7)" }}>
                        Masukkan nilai transaksi untuk melihat simulasi diskon +
                        cashback pengiriman cargo Anda.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Kalkulator Unlimited Points */}
              <div className="glass space-y-4 p-6">
                <h3 className="text-center text-base font-semibold md:text-lg">
                  Simulasi Poin Loyalty &amp; Level Kemitraan
                </h3>

                <div className="grid items-start gap-4 md:grid-cols-3">
                  <div className="space-y-4 md:col-span-2">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs md:text-sm">
                          Total Transaksi 3 Bulan Pertama (Rp)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={rev3M}
                          onChange={(e) =>
                            setRev3M(formatInput(e.target.value))
                          }
                          className="w-full rounded-md px-3 py-2 text-sm"
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "var(--text)",
                          }}
                          placeholder="mis. 55.000.000"
                        />
                        <p
                          className="text-[11px]"
                          style={{ color: "rgba(247,248,250,0.6)" }}
                        >
                          Menentukan level Silver / Gold / Platinum dalam
                          program loyalitas logistik Anda.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs md:text-sm">
                          Estimasi Transaksi Kuartal Berikutnya (Rp)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={revNext}
                          onChange={(e) =>
                            setRevNext(formatInput(e.target.value))
                          }
                          className="w-full rounded-md px-3 py-2 text-sm"
                          style={{
                            background: "rgba(0,0,0,0.3)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "var(--text)",
                          }}
                          placeholder="mis. 75.000.000"
                        />
                        <p
                          className="text-[11px]"
                          style={{ color: "rgba(247,248,250,0.6)" }}
                        >
                          Digunakan untuk menghitung poin &amp; nilai reward
                          kuartalan.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCalculatePoints}
                      className="btn-ghost mt-1"
                    >
                      Hitung Poin &amp; Level
                    </button>
                  </div>

                  <div className="glass min-h-[140px] p-4 text-xs md:text-sm">
                    {pointsError && (
                      <p style={{ color: "#ff8a80" }}>{pointsError}</p>
                    )}
                    {!pointsError && pointsResult && (
                      <div className="space-y-1">
                        <p className="flex justify-between gap-2">
                          <span>Level Kemitraan</span>
                          <span style={{ fontWeight: 600 }}>
                            {pointsResult.tier}
                          </span>
                        </p>
                        <p
                          className="text-[11px]"
                          style={{ color: "rgba(247,248,250,0.6)" }}
                        >
                          Berdasarkan total transaksi 3 bulan pertama.
                        </p>
                        <hr
                          style={{
                            borderColor: "rgba(255,255,255,0.15)",
                            margin: "0.4rem 0",
                          }}
                        />
                        <p className="flex justify-between gap-2">
                          <span>Bonus Selamat Datang</span>
                          <span>
                            {pointsResult.welcomeBonus.toLocaleString("id-ID")}{" "}
                            poin
                          </span>
                        </p>
                        <p className="flex justify-between gap-2">
                          <span>Poin dari Transaksi Kuartal</span>
                          <span>
                            {pointsResult.multipliedPoints.toLocaleString(
                              "id-ID"
                            )}{" "}
                            poin
                          </span>
                        </p>
                        <p
                          className="text-[11px]"
                          style={{ color: "rgba(247,248,250,0.6)" }}
                        >
                          Pengali {pointsResult.multiplier}x sesuai level.
                        </p>
                        <hr
                          style={{
                            borderColor: "rgba(255,255,255,0.15)",
                            margin: "0.4rem 0",
                          }}
                        />
                        <p
                          className="flex justify-between gap-2"
                          style={{ fontWeight: 600 }}
                        >
                          <span>Total Poin</span>
                          <span>
                            {pointsResult.totalPoints.toLocaleString("id-ID")}{" "}
                            poin
                          </span>
                        </p>
                        <p
                          className="flex justify-between gap-2"
                          style={{ fontWeight: 600 }}
                        >
                          <span>Nilai Reward</span>
                          <span style={{ color: "var(--accent)" }}>
                            {formatRupiah(pointsResult.rewardValue)}
                          </span>
                        </p>
                      </div>
                    )}
                    {!pointsError && !pointsResult && (
                      <p style={{ color: "rgba(247,248,250,0.7)" }}>
                        Masukkan estimasi omzet untuk melihat simulasi level,
                        poin dan nilai reward program loyalitas logistik Anda.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* LINIMASA KEMITRAAN */}
            <section className="space-y-8">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold md:text-3xl">
                  Linimasa Kemitraan CARGO Rewards
                </h2>
                <p
                  className="text-sm"
                  style={{ color: "rgba(247,248,250,0.8)" }}
                >
                  Gambaran perjalanan Anda bersama UGC Logistics dari sebelum
                  go-live sampai fase pertumbuhan.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => togglePhase(1)}
                  className="glass text-left text-xs md:text-sm p-4"
                  style={{
                    borderColor:
                      activePhase === 1 ? "var(--accent)" : "var(--border)",
                  }}
                >
                  <p
                    className="text-[11px] uppercase tracking-[0.2em]"
                    style={{ color: "rgba(247,248,250,0.6)" }}
                  >
                    Fase 1
                  </p>
                  <p
                    className="font-semibold"
                    style={{ color: "var(--accent)" }}
                  >
                    Persiapan
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "rgba(247,248,250,0.8)" }}
                  >
                    Fondasi kemitraan disiapkan sebelum pengiriman pertama.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => togglePhase(2)}
                  className="glass text-left text-xs md:text-sm p-4"
                  style={{
                    borderColor:
                      activePhase === 2 ? "var(--accent)" : "var(--border)",
                  }}
                >
                  <p
                    className="text-[11px] uppercase tracking-[0.2em]"
                    style={{ color: "rgba(247,248,250,0.6)" }}
                  >
                    Fase 2
                  </p>
                  <p
                    className="font-semibold"
                    style={{ color: "var(--accent)" }}
                  >
                    Aktivasi
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "rgba(247,248,250,0.8)" }}
                  >
                    Periode awal pengiriman dengan monitoring dan validasi
                    benefit.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => togglePhase(3)}
                  className="glass text-left text-xs md:text-sm p-4"
                  style={{
                    borderColor:
                      activePhase === 3 ? "var(--accent)" : "var(--border)",
                  }}
                >
                  <p
                    className="text-[11px] uppercase tracking-[0.2em]"
                    style={{ color: "rgba(247,248,250,0.6)" }}
                  >
                    Fase 3
                  </p>
                  <p
                    className="font-semibold"
                    style={{ color: "var(--accent)" }}
                  >
                    Pertumbuhan
                  </p>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "rgba(247,248,250,0.8)" }}
                  >
                    Optimalisasi berkelanjutan dan eskalasi level & benefit.
                  </p>
                </button>
              </div>

              <div className="glass space-y-2 p-6 text-xs md:text-sm">
                {activePhase === 1 && (
                  <>
                    <h3 className="font-semibold">
                      Timeline Persiapan (sebelum bulan 1)
                    </h3>
                    <ul className="list-inside list-disc space-y-1">
                      <li>
                        <strong style={{ color: "var(--accent)" }}>
                          Transparansi program:
                        </strong>{" "}
                        mekanisme, syarat dan ketentuan dijelaskan di awal
                        sehingga mudah dijelaskan ke internal Anda.
                      </li>
                      <li>
                        <strong style={{ color: "var(--accent)" }}>
                          Pemetaan kebutuhan:
                        </strong>{" "}
                        profil pengiriman, rute, SLA dan risiko dikaji sebelum
                        go-live.
                      </li>
                      <li>
                        <strong style={{ color: "var(--accent)" }}>
                          Desain solusi:
                        </strong>{" "}
                        skema harga, moda layanan dan standar layanan disepakati
                        bersama.
                      </li>
                    </ul>
                  </>
                )}

                {activePhase === 2 && (
                  <>
                    <h3 className="font-semibold">
                      Timeline Aktivasi (bulan 1 - 3)
                    </h3>
                    <ul className="list-inside list-disc space-y-1">
                      <li>
                        <strong style={{ color: "var(--accent)" }}>
                          Go-live pengiriman:
                        </strong>{" "}
                        pengiriman awal dimonitor secara ketat untuk memastikan
                        eksekusi berjalan sesuai SLA.
                      </li>
                      <li>
                        <strong style={{ color: "var(--accent)" }}>
                          Review berkala:
                        </strong>{" "}
                        laporan singkat performa dan issue logistik dibahas
                        rutin.
                      </li>
                      <li>
                        <strong style={{ color: "var(--accent)" }}>
                          Validasi benefit:
                        </strong>{" "}
                        diskon, cashback dan poin direkap sehingga terasa dampak
                        finansialnya.
                      </li>
                    </ul>
                  </>
                )}

                {activePhase === 3 && (
                  <>
                    <h3 className="font-semibold">
                      Timeline Pertumbuhan (bulan 4 - 6 dan seterusnya)
                    </h3>
                    <ul className="list-inside list-disc space-y-1">
                      <li>
                        <strong style={{ color: "var(--accent)" }}>
                          Laporan kinerja:
                        </strong>{" "}
                        analisis volume, rute, SLA dan biaya untuk melihat
                        peluang efisiensi.
                      </li>
                      <li>
                        <strong style={{ color: "var(--accent)" }}>
                          Optimalisasi:
                        </strong>{" "}
                        perbaikan layout rute, konsolidasi pengiriman, atau
                        penyesuaian moda.
                      </li>
                      <li>
                        <strong style={{ color: "var(--accent)" }}>
                          Eskalasi level:
                        </strong>{" "}
                        saat naik ke Gold/Platinum, benefit dan prioritas
                        layanan juga meningkat.
                      </li>
                    </ul>
                  </>
                )}

                {activePhase === null && (
                  <p style={{ color: "rgba(247,248,250,0.8)" }}>
                    Pilih salah satu fase di atas untuk melihat detail
                    linimasa.
                  </p>
                )}
              </div>
            </section>

            {/* CTA AKHIR */}
            <section className="space-y-4 text-center">
              <h2 className="text-2xl font-bold md:text-3xl">
                Siap Hemat Biaya Pengiriman &amp; Maksimalkan Setiap Pengiriman
                Cargo?
              </h2>
              <p
                className="mx-auto max-w-xl text-sm md:text-base"
                style={{ color: "rgba(247,248,250,0.8)" }}
              >
                Bergabunglah dengan{" "}
                <strong>program loyalitas logistik CARGO Rewards</strong> dan
                ubah biaya pengiriman menjadi{" "}
                <strong>diskon, cashback, dan poin loyalty</strong> yang bisa
                membantu bisnis Anda tumbuh lebih sehat dan terukur.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {user ? (
                  <>
                    <Link href="/dashboard">
                      <button className="btn-primary">
                        Buka Dashboard Saya
                      </button>
                    </Link>
                    <a href="#program">
                      <button className="btn-outline">
                        Pelajari lebih lanjut
                      </button>
                    </a>
                  </>
                ) : (
                  <>
                    <Link href="/register">
                      <button className="btn-primary">
                        Registrasi C.A.R.G.O Rewards
                      </button>
                    </Link>
                    <Link href="/login">
                      <button className="btn-outline">
                        Saya sudah punya akun
                      </button>
                    </Link>
                  </>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
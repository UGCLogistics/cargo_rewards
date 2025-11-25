"use client";

import Image from "next/image";
import Link from "next/link";

export default function RewardsHeader() {
  return (
    // area sticky transparan
    <header className="sticky top-0 z-40 px-4 pt-3 pb-2">
      {/* CARD KACA */}
      <div className="glass flex items-center gap-3 px-4 py-2">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="https://mhzymxqcfrmswjdydtbt.supabase.co/storage/v1/object/public/graphics/logo/logorewardswhiteorange.png"
            alt="CARGO Rewards"
            width={150}
            height={40}
            className="h-8 w-auto"
            priority
          />
        </Link>

        <div className="text-xs leading-tight text-slate-200">
          <div className="font-bold text-[#ff4600]">C.A.R.G.O Rewards</div>
          <div className="hidden sm:block text-slate-300">
            UGC Logistics – Loyalty & Rewards Program
          </div>
        </div>
      </div>
    </header>
  );
}

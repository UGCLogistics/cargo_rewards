"use client";

import Image from "next/image";
import Link from "next/link";

export default function RewardsHeader() {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/10 bg-slate-950/80 px-4 py-2 backdrop-blur-md">
      <Link href="/dashboard" className="flex items-center gap-2">
        <Image
          src="https://mhzymxqcfrmswjdydtbt.supabase.co/storage/v1/object/public/graphics/logo/logorewardswhiteorange.png"
          alt="CARGO Rewards"
          width={150}
          height={40}
          className="h-8 w-auto"
          priority
        />
      </Link>
      <div className="text-xs leading-tight text-slate-300">
        <div className="font-bold text-[#ff4600">C.A.R.G.O Rewards</div>
        <div className="hidden sm:block">
          UGC Logistics - Loyalty & Rewards Program
        </div>
      </div>
    </header>
  );
}

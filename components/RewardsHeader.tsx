"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function RewardsHeader() {
  const pathname = usePathname();

  // Hanya tampil di /dashboard dan semua sub-route-nya
  const showHeader =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if (!showHeader) {
    return null;
  }

  return (
    // sticky full-width di paling atas
    <header className="sticky top-0 z-40">
      {/* BAR KACA FULL WIDTH */}
      <div className="glass glass-header flex w-full items-center gap-3 px-4 py-2">
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
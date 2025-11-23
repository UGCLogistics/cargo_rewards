"use client";

import Image from "next/image";

export default function RewardsFooter() {
  return (
    <footer className="mt-4 border-t border-white/10 bg-slate-950/80 px-4 py-5 text-center text-xs text-slate-400 backdrop-blur-md">
      <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-slate-500">
        presented by
      </p>

      <div className="mb-2 flex justify-center">
        <Image
          src="https://mhzymxqcfrmswjdydtbt.supabase.co/storage/v1/object/public/graphics/logo/logougcorangewhite.png"
          alt="UGC Logistics"
          width={160}
          height={40}
          className="h-8 w-auto"
        />
      </div>

      <p className="text-[11px] sm:text-xs text-slate-300">
        PT UTAMA GLOBALINDO CARGO &nbsp;|&nbsp; &copy; 2025
      </p>
    </footer>
  );
}

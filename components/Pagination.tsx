"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  /** halaman aktif (1-based: mulai dari 1) */
  page: number;
  /** total halaman minimal 1 */
  totalPages: number;
  /** nomor baris pertama yang ditampilkan (mis. 1) */
  from: number;
  /** nomor baris terakhir yang ditampilkan (mis. 20) */
  to: number;
  /** total seluruh baris */
  totalCount: number;
  /** callback ketika pindah halaman */
  onPageChange: (page: number) => void;
};

export default function Pagination({
  page,
  totalPages,
  from,
  to,
  totalCount,
  onPageChange,
}: PaginationProps) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const goPrev = () => {
    if (!canPrev) return;
    onPageChange(page - 1);
  };

  const goNext = () => {
    if (!canNext) return;
    onPageChange(page + 1);
  };

  if (totalPages <= 1) {
    // kalau cuma 1 halaman, cukup info ringkas saja
    return (
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <div>
          Menampilkan{" "}
          <span className="font-semibold text-slate-200">{from}</span> -{" "}
          <span className="font-semibold text-slate-200">{to}</span> dari{" "}
          <span className="font-semibold text-slate-200">
            {totalCount}
          </span>{" "}
          baris
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
      <div>
        Menampilkan{" "}
        <span className="font-semibold text-slate-200">{from}</span> -{" "}
        <span className="font-semibold text-slate-200">{to}</span> dari{" "}
        <span className="font-semibold text-slate-200">
          {totalCount}
        </span>{" "}
        baris
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={goPrev}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-600/60 bg-slate-900/60 px-2.5 py-1.5 text-[11px] font-medium text-slate-100 backdrop-blur-md hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        <span className="text-[11px] text-slate-400">
          Hal{" "}
          <span className="font-semibold text-slate-100">{page}</span> /{" "}
          <span className="font-semibold text-slate-100">
            {totalPages}
          </span>
        </span>

        <button
          type="button"
          disabled={!canNext}
          onClick={goNext}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-600/60 bg-slate-900/60 px-2.5 py-1.5 text-[11px] font-medium text-slate-100 backdrop-blur-md hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="hidden sm:inline">Berikutnya</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "context/AuthContext";

type Role = "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER";

/**
 * ImportTransactionsPage hanya boleh diakses oleh INTERNAL
 * (ADMIN / MANAGER / STAFF). CUSTOMER akan diarahkan kembali
 * ke halaman riwayat transaksi.
 */
export default function ImportTransactionsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const rawRole = (user?.user_metadata as any)?.role || "CUSTOMER";
  const role = (rawRole as string).toUpperCase() as Role;
  const isInternal =
    role === "ADMIN" || role === "MANAGER" || role === "STAFF";

  useEffect(() => {
    if (!user) return;
    if (!isInternal) {
      router.replace("/dashboard/transactions");
    }
  }, [user, isInternal, router]);

  if (!user || !isInternal) {
    return <p className="text-sm text-slate-300">Mengalihkan…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Impor Transaksi</h1>
      <p className="text-sm text-slate-200">
        Fitur ini akan memungkinkan Anda mengimpor data transaksi secara
        massal dari file CSV atau Excel. Implementasikan pengunggahan file
        dan pengolahan data pada API sesuai kebutuhan bisnis Anda.
      </p>
    </div>
  );
}

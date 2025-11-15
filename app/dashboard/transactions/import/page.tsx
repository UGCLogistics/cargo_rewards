"use client";

import DashboardLayout from '../../layout';

/**
 * ImportTransactionsPage serves as a stub for bulk CSV/XLSX import of
 * transactions. Implement uploading to Supabase storage and parsing on
 * the server to insert multiple records in a single operation.
 */
export default function ImportTransactionsPage() {
  return (
    <DashboardLayout>
      <h1>Impor Transaksi</h1>
      <p>Fitur ini akan memungkinkan Anda mengimpor data transaksi secara massal dari file CSV atau Excel. Implementasikan pengunggahan file dan pengolahan data pada API sesuai kebutuhan bisnis Anda.</p>
    </DashboardLayout>
  );
}
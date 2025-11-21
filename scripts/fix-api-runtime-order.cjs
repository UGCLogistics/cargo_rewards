// scripts/fix-api-runtime-order.cjs
// Jalankan: node scripts/fix-api-runtime-order.cjs
//
// Fungsi:
// - Untuk semua app/api/**/route.ts(x):
//   1) Hapus baris "export const runtime = 'nodejs';"
//      dan "export const dynamic = 'force-dynamic';" dari posisi mereka sekarang.
//   2) Tambahkan kembali blok tsb tepat di BAWAH blok import teratas,
//      supaya tidak nyelip di tengah import multi-baris.

const fs = require("fs");
const path = require("path");

const root = process.cwd();

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (entry.isFile()) {
      callback(fullPath);
    }
  }
}

function fixFile(filePath) {
  if (!filePath.endsWith("route.ts") && !filePath.endsWith("route.tsx")) return;

  let content = fs.readFileSync(filePath, "utf8");

  // Kalau tidak ada runtime/dynamic, skip
  if (!content.includes("export const runtime") && !content.includes("export const dynamic")) {
    return;
  }

  const lines = content.split(/\r?\n/);
  const newLines = [];
  let removedRuntime = false;
  let removedDynamic = false;

  const runtimeRegex = /^\s*export const runtime\s*=\s*['"]nodejs['"];\s*$/;
  const dynamicRegex = /^\s*export const dynamic\s*=\s*['"]force-dynamic['"];\s*$/;

  // 1) Buang semua baris runtime/dynamic dari posisi sekarang
  for (const line of lines) {
    if (runtimeRegex.test(line)) {
      removedRuntime = true;
      continue;
    }
    if (dynamicRegex.test(line)) {
      removedDynamic = true;
      continue;
    }
    newLines.push(line);
  }

  if (!removedRuntime && !removedDynamic) {
    // Tidak ada yang dibuang, tidak perlu diproses
    return;
  }

  // 2) Cari akhir blok import teratas
  let idx = 0;
  while (idx < newLines.length) {
    const trimmed = newLines[idx].trim();
    if (
      trimmed.startsWith("import ") ||
      trimmed.startsWith("import type ") ||
      trimmed === "" // kosong masih dianggap bagian blok import
    ) {
      idx++;
      continue;
    }
    break;
  }

  const insertBlock = [
    "",
    "export const runtime = 'nodejs';",
    "export const dynamic = 'force-dynamic';",
    ""
  ];

  const finalLines = [
    ...newLines.slice(0, idx),
    ...insertBlock,
    ...newLines.slice(idx)
  ];

  fs.writeFileSync(filePath, finalLines.join("\n"), "utf8");
  console.log("✔ Fixed:", path.relative(root, filePath));
}

function main() {
  const apiRoot = path.join(root, "app", "api");
  if (!fs.existsSync(apiRoot)) {
    console.log("app/api tidak ditemukan, tidak ada yang diproses.");
    return;
  }
  console.log("=== Memperbaiki posisi runtime/dynamic di app/api/**/route.ts ===");
  walkDir(apiRoot, fixFile);
  console.log("=== Selesai ===");
}

main();

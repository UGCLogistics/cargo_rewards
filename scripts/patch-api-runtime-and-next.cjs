// scripts/patch-api-runtime-and-next.cjs
// Jalankan: node scripts/patch-api-runtime-and-next.cjs
// Fungsi:
// 1) Upgrade next & eslint-config-next ke ^14.2.0 di package.json
// 2) Tambahkan export runtime & dynamic di semua app/api/**/route.ts
//    jika belum ada.

const fs = require("fs");
const path = require("path");

const root = process.cwd();

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// 1) Update package.json: upgrade next & eslint-config-next
function updateNextVersion() {
  const pkgPath = path.join(root, "package.json");
  if (!fileExists(pkgPath)) {
    console.warn("package.json not found, skip updateNextVersion");
    return;
  }

  const pkg = readJSON(pkgPath);
  let changed = false;

  if (pkg.dependencies && pkg.dependencies.next) {
    if (pkg.dependencies.next !== "^14.2.0") {
      pkg.dependencies.next = "^14.2.0";
      changed = true;
      console.log(`✔ Set dependencies.next -> ^14.2.0`);
    }
  } else {
    console.warn("⚠ dependencies.next tidak ditemukan, lewati update next");
  }

  if (pkg.devDependencies && pkg.devDependencies["eslint-config-next"]) {
    if (pkg.devDependencies["eslint-config-next"] !== "^14.2.0") {
      pkg.devDependencies["eslint-config-next"] = "^14.2.0";
      changed = true;
      console.log(`✔ Set devDependencies["eslint-config-next"] -> ^14.2.0`);
    }
  } else {
    console.warn("⚠ devDependencies.eslint-config-next tidak ditemukan, lewati update eslint-config-next");
  }

  if (changed) {
    writeJSON(pkgPath, pkg);
    console.log("✔ package.json updated (Next.js 14.2.0 & eslint-config-next 14.2.0)");
  } else {
    console.log("ℹ package.json sudah pakai versi yang sesuai, tidak ada perubahan");
  }
}

// Helper: jalanin recursive ke folder
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

// 2) Tambah runtime & dynamic di semua app/api/**/route.ts
function patchApiRoutes() {
  const apiRoot = path.join(root, "app", "api");
  if (!fs.existsSync(apiRoot)) {
    console.log("ℹ app/api tidak ditemukan, skip patchApiRoutes");
    return;
  }

  const patchedFiles = [];

  walkDir(apiRoot, (filePath) => {
    // hanya route.ts / route.tsx
    if (!filePath.endsWith("route.ts") && !filePath.endsWith("route.tsx")) {
      return;
    }

    let content = fs.readFileSync(filePath, "utf8");

    // Kalau sudah ada runtime atau dynamic, skip
    if (content.includes("export const runtime") || content.includes("export const dynamic")) {
      return;
    }

    const lines = content.split(/\r?\n/);
    let lastImportIndex = -1;

    // cari import terakhir
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (
        trimmed.startsWith("import ") ||
        trimmed.startsWith("import type ")
      ) {
        lastImportIndex = i;
      }
    }

    const injectLines = [
      "export const runtime = 'nodejs';",
      "export const dynamic = 'force-dynamic';",
      "",
    ];

    if (lastImportIndex === -1) {
      // Tidak ada import, taruh di paling atas
      const newContent = injectLines.join("\n") + content;
      fs.writeFileSync(filePath, newContent, "utf8");
    } else {
      // Sisipkan setelah import terakhir
      const before = lines.slice(0, lastImportIndex + 1);
      const after = lines.slice(lastImportIndex + 1);
      const newLines = [...before, "", ...injectLines, ...after];
      fs.writeFileSync(filePath, newLines.join("\n"), "utf8");
    }

    patchedFiles.push(path.relative(root, filePath));
  });

  if (patchedFiles.length === 0) {
    console.log("ℹ Tidak ada app/api/**/route.ts yang perlu dipatch (mungkin sudah ada runtime/dynamic)");
  } else {
    console.log("✔ Patch runtime & dynamic ditambahkan ke file-file berikut:");
    patchedFiles.forEach((f) => console.log("  - " + f));
  }
}

function main() {
  console.log("=== Patch Next.js version & API runtime ===");
  updateNextVersion();
  patchApiRoutes();
  console.log("=== Selesai patch. Lanjutkan dengan npm install & npm run build. ===");
}

main();

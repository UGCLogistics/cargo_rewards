// scripts/migrate-supabase-ssr.js
// Jalankan: node scripts/migrate-supabase-ssr.js
// Pastikan dijalankan dari root project (tempat package.json berada).

const fs = require("fs");
const path = require("path");

const root = process.cwd();

// Helper util
function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 1) Update package.json: hapus auth-helpers, pastikan supabase-js & @supabase/ssr
function updatePackageJson() {
  const pkgPath = path.join(root, "package.json");
  if (!fileExists(pkgPath)) {
    console.warn("package.json not found, skip updatePackageJson");
    return;
  }

  const pkg = readJSON(pkgPath);
  pkg.dependencies = pkg.dependencies || {};

  // Hapus auth-helpers
  delete pkg.dependencies["@supabase/auth-helpers-nextjs"];
  delete pkg.dependencies["@supabase/auth-helpers-shared"];

  // Pastikan supabase-js & @supabase/ssr ada
  if (!pkg.dependencies["@supabase/supabase-js"]) {
    pkg.dependencies["@supabase/supabase-js"] = "^2.84.0";
  }
  if (!pkg.dependencies["@supabase/ssr"]) {
    pkg.dependencies["@supabase/ssr"] = "^0.7.0";
  }

  writeJSON(pkgPath, pkg);
  console.log("✔ package.json updated");
}

// 2) Buat helper SSR: lib/supabase/server.ts & client.ts
function ensureSupabaseHelpers() {
  const supabaseDir = path.join(root, "lib", "supabase");
  ensureDir(supabaseDir);

  const serverPath = path.join(supabaseDir, "server.ts");
  const clientPath = path.join(supabaseDir, "client.ts");

  if (!fileExists(serverPath)) {
    const serverContent = `import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Server-side Supabase client untuk Next.js App Router.
 * Menggunakan cookie Next.js untuk menyimpan session.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        /**
         * Untuk Next.js 13/14, cookies() hanya writable di server actions
         * / route handlers. Jika kamu perlu set cookie di situ, fungsi ini
         * akan dipanggil oleh Supabase.
         */
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );
}
`;
    fs.writeFileSync(serverPath, serverContent, "utf8");
    console.log("✔ lib/supabase/server.ts created");
  } else {
    console.log("ℹ lib/supabase/server.ts already exists, skipped");
  }

  if (!fileExists(clientPath)) {
    const clientContent = `import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * Dipakai di komponen client (React) / AuthContext.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
`;
    fs.writeFileSync(clientPath, clientContent, "utf8");
    console.log("✔ lib/supabase/client.ts created");
  } else {
    console.log("ℹ lib/supabase/client.ts already exists, skipped");
  }
}

// 3) Update lib/supabaseClient.ts (kalau ada)
function updateSupabaseClientTs() {
  const candidates = [
    path.join(root, "lib", "supabaseClient.ts"),
    path.join(root, "src", "lib", "supabaseClient.ts"),
  ];

  for (const filePath of candidates) {
    if (!fileExists(filePath)) continue;

    let content = fs.readFileSync(filePath, "utf8");
    let updated = content;

    // Remove import dari auth-helpers
    updated = updated.replace(
      /import\s+{[^}]*}\s+from\s+['"]@supabase\/auth-helpers-nextjs['"];?\s*/g,
      ""
    );

    // Pastikan import dari helper baru
    if (!updated.includes('lib/supabase/client')) {
      updated =
        `import { createClient } from "@/lib/supabase/client";\n` +
        updated;
    }

    // Ganti createBrowserSupabaseClient() -> createClient()
    updated = updated.replace(
      /createBrowserSupabaseClient\s*\(\s*\)/g,
      "createClient()"
    );

    if (updated !== content) {
      fs.writeFileSync(filePath, updated, "utf8");
      console.log("✔ Updated", path.relative(root, filePath));
    }
  }
}

// 4) Update AuthContext.tsx (Session/User types)
function updateAuthContext() {
  const candidates = [
    path.join(root, "context", "AuthContext.tsx"),
    path.join(root, "src", "context", "AuthContext.tsx"),
  ];

  for (const filePath of candidates) {
    if (!fileExists(filePath)) continue;

    let content = fs.readFileSync(filePath, "utf8");
    let updated = content;

    updated = updated.replace(
      /import\s+type\s+{[^}]*Session[^}]*}\s+from\s+['"]@supabase\/auth-helpers-nextjs['"];?\s*/g,
      ""
    );
    updated = updated.replace(
      /import\s+{[^}]*Session[^}]*}\s+from\s+['"]@supabase\/auth-helpers-nextjs['"];?\s*/g,
      ""
    );

    // Tambah import baru kalau belum ada
    if (!updated.includes("@supabase/supabase-js")) {
      updated =
        `import type { Session, User } from "@supabase/supabase-js";\n` +
        updated;
    }

    if (updated !== content) {
      fs.writeFileSync(filePath, updated, "utf8");
      console.log("✔ Updated", path.relative(root, filePath));
    }
  }
}

// 5) Update route handlers di app/api
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

function updateApiRoutes() {
  const apiRoot = path.join(root, "app", "api");
  if (!fs.existsSync(apiRoot)) {
    console.log("ℹ app/api not found, skip updateApiRoutes");
    return;
  }

  walkDir(apiRoot, (filePath) => {
    if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) return;

    let content = fs.readFileSync(filePath, "utf8");
    if (!content.includes("@supabase/auth-helpers-nextjs")) return;

    let updated = content;

    // Hapus import dari auth-helpers
    updated = updated.replace(
      /import\s+{[^}]*}\s+from\s+['"]@supabase\/auth-helpers-nextjs['"];?\s*/g,
      ""
    );

    // Tambah import createClient kalau belum ada
    if (!updated.includes('from "@/lib/supabase/server"')) {
      updated =
        `import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";\n` +
        updated;
    }

    // Ganti pemanggilan helper lama
    updated = updated.replace(
      /createRouteHandlerSupabaseClient\s*\(\s*{[^}]*}\s*\)/g,
      "createSupabaseServerClient()"
    );
    updated = updated.replace(
      /createRouteHandlerClient\s*\(\s*{[^}]*}\s*\)/g,
      "createSupabaseServerClient()"
    );
    updated = updated.replace(
      /createRouteHandlerSupabaseClient\s*\(\s*\)/g,
      "createSupabaseServerClient()"
    );

    if (updated !== content) {
      fs.writeFileSync(filePath, updated, "utf8");
      console.log("✔ Updated", path.relative(root, filePath));
    }
  });
}

function main() {
  console.log("=== Supabase SSR migration (script) ===");
  updatePackageJson();
  ensureSupabaseHelpers();
  updateSupabaseClientTs();
  updateAuthContext();
  updateApiRoutes();
  console.log("=== Done. Silakan lanjut ke npm install & build. ===");
}

main();

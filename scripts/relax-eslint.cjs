// scripts/relax-eslint.cjs
// Jalankan: node scripts/relax-eslint.cjs
//
// Fungsi:
// - Baca .eslintrc.json
// - Tambah / update rules supaya lebih longgar:
//   - Matikan @typescript-eslint/no-explicit-any
//   - Matikan @typescript-eslint/no-unused-vars
//   - Matikan prefer-const
//   - Matikan react-hooks/exhaustive-deps

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const eslintrcPath = path.join(root, ".eslintrc.json");

if (!fs.existsSync(eslintrcPath)) {
  console.error("❌ .eslintrc.json tidak ditemukan di root project.");
  process.exit(1);
}

let raw;
try {
  raw = fs.readFileSync(eslintrcPath, "utf8");
} catch (e) {
  console.error("❌ Gagal baca .eslintrc.json:", e);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(raw);
} catch (e) {
  console.error("❌ .eslintrc.json bukan JSON valid:", e);
  process.exit(1);
}

if (!config || typeof config !== "object") {
  console.error("❌ Isi .eslintrc.json tidak valid.");
  process.exit(1);
}

config.rules = config.rules || {};

const newRules = {
  "@typescript-eslint/no-explicit-any": "off",
  "@typescript-eslint/no-unused-vars": "off",
  "prefer-const": "off",
  "react-hooks/exhaustive-deps": "off",
};

config.rules = {
  ...config.rules,
  ...newRules,
};

try {
  fs.writeFileSync(eslintrcPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log("✅ .eslintrc.json berhasil di-update. Rules dilonggarkan:");
  console.log(newRules);
} catch (e) {
  console.error("❌ Gagal menulis .eslintrc.json:", e);
  process.exit(1);
}

// 版の番号を上げる: node scripts/bump-version.mjs 2
// version.json の version と js/version.mjs の APP_VERSION を同じ番号に書き換える（docs/deploy.md）
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const next = process.argv[2];
if (!/^[\w.-]+$/.test(next || "")) {
  console.error("使い方: node scripts/bump-version.mjs <新しい番号。例 2>");
  process.exit(1);
}
const root = fileURLToPath(new URL("..", import.meta.url));
writeFileSync(root + "version.json", JSON.stringify({ version: next }) + "\n");
const p = root + "js/version.mjs";
const src = readFileSync(p, "utf8");
const out = src.replace(/export const APP_VERSION = "[^"]*";/, `export const APP_VERSION = "${next}";`);
if (out === src && !src.includes(`APP_VERSION = "${next}"`)) { console.error("APP_VERSION が見つかりません"); process.exit(1); }
writeFileSync(p, out);
console.log("版の番号を " + next + " にしました");

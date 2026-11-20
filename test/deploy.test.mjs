import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function mjsFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...mjsFiles(p));
    else if (e.name.endsWith(".mjs")) out.push(p);
  }
  return out;
}

test("GitHub Pages 用に .nojekyll がある", () => {
  assert.ok(existsSync(join(root, ".nojekyll")));
});

test("index.html の読み込みは相対パス（下位のパスでも読める）", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.includes("manifest.webmanifest"));
  assert.ok(refs.includes("js/main.mjs"));
  for (const r of refs) assert.ok(!r.startsWith("/") && !/^https?:/.test(r), r);
});

test("manifest の start_url は相対パス", () => {
  const m = JSON.parse(readFileSync(join(root, "manifest.webmanifest"), "utf8"));
  assert.ok(!m.start_url.startsWith("/") && !/^https?:/.test(m.start_url));
});

test("js/ の import は ./ か ../ の相対パスだけ", () => {
  for (const f of mjsFiles(join(root, "js"))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)) {
      assert.match(m[1], /^\.\.?\//, `${f}: ${m[1]}`);
    }
  }
});

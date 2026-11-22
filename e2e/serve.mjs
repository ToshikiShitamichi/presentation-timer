// 画面のテスト用の静的サーバー（127.0.0.1 だけ）。配るのは index.html・manifest.webmanifest・js/ だけ
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.argv[2] || 4890);
const TYPES = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".webmanifest": "application/manifest+json" };
const ALLOWED = (p) => p === "/index.html" || p === "/manifest.webmanifest" || /^\/js\/[\w./-]+\.mjs$/.test(p);

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  if (p.includes("..") || !ALLOWED(p)) { res.writeHead(404); res.end("not found"); return; }
  try {
    const body = await readFile(normalize(join(root, p)));
    res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}).listen(port, "127.0.0.1");

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_VERSION, hasNewVersion } from "../js/version.mjs";
import { createUpdater } from "../js/update.mjs";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

test("hasNewVersion: 番号が違えば更新あり、同じなら何もしない", () => {
  assert.equal(hasNewVersion("1", { version: "2" }), true);
  assert.equal(hasNewVersion("2", { version: "2" }), false);
});

test("hasNewVersion: 取りに行けない・壊れた中身なら何もしない（エラーも出さない）", () => {
  for (const bad of [null, undefined, "x", 3, [], {}, { version: "" }, { version: 2 }, { version: null }]) {
    assert.equal(hasNewVersion("1", bad), false, JSON.stringify(bad));
  }
  assert.equal(hasNewVersion("", { version: "2" }), false);
});

function setup({ latest, busy = false, guardValue = null }) {
  const calls = { reload: 0, fetch: 0 };
  let g = guardValue;
  const state = { latest, busy };
  const u = createUpdater({
    current: "1",
    fetchLatest: async () => { calls.fetch++; if (state.latest instanceof Error) throw state.latest; return state.latest; },
    isBusy: () => state.busy,
    reload: async () => { calls.reload++; },
    guard: { get: () => g, set: (v) => { g = v; } },
  });
  return { u, calls, state };
}

test("createUpdater: 違えば読み直す。同じ版へは2回読み直さない", async () => {
  const { u, calls } = setup({ latest: { version: "2" } });
  await u.check();
  await u.check();
  assert.equal(calls.reload, 1);
});

test("createUpdater: 同じ番号・取れない・壊れた中身では読み直さない", async () => {
  for (const latest of [{ version: "1" }, null, new Error("offline"), { oops: 1 }]) {
    const { u, calls } = setup({ latest });
    await u.check();
    assert.equal(calls.reload, 0);
  }
});

test("createUpdater: S-02 の間は読み直さず、離れたあとで読み直す", async () => {
  const { u, calls, state } = setup({ latest: { version: "2" }, busy: true });
  await u.check();
  assert.equal(calls.reload, 0);
  state.busy = false;
  await u.check();
  assert.equal(calls.reload, 1);
});

test("version.json と js の定数の番号が同じ", () => {
  const j = JSON.parse(readFileSync(join(root, "version.json"), "utf8"));
  assert.equal(typeof j.version, "string");
  assert.equal(j.version, APP_VERSION);
});

test("docs/deploy.md に「更新のたびに版の番号を上げる」手順がある", () => {
  const md = readFileSync(join(root, "docs/deploy.md"), "utf8");
  assert.match(md, /更新のたびに版の番号を上げる/);
  assert.match(md, /version\.json/);
  assert.match(md, /APP_VERSION/);
});

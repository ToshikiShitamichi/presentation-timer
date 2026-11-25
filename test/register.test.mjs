import { test } from "node:test";
import assert from "node:assert/strict";
import { registerLecture } from "../js/register.mjs";
import { loadLectures, STORAGE_KEY } from "../js/storage.mjs";

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
const TEXT = "9:30\t0:10\t導入\t【01 はじめに】\tスライド1〜8枚目\n9:40\t0:05\t休憩\t【休憩】\t";

test("R-007-1 タイトルと進行表を1つの講義として保存する（前後の空白は除く）", () => {
  const st = memoryStorage();
  const r = registerLecture(st, "  11/20 午前  ", TEXT);
  assert.equal(r.ok, true);
  const ls = loadLectures(st);
  assert.equal(ls.length, 1);
  assert.equal(ls[0].title, "11/20 午前");
  assert.equal("lecture_date" in ls[0], false);
  assert.equal(ls[0].blocks.length, 2);
  assert.equal(r.warning, null);
});

test("R-007-2 同じタイトルの別の講義も追加で保存する", () => {
  const st = memoryStorage();
  registerLecture(st, "2026-11-20", TEXT);
  const r = registerLecture(st, "2026-11-20", "13:00\t0:30\tA\t【02 午後】\tスライド9枚目");
  assert.equal(r.ok, true);
  const ls = loadLectures(st);
  assert.equal(ls.length, 2);
  assert.deepEqual(ls.map((l) => l.title), ["2026-11-20", "2026-11-20"]);
  assert.notEqual(ls[0].id, ls[1].id);
});

test("取り込めないテキストは保存せず、理由を返す", () => {
  const st = memoryStorage();
  const r = registerLecture(st, "2026-11-20", "abc\t0:10\tx\ty");
  assert.equal(r.ok, false);
  assert.match(r.error, /1行目の開始時間/);
  assert.equal(st.getItem(STORAGE_KEY), null);
  assert.equal(registerLecture(st, "2026-11-20", "").ok, false);
});

test("タイトルが空（空白だけも）は保存しない", () => {
  const st = memoryStorage();
  const r = registerLecture(st, "", TEXT);
  assert.equal(r.ok, false);
  assert.match(r.error, /タイトル/);
  assert.equal(registerLecture(st, "   ", TEXT).ok, false);
  assert.equal(registerLecture(st, undefined, TEXT).ok, false);
  assert.equal(st.getItem(STORAGE_KEY), null);
});

test("前の形の保存（lecture_date だけ）は、タイトルとして読む", () => {
  const st = memoryStorage();
  st.setItem(STORAGE_KEY, JSON.stringify({ lectures: [{ id: 1, lecture_date: "2026-11-20", blocks: [] }] }));
  assert.equal(loadLectures(st)[0].title, "2026-11-20");
});

test("100 に近づくと警告を返す", () => {
  const st = memoryStorage();
  let r;
  for (let i = 0; i < 90; i++) r = registerLecture(st, "2026-11-20", TEXT);
  assert.match(r.warning, /90 件/);
});

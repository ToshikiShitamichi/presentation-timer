import { test } from "node:test";
import assert from "node:assert/strict";
import { exportLectures, importLectures, exportFileName, replaceLectures, BACKUP_FORMAT } from "../js/backup.mjs";
import { registerLecture } from "../js/register.mjs";
import { loadLectures, deleteLecture, STORAGE_KEY } from "../js/storage.mjs";

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
const TEXT1 = "9:30\t0:10\t導入\t【01 はじめに】\tスライド1〜8枚目\n9:40\t0:05\t休憩\t【休憩】\t";
const TEXT2 = "13:00\t0:30\tA\t【02 午後】\tスライド9枚目";

function pcWith(...items) {
  const st = memoryStorage();
  for (const [d, t] of items) assert.equal(registerLecture(st, d, t).ok, true);
  return st;
}

test("書き出し→読み込みで元と同じ講義になる", () => {
  const pc = pcWith(["2026-11-20", TEXT1], ["2026-11-21", TEXT2]);
  const text = exportLectures(pc, new Date(2026, 10, 20));
  assert.equal(JSON.parse(text).format, BACKUP_FORMAT);
  const phone = memoryStorage();
  const r = importLectures(phone, text);
  assert.deepEqual([r.ok, r.added, r.skipped], [true, 2, 0]);
  assert.deepEqual(loadLectures(phone), loadLectures(pc));
});

test("同じファイルを2回読んでも増えない", () => {
  const text = exportLectures(pcWith(["2026-11-20", TEXT1]));
  const phone = memoryStorage();
  importLectures(phone, text);
  const r = importLectures(phone, text);
  assert.deepEqual([r.ok, r.added, r.skipped], [true, 0, 1]);
  assert.equal(loadLectures(phone).length, 1);
});

test("ほかの講義の後ろに足され、id は重ならない", () => {
  const text = exportLectures(pcWith(["2026-11-20", TEXT1], ["2026-11-21", TEXT2]));
  const phone = pcWith(["2026-11-19", TEXT2]);
  const r = importLectures(phone, text);
  assert.equal(r.added, 2);
  const ls = loadLectures(phone);
  assert.equal(ls.length, 3);
  assert.deepEqual(ls.map((l) => l.lecture_date), ["2026-11-19", "2026-11-20", "2026-11-21"]);
  assert.equal(new Set(ls.map((l) => l.id)).size, 3);
  const blockIds = ls.flatMap((l) => l.blocks.map((b) => b.id));
  assert.equal(new Set(blockIds).size, blockIds.length);
  for (const l of ls) for (const b of l.blocks) assert.equal(b.lecture_id, l.id);
});

test("同じ日付でも blocks が違えば足す", () => {
  const text = exportLectures(pcWith(["2026-11-20", TEXT2]));
  const phone = pcWith(["2026-11-20", TEXT1]);
  assert.equal(importLectures(phone, text).added, 1);
  assert.equal(loadLectures(phone).length, 2);
});

test("形式違い・壊れた JSON は保存を変えずエラーの文を返す", () => {
  const phone = pcWith(["2026-11-20", TEXT1]);
  const before = phone.getItem(STORAGE_KEY);
  const bad = [
    "{ これは壊れている",
    "",
    JSON.stringify({ lectures: [] }),
    JSON.stringify({ format: "other", version: 1, lectures: [] }),
    JSON.stringify({ format: BACKUP_FORMAT, version: 99, lectures: [] }),
    JSON.stringify({ format: BACKUP_FORMAT, version: 1 }),
    JSON.stringify({ format: BACKUP_FORMAT, version: 1, lectures: [{ lecture_date: "2026-02-30", blocks: [{ start_time: "9:00" }] }] }),
    // 2件目だけ壊れていても、1件目も足さない
    JSON.stringify({ format: BACKUP_FORMAT, version: 1, lectures: [{ lecture_date: "2026-12-01", blocks: [{ start_time: "9:00" }] }, { lecture_date: "2026-12-02", blocks: [] }] }),
  ];
  for (const t of bad) {
    const r = importLectures(phone, t);
    assert.equal(r.ok, false);
    assert.ok(typeof r.error === "string" && r.error.length > 0);
    assert.equal(phone.getItem(STORAGE_KEY), before);
  }
});

test("講義が0件なら書き出さない（null）", () => {
  assert.equal(exportLectures(memoryStorage()), null);
});

test("90 件に達すると警告を返す", () => {
  const items = Array.from({ length: 90 }, (_, i) => ["2026-11-20", `9:00\t0:10\tx\t内容${i}`]);
  const text = exportLectures(pcWith(...items));
  const r = importLectures(memoryStorage(), text);
  assert.equal(r.added, 90);
  assert.match(r.warning, /90 件/);
});

test("ファイル名の例", () => {
  assert.equal(exportFileName(new Date(2026, 10, 20)), "presentation-timer-lectures-2026-11-20.json");
});

test("削除で指定の1件だけが消え、ほかは残る", () => {
  const st = pcWith(["2026-11-20", TEXT1], ["2026-11-21", TEXT2]);
  const before = loadLectures(st);
  assert.equal(deleteLecture(st, before[0].id), true);
  assert.deepEqual(loadLectures(st), [before[1]]);
});

test("存在しない id では何も変えない", () => {
  const st = pcWith(["2026-11-20", TEXT1]);
  const raw = st.getItem(STORAGE_KEY);
  assert.equal(deleteLecture(st, 999), false);
  assert.equal(st.getItem(STORAGE_KEY), raw);
});

test("置き換えで保存がファイルの中身だけになり、書き出すとファイルと同じ講義になる", () => {
  const pc = pcWith(["2026-11-20", TEXT1], ["2026-11-21", TEXT2]);
  const text = exportLectures(pc, new Date(2026, 10, 20));
  const phone = pcWith(["2026-01-01", TEXT2], ["2026-01-02", TEXT2], ["2026-01-03", TEXT1]);
  const r = replaceLectures(phone, text);
  assert.deepEqual([r.ok, r.count], [true, 2]);
  assert.deepEqual(loadLectures(phone).map((l) => l.lecture_date), ["2026-11-20", "2026-11-21"]);
  assert.deepEqual(JSON.parse(exportLectures(phone, new Date(2026, 10, 20))).lectures, JSON.parse(text).lectures);
});

test("置き換えは、形式違い・壊れた JSON・0件・読めない講義では保存が変わらない", () => {
  const st = pcWith(["2026-11-20", TEXT1]);
  const raw = st.getItem(STORAGE_KEY);
  const empty = JSON.stringify({ format: BACKUP_FORMAT, version: 1, lectures: [] });
  const badLecture = JSON.stringify({ format: BACKUP_FORMAT, version: 1, lectures: [{ lecture_date: "2026-11-21", blocks: [{ start_time: "9:00" }] }, { lecture_date: "x", blocks: [] }] });
  for (const t of ["{", JSON.stringify({ format: "other", version: 1, lectures: [] }), empty, badLecture]) {
    const r = replaceLectures(st, t);
    assert.equal(r.ok, false);
    assert.ok(r.error.length > 0);
    assert.equal(st.getItem(STORAGE_KEY), raw);
  }
});

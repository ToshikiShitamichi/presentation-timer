import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSchedule, parseTsv } from "../js/schedule-import.mjs";
import { addLecture, loadLectures, saveLectures, storageWarning, STORAGE_KEY } from "../js/storage.mjs";

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

const HEADER = "開始時間\t所要時間\tステップ\t進め方・手順\t使用ツール・資料\tハマりポイント／フォロー方法\t時間調整ポイント";
const ROW1 = "9:30\t0:10\t導入\t\"見出し\n2行目\"\tスライド1〜8枚目\t詰まる所\t短縮可";
const ROW2 = "9:40\t0:10\t\t【休憩】\t\t\t";
const ROW3 = "16:37\t0:08\tまとめ\t振り返り\t\t\t";

test("BR-001 列の順に読む", () => {
  const [b] = parseSchedule(ROW1);
  assert.equal(b.start_time, "9:30");
  assert.equal(b.duration, "0:10");
  assert.equal(b.step, "導入");
  assert.equal(b.tools_materials, "スライド1〜8枚目");
  assert.equal(b.trouble_follow_up, "詰まる所");
  assert.equal(b.time_adjustment, "短縮可");
});

test("R-001-1 / BR-002 1行が1ブロック、引用符の中の改行はセルの一部", () => {
  const blocks = parseSchedule([ROW1, ROW2, ROW3].join("\n"));
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].procedure, "見出し\n2行目");
  assert.deepEqual(blocks.map((b) => b.sort_order), [1, 2, 3]);
  assert.equal(parseSchedule([ROW1, ROW2].join("\r\n")).length, 2);
});

test("引用符の中の二重引用符と引用符内のタブ", () => {
  assert.deepEqual(parseTsv('"a ""b""\tc"\td'), [['a "b"\tc', "d"]]);
});

test("R-001-3 / BR-003 ヘッダー行は読み飛ばす", () => {
  const blocks = parseSchedule([HEADER, ROW1].join("\n"));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].start_time, "9:30");
});

test("R-002-1 / BR-004 【休憩】の行は休憩のブロック", () => {
  const blocks = parseSchedule([ROW1, ROW2].join("\n"));
  assert.equal(blocks[0].is_break, false);
  assert.equal(blocks[1].is_break, true);
});

test("取り込めないテキストは Error", () => {
  assert.throws(() => parseSchedule(""), /取り込める行がありません/);
  assert.throws(() => parseSchedule("あ\tい"), /開始時間/);
  assert.throws(() => parseSchedule("9:30\tあ"), /所要時間/);
});

test("T-002 講義1件に blocks を持たせて保存・読み込みできる", () => {
  const st = fakeStorage();
  const blocks = parseSchedule([ROW1, ROW2].join("\n"));
  const { lecture } = addLecture(st, "2026-11-20", blocks);
  assert.equal(lecture.id, 1);
  const loaded = loadLectures(st);
  assert.deepEqual(loaded, [lecture]);
  assert.deepEqual(Object.keys(loaded[0]).sort(), ["blocks", "id", "title"]);
  assert.deepEqual(
    Object.keys(loaded[0].blocks[0]).sort(),
    ["duration", "id", "is_break", "lecture_id", "procedure", "sort_order", "start_time", "step", "time_adjustment", "tools_materials", "trouble_follow_up"],
  );
  assert.equal(loaded[0].blocks[1].is_break, true);
  assert.equal(loaded[0].blocks[0].lecture_id, 1);
});

test("R-007-2 同じ日付でも追加で保存し、id は重ならない", () => {
  const st = fakeStorage();
  const blocks = parseSchedule([ROW1, ROW2].join("\n"));
  addLecture(st, "2026-11-20", blocks);
  addLecture(st, "2026-11-20", blocks);
  const l = loadLectures(st);
  assert.equal(l.length, 2);
  const ids = l.flatMap((x) => x.blocks.map((b) => b.id));
  assert.equal(new Set(ids).size, 4);
});

test("R-007-3 開き直しても残る・壊れた保存は空", () => {
  const st = fakeStorage();
  addLecture(st, "2026-11-20", parseSchedule(ROW1));
  assert.equal(loadLectures(st).length, 1);
  st.setItem(STORAGE_KEY, "{壊れた");
  assert.deepEqual(loadLectures(st), []);
  assert.deepEqual(loadLectures(fakeStorage()), []);
});

test("判断事項4 100 講義に近づいたら警告", () => {
  assert.equal(storageWarning(89), null);
  assert.match(storageWarning(90), /近づいています/);
  assert.match(storageWarning(100), /目安/);
  const st = fakeStorage();
  saveLectures(st, Array.from({ length: 89 }, (_, i) => ({ id: i + 1, lecture_date: "2026-01-01", blocks: [] })));
  assert.equal(addLecture(st, "2026-11-20", parseSchedule(ROW1)).warning, storageWarning(90));
});

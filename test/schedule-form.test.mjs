import { test } from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEY, loadLectures, loadGroups, addGroup } from "../js/storage.mjs";
import { registerLecture, registerLectureForm, editLectureForm } from "../js/register.mjs";
import { parseSchedule, formRowsToBlocks, blocksToFormRows } from "../js/schedule-import.mjs";
import { screens, emptyFormRow, formRowsHtml } from "../js/screens/registry.mjs";

function memStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), raw: () => m.get(STORAGE_KEY) };
}
const row = (o) => ({ ...emptyFormRow(), ...o });

test("フォームの行からブロックを作る: 貼り付けと同じ結果。休憩は【休憩】", () => {
  const rows = [
    row({ start_time: "9:30", duration: "0:10", step: "導入", procedure: "自己紹介", tools_materials: "p.1" }),
    row({ start_time: "9:40", duration: "0:10", step: "休憩", procedure: "無視される", is_break: true }),
  ];
  const blocks = formRowsToBlocks(rows);
  assert.equal(blocks[1].procedure, "【休憩】");
  assert.equal(blocks[1].is_break, true);
  assert.equal(blocks[0].is_break, false);
  const pasted = parseSchedule("9:30\t0:10\t導入\t自己紹介\tp.1\t\t\n9:40\t0:10\t休憩\t【休憩】\t\t\t\n");
  assert.deepEqual(blocks, pasted);
});

test("フォーム: 全部空の行は数えない。0行は「取り込める行がありません。」", () => {
  const blocks = formRowsToBlocks([row({}), row({ start_time: "9:00", duration: "1:00" }), row({})]);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].sort_order, 1);
  assert.throws(() => formRowsToBlocks([row({}), row({})]), { message: "取り込める行がありません。" });
  assert.throws(() => formRowsToBlocks([]), { message: "取り込める行がありません。" });
});

test("フォーム: 時刻の誤りは何行目かを出す", () => {
  assert.throws(() => formRowsToBlocks([row({ start_time: "9:00", duration: "1:00" }), row({ start_time: "9時", duration: "0:10" })]), /^Error: 2行目の開始時間「9時」が読めません/);
  assert.throws(() => formRowsToBlocks([row({ start_time: "9:00", duration: "10分" })]), /1行目の所要時間「10分」が読めません/);
});

test("登録・編集（フォーム）: 誤りは保存しない。タイトルが空でも保存しない。編集は id・並び・グループを保つ", () => {
  const s = memStorage();
  registerLecture(s, "A", "9:00\t0:30\t導入\t自己紹介\tp.1\n");
  registerLecture(s, "B", "10:00\t0:30\t演習\t演習1\tp.2\n");
  addGroup(s, "通し", [1, 2]);
  const raw = s.raw();
  assert.equal(registerLectureForm(s, "新", [row({ start_time: "9時", duration: "0:10" })]).ok, false);
  assert.deepEqual(registerLectureForm(s, " ", [row({ start_time: "9:00", duration: "0:10" })]), { ok: false, error: "タイトルを入れてください。" });
  assert.equal(registerLectureForm(s, "新", []).error, "取り込める行がありません。");
  assert.equal(editLectureForm(s, 1, "A改", [row({ start_time: "x", duration: "0:10" })]).ok, false);
  assert.equal(s.raw(), raw);
  const r = registerLectureForm(s, "C", [row({ start_time: "13:00", duration: "1:00", step: "応用" })]);
  assert.equal(r.ok, true);
  assert.equal(loadLectures(s).length, 3);
  const e = editLectureForm(s, 2, "B改", [row({ start_time: "11:00", duration: "0:20", procedure: "新しい手順" })]);
  assert.equal(e.ok, true);
  const after = loadLectures(s);
  assert.deepEqual(after.slice(0, 2).map((l) => l.id), [1, 2]);
  assert.equal(after[1].title, "B改");
  assert.equal(after[1].blocks[0].procedure, "新しい手順");
  assert.deepEqual(loadGroups(s).map((g) => g.lecture_ids), [[1, 2]]);
});

test("blocksToFormRows: 休憩の行は進め方・手順を空にしてチェックを付ける。戻すと元のブロックと同じ", () => {
  const blocks = parseSchedule("9:00\t0:30\t導入\t手順\tp.1\t困る\t調整\n9:30\t0:10\t休憩\t【休憩】\t\t\t\n");
  const rows = blocksToFormRows(blocks);
  assert.equal(rows[1].is_break, true);
  assert.equal(rows[1].procedure, "");
  assert.deepEqual(formRowsToBlocks(rows), blocks);
});

test("フォームの HTML: 入力された文字は escapeHtml を通す", () => {
  const h = formRowsHtml([row({ step: '<img src=x onerror=alert(1)>', start_time: '"><b>' })]);
  assert.doesNotMatch(h, /<img/);
  assert.doesNotMatch(h, /<b>/);
  assert.match(h, /&lt;img/);
});

test("S-05: フォームに今のブロックが入った状態で出る。最初は貼り付け。S-04 のフォームは空の1行", () => {
  const s = memStorage();
  registerLecture(s, "A", "9:00\t0:30\t導入\t自己紹介\tp.1\n9:30\t0:10\t休憩\t【休憩】\t\t\t\n");
  const mk = () => ({ innerHTML: "", textContent: "", querySelector: () => ({ addEventListener() {}, setAttribute() {} }) });
  const c = mk();
  screens["S-05"].render(c, { id: 1, storage: s, navigate() {} });
  assert.match(c.innerHTML, /aria-pressed="true">貼り付け/);
  assert.match(c.innerHTML, /id="editFormBox" hidden/);
  assert.equal((c.innerHTML.match(/class="fRow"/g) || []).length, 2);
  assert.match(c.innerHTML, /data-f="start_time" value="9:30"/);
  assert.match(c.innerHTML, /自己紹介<\/textarea>/);
  assert.match(c.innerHTML, /data-f="is_break" checked/);
  const c4 = mk();
  screens["S-04"].render(c4, { storage: s, navigate() {} });
  assert.equal((c4.innerHTML.match(/class="fRow"/g) || []).length, 1);
  assert.doesNotMatch(c4.innerHTML, /data-f="is_break" checked/);
});

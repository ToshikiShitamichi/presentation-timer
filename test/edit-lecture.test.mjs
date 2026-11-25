import { test } from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEY, loadLectures, loadGroups, addGroup } from "../js/storage.mjs";
import { registerLecture, editLecture } from "../js/register.mjs";
import { parseSchedule, blocksToTsv } from "../js/schedule-import.mjs";
import { screens } from "../js/screens/registry.mjs";

function memStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), raw: () => m.get(STORAGE_KEY) };
}

const TSV_A = "9:00\t0:30\t導入\t自己紹介\tp.1\n9:30\t0:10\t休憩\t【休憩】\t\n";
const TSV_B = "10:00\t1:00\t演習\t演習1\tp.2\n";
const TSV_C = "13:00\t1:00\t応用\t応用の内容\tp.9\n";

function setup() {
  const s = memStorage();
  registerLecture(s, "A", TSV_A);
  registerLecture(s, "B", TSV_B);
  registerLecture(s, "C", TSV_C);
  addGroup(s, "通し", [1, 2]);
  return s;
}

test("編集: id・グループの並び・ほかの講義は変わらず、タイトルと進行表だけ置き換わる", () => {
  const s = setup();
  const before = loadLectures(s);
  const r = editLecture(s, 2, "B改", "11:00\t0:20\t新\t新しい手順\tp.5\n");
  assert.equal(r.ok, true);
  const after = loadLectures(s);
  assert.deepEqual(after.map((l) => l.id), [1, 2, 3]);
  assert.equal(after[1].title, "B改");
  assert.equal(after[1].blocks.length, 1);
  assert.equal(after[1].blocks[0].procedure, "新しい手順");
  assert.equal(after[1].blocks[0].lecture_id, 2);
  assert.deepEqual(after[0], before[0]);
  assert.deepEqual(after[2], before[2]);
  assert.deepEqual(loadGroups(s).map((g) => g.lecture_ids), [[1, 2]]);
  const ids = after.flatMap((l) => l.blocks.map((b) => b.id));
  assert.equal(new Set(ids).size, ids.length); // ブロックの id は重ならない
});

test("編集: タイトルが空なら文を出して保存を変えない", () => {
  const s = setup();
  const raw = s.raw();
  for (const t of ["", "   "]) {
    const r = editLecture(s, 1, t, TSV_B);
    assert.deepEqual(r, { ok: false, error: "タイトルを入れてください。" });
  }
  assert.equal(s.raw(), raw);
});

test("編集: 進行表が取り込めないときもエラーの文を出して保存を変えない", () => {
  const s = setup();
  const raw = s.raw();
  const r1 = editLecture(s, 1, "A", "あいう\t0:10\n");
  assert.equal(r1.ok, false);
  assert.match(r1.error, /開始時間/);
  const r2 = editLecture(s, 1, "A", "");
  assert.deepEqual(r2, { ok: false, error: "取り込める行がありません。" });
  assert.equal(s.raw(), raw);
});

test("編集: 見つからない id は保存を変えない", () => {
  const s = setup();
  const raw = s.raw();
  assert.equal(editLecture(s, 99, "X", TSV_B).ok, false);
  assert.equal(s.raw(), raw);
});

test("blocksToTsv: 戻して取り込み直すと元と同じ行（休憩・セル内の改行・引用符・タブ）", () => {
  const src =
    '9:00\t0:30\t導入\t"1行目\n2行目 ""引用"" です"\tp.1\t"ハマり\tタブ"\t調整\n' +
    "9:30\t0:10\t休憩\t【休憩】\t\t\t\n" +
    '9:40\t0:20\t演習\t"""先頭が引用符"\t\t\t\n';
  const blocks = parseSchedule(src);
  assert.equal(blocks[0].procedure, '1行目\n2行目 "引用" です');
  assert.equal(blocks[1].is_break, true);
  const again = parseSchedule(blocksToTsv(blocks));
  assert.deepEqual(again, blocks);
});

test("S-05: 今のタイトルと進行表を入れて出し、保存すると S-03 へ。キャンセルと ← は何も変えない。確認は出さない", () => {
  const s = setup();
  const els = {};
  const el = (n) => (els[n] ??= { value: "", textContent: "", handlers: {}, addEventListener(t, f) { this.handlers[t] = f; } });
  const c = { innerHTML: "", textContent: "", querySelector: (sel) => el(sel.slice(1)) };
  const nav = [];
  let asked = 0;
  globalThis.confirm = () => { asked++; return true; };
  screens["S-05"].render(c, { id: 1, storage: s, navigate: (h) => nav.push(h) });
  assert.equal(els.editTitle.value, "A");
  assert.equal(els.editTsv.value, blocksToTsvOf(s, 1));
  // 空のタイトル → エラー、移らない
  els.editTitle.value = "";
  els.saveBtn.handlers.click();
  assert.equal(els.editError.textContent, "タイトルを入れてください。");
  assert.deepEqual(nav, []);
  // 保存
  els.editTitle.value = "<b>新</b>";
  els.saveBtn.handlers.click();
  assert.deepEqual(nav, ["#/S-03"]);
  assert.equal(loadLectures(s)[0].title, "<b>新</b>");
  assert.equal(asked, 0);
  // キャンセル・← は変えない
  const raw = s.raw();
  els.cancelBtn.handlers.click();
  els.editBack.handlers.click();
  assert.deepEqual(nav, ["#/S-03", "#/S-03", "#/S-03"]);
  assert.equal(s.raw(), raw);
  // HTML には入力値を埋め込まない（value で入れる）
  assert.doesNotMatch(c.innerHTML, /新/);
});

function blocksToTsvOf(s, id) {
  return blocksToTsv(loadLectures(s).find((l) => l.id === id).blocks);
}

test("S-05: 見つからない講義は S-03 へ戻る", () => {
  const nav = [];
  const c = { innerHTML: "", textContent: "", querySelector: () => ({}) };
  screens["S-05"].render(c, { id: 42, storage: memStorage(), navigate: (h) => nav.push(h) });
  assert.deepEqual(nav, ["#/S-03"]);
});

test("S-03: 各講義に「編集」ボタン。押すと S-05 へ id を渡す", () => {
  const s = setup();
  const els = {};
  const el = (n) => (els[n] ??= { handlers: {}, addEventListener(t, f) { this.handlers[t] = f; } });
  const c = { innerHTML: "", textContent: "", querySelector: (sel) => el(sel.slice(1)) };
  const opened = [];
  screens["S-03"].render(c, { storage: s, open: (id, p) => opened.push([id, p]) });
  // グループの中の講義は、グループを開くまで出ない（T-0430）。グループに入っていない講義だけが並ぶ
  assert.equal((c.innerHTML.match(/>編集<\/button>/g) || []).length, 1);
  els.lectureList.handlers.click({ target: { closest: (q) => (q === "button.edit" ? { dataset: { id: "3" } } : null) } });
  assert.deepEqual(opened, [["S-05", { id: 3 }]]);
});

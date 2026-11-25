import { test } from "node:test";
import assert from "node:assert/strict";
import { registerLecture } from "../js/register.mjs";
import { loadLectures, loadGroups, addGroup, deleteGroup, deleteLecture, STORAGE_KEY } from "../js/storage.mjs";
import { buildList, mergedBlocks } from "../js/lecture-list.mjs";
import { exportLectures, importLectures, replaceLectures, BACKUP_FORMAT } from "../js/backup.mjs";
import { liveView } from "../js/live-view.mjs";
import { timeToSeconds } from "../js/schedule-time.mjs";
import { screens } from "../js/screens/registry.mjs";

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}
const AM = "10:00\t1:00\t導入\t午前の内容\tp.1-3\n11:00\t1:00\t演習\t午前の演習\tp.4-8";
const PM = "13:00\t2:00\t応用\t午後の内容\tp.9-20\n15:00\t3:00\t発表\t午後の発表\tp.21-30";
const NOON = "12:00\t1:00\t休憩\t【休憩】\t";

function setup() {
  const st = memoryStorage();
  registerLecture(st, "午後", PM);
  registerLecture(st, "午前", AM);
  registerLecture(st, "昼", NOON);
  registerLecture(st, "別の日", "9:00\t0:30\tX\t別の日の内容\tp.1");
  return st;
}
const ids = (st, ...titles) => titles.map((t) => loadLectures(st).find((l) => l.title === t).id);

test("グループを作る: タイトルと講義の並びを保存する。タイトルが空・講義が0件は作れない", () => {
  const st = setup();
  const r = addGroup(st, " 11/25 通し ", ids(st, "午前", "昼", "午後"));
  assert.equal(r.ok, true);
  assert.deepEqual(loadGroups(st).map((g) => [g.title, g.lecture_ids.length]), [["11/25 通し", 3]]);
  const raw = st.getItem(STORAGE_KEY);
  assert.equal(addGroup(st, "", ids(st, "午前")).ok, false);
  assert.equal(addGroup(st, "x", []).ok, false);
  assert.equal(addGroup(st, "x", [999]).ok, false);
  assert.equal(st.getItem(STORAGE_KEY), raw);
  // 講義を足してもグループは残る
  registerLecture(st, "もう1件", AM);
  assert.equal(loadGroups(st).length, 1);
});

test("通しの進行表: 講義の行を開始時刻の順に並べ、10:00〜18:00 を1つの表として表示する", () => {
  const st = setup();
  addGroup(st, "通し", ids(st, "午後", "午前", "昼")); // 並びは時刻順でない
  const g = buildList(loadLectures(st), loadGroups(st)).groups[0];
  assert.deepEqual(g.blocks.map((b) => b.start_time), ["10:00", "11:00", "12:00", "13:00", "15:00"]);
  assert.equal(g.timeText, "10:00〜18:00");
  assert.deepEqual(mergedBlocks(loadLectures(st), loadGroups(st)[0]).map((b) => b.step), ["導入", "演習", "休憩", "応用", "発表"]);
  const at = (s) => timeToSeconds(s);
  assert.equal(liveView(g.blocks, at("12:30")).content.includes("休憩"), true);
  assert.equal(liveView(g.blocks, at("17:00")).remainSeconds, 3600); // 最後の行は 18:00 まで
  assert.equal(liveView(g.blocks, at("11:30")).remainSeconds, 30 * 60); // 次の行（12:00 の休憩）の開始まで
});

test("一覧: グループと、グループに入っていない講義を出す。入れた講義も1件ずつ開ける", () => {
  const st = setup();
  addGroup(st, "通し", ids(st, "午前", "昼", "午後"));
  const { groups, singles } = buildList(loadLectures(st), loadGroups(st));
  assert.deepEqual(groups.map((g) => g.title), ["通し"]);
  assert.deepEqual(groups[0].items.map((i) => i.title), ["午前", "昼", "午後"]);
  assert.deepEqual(singles.map((i) => i.title), ["別の日"]);

  const nodes = [];
  const c = { innerHTML: "", querySelector: (sel) => (nodes[sel] ??= { handlers: {}, addEventListener(t, f) { this.handlers[t] = f; } }) };
  const opened = [];
  screens["S-03"].render(c, { storage: st, openLecture: (x) => opened.push(x) });
  const click = (dataset, cls) => nodes["#lectureList"].handlers.click({ target: { closest: (s) => (s === `button.${cls}` ? { dataset } : null) } });
  click({ gid: String(groups[0].id) }, "lecture"); // グループ: 通しの進行表
  assert.deepEqual(opened[0].blocks.map((b) => b.start_time), ["10:00", "11:00", "12:00", "13:00", "15:00"]);
  click({ id: String(ids(st, "午前")[0]) }, "lecture"); // 入れた講義を1件だけ
  assert.deepEqual(opened[1].blocks.map((b) => b.start_time), ["10:00", "11:00"]);
});

test("S-03 のグループの開け閉め: 最初は閉じ、押すと開き、もう一度で閉じる。グループごとに別々。保存は変わらない", () => {
  const st = setup();
  addGroup(st, "通し", ids(st, "午前", "午後"));
  addGroup(st, "昼組", ids(st, "昼"));
  const all = buildList(loadLectures(st), loadGroups(st)).groups;
  const g1 = all.find((g) => g.title === "通し");
  const g2 = all.find((g) => g.title === "昼組");
  const nodes = {};
  const c = { innerHTML: "", querySelector: (sel) => (nodes[sel] ??= { handlers: {}, innerHTML: "", hidden: true, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(t, f) { this.handlers[t] = f; } }) };
  const opened = [];
  screens["S-03"].render(c, { storage: st, openLecture: (x) => opened.push(x) });
  // 最初は閉じていて、中の講義のカードは出ない
  assert.match(c.innerHTML, new RegExp(`aria-expanded="false" aria-controls="grpMembers-${g1.id}"`));
  assert.match(c.innerHTML, new RegExp(`id="grpMembers-${g1.id}" hidden>`));
  assert.doesNotMatch(c.innerHTML, /class="member"/);
  const raw = st.getItem(STORAGE_KEY);
  const toggle = (g, el) => nodes["#lectureList"].handlers.click({ target: { closest: (s) => (s === "button.grpToggle" ? el : null) } });
  const t1 = { dataset: { gid: String(g1.id) }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const t2 = { dataset: { gid: String(g2.id) }, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  toggle(g1, t1); // 開く（編集・削除のボタンも出る）
  const m1 = nodes[`#grpMembers-${g1.id}`];
  assert.equal(m1.hidden, false);
  assert.equal(t1.attrs["aria-expanded"], "true");
  assert.match(m1.innerHTML, /午前/);
  assert.match(m1.innerHTML, /午後/);
  assert.match(m1.innerHTML, /class="del edit"/);
  assert.match(m1.innerHTML, /class="del" data-id/);
  // もう1つは閉じたまま
  assert.equal(nodes[`#grpMembers-${g2.id}`]?.hidden ?? true, true);
  toggle(g2, t2); // 2つ目も開く。1つ目は開いたまま
  assert.equal(nodes[`#grpMembers-${g2.id}`].hidden, false);
  assert.equal(m1.hidden, false);
  toggle(g1, t1); // 1つ目を閉じる。2つ目は開いたまま
  assert.equal(m1.hidden, true);
  assert.equal(m1.innerHTML, "");
  assert.equal(t1.attrs["aria-expanded"], "false");
  assert.equal(nodes[`#grpMembers-${g2.id}`].hidden, false);
  // グループのカードを押すと、今のとおり通しの進行表が S-02 へ渡る。保存の形は変わらない
  nodes["#lectureList"].handlers.click({ target: { closest: (s) => (s === "button.lecture" ? { dataset: { gid: String(g1.id) } } : null) } });
  assert.deepEqual(opened[0].blocks.map((b) => b.start_time), ["10:00", "11:00", "13:00", "15:00"]);
  assert.equal(st.getItem(STORAGE_KEY), raw);
});

test("グループを消しても中の講義は消えない。ない id では何も変えない", () => {
  const st = setup();
  addGroup(st, "通し", ids(st, "午前", "午後"));
  const g = loadGroups(st)[0];
  const before = loadLectures(st);
  assert.equal(deleteGroup(st, g.id), true);
  assert.deepEqual(loadGroups(st), []);
  assert.deepEqual(loadLectures(st), before);
  const raw = st.getItem(STORAGE_KEY);
  assert.equal(deleteGroup(st, 999), false);
  assert.equal(st.getItem(STORAGE_KEY), raw);
});

test("講義を消すと、グループの並びからも外れる（空になったグループは消える。ほかの講義は残る）", () => {
  const st = setup();
  addGroup(st, "通し", ids(st, "午前", "午後"));
  addGroup(st, "昼だけ", ids(st, "昼"));
  deleteLecture(st, ids(st, "午前")[0]);
  assert.deepEqual(loadGroups(st).map((g) => [g.title, g.lecture_ids.length]), [["通し", 1], ["昼だけ", 1]]);
  deleteLecture(st, ids(st, "昼")[0]);
  assert.deepEqual(loadGroups(st).map((g) => g.title), ["通し"]);
});

test("S-03 のグループの削除: 確認でOKならグループだけ消える。講義は残る", () => {
  const st = setup();
  addGroup(st, "通し", ids(st, "午前", "午後"));
  const gid = loadGroups(st)[0].id;
  const nodes = [];
  const c = { innerHTML: "", querySelector: (sel) => (nodes[sel] ??= { handlers: {}, addEventListener(t, f) { this.handlers[t] = f; } }) };
  let re = 0;
  const asked = [];
  let answer = false;
  screens["S-03"].render(c, { storage: st, rerender: () => re++, confirm: (m) => { asked.push(m); return answer; } });
  const del = () => nodes["#lectureList"].handlers.click({ target: { closest: (s) => (s === "button.del" ? { dataset: { gid: String(gid) } } : null) } });
  del();
  assert.match(asked[0], /通し/);
  assert.equal(loadGroups(st).length, 1);
  answer = true;
  del();
  assert.equal(loadGroups(st).length, 0);
  assert.equal(loadLectures(st).length, 4);
  assert.equal(re, 1);
});

test("S-03: タイトルは escapeHtml を通して出す", () => {
  const st = memoryStorage();
  registerLecture(st, "<img src=x onerror=1>", AM);
  addGroup(st, "<b>組</b>", [1]);
  const c = { innerHTML: "", querySelector: () => ({ addEventListener() {} }) };
  screens["S-03"].render(c, { storage: st });
  assert.doesNotMatch(c.innerHTML, /<img|<b>/);
  assert.match(c.innerHTML, /&lt;img src=x/);
  assert.match(c.innerHTML, /&lt;b&gt;組/);
});

test("書き出し→読み込みの往復: タイトルとグループが元と同じになる（version 2）", () => {
  const pc = setup();
  addGroup(pc, "通し", ids(pc, "午後", "午前"));
  const text = exportLectures(pc, new Date(2026, 10, 25));
  const data = JSON.parse(text);
  assert.equal(data.version, 2);
  assert.deepEqual(data.lectures.map((l) => l.title), ["午後", "午前", "昼", "別の日"]);
  assert.deepEqual(data.groups, [{ title: "通し", lectures: [0, 1] }]);
  const phone = memoryStorage();
  const r = importLectures(phone, text);
  assert.deepEqual([r.ok, r.added, r.groupsAdded], [true, 4, 1]);
  assert.deepEqual(loadLectures(phone), loadLectures(pc));
  assert.deepEqual(loadGroups(phone), loadGroups(pc));
  // 2回読んでも増えない
  const r2 = importLectures(phone, text);
  assert.deepEqual([r2.added, r2.skipped, r2.groupsAdded], [0, 4, 0]);
  assert.equal(loadGroups(phone).length, 1);
});

test("読み込み: すでにある講義はグループの中でその講義を使う。置き換えはグループも置き換える", () => {
  const pc = setup();
  addGroup(pc, "通し", ids(pc, "午前", "午後"));
  const text = exportLectures(pc);
  const phone = memoryStorage();
  registerLecture(phone, "午後", PM); // 同じ講義が先にある
  importLectures(phone, text);
  assert.equal(loadLectures(phone).length, 4);
  const g = loadGroups(phone)[0];
  assert.deepEqual(g.lecture_ids.map((id) => loadLectures(phone).find((l) => l.id === id).title), ["午前", "午後"]);
  // 置き換え
  const other = setup();
  addGroup(other, "古いグループ", ids(other, "昼"));
  const r = replaceLectures(other, text);
  assert.deepEqual([r.ok, r.count], [true, 4]);
  assert.deepEqual(loadGroups(other).map((x) => x.title), ["通し"]);
  assert.deepEqual(JSON.parse(exportLectures(other)).groups, JSON.parse(text).groups);
});

test("前の版（version 1）のファイルは lecture_date をタイトルとして読める。グループは付かない", () => {
  const v1 = JSON.stringify({
    format: BACKUP_FORMAT,
    version: 1,
    lectures: [{ lecture_date: "2026-11-20", blocks: [{ start_time: "9:30", duration: "0:10", step: "a", procedure: "b" }] }],
  });
  const st = memoryStorage();
  assert.equal(importLectures(st, v1).added, 1);
  assert.equal(loadLectures(st)[0].title, "2026-11-20");
  assert.deepEqual(loadGroups(st), []);
  assert.equal(replaceLectures(memoryStorage(), v1).ok, true);
});

test("version 2 の壊れたタイトル・グループは保存を変えずエラーにする", () => {
  const st = setup();
  const raw = st.getItem(STORAGE_KEY);
  const blk = [{ start_time: "9:00" }];
  const mk = (lectures, groups) => JSON.stringify({ format: BACKUP_FORMAT, version: 2, lectures, groups });
  const bad = [
    mk([{ title: "", blocks: blk }], []),
    mk([{ blocks: blk }], []),
    mk([{ title: "a", blocks: blk }], [{ title: "", lectures: [0] }]),
    mk([{ title: "a", blocks: blk }], [{ title: "g", lectures: [1] }]),
    mk([{ title: "a", blocks: blk }], [{ title: "g", lectures: [] }]),
    mk([{ title: "a", blocks: blk }], "x"),
  ];
  for (const t of bad) {
    assert.equal(importLectures(st, t).ok, false);
    assert.equal(replaceLectures(st, t).ok, false);
    assert.equal(st.getItem(STORAGE_KEY), raw);
  }
});

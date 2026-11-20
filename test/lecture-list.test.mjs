import { test } from "node:test";
import assert from "node:assert/strict";
import { groupLecturesByDate } from "../js/lecture-list.mjs";
import { createNavigator } from "../js/navigator.mjs";
import { screens } from "../js/screens/registry.mjs";
import { STORAGE_KEY, loadLectures } from "../js/storage.mjs";

const blk = (start, dur, procedure = "内容") => ({ start_time: start, duration: dur, step: "ステップ", procedure, is_break: false });
const lec = (id, date, blocks) => ({ id, lecture_date: date, blocks });

test("日付ごとにまとめ、日付は古い順・同じ日は開始時刻順", () => {
  const g = groupLecturesByDate([
    lec(1, "2026-12-02", [blk("13:00", "1:00", "午後")]),
    lec(2, "2026-12-01", [blk("9:30", "0:10", "<b>朝</b>"), blk("9:40", "0:05")]),
    lec(3, "2026-12-02", [blk("9:00", "0:30", "早い")]),
  ]);
  assert.deepEqual(g.map((x) => x.date), ["2026-12-01", "2026-12-02"]);
  assert.deepEqual(g[1].items.map((i) => i.id), [3, 1]);
  assert.equal(g[0].items[0].timeText, "9:30〜9:45");
  assert.equal(g[0].items[0].first, "<b>朝</b>");
});

test("講義が0件・行がない講義でも落ちない", () => {
  assert.deepEqual(groupLecturesByDate([]), []);
  const g = groupLecturesByDate([lec(1, "2026-12-01", [])]);
  assert.equal(g[0].items[0].timeText, "");
});

function memStorage(lectures) {
  const m = new Map();
  if (lectures) m.set(STORAGE_KEY, JSON.stringify({ lectures }));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
}

function fakeContainer() {
  const els = {};
  const el = (n) => (els[n] ??= { handlers: {}, addEventListener(t, f) { this.handlers[t] = f; } });
  return {
    els,
    innerHTML: "",
    textContent: "",
    querySelector: (sel) => el(sel.slice(1)),
  };
}

test("S-03: 講義がないときは empty、あるときは日付と入力の文字をエスケープして出す", () => {
  const c = fakeContainer();
  screens["S-03"].render(c, { storage: memStorage() });
  assert.match(c.innerHTML, /class="empty"/);
  const c2 = fakeContainer();
  screens["S-03"].render(c2, { storage: memStorage([lec(1, "2026-12-01", [blk("9:30", "0:10", "<img src=x>")])]) });
  assert.doesNotMatch(c2.innerHTML, /<img/);
  assert.match(c2.innerHTML, /&lt;img src=x&gt;/);
  assert.match(c2.innerHTML, /class="lecture"/);
});

test("S-03: 「講義を登録する」で S-04、講義を選ぶと openLecture に講義が渡る", () => {
  const c = fakeContainer();
  const nav = [];
  const opened = [];
  const l = lec(5, "2026-12-01", [blk("9:30", "0:10")]);
  screens["S-03"].render(c, { storage: memStorage([l]), navigate: (h) => nav.push(h), openLecture: (x) => opened.push(x) });
  c.els.toRegister.handlers.click();
  assert.deepEqual(nav, ["#/S-04"]);
  c.els.lectureList.handlers.click({ target: { closest: (s) => (s === "button.lecture" ? { dataset: { g: "0", i: "0" } } : null) } });
  assert.equal(opened[0].id, 5);
});

test("S-03: 削除はカードごと。確認でOKなら1件だけ取り除いて出し直し、S-02 には移らない。キャンセルなら変えない", () => {
  const ls = [lec(1, "2026-12-01", [blk("9:30", "0:10")]), lec(2, "2026-12-02", [blk("13:00", "0:10")])];
  const st = memStorage(ls);
  const c = fakeContainer();
  const opened = [];
  const asked = [];
  let answer = false;
  let rerendered = 0;
  screens["S-03"].render(c, {
    storage: st, openLecture: (x) => opened.push(x), rerender: () => rerendered++,
    confirm: (m) => { asked.push(m); return answer; },
  });
  assert.match(c.innerHTML, /class="del"/);
  const clickDel = (g) => c.els.lectureList.handlers.click({ target: { closest: (s) => (s === "button.del" ? { dataset: { g: String(g), i: "0" } } : null) } });
  clickDel(0);
  assert.match(asked[0], /2026-12-01/);
  assert.match(asked[0], /9:30/);
  assert.deepEqual(loadLectures(st).map((l) => l.id), [1, 2]);
  assert.equal(rerendered, 0);
  answer = true;
  clickDel(0);
  assert.deepEqual(loadLectures(st).map((l) => l.id), [2]);
  assert.equal(rerendered, 1);
  assert.equal(opened.length, 0);
});

test("navigator: 選んだ講義の blocks が S-02 に渡り、前の画面のあと始末をしてから移る", () => {
  const log = [];
  let hash = "#/S-03";
  const fake = {
    "S-02": { render: (c, p) => { log.push(["S-02", p.blocks]); return () => log.push("stop S-02"); } },
    "S-03": { render: () => { log.push("S-03"); return () => log.push("stop S-03"); } },
  };
  const nav = createNavigator({
    screens: fake, container: {}, getHash: () => hash,
    setHash: (h) => { hash = h; nav.show(); }, // 本物の hashchange の代わり
  });
  nav.show();
  const blocks = [blk("9:30", "0:10")];
  nav.openLecture({ id: 1, blocks });
  assert.deepEqual(log, ["S-03", "stop S-03", ["S-02", blocks]]);
  // 同じ画面を開き直しても、先に止めてから描く
  nav.open("S-02", { blocks });
  assert.equal(log[3], "stop S-02");
});

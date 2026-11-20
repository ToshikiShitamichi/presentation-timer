import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSchedule } from "../js/schedule-import.mjs";
import { timeToSeconds } from "../js/schedule-time.mjs";
import { startLiveTicker, TICK_MS } from "../js/live-ticker.mjs";
import { screens } from "../js/screens/registry.mjs";

const blocks = parseSchedule(
  [
    "9:30\t0:10\t導入\t【01 はじめに】\tスライド1〜8枚目",
    "9:40\t0:05\t休憩\t【休憩】\t",
    "9:45\t0:20\t本編\t【02 本編】\tスライド9〜12枚目",
  ].join("\n"),
);

// 差し替え用の時計: 時刻を進めて tick を1回呼べる
function fakeClock(startSec) {
  const c = {
    sec: startSec,
    fn: null,
    ms: null,
    cleared: 0,
    now: () => c.sec,
    setInterval(fn, ms) { c.fn = fn; c.ms = ms; return 1; },
    clearInterval() { c.cleared++; c.fn = null; },
    advance(s) { c.sec += s; if (c.fn) c.fn(); },
  };
  return c;
}

test("R-006-1 更新の間隔は1秒ごと", () => {
  const c = fakeClock(timeToSeconds("9:30"));
  startLiveTicker(blocks, { ...c, setInterval: c.setInterval, clearInterval: c.clearInterval });
  assert.equal(TICK_MS, 1000);
  assert.equal(c.ms, 1000);
});

test("R-006-1 時刻を進めるとブロックが替わり、休憩に入り、終わりを過ぎる", () => {
  const c = fakeClock(timeToSeconds("9:39") + 58);
  const views = [];
  startLiveTicker(blocks, { now: c.now, setInterval: c.setInterval, clearInterval: c.clearInterval, onUpdate: (v) => views.push(v) });
  c.advance(1); // 9:39:59
  assert.equal(views.at(-1).content, "【01 はじめに】");
  assert.equal(views.at(-1).remainText, "0:01");
  c.advance(1); // 9:40:00 休憩の行に入る
  assert.equal(views.at(-1).isBreak, true);
  assert.equal(views.at(-1).content, "【休憩】");
  c.advance(300); // 9:45:00 次のブロック
  assert.equal(views.at(-1).content, "【02 本編】");
  assert.equal(views.at(-1).slides, "スライド9〜12枚目");
  c.advance(timeToSeconds("10:05") - c.sec); // 講義の終わりの時刻
  assert.equal(views.at(-1).state, "after");
  assert.equal(views.at(-1).clock, "10:05:00");
});

test("止めるとタイマーが消え、以降は更新されない（何度止めてもよい）", () => {
  const c = fakeClock(timeToSeconds("9:30"));
  let n = 0;
  const stop = startLiveTicker(blocks, { now: c.now, setInterval: c.setInterval, clearInterval: c.clearInterval, onUpdate: () => n++ });
  const fn = c.fn;
  stop();
  stop();
  assert.equal(c.cleared, 1);
  fn(); // 止めたあとに呼ばれても更新しない
  assert.equal(n, 0);
});

// 最小の画面の入れ物（id で探せる要素）
function fakeContainer() {
  const els = {};
  const make = () => ({ textContent: "", handlers: {}, addEventListener(t, f) { this.handlers[t] = f; }, classList: { toggle(name, on) { this.on = this.on ?? {}; this.on[name] = on; } } });
  return {
    set innerHTML(html) {
      this.html = html;
      for (const m of html.matchAll(/id="(\w+)"/g)) els[m[1]] = make();
    },
    querySelector: (sel) => els[sel.slice(1)],
    els,
  };
}

test("S-02 は1秒ごとに表示を更新し、返された関数でタイマーを止める", () => {
  const c = fakeClock(timeToSeconds("9:39") + 59);
  const box = fakeContainer();
  const stop = screens["S-02"].render(box, { blocks, clock: c });
  assert.equal(typeof stop, "function");
  assert.equal(c.ms, 1000);
  c.advance(1); // 9:40:00
  assert.equal(box.els.content.textContent, "【休憩】");
  assert.equal(box.els.content.classList.on["is-break"], true);
  assert.equal(box.els.clock.textContent, "09:40:00");
  stop(); // 別の画面へ移るとき
  assert.equal(c.cleared, 1);
  assert.equal(c.fn, null);
});

test("S-02 の「←」は S-03 へ移り、進行表がなくても出る。タイマーは返された関数で止まる", () => {
  const c = fakeClock(timeToSeconds("9:30"));
  const box = fakeContainer();
  const nav = [];
  const stop = screens["S-02"].render(box, { blocks, clock: c, navigate: (h) => nav.push(h) });
  assert.match(box.html, /id="backBtn" aria-label="一覧に戻る"/);
  box.els.backBtn.handlers.click();
  assert.deepEqual(nav, ["#/S-03"]);
  stop();
  assert.equal(c.fn, null);
  const box2 = fakeContainer();
  const nav2 = [];
  screens["S-02"].render(box2, { clock: fakeClock(0), navigate: (h) => nav2.push(h) });
  box2.els.backBtn.handlers.click();
  assert.deepEqual(nav2, ["#/S-03"]);
});

test("S-02 は進行表がないときタイマーを作らない", () => {
  const c = fakeClock(0);
  const stop = screens["S-02"].render(fakeContainer(), { clock: c });
  assert.equal(c.fn, null);
  stop();
});

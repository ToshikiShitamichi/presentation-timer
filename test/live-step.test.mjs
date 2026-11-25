import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSchedule } from "../js/schedule-import.mjs";
import { timeToSeconds } from "../js/schedule-time.mjs";
import { liveView, stepShown } from "../js/live-view.mjs";

// 9:30 導入 → 9:40 休憩 → 9:45 本編（20分。終わりは 10:05）。所要時間は次の行の開始とずらして、所要時間を使わないことも確かめる
const blocks = parseSchedule(
  [
    "9:30\t0:05\t導入\t【01 導入】\tスライド1〜8枚目",
    "9:40\t0:05\t休憩\t【休憩】\t",
    "9:45\t0:10\t本編\t【02 本編】\tスライド9〜12枚目",
  ].join("\n"),
);
const at = (s, extra = 0) => timeToSeconds(s) + extra;

test("残り時間は次の行の開始時刻との差（所要時間は使わない）。最後の行は講義の終わりから", () => {
  assert.equal(liveView(blocks, at("9:32")).remainText, "8:00"); // 9:40 − 9:32（所要時間 5分なら 3:00 になる）
  assert.equal(liveView(blocks, at("9:50")).remainText, "5:00"); // 最後の行: 終わり 9:55 − 9:50
});

test("進む: 今のセクションの次へ。残り時間も進めた先で出る", () => {
  const now = at("9:32");
  const s = stepShown(blocks, now, null, 1);
  assert.equal(s, 1);
  const v = liveView(blocks, now, s);
  assert.equal(v.index, 1);
  assert.equal(v.isBreak, true);
  assert.equal(v.remainText, "13:00"); // 9:45 − 9:32
  assert.equal(v.canPrev, true);
  assert.equal(v.canNext, true);
});

test("戻る: 進めたセクションから戻れるが、時刻の今のセクションより前には戻れない", () => {
  const now = at("9:32");
  let s = stepShown(blocks, now, null, 1);
  s = stepShown(blocks, now, s, 1);
  assert.equal(s, 2);
  assert.equal(liveView(blocks, now, s).canNext, false); // 最後の行では進めない
  assert.equal(stepShown(blocks, now, s, 1), 2);
  s = stepShown(blocks, now, s, -1);
  assert.equal(s, 1);
  s = stepShown(blocks, now, s, -1);
  assert.equal(s, null); // 時刻どおりに戻る
  assert.equal(liveView(blocks, now, s).canPrev, false);
  assert.equal(stepShown(blocks, now, null, -1), null); // 境目: 戻れない
  assert.equal(liveView(blocks, now, null).index, 0);
});

test("最後の行: 残り時間は講義の終わり（9:55）から", () => {
  const now = at("9:30");
  const v = liveView(blocks, now, 2);
  assert.equal(v.index, 2);
  assert.equal(v.remainText, "25:00");
  assert.equal(v.slides, "スライド9〜12枚目");
});

test("時刻が追いついたら時刻どおり（時刻の側が選んだセクションを越えたら時刻の側）", () => {
  const s = 1;
  assert.equal(liveView(blocks, at("9:41"), s).index, 1); // 時刻も同じセクション
  const v = liveView(blocks, at("9:46"), s); // 時刻は 2 に進んだ
  assert.equal(v.index, 2);
  assert.equal(v.canPrev, false);
  assert.equal(v.remainText, "9:00");
});

test("講義の前・後は進められない", () => {
  assert.equal(stepShown(blocks, at("9:00"), null, 1), null);
  assert.equal(liveView(blocks, at("9:00"), 1).canNext, false);
  assert.equal(liveView(blocks, at("10:30"), 1).state, "after");
});

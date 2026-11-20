import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSchedule } from "../js/schedule-import.mjs";
import { timeToSeconds } from "../js/schedule-time.mjs";
import { liveView, formatClock, formatRemain, firstLine } from "../js/live-view.mjs";

const TEXT = [
  '9:30\t0:10\t導入\t"【01 はじめに（説明）】\n2行目"\tスライド1〜8枚目',
  "9:40\t0:05\t休憩\t【休憩】\t",
  "9:45\t0:20\t本編\t【02 本編】\tスライド9〜12枚目",
].join("\n");
const blocks = parseSchedule(TEXT);
const at = (s, extra = 0) => timeToSeconds(s) + extra;

test("R-004-1/2/3/4 現在のブロックのスライド範囲・1行目の見出し・現在時刻・残り時間", () => {
  const v = liveView(blocks, at("9:32", 10));
  assert.equal(v.state, "during");
  assert.equal(v.slides, "スライド1〜8枚目");
  assert.equal(v.content, "【01 はじめに（説明）】");
  assert.equal(v.clock, "09:32:10");
  assert.equal(v.remainSeconds, at("9:40") - at("9:32", 10)); // BR-007
  assert.equal(v.remainText, "7:50");
  assert.equal(v.isBreak, false);
});

test("R-005-1 休憩のブロックは「【休憩】」", () => {
  const v = liveView(blocks, at("9:41"));
  assert.equal(v.isBreak, true);
  assert.equal(v.content, "【休憩】");
  assert.equal(v.remainText, "4:00");
});

test("境目: 開始ちょうど・終わりちょうど・最初の行より前・終わり以降", () => {
  assert.equal(liveView(blocks, at("9:30")).state, "during");
  assert.equal(liveView(blocks, at("9:30")).remainText, "10:00");
  assert.equal(liveView(blocks, at("9:40")).isBreak, true); // 次の行の開始ちょうど
  assert.equal(liveView(blocks, at("10:04", 59)).state, "during");
  assert.equal(liveView(blocks, at("10:04", 59)).remainText, "0:01");
  const before = liveView(blocks, at("9:29", 59));
  assert.equal(before.state, "before");
  assert.equal(before.content, "");
  assert.equal(before.remainText, "--:--");
  assert.equal(liveView(blocks, at("10:05")).state, "after"); // 終わりちょうど
  assert.equal(liveView(blocks, at("23:00")).state, "after");
});

test("スライド範囲が空のブロックは、前の休憩でない値のあるブロックの値を出す", () => {
  const b = parseSchedule(
    [
      "9:00\t0:10\t導入\t【01】\tスライド1〜8枚目",
      "9:10\t0:10\t説明\t【02】\t",
      "9:20\t0:05\t休憩\t【休憩】\t",
      "9:25\t0:10\t演習\t【03】\t",
    ].join("\n"),
  );
  assert.equal(liveView(b, at("9:05")).slides, "スライド1〜8枚目"); // 値があればそのまま
  assert.equal(liveView(b, at("9:15")).slides, "スライド1〜8枚目"); // 空なら前の値
  assert.equal(liveView(b, at("9:22")).slides, ""); // 休憩は今の表示のまま
  assert.equal(liveView(b, at("9:27")).slides, "スライド1〜8枚目"); // 休憩を飛ばして前の値
});

test("前にも値がなければスライド範囲は空のまま", () => {
  const b = parseSchedule(["9:00\t0:10\t導入\t【01】\t", "9:10\t0:10\t説明\t【02】\t"].join("\n"));
  assert.equal(liveView(b, at("9:15")).slides, "");
});

test("現在時刻は Date でも渡せる", () => {
  const v = liveView(blocks, new Date(2026, 10, 19, 9, 31, 5));
  assert.equal(v.clock, "09:31:05");
  assert.equal(v.state, "during");
});

test("次の行の開始より前に所要時間が終わると、残り時間は負（isOver）", () => {
  const b = parseSchedule("9:00\t0:05\tA\tX\n9:30\t0:05\tB\tY");
  const v = liveView(b, at("9:10"));
  assert.equal(v.isOver, true);
  assert.equal(v.remainText, "-5:00");
});

test("表示の整形", () => {
  assert.equal(formatClock(3 * 3600 + 5 * 60 + 9), "03:05:09");
  assert.equal(formatRemain(3723), "1:02:03");
  assert.equal(firstLine("a\r\nb"), "a");
  assert.equal(firstLine(undefined), "");
});

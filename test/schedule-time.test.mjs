import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSchedule } from "../js/schedule-import.mjs";
import { currentBlock, lectureEnd, nowToSeconds, timeToSeconds } from "../js/schedule-time.mjs";

const TEXT = ["9:30\t0:10\t導入\tA", "9:40\t0:20\t本編\tB", "16:37\t0:08\t まとめ\tC"].join("\n");
const blocks = parseSchedule(TEXT);
const at = (s) => timeToSeconds(s);

test("R-003-3 / BR-005 終わりの時刻 ＝ 最後の行の開始時刻＋所要時間", () => {
  assert.equal(lectureEnd(blocks).text, "16:45");
  assert.equal(lectureEnd(blocks).seconds, at("16:45"));
  assert.equal(lectureEnd(parseSchedule("23:50\t0:20\t終\tX")).text, "24:10");
});

test("R-003-1 行の開始時刻以上、次の行の開始時刻より前はその行", () => {
  assert.equal(currentBlock(blocks, at("9:30")).index, 0); // 開始時刻ちょうど
  assert.equal(currentBlock(blocks, at("9:39") + 59).index, 0); // 次の行の1秒前
  assert.equal(currentBlock(blocks, at("9:40")).index, 1); // 次の行の開始時刻ちょうど
  assert.equal(currentBlock(blocks, at("12:00")).index, 1);
});

test("R-003-2 最後の行は終わりの時刻より前の間", () => {
  assert.equal(currentBlock(blocks, at("16:37")).index, 2);
  assert.equal(currentBlock(blocks, at("16:44") + 59).index, 2);
  assert.equal(currentBlock(blocks, at("16:44")).block.procedure, "C");
});

test("BR-006 終わりの時刻ちょうど・以降、最初の行より前は現在のブロックなし", () => {
  assert.equal(currentBlock(blocks, at("16:45")), null);
  assert.equal(currentBlock(blocks, at("20:00")), null);
  assert.equal(currentBlock(blocks, at("9:29") + 59), null);
  assert.equal(currentBlock(blocks, 0), null);
});

test("現在時刻は Date でも渡せる", () => {
  assert.equal(nowToSeconds(new Date(2026, 10, 19, 9, 40, 5)), at("9:40") + 5);
  assert.equal(currentBlock(blocks, new Date(2026, 10, 19, 9, 45)).index, 1);
  assert.throws(() => nowToSeconds("9:30"));
});

test("読めない時刻・空の進行表は Error", () => {
  assert.throws(() => timeToSeconds("abc"));
  assert.throws(() => lectureEnd([]));
});

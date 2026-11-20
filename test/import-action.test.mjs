import { test } from "node:test";
import assert from "node:assert/strict";
import { runImport } from "../js/import-action.mjs";
import { createNavigator } from "../js/navigator.mjs";

const TSV =
  "開始時間\t所要時間\tステップ\t進め方・手順\n" +
  "9:30\t0:08\t導入\t説明する\n" +
  "9:38\t0:10\t\t【休憩】\n";

test("取り込めるテキストは S-02 へ blocks を渡して移る（休憩の行も入る）", () => {
  const calls = [];
  const r = runImport(TSV, (id, params) => calls.push([id, params]));
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "S-02");
  assert.equal(calls[0][1].blocks.length, 2);
  assert.equal(calls[0][1].blocks[0].procedure, "説明する");
  assert.equal(calls[0][1].blocks[1].is_break, true);
});

test("取り込めないテキストはエラー文を返し、移らない", () => {
  for (const text of ["", "abc\tdef", "9:30\tx"]) {
    let moved = false;
    const r = runImport(text, () => { moved = true; });
    assert.equal(r.ok, false);
    assert.ok(r.error.length > 0);
    assert.equal(moved, false);
  }
});

test("navigator 経由で S-02 へ移ると、前の画面のあと始末が先に呼ばれ、blocks が渡る", () => {
  const log = [];
  let hash = "#/S-01";
  const screens = {
    "S-01": { render: (c, p) => { log.push("render S-01"); runImport(TSV, p.open); return () => log.push("cleanup S-01"); } },
    "S-02": { render: (c, p) => { log.push("render S-02 " + p.blocks.length); return () => log.push("cleanup S-02"); } },
  };
  const nav = createNavigator({
    screens, container: {}, getHash: () => hash, setHash: (h) => { hash = h; }, onScreen: () => {},
  });
  nav.show();
  assert.equal(hash, "#/S-02");
  nav.show(); // hashchange 相当
  assert.deepEqual(log, ["render S-01", "cleanup S-01", "render S-02 2"]);
});

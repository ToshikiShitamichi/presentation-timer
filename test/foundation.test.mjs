import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHash, screenHash, SCREEN_IDS } from "../js/router.mjs";

test("hash から画面 ID を読む", () => {
  for (const id of SCREEN_IDS) assert.equal(parseHash(screenHash(id)), id);
  assert.equal(parseHash(""), "S-03");
  assert.equal(parseHash("#/S-99"), "S-03");
});

test("manifest はモックの data: URL と同じ内容", () => {
  const mock = readFileSync(new URL("../docs/mocks/S-01.html", import.meta.url), "utf8");
  const m = /rel="manifest" href='data:application\/manifest\+json,([^']+)'/.exec(mock);
  const expected = JSON.parse(decodeURIComponent(m[1]));
  const actual = JSON.parse(readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
  assert.deepEqual(actual, expected);
  assert.equal(actual.display, "standalone");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("docs/change-reports/v1.json は AGENTS.md の8の形式で読める", async () => {
  const text = await readFile(new URL("../docs/change-reports/v1.json", import.meta.url), "utf8");
  const report = JSON.parse(text);
  assert.equal(typeof report.revision, "number");
  assert.ok(Array.isArray(report.changes) && report.changes.length > 0);
  const types = ["add", "change", "deprecate"];
  const targets = ["requirement", "criterion", "function", "business_rule", "screen", "component", "table", "column"];
  for (const c of report.changes) {
    assert.ok(types.includes(c.type), `type: ${c.type}`);
    assert.ok(targets.includes(c.target), `target: ${c.target}`);
    assert.ok(c.id && c.reason, `id と reason が要る: ${c.id}`);
  }
});

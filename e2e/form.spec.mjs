import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) { try { localStorage.clear(); } catch {} sessionStorage.setItem("seeded", "1"); }
  });
});

async function fillRow(page, n, v) {
  const row = page.locator(".fRow").nth(n);
  for (const [k, val] of Object.entries(v)) await row.locator(`[data-f="${k}"]`).fill(val);
}

test("S-04 のフォームで2行入れて登録 → S-03 に出て S-02 で開ける。誤りは赤い文で保存しない", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-23T09:35:00"));
  await page.goto("/#/S-04");
  await expect(page.locator("#regModePaste")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#regFormBox")).toBeHidden();
  await page.click("#regModeForm");
  await expect(page.locator(".fRow")).toHaveCount(1);
  await page.fill("#regTitle", "フォーム登録");
  // 時刻の誤り
  await fillRow(page, 0, { start_time: "9時", duration: "0:10" });
  await page.click("#registerBtn");
  await expect(page.locator("#regError")).toContainText("1行目の開始時間「9時」が読めません");
  await fillRow(page, 0, { start_time: "9:30", duration: "0:10", step: "導入", procedure: "自己紹介をする", tools_materials: "p.1-3" });
  await page.click("#regAddRow");
  await expect(page.locator(".fRow")).toHaveCount(2);
  // 追加しても入力は残る
  await expect(page.locator(".fRow").nth(0).locator('[data-f="step"]')).toHaveValue("導入");
  await fillRow(page, 1, { start_time: "9:40", duration: "0:20", step: "休憩" });
  await page.locator(".fRow").nth(1).locator('[data-f="is_break"]').check();
  await page.click("#registerBtn");
  await expect(page.locator("#s03")).toBeVisible();
  await expect(page.locator("button.lecture .title")).toHaveText("フォーム登録");
  await page.click("button.lecture");
  await expect(page.locator("#s02")).toBeVisible();
  await expect(page.locator("#content")).toHaveText("自己紹介をする");
  await expect(page.locator("#slides")).toHaveText("p.1-3");
});

test("S-04 のフォーム: 行を削除して0行にすると「取り込める行がありません。」", async ({ page }) => {
  await page.goto("/#/S-04");
  await page.click("#regModeForm");
  await page.fill("#regTitle", "空");
  await page.locator(".fRow .fDel").first().click();
  await expect(page.locator(".fRow")).toHaveCount(0);
  await page.click("#registerBtn");
  await expect(page.locator("#regError")).toHaveText("取り込める行がありません。");
});

test("S-05 のフォームに今のブロックが入り、1行直して保存できる", async ({ page }) => {
  await page.goto("/#/S-04");
  await page.fill("#regTitle", "直す講義");
  await page.fill("#regTsv", "9:30\t0:10\t導入\t自己紹介\tp.1\n9:40\t0:10\t休憩\t【休憩】\t\n");
  await page.click("#registerBtn");
  await expect(page.locator("#s03")).toBeVisible();
  await page.click("button.edit");
  await page.click("#editModeForm");
  await expect(page.locator(".fRow")).toHaveCount(2);
  await expect(page.locator(".fRow").nth(0).locator('[data-f="procedure"]')).toHaveValue("自己紹介");
  await expect(page.locator(".fRow").nth(1).locator('[data-f="is_break"]')).toBeChecked();
  await fillRow(page, 0, { procedure: "自己紹介と目的の説明" });
  await page.click("#saveBtn");
  await expect(page.locator("#s03")).toBeVisible();
  await page.click("button.edit");
  await expect(page.locator("#editTsv")).toHaveValue(/自己紹介と目的の説明/);
  await expect(page.locator("#editTsv")).toHaveValue(/【休憩】/);
});

import { test, expect } from "@playwright/test";

// 進行表: A 開始時間 / B 所要時間 / C ステップ / D 進め方・手順 / E 使用ツール・資料（スライド範囲）
const TSV =
  "開始時間\t所要時間\tステップ\t進め方・手順\t使用ツール・資料\n" +
  "9:30\t0:10\t導入\t自己紹介をする\tp.1-3\n" +
  "9:40\t0:10\t休憩\t【休憩】\t\n" +
  "9:50\t0:20\t演習\t演習1を解く\tp.4-8\n";

// 時刻を固定する（ブラウザの Date だけ。Node 側のローカル時刻で指定）
async function fixTime(page, iso) {
  await page.clock.setFixedTime(new Date(iso));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
});

test("S-01 取り込み → S-02 に、スライド範囲・内容・現在時刻・残り時間が出る", async ({ page }) => {
  await fixTime(page, "2026-11-23T09:35:20");
  await page.goto("/#/S-01");
  await page.fill("#tsv", TSV);
  await page.click("#importBtn");
  await expect(page.locator("#s02")).toBeVisible();
  await expect(page.locator("#clock")).toHaveText("09:35:20");
  await expect(page.locator("#slides")).toHaveText("p.1-3");
  await expect(page.locator("#content")).toHaveText("自己紹介をする");
  await expect(page.locator("#remain")).toHaveText("4:40");
});

test("S-01 取り込み: 休憩の時間帯は「【休憩】」が出て、スライド範囲は出ない", async ({ page }) => {
  await fixTime(page, "2026-11-23T09:42:00");
  await page.goto("/#/S-01");
  await page.fill("#tsv", TSV);
  await page.click("#importBtn");
  await expect(page.locator("#content")).toHaveText("【休憩】");
  await expect(page.locator("#content")).toHaveClass(/is-break/);
  await expect(page.locator("#slides")).toHaveText("");
  await expect(page.locator("#remain")).toHaveText("8:00");
});

test("S-04 登録 → S-03 一覧 → S-02 表示、「←」で S-03 へ戻る", async ({ page }) => {
  await fixTime(page, "2026-11-23T09:55:00");
  await page.goto("/#/S-04");
  await page.fill("#regDate", "2026-11-23");
  await page.fill("#regTsv", TSV);
  await page.click("#registerBtn");
  await expect(page.locator("#s03")).toBeVisible();
  await expect(page.locator("button.lecture")).toHaveCount(1);
  await page.click("button.lecture");
  await expect(page.locator("#s02")).toBeVisible();
  await expect(page.locator("#clock")).toHaveText("09:55:00");
  await expect(page.locator("#slides")).toHaveText("p.4-8");
  await expect(page.locator("#content")).toHaveText("演習1を解く");
  await expect(page.locator("#remain")).toHaveText("15:00");
  await page.click("#backBtn");
  await expect(page.locator("#s03")).toBeVisible();
  await expect(page.locator("button.lecture")).toHaveCount(1);
});

import { test, expect } from "@playwright/test";

// 版の自動更新（version.json の番号が違えば読み直す）。公開先の version.json はテストで差し替える
const TSV =
  "開始時間\t所要時間\tステップ\t進め方・手順\t使用ツール・資料\n" +
  "9:50\t0:20\t演習\t演習1を解く\tp.4-8\n";

async function serveVersion(page, state) {
  state.requests = 0;
  await page.route("**/version.json*", async (route) => {
    state.requests++;
    if (state.body === null) { await route.fulfill({ status: 500, body: "x" }); return; }
    await route.fulfill({ status: 200, contentType: "application/json", body: state.body });
  });
}

test("同じ番号・壊れた中身・取れないときは読み直さない", async ({ page }) => {
  const state = { body: '{"version":"2"}' };
  await serveVersion(page, state);
  await page.goto("/#/S-03");
  await page.evaluate(() => { window.__marker = 1; });
  for (const body of ['{"version":"2"}', "not json", null]) {
    state.body = body;
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__marker)).toBe(1);
  }
});

test("番号が違えば自動で読み直す。読み直しを繰り返さない", async ({ page }) => {
  const state = { body: '{"version":"999"}' };
  await serveVersion(page, state);
  let loads = 0;
  page.on("load", () => { loads++; });
  await page.goto("/#/S-03");
  await page.evaluate(() => { window.__marker = 1; });
  await expect.poll(() => loads).toBeGreaterThanOrEqual(2); // 開いた1回 + 読み直し1回
  await page.waitForTimeout(800);
  expect(loads).toBe(2); // 番号が変わらない（このテストでは js は古いまま）でも、何度も読み直さない
  expect(await page.evaluate(() => window.__marker)).toBeUndefined();
});

test("S-03 に版の番号が出る", async ({ page }) => {
  await serveVersion(page, { body: '{"version":"2"}' });
  await page.goto("/#/S-03");
  await expect(page.locator("#appVersion")).toHaveText("版 2");
});

test("登録（S-04）の入力中は読み直さず、S-04 を離れたときに読み直す", async ({ page }) => {
  const state = { body: '{"version":"2"}' };
  await serveVersion(page, state);
  await page.goto("/#/S-04");
  await page.fill("#regTitle", "入力中のタイトル");
  await page.evaluate(() => { window.__marker = 1; });

  state.body = '{"version":"999"}';
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__marker)).toBe(1);
  await expect(page.locator("#regTitle")).toHaveValue("入力中のタイトル");

  await page.evaluate(() => { location.hash = "#/S-03"; }); // S-04 を離れる
  await expect
    .poll(
      async () => {
        try {
          return (await page.evaluate(() => window.__marker)) === undefined ? "reloaded" : "same";
        } catch {
          return "navigating";
        }
      },
      { timeout: 5000 },
    )
    .toBe("reloaded");
});

test("講義中の表示（S-02）の間は読み直さず、S-02 を離れたときに読み直す", async ({ page }) => {
  const state = { body: '{"version":"2"}' };
  await serveVersion(page, state);
  await page.clock.setFixedTime(new Date("2026-11-23T09:55:00"));
  await page.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); sessionStorage.setItem("seeded", "1"); } });
  await page.goto("/#/S-04");
  await page.fill("#regTitle", "更新テスト");
  await page.fill("#regTsv", TSV);
  await page.click("#registerBtn");
  await page.click("button.lecture");
  await expect(page.locator("#s02")).toBeVisible();
  await page.evaluate(() => { window.__marker = 1; });

  state.body = '{"version":"999"}';
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__marker)).toBe(1); // S-02 の間はそのまま

  await page.click("#backBtn"); // S-02 を離れる
  // 読み直しの最中は evaluate が Execution context was destroyed で落ちるので、例外は「まだ」として扱い、
  // 読み直し後の新しいページで marker が消えていることを待つ
  await expect
    .poll(
      async () => {
        try {
          return (await page.evaluate(() => window.__marker)) === undefined ? "reloaded" : "same";
        } catch {
          return "navigating";
        }
      },
      { timeout: 5000 },
    )
    .toBe("reloaded");
});

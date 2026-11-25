import { test, expect } from "@playwright/test";

// 前の版の保存の形（lecture_date だけ。title も groups もない）
const OLD = {
  lectures: [
    {
      id: 1,
      lecture_date: "2026-11-20",
      blocks: [
        { id: 1, lecture_id: 1, sort_order: 1, start_time: "9:30", duration: "0:10", step: "導入", procedure: "自己紹介", tools_materials: "p.1", trouble_follow_up: "", time_adjustment: "", is_break: false },
      ],
    },
  ],
};

test("前の版で登録した講義も編集できる: タイトルを直して保存すると S-03 に新しいタイトルが出る", async ({ page }) => {
  await page.addInitScript((old) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("presentation-timer:lectures", JSON.stringify(old));
      sessionStorage.setItem("seeded", "1");
    }
  }, OLD);
  await page.goto("/#/S-03");
  await expect(page.locator("button.lecture .title")).toHaveText("2026-11-20");
  await page.click("button.edit");
  await expect(page.locator("#s05")).toBeVisible();
  await expect(page.locator("#editTitle")).toHaveValue("2026-11-20");
  await expect(page.locator("#editTsv")).toHaveValue("9:30\t0:10\t導入\t自己紹介\tp.1\t\t");
  // タイトルが空だと保存されない
  await page.fill("#editTitle", "");
  await page.click("#saveBtn");
  await expect(page.locator("#editError")).toHaveText("タイトルを入れてください。");
  await page.fill("#editTitle", "11/20 午前（直した）");
  await page.click("#saveBtn");
  await expect(page.locator("#s03")).toBeVisible();
  await expect(page.locator("button.lecture .title")).toHaveText("11/20 午前（直した）");
  // キャンセルは何も変えない
  await page.click("button.edit");
  await page.fill("#editTitle", "捨てる");
  await page.click("#cancelBtn");
  await expect(page.locator("button.lecture .title")).toHaveText("11/20 午前（直した）");
});

// 画面のテスト（tasks.md の T-010）。e2e/ だけを読む（node --test は test/ だけを読むので、同じファイルを拾わない）
import { defineConfig } from "@playwright/test";

const PORT = 4890; // 4870・4871 とぶつからない番号

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.spec.mjs",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: {
    // 127.0.0.1 だけで受ける。配るのはこのフォルダの静的ファイル（ビルドなし）
    command: `node e2e/serve.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: false,
    timeout: 20000,
  },
});

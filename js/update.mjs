import { hasNewVersion } from "./version.mjs";

// 新しい版を確かめて、あれば読み直す。DOM に触らないよう、部品は引数で受け取る（node --test で確かめられる）
//  fetchLatest: 公開先の version.json を取り、中身（オブジェクト）を返す。失敗したら投げるか null を返す
//  isBusy: 講義中の表示（S-02）などで読み直してはいけないとき true
//  reload: キャッシュを取り直して読み直す
//  guard: { get(), set(v) } 同じ版へ何度も読み直さないための記憶（sessionStorage など）
export function createUpdater({ current, fetchLatest, isBusy, reload, guard }) {
  let pending = null; // S-02 の間に見つけた新しい版
  let running = false;

  async function check() {
    if (running) return;
    running = true;
    try {
      if (pending === null) {
        let latest = null;
        try { latest = await fetchLatest(); } catch { latest = null; }
        if (!hasNewVersion(current, latest)) return;
        pending = latest.version;
      }
      if (isBusy()) return;
      if (guard.get() === pending) return; // もう読み直したのに版が変わらない: 繰り返さない
      guard.set(pending);
      pending = null;
      await reload();
    } finally {
      running = false;
    }
  }
  return { check };
}

// ブラウザ用の組み立て。開いたとき・画面が前に戻ってきたとき・S-02 を離れたときに確かめる
export function startAutoUpdate({ current, win = window, doc = document }) {
  const KEY = "pt-reloaded-version";
  const updater = createUpdater({
    current,
    fetchLatest: async () => {
      const res = await win.fetch("version.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    },
    // 講義中の表示と、入力中の登録・編集の画面では読み直さない（離れたとき hashchange で読み直す）
    isBusy: () => ["S-02", "S-04", "S-05"].includes(doc.body.dataset.screen),
    reload: async () => {
      // js/ の .mjs が古いまま残らないよう、読み込み済みのファイルをキャッシュを無視して取り直す
      const urls = new Set([win.location.href.split("#")[0]]);
      for (const e of win.performance.getEntriesByType("resource")) {
        if (/\.(mjs|webmanifest)(\?|$)/.test(e.name) && e.name.startsWith(win.location.origin)) urls.add(e.name.split("?")[0]);
      }
      await Promise.all([...urls].map((u) => win.fetch(u, { cache: "reload" }).catch(() => {})));
      win.location.reload();
    },
    guard: {
      get: () => { try { return win.sessionStorage.getItem(KEY); } catch { return null; } },
      set: (v) => { try { win.sessionStorage.setItem(KEY, v); } catch {} },
    },
  });
  const run = () => { updater.check(); };
  doc.addEventListener("visibilitychange", () => { if (doc.visibilityState === "visible") run(); });
  win.addEventListener("hashchange", run); // S-02 を離れたとき
  run();
  return updater;
}

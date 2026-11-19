import { parseHash } from "./router.mjs";
import { screens } from "./screens/registry.mjs";

let cleanup = null; // 表示中の画面のあと始末（S-02 のタイマーなど）

function show() {
  if (typeof cleanup === "function") cleanup();
  cleanup = null;
  const id = parseHash(location.hash);
  const container = document.getElementById("app");
  document.body.dataset.screen = id;
  cleanup = screens[id].render(container);
}

window.addEventListener("hashchange", show);
show();

// 講義データ（localStorage）を端末に消されにくくする（判断事項6）。Service Worker は作らない（判断事項2）
if (navigator.storage && typeof navigator.storage.persist === "function") {
  navigator.storage.persist().catch(() => {});
}

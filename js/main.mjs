import { parseHash } from "./router.mjs";
import { screens } from "./screens/registry.mjs";

function show() {
  const id = parseHash(location.hash);
  const container = document.getElementById("app");
  document.body.dataset.screen = id;
  screens[id].render(container);
}

window.addEventListener("hashchange", show);
show();

// 講義データ（localStorage）を端末に消されにくくする（判断事項6）。Service Worker は作らない（判断事項2）
if (navigator.storage && typeof navigator.storage.persist === "function") {
  navigator.storage.persist().catch(() => {});
}

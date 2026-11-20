import { screens } from "./screens/registry.mjs";
import { createNavigator } from "./navigator.mjs";

const nav = createNavigator({
  screens,
  container: document.getElementById("app"),
  getHash: () => location.hash,
  setHash: (hash) => { location.hash = hash; },
  onScreen: (id) => { document.body.dataset.screen = id; },
});

window.addEventListener("hashchange", () => nav.show());
nav.show();

// 講義データ（localStorage）を端末に消されにくくする（判断事項6）。Service Worker は作らない（判断事項2）
if (navigator.storage && typeof navigator.storage.persist === "function") {
  navigator.storage.persist().catch(() => {});
}

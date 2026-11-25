import { screens } from "./screens/registry.mjs";
import { createNavigator } from "./navigator.mjs";
import { startAutoUpdate } from "./update.mjs";
import { APP_VERSION } from "./version.mjs";

const nav = createNavigator({
  screens,
  container: document.getElementById("app"),
  getHash: () => location.hash,
  setHash: (hash) => { location.hash = hash; },
  onScreen: (id) => { document.body.dataset.screen = id; },
});

window.addEventListener("hashchange", () => nav.show());
nav.show();

// 公開した新しい版を、開いたときと画面が前に戻ったときに確かめて読み直す（講義中の S-02 の間は待つ）
startAutoUpdate({ current: APP_VERSION });

// 講義データ（localStorage）を端末に消されにくくする（判断事項6）。Service Worker は作らない（判断事項2）
if (navigator.storage && typeof navigator.storage.persist === "function") {
  navigator.storage.persist().catch(() => {});
}

// 講義中の表示画面（S-02）を1秒ごとに進める（tasks.md の T-006。R-006-1）。画面（DOM）は持たない。
// 時刻と時計（今の時刻・タイマー）は差し替えられる。計算は liveView（js/live-view.mjs）をそのまま使う。
import { liveView } from "./live-view.mjs";

export const TICK_MS = 1000; // 更新の間隔（1秒ごと）

// options: { now: () => Date または秒数, setInterval, clearInterval, onUpdate(view) }
// 戻り値: stop()（タイマーを止める。何度呼んでもよい）
export function startLiveTicker(blocks, options = {}) {
  const now = options.now ?? (() => new Date());
  const setTimer = options.setInterval ?? globalThis.setInterval.bind(globalThis);
  const clearTimer = options.clearInterval ?? globalThis.clearInterval.bind(globalThis);
  const onUpdate = options.onUpdate ?? (() => {});
  let stopped = false;
  const tick = () => {
    if (!stopped) onUpdate(liveView(blocks, now(), options.getShown ? options.getShown() : null));
  };
  const handle = setTimer(tick, TICK_MS);
  return function stop() {
    if (stopped) return;
    stopped = true;
    clearTimer(handle);
  };
}

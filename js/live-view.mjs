// 講義中の表示画面（S-02）に出す中身の計算（tasks.md の T-005。R-004、R-005、BR-007）。画面は持たない。
// 現在時刻は引数で受け取る（Date または 0時からの秒数）。
import { currentBlock, lectureEnd, nowToSeconds, timeToSeconds } from "./schedule-time.mjs";
import { BREAK_LABEL } from "./schedule-import.mjs";

function pad2(n) {
  return String(n).padStart(2, "0");
}

// 0時からの秒数 → "09:05:03"
export function formatClock(sec) {
  const s = Math.floor(sec);
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

// 残り秒数 → "7:05"（分:秒）、1時間以上は "1:02:03"、過ぎていれば "-0:10"
export function formatRemain(sec) {
  const neg = sec < 0;
  const s = Math.abs(Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const body = h > 0 ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${m}:${pad2(s % 60)}`;
  return neg ? "-" + body : body;
}

// 進め方・手順欄の1行目（見出し）
export function firstLine(text) {
  return String(text ?? "").split(/\r\n|\n|\r/)[0].trim();
}

// 表示する中身。state: "before"（最初の行より前）／"during"（現在のブロックあり）／"after"（講義の終わり以降）
// 戻り値: { state, clock, slides, content, isBreak, remainSeconds, remainText, isOver }
export function liveView(blocks, now) {
  const t = nowToSeconds(now);
  const view = {
    state: "before",
    clock: formatClock(t),
    slides: "",
    content: "",
    isBreak: false,
    remainSeconds: null,
    remainText: "--:--",
    isOver: false,
  };
  const cur = currentBlock(blocks, t);
  if (!cur) {
    view.state = t >= lectureEnd(blocks).seconds ? "after" : "before";
    return view;
  }
  const b = cur.block;
  const remain = timeToSeconds(b.start_time) + timeToSeconds(b.duration) - t; // BR-007
  view.state = "during";
  view.isBreak = b.is_break === true || firstLine(b.procedure) === BREAK_LABEL;
  view.slides = String(b.tools_materials ?? "").trim();
  // 空なら、前のブロックのうち休憩でなく値のある一番近いものを出す（セル結合で上の行にだけ値がある進行表のため）。休憩のブロックは今のまま
  if (view.slides === "" && !view.isBreak) {
    for (let i = cur.index - 1; i >= 0; i--) {
      const p = blocks[i];
      if (p.is_break === true || firstLine(p.procedure) === BREAK_LABEL) continue;
      const s = String(p.tools_materials ?? "").trim();
      if (s !== "") {
        view.slides = s;
        break;
      }
    }
  }
  view.content = view.isBreak ? BREAK_LABEL : firstLine(b.procedure);
  view.remainSeconds = remain;
  view.remainText = formatRemain(remain);
  view.isOver = remain < 0;
  return view;
}

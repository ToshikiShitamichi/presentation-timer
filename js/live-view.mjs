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
// shown: 手で進めたセクションの番号（null なら時刻どおり）。時刻で決まる今のセクションより後ろのときだけ効く。
// 追加の戻り値: index（表示中の行の番号。during のとき）、canNext、canPrev
export function effectiveIndex(blocks, now, shown = null) {
  const cur = currentBlock(blocks, nowToSeconds(now));
  if (!cur) return null;
  if (Number.isInteger(shown) && shown > cur.index) return Math.min(shown, blocks.length - 1);
  return cur.index;
}

// 次へ（dir=1）・前へ（dir=-1）を押したあとの shown を返す。範囲の外では今の値のまま。
// 時刻で決まる今のセクションまで戻ったら null（時刻どおり）。
export function stepShown(blocks, now, shown, dir) {
  const t = nowToSeconds(now);
  const cur = currentBlock(blocks, t);
  if (!cur) return shown ?? null;
  const eff = effectiveIndex(blocks, t, shown);
  const next = eff + (dir < 0 ? -1 : 1);
  if (next >= blocks.length || next < cur.index) return eff === cur.index ? null : eff;
  return next === cur.index ? null : next;
}

export function liveView(blocks, now, shown = null) {
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
    index: null,
    canNext: false,
    canPrev: false,
  };
  const timeCur = currentBlock(blocks, t);
  if (!timeCur) {
    view.state = t >= lectureEnd(blocks).seconds ? "after" : "before";
    return view;
  }
  const idx = effectiveIndex(blocks, t, shown);
  const cur = { index: idx, block: blocks[idx] };
  view.index = idx;
  view.canNext = idx < blocks.length - 1;
  view.canPrev = idx > timeCur.index;
  const b = cur.block;
  // BR-007（11/25 変更）: 次の行の開始時刻 − 今の時刻。最後の行は講義の終わりの時刻から引く
  const endSec = idx + 1 < blocks.length ? timeToSeconds(blocks[idx + 1].start_time) : lectureEnd(blocks).seconds;
  const remain = endSec - t;
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

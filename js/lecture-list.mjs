// S-03 の一覧に並べる中身（tasks.md の T-008。R-008-1）。DOM に触らない純関数。
import { lectureEnd } from "./schedule-time.mjs";

function timeRange(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return "";
  try {
    return `${blocks[0].start_time}〜${lectureEnd(blocks).text}`;
  } catch {
    return String(blocks[0].start_time ?? "");
  }
}

function firstContent(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return "";
  const b = blocks[0];
  return b.procedure || b.step || "";
}

// 開始時刻の並べ替え用の秒数（読めないときは最後）
function startSec(blocks) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(blocks?.[0]?.start_time ?? "").trim());
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : Number.MAX_SAFE_INTEGER;
}

// 講義の配列 → 日付ごとのまとめ。日付は古い順、同じ日付の中は開始時刻の順（同じなら登録順）。
// 戻り値: [ { date, items: [ { id, timeText, first, lecture } ] } ]
export function groupLecturesByDate(lectures) {
  const sorted = [...(lectures ?? [])].sort(
    (a, b) =>
      String(a.lecture_date).localeCompare(String(b.lecture_date)) ||
      startSec(a.blocks) - startSec(b.blocks) ||
      a.id - b.id,
  );
  const groups = [];
  for (const l of sorted) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== l.lecture_date) {
      g = { date: l.lecture_date, items: [] };
      groups.push(g);
    }
    g.items.push({ id: l.id, timeText: timeRange(l.blocks), first: firstContent(l.blocks), lecture: l });
  }
  return groups;
}

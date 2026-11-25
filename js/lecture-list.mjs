// S-03 の一覧に並べる中身（tasks.md の T-008。R-008-1）。DOM に触らない純関数。
// 11/25 の変更: 日付ごとのまとめをやめ、グループ（タイトル付き）と、グループに入っていない講義を出す。
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
function startOf(start) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(start ?? "").trim());
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : Number.MAX_SAFE_INTEGER;
}

function startSec(blocks) {
  return startOf(blocks?.[0]?.start_time);
}

function toItem(l) {
  return { id: l.id, title: l.title, timeText: timeRange(l.blocks), first: firstContent(l.blocks), lecture: l };
}

// 講義の並べ方: タイトル順、同じタイトルは開始時刻の順（同じなら登録順）
function byTitleThenStart(a, b) {
  return String(a.title).localeCompare(String(b.title)) || startSec(a.blocks) - startSec(b.blocks) || a.id - b.id;
}

// グループの講義の行を、開始時刻の順に並べた1つの進行表にする（通しの表示用）。同じ開始時刻は、グループの並びの順。
export function mergedBlocks(lectures, group) {
  const byId = new Map((lectures ?? []).map((l) => [l.id, l]));
  const rows = [];
  for (const id of group.lecture_ids ?? []) {
    const l = byId.get(id);
    if (l) for (const b of l.blocks) rows.push(b);
  }
  return rows
    .map((b, i) => ({ b, i }))
    .sort((x, y) => startOf(x.b.start_time) - startOf(y.b.start_time) || x.i - y.i)
    .map((x) => x.b);
}

// 講義とグループ → 一覧の中身。
// 戻り値: { groups: [ { id, title, timeText, items: [講義の項目] , blocks } ], singles: [ { id, title, timeText, first, lecture } ] }
// groups はタイトル順（同じなら作った順）。items はグループの並びの順で、1件ずつ開けるように講義も出す。
// singles は、どのグループにも入っていない講義（タイトル順）。
export function buildList(lectures, groups) {
  const all = lectures ?? [];
  const byId = new Map(all.map((l) => [l.id, l]));
  const inGroup = new Set();
  const outGroups = [...(groups ?? [])]
    .sort((a, b) => String(a.title).localeCompare(String(b.title)) || a.id - b.id)
    .map((g) => {
      const ls = (g.lecture_ids ?? []).map((id) => byId.get(id)).filter(Boolean);
      for (const l of ls) inGroup.add(l.id);
      const blocks = mergedBlocks(all, g);
      return { id: g.id, title: g.title, timeText: timeRange(blocks), items: ls.map(toItem), blocks };
    });
  const singles = all.filter((l) => !inGroup.has(l.id)).sort(byTitleThenStart).map(toItem);
  return { groups: outGroups, singles };
}

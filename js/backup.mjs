// 講義の書き出し・読み込み（tasks.md の T-001〜T-012 の後に、11/20 の社長の指示で足した。判断事項6の変更）。
// DOM に触らない純関数。localStorage は引数で差し替えられる。
import { loadLectures, saveLectures, storageWarning } from "./storage.mjs";

export const BACKUP_FORMAT = "presentation-timer-lectures";
export const BACKUP_VERSION = 1;

const BLOCK_STRINGS = ["start_time", "duration", "step", "procedure", "tools_materials", "trouble_follow_up", "time_adjustment"];

function p2(n) {
  return String(n).padStart(2, "0");
}

// 書き出すファイルの名前。例: presentation-timer-lectures-2026-11-20.json
export function exportFileName(d = new Date()) {
  return `${BACKUP_FORMAT}-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.json`;
}

// 保存されている講義の全部 → ファイルの文字列。講義が0件なら null（書き出すものがない）。
export function exportLectures(storage, now = new Date()) {
  const lectures = loadLectures(storage);
  if (lectures.length === 0) return null;
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exported_at: now.toISOString(),
      lectures: lectures.map((l) => ({ lecture_date: l.lecture_date, blocks: l.blocks })),
    },
    null,
    2,
  );
}

// ブロックの比較用の文字列（id・lecture_id は見ない）
function blocksKey(blocks) {
  return JSON.stringify(
    blocks.map((b) => [...BLOCK_STRINGS.map((k) => (typeof b[k] === "string" ? b[k] : "")), b.is_break === true]),
  );
}

function isRealDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

// ファイルの文字列を確かめて、講義の配列（lecture_date と blocks だけ）にする。
function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "ファイルを読めません（JSON として壊れています）。" };
  }
  if (!data || typeof data !== "object" || data.format !== BACKUP_FORMAT) {
    return { error: "このアプリで書き出したファイルではありません。" };
  }
  if (data.version !== BACKUP_VERSION) {
    return { error: `ファイルの版（${String(data.version)}）に対応していません。` };
  }
  if (!Array.isArray(data.lectures)) return { error: "ファイルに講義の一覧がありません。" };
  const out = [];
  for (let i = 0; i < data.lectures.length; i++) {
    const l = data.lectures[i];
    const n = i + 1;
    if (!l || typeof l !== "object" || typeof l.lecture_date !== "string" || !isRealDate(l.lecture_date)) {
      return { error: `${n} 件目の講義の日付が読めません。` };
    }
    if (!Array.isArray(l.blocks) || l.blocks.length === 0 || l.blocks.some((b) => !b || typeof b !== "object" || typeof b.start_time !== "string")) {
      return { error: `${n} 件目の講義の進行表が読めません。` };
    }
    out.push({ lecture_date: l.lecture_date, blocks: l.blocks });
  }
  return { lectures: out };
}

// ファイルの講義を今の講義に足して保存する。
// 同じ日付で blocks の中身が同じ講義は足さない。id は新しく付ける。
// 戻り値: { ok: true, added, skipped, warning } または { ok: false, error }（エラーのときは保存を変えない）
export function importLectures(storage, text) {
  const parsed = parseBackup(text);
  if (parsed.error) return { ok: false, error: parsed.error };
  const lectures = loadLectures(storage);
  let nextId = lectures.reduce((m, l) => Math.max(m, l.id), 0) + 1;
  let nextBlockId = lectures.reduce((m, l) => l.blocks.reduce((mm, b) => Math.max(mm, b.id), m), 0) + 1;
  const seen = new Set(lectures.map((l) => l.lecture_date + "|" + blocksKey(l.blocks)));
  let added = 0;
  let skipped = 0;
  for (const l of parsed.lectures) {
    const key = l.lecture_date + "|" + blocksKey(l.blocks);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const id = nextId++;
    lectures.push({
      id,
      lecture_date: l.lecture_date,
      blocks: l.blocks.map((b, idx) => {
        const nb = { id: nextBlockId++, lecture_id: id, sort_order: Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : idx + 1 };
        for (const k of BLOCK_STRINGS) nb[k] = typeof b[k] === "string" ? b[k] : "";
        nb.is_break = b.is_break === true;
        return nb;
      }),
    });
    added++;
  }
  if (added > 0) saveLectures(storage, lectures);
  return { ok: true, added, skipped, warning: storageWarning(lectures.length) };
}

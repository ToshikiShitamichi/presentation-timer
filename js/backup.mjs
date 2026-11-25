// 講義の書き出し・読み込み（tasks.md の T-001〜T-012 の後に、11/20 の社長の指示で足した。判断事項6の変更）。
// DOM に触らない純関数。localStorage は引数で差し替えられる。
// 11/25 の変更（version 2）: 講義は lecture_date でなく title を持ち、groups（title と lectures: ファイル内の講義の番号〔0 から〕の並び）を持つ。version 1 のファイルも読める（lecture_date はタイトルとして読む）。
import { loadLectures, loadGroups, saveLectures, storageWarning } from "./storage.mjs";

export const BACKUP_FORMAT = "presentation-timer-lectures";
export const BACKUP_VERSION = 2;

const BLOCK_STRINGS = ["start_time", "duration", "step", "procedure", "tools_materials", "trouble_follow_up", "time_adjustment"];

function p2(n) {
  return String(n).padStart(2, "0");
}

// 書き出すファイルの名前。例: presentation-timer-lectures-2026-11-20.json
export function exportFileName(d = new Date()) {
  return `${BACKUP_FORMAT}-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.json`;
}

// 保存されている講義とグループの全部 → ファイルの文字列。講義が0件なら null（書き出すものがない）。
export function exportLectures(storage, now = new Date()) {
  const lectures = loadLectures(storage);
  if (lectures.length === 0) return null;
  const index = new Map(lectures.map((l, i) => [l.id, i]));
  const groups = loadGroups(storage)
    .map((g) => ({ title: g.title, lectures: g.lecture_ids.filter((id) => index.has(id)).map((id) => index.get(id)) }))
    .filter((g) => g.lectures.length > 0);
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exported_at: now.toISOString(),
      lectures: lectures.map((l) => ({ title: l.title, blocks: l.blocks })),
      groups,
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

// ファイルの文字列を確かめて、講義の配列（title と blocks だけ）とグループの配列（title と lectures）にする。
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
  if (data.version !== 1 && data.version !== BACKUP_VERSION) {
    return { error: `ファイルの版（${String(data.version)}）に対応していません。` };
  }
  if (!Array.isArray(data.lectures)) return { error: "ファイルに講義の一覧がありません。" };
  const out = [];
  for (let i = 0; i < data.lectures.length; i++) {
    const l = data.lectures[i];
    const n = i + 1;
    let title;
    if (data.version === 1) {
      if (!l || typeof l !== "object" || typeof l.lecture_date !== "string" || !isRealDate(l.lecture_date)) {
        return { error: `${n} 件目の講義の日付が読めません。` };
      }
      title = l.lecture_date;
    } else {
      if (!l || typeof l !== "object" || typeof l.title !== "string" || l.title.trim() === "") {
        return { error: `${n} 件目の講義のタイトルが読めません。` };
      }
      title = l.title.trim();
    }
    if (!Array.isArray(l.blocks) || l.blocks.length === 0 || l.blocks.some((b) => !b || typeof b !== "object" || typeof b.start_time !== "string")) {
      return { error: `${n} 件目の講義の進行表が読めません。` };
    }
    out.push({ title, blocks: l.blocks });
  }
  const groups = [];
  if (data.version === BACKUP_VERSION && data.groups !== undefined) {
    if (!Array.isArray(data.groups)) return { error: "ファイルのグループの一覧が読めません。" };
    for (let i = 0; i < data.groups.length; i++) {
      const g = data.groups[i];
      const n = i + 1;
      if (!g || typeof g !== "object" || typeof g.title !== "string" || g.title.trim() === "") {
        return { error: `${n} 件目のグループのタイトルが読めません。` };
      }
      if (
        !Array.isArray(g.lectures) ||
        g.lectures.length === 0 ||
        g.lectures.some((x) => !Number.isInteger(x) || x < 0 || x >= out.length)
      ) {
        return { error: `${n} 件目のグループの講義の並びが読めません。` };
      }
      groups.push({ title: g.title.trim(), lectures: [...new Set(g.lectures)] });
    }
  }
  return { lectures: out, groups };
}

function makeBlocks(blocks, id, nextBlockId) {
  return blocks.map((b, idx) => {
    const nb = { id: nextBlockId(), lecture_id: id, sort_order: Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : idx + 1 };
    for (const k of BLOCK_STRINGS) nb[k] = typeof b[k] === "string" ? b[k] : "";
    nb.is_break = b.is_break === true;
    return nb;
  });
}

// ファイルの講義とグループを今の保存に足して保存する。
// 同じタイトルで blocks の中身が同じ講義は足さない（グループの中ではその今ある講義を使う）。
// 同じタイトルで同じ講義の並びのグループは足さない。id は新しく付ける。
// 戻り値: { ok: true, added, skipped, groupsAdded, warning } または { ok: false, error }（エラーのときは保存を変えない）
export function importLectures(storage, text) {
  const parsed = parseBackup(text);
  if (parsed.error) return { ok: false, error: parsed.error };
  const lectures = loadLectures(storage);
  const groups = loadGroups(storage);
  let nextId = lectures.reduce((m, l) => Math.max(m, l.id), 0) + 1;
  let nextBlockId = lectures.reduce((m, l) => l.blocks.reduce((mm, b) => Math.max(mm, b.id), m), 0) + 1;
  const seen = new Map(lectures.map((l) => [l.title + "|" + blocksKey(l.blocks), l.id]));
  const idOf = []; // ファイルの講義の番号 → 保存の講義の id
  let added = 0;
  let skipped = 0;
  for (const l of parsed.lectures) {
    const key = l.title + "|" + blocksKey(l.blocks);
    if (seen.has(key)) {
      skipped++;
      idOf.push(seen.get(key));
      continue;
    }
    const id = nextId++;
    seen.set(key, id);
    idOf.push(id);
    lectures.push({ id, title: l.title, blocks: makeBlocks(l.blocks, id, () => nextBlockId++) });
    added++;
  }
  let groupsAdded = 0;
  let nextGroupId = groups.reduce((m, g) => Math.max(m, g.id), 0) + 1;
  for (const g of parsed.groups) {
    const ids = g.lectures.map((i) => idOf[i]);
    const same = groups.some((x) => x.title === g.title && x.lecture_ids.length === ids.length && x.lecture_ids.every((v, i) => v === ids[i]));
    if (same) continue;
    groups.push({ id: nextGroupId++, title: g.title, lecture_ids: ids });
    groupsAdded++;
  }
  if (added > 0 || groupsAdded > 0) saveLectures(storage, lectures, groups);
  return { ok: true, added, skipped, groupsAdded, warning: storageWarning(lectures.length) };
}

// ファイルの講義とグループだけにして保存する（今の講義とグループは全部消える。id は新しく付ける）。
// 戻り値: { ok: true, count, warning } または { ok: false, error }（エラーのときは保存を変えない）
export function replaceLectures(storage, text) {
  const parsed = parseBackup(text);
  if (parsed.error) return { ok: false, error: parsed.error };
  if (parsed.lectures.length === 0) return { ok: false, error: "ファイルに講義が1件もありません。" };
  let nextBlockId = 1;
  const lectures = parsed.lectures.map((l, i) => {
    const id = i + 1;
    return { id, title: l.title, blocks: makeBlocks(l.blocks, id, () => nextBlockId++) };
  });
  const groups = parsed.groups.map((g, i) => ({ id: i + 1, title: g.title, lecture_ids: g.lectures.map((x) => x + 1) }));
  saveLectures(storage, lectures, groups);
  return { ok: true, count: lectures.length, warning: storageWarning(lectures.length) };
}

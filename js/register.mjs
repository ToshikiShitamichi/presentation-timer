// 講義の登録の処理（F-004。tasks.md の T-007。R-007-1、R-007-2）。画面は持たない。
// storage は引数で差し替えられる。保存は storage.mjs の addLecture、取り込みは schedule-import.mjs の parseSchedule。
// 11/25 の変更: 日付をやめてタイトル（空は登録できない）にした。
import { parseSchedule, formRowsToBlocks } from "./schedule-import.mjs";
import { addLecture, updateLecture } from "./storage.mjs";

// 登録済みの講義のタイトルと進行表を置き換える（編集。S-05）。登録と同じ確かめをして、エラーのときは保存を変えない。
// 戻り値: { ok: true, lecture } か { ok: false, error }
export function editLecture(storage, id, title, text) {
  const name = String(title ?? "").trim();
  if (!name) return { ok: false, error: "タイトルを入れてください。" };
  let blocks;
  try {
    blocks = parseSchedule(String(text ?? ""));
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const r = updateLecture(storage, id, name, blocks);
  if (!r.ok) return { ok: false, error: "その講義が見つかりません。" };
  return { ok: true, lecture: r.lecture };
}

// フォームの行（schedule-import.mjs の formRowsToBlocks）から登録・編集する。確かめは貼り付けと同じ。
export function registerLectureForm(storage, title, rows) {
  const name = String(title ?? "").trim();
  if (!name) return { ok: false, error: "タイトルを入れてください。" };
  let blocks;
  try {
    blocks = formRowsToBlocks(rows);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const { lecture, warning } = addLecture(storage, name, blocks);
  return { ok: true, lecture, warning };
}

export function editLectureForm(storage, id, title, rows) {
  const name = String(title ?? "").trim();
  if (!name) return { ok: false, error: "タイトルを入れてください。" };
  let blocks;
  try {
    blocks = formRowsToBlocks(rows);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const r = updateLecture(storage, id, name, blocks);
  if (!r.ok) return { ok: false, error: "その講義が見つかりません。" };
  return { ok: true, lecture: r.lecture };
}

// タイトルと進行表のテキストから講義を1件登録する。
// 戻り値: { ok: true, lecture, warning } か { ok: false, error }（error は画面の #regError に出す文）
export function registerLecture(storage, title, text) {
  const name = String(title ?? "").trim();
  if (!name) return { ok: false, error: "タイトルを入れてください。" };
  let blocks;
  try {
    blocks = parseSchedule(String(text ?? ""));
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const { lecture, warning } = addLecture(storage, name, blocks);
  return { ok: true, lecture, warning };
}

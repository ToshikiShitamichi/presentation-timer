// 講義の登録の処理（F-004。tasks.md の T-007。R-007-1、R-007-2）。画面は持たない。
// storage は引数で差し替えられる。保存は storage.mjs の addLecture、取り込みは schedule-import.mjs の parseSchedule。
// 11/25 の変更: 日付をやめてタイトル（空は登録できない）にした。
import { parseSchedule } from "./schedule-import.mjs";
import { addLecture } from "./storage.mjs";

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

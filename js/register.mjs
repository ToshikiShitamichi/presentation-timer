// 講義の登録の処理（F-004。tasks.md の T-007。R-007-1、R-007-2）。画面は持たない。
// storage は引数で差し替えられる。保存は storage.mjs の addLecture、取り込みは schedule-import.mjs の parseSchedule。
import { parseSchedule } from "./schedule-import.mjs";
import { addLecture } from "./storage.mjs";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function validDate(s) {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

// 日付と進行表のテキストから講義を1件登録する。
// 戻り値: { ok: true, lecture, warning } か { ok: false, error }（error は画面の #regError に出す文）
export function registerLecture(storage, lectureDate, text) {
  const date = String(lectureDate ?? "").trim();
  if (!validDate(date)) return { ok: false, error: "日付を入れてください。" };
  let blocks;
  try {
    blocks = parseSchedule(String(text ?? ""));
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const { lecture, warning } = addLecture(storage, date, blocks);
  return { ok: true, lecture, warning };
}

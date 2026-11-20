// S-01「取り込む」の処理（tasks.md の T-009）。画面は持たないので node --test で確かめられる。
// 取り込めたら open("S-02", { blocks }) で S-02 へ移る（前の画面のタイマー停止は navigator.mjs の show が行う）。
// 取り込めないときは移らず、{ ok: false, error }（画面の #importError に出す文）を返す。
import { parseSchedule } from "./schedule-import.mjs";

export function runImport(text, open) {
  let blocks;
  try {
    blocks = parseSchedule(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  open("S-02", { blocks });
  return { ok: true, blocks };
}

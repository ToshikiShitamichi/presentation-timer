// 講義の終わりの時刻と現在のブロックの判定（tasks.md の T-004。R-003、BR-005、BR-006）。画面は持たない。
// 時刻は「0時からの秒数」で扱う。現在時刻は引数で受け取る（Date、または 0時からの秒数）。

// "9:30" → 0時からの秒数。読めないときは Error
export function timeToSeconds(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? "").trim());
  if (!m) throw new Error(`時刻「${text}」が読めません（例: 9:30）。`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60;
}

// 0時からの秒数 → "16:45"（分まで。24時以降はそのまま 24:10 のように出す）
export function secondsToTime(sec) {
  const total = Math.floor(sec / 60);
  const h = Math.floor(total / 60);
  const mm = String(total % 60).padStart(2, "0");
  return `${h}:${mm}`;
}

// 現在時刻（Date または 0時からの秒数）→ 0時からの秒数
export function nowToSeconds(now) {
  if (now instanceof Date) return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  if (typeof now === "number" && Number.isFinite(now)) return now;
  throw new Error("現在時刻は Date か秒数で渡してください。");
}

// 講義の終わりの時刻（BR-005）＝ 最後の行の開始時刻 ＋ 所要時間。進行表（parseSchedule の結果）を渡す。
// 戻り値は { seconds, text }（例: 16:37＋0:08 → text は "16:45"）
export function lectureEnd(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) throw new Error("進行表に行がありません。");
  const last = blocks[blocks.length - 1];
  const seconds = timeToSeconds(last.start_time) + timeToSeconds(last.duration);
  return { seconds, text: secondsToTime(seconds) };
}

// 現在のブロック（BR-006）。戻り値は { index, block } 。
// 開始時刻以上、次の行の開始時刻より前の間はその行。最後の行は、終わりの時刻より前の間。
// 最初の行より前・終わりの時刻以降は null（予定のブロックがない）。
export function currentBlock(blocks, now) {
  const t = nowToSeconds(now);
  const end = lectureEnd(blocks).seconds;
  if (t >= end) return null;
  let found = null;
  for (let i = 0; i < blocks.length; i++) {
    if (timeToSeconds(blocks[i].start_time) <= t) found = i;
    else break;
  }
  return found === null ? null : { index: found, block: blocks[found] };
}

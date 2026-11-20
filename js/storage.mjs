// 講義の保存・読み込み（F-004・F-005。tasks.md の T-002）。localStorage は引数で差し替えられる。
// 保存の形: { lectures: [ { id, lecture_date, blocks: [ TB-02 の項目 ] } ] }
export const STORAGE_KEY = "presentation-timer:lectures";
export const LECTURE_LIMIT = 100; // 判断事項4: 20〜100 講義
export const LECTURE_WARN_AT = 90; // 100 に近づいたら警告

const BLOCK_STRINGS = ["start_time", "duration", "step", "procedure", "tools_materials", "trouble_follow_up", "time_adjustment"];

function normalizeBlock(b, lectureId) {
  const out = { id: Number(b.id), lecture_id: lectureId, sort_order: Number(b.sort_order) };
  for (const k of BLOCK_STRINGS) out[k] = typeof b[k] === "string" ? b[k] : "";
  out.is_break = b.is_break === true;
  return out;
}

// 保存された講義をすべて読む。何もない・壊れているときは空の配列。
export function loadLectures(storage) {
  let data;
  try {
    data = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return [];
  }
  if (!data || !Array.isArray(data.lectures)) return [];
  return data.lectures.map((l) => {
    const id = Number(l.id);
    return {
      id,
      lecture_date: String(l.lecture_date ?? ""),
      blocks: (Array.isArray(l.blocks) ? l.blocks : []).map((b) => normalizeBlock(b, id)),
    };
  });
}

export function saveLectures(storage, lectures) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ lectures }));
}

// 保存が 100 講義に近づいたときの警告の文。まだ余裕があれば null。
export function storageWarning(count) {
  if (count >= LECTURE_LIMIT) return `講義が ${count} 件になりました（目安は ${LECTURE_LIMIT} 件まで）。古い講義の整理を考えてください。`;
  if (count >= LECTURE_WARN_AT) return `講義が ${count} 件になりました。${LECTURE_LIMIT} 件に近づいています。`;
  return null;
}

// 講義を1件追加して保存する。同じ日付の講義があっても追加で保存する（R-007-2）。
// blocks は parseSchedule の結果。id と lecture_id はここで付ける。
export function addLecture(storage, lectureDate, blocks) {
  const lectures = loadLectures(storage);
  const id = lectures.reduce((m, l) => Math.max(m, l.id), 0) + 1;
  let nextBlockId = lectures.reduce((m, l) => l.blocks.reduce((mm, b) => Math.max(mm, b.id), m), 0) + 1;
  const lecture = {
    id,
    lecture_date: lectureDate,
    blocks: blocks.map((b) => normalizeBlock({ ...b, id: nextBlockId++ }, id)),
  };
  lectures.push(lecture);
  saveLectures(storage, lectures);
  return { lecture, warning: storageWarning(lectures.length) };
}

// 講義を1件取り除いて保存する（論理削除なし。docs/04_database.md）。ほかの講義は変えない。
// 戻り値: 取り除いたら true、その id の講義がなければ false（保存は変えない）。
export function deleteLecture(storage, id) {
  const lectures = loadLectures(storage);
  const rest = lectures.filter((l) => l.id !== Number(id));
  if (rest.length === lectures.length) return false;
  saveLectures(storage, rest);
  return true;
}

// 講義の保存・読み込み（F-004・F-005。tasks.md の T-002）。localStorage は引数で差し替えられる。
// 保存の形: { lectures: [ { id, title, blocks: [ TB-02 の項目 ] } ], groups: [ { id, title, lecture_ids: [講義の id] } ] }
// 11/25 の変更: lecture_date をやめて title にした。前の形（lecture_date だけを持つ保存）は、読むときに title として読む。groups は新しい。
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

function readData(storage) {
  try {
    const data = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null");
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

// 保存された講義をすべて読む。何もない・壊れているときは空の配列。
export function loadLectures(storage) {
  const data = readData(storage);
  if (!data || !Array.isArray(data.lectures)) return [];
  return data.lectures.map((l) => {
    const id = Number(l.id);
    return {
      id,
      title: String(l.title ?? l.lecture_date ?? ""),
      blocks: (Array.isArray(l.blocks) ? l.blocks : []).map((b) => normalizeBlock(b, id)),
    };
  });
}

// 保存されたグループをすべて読む。何もないときは空の配列。
export function loadGroups(storage) {
  const data = readData(storage);
  if (!data || !Array.isArray(data.groups)) return [];
  return data.groups.map((g) => ({
    id: Number(g.id),
    title: String(g.title ?? ""),
    lecture_ids: (Array.isArray(g.lecture_ids) ? g.lecture_ids : []).map(Number).filter((n) => Number.isFinite(n)),
  }));
}

// groups を渡さなければ、保存されているグループをそのまま残す。
export function saveLectures(storage, lectures, groups = loadGroups(storage)) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ lectures, groups }));
}

// 保存が 100 講義に近づいたときの警告の文。まだ余裕があれば null。
export function storageWarning(count) {
  if (count >= LECTURE_LIMIT) return `講義が ${count} 件になりました（目安は ${LECTURE_LIMIT} 件まで）。古い講義の整理を考えてください。`;
  if (count >= LECTURE_WARN_AT) return `講義が ${count} 件になりました。${LECTURE_LIMIT} 件に近づいています。`;
  return null;
}

// 講義を1件追加して保存する。同じタイトルの講義があっても追加で保存する（R-007-2）。
// blocks は parseSchedule の結果。id と lecture_id はここで付ける。
export function addLecture(storage, title, blocks) {
  const lectures = loadLectures(storage);
  const id = lectures.reduce((m, l) => Math.max(m, l.id), 0) + 1;
  let nextBlockId = lectures.reduce((m, l) => l.blocks.reduce((mm, b) => Math.max(mm, b.id), m), 0) + 1;
  const lecture = {
    id,
    title,
    blocks: blocks.map((b) => normalizeBlock({ ...b, id: nextBlockId++ }, id)),
  };
  lectures.push(lecture);
  saveLectures(storage, lectures);
  return { lecture, warning: storageWarning(lectures.length) };
}

// 講義1件のタイトルと進行表を置き換えて保存する（編集。S-05）。講義の id・並び・グループは変えない。
// blocks は parseSchedule の結果。ブロックの id は、ほかの講義と重ならないよう新しく付ける。
// 戻り値: { ok: true, lecture } か、その id の講義がなければ { ok: false }（保存は変えない）
export function updateLecture(storage, id, title, blocks) {
  const lectures = loadLectures(storage);
  const i = lectures.findIndex((l) => l.id === Number(id));
  if (i < 0) return { ok: false };
  const lid = lectures[i].id;
  let nextBlockId = lectures.reduce((m, l) => l.blocks.reduce((mm, b) => Math.max(mm, b.id), m), 0) + 1;
  const lecture = { id: lid, title, blocks: blocks.map((b) => normalizeBlock({ ...b, id: nextBlockId++ }, lid)) };
  lectures[i] = lecture;
  saveLectures(storage, lectures);
  return { ok: true, lecture };
}

// 講義を1件取り除いて保存する（論理削除なし。docs/04_database.md）。ほかの講義は変えない。
// グループの並びからもその講義を外す（講義がなくなって空になったグループは、グループだけを取り除く）。
// 戻り値: 取り除いたら true、その id の講義がなければ false（保存は変えない）。
export function deleteLecture(storage, id) {
  const lectures = loadLectures(storage);
  const rest = lectures.filter((l) => l.id !== Number(id));
  if (rest.length === lectures.length) return false;
  const groups = loadGroups(storage)
    .map((g) => ({ ...g, lecture_ids: g.lecture_ids.filter((x) => x !== Number(id)) }))
    .filter((g) => g.lecture_ids.length > 0);
  saveLectures(storage, rest, groups);
  return true;
}

// グループを1件作って保存する。lectureIds の並びがそのままグループの並び。ない講義の id は無視する。
// 戻り値: { ok: true, group } か { ok: false, error }（エラーのときは保存を変えない）
export function addGroup(storage, title, lectureIds) {
  const name = String(title ?? "").trim();
  if (!name) return { ok: false, error: "グループのタイトルを入れてください。" };
  const lectures = loadLectures(storage);
  const exist = new Set(lectures.map((l) => l.id));
  const ids = [...new Set((lectureIds ?? []).map(Number))].filter((n) => exist.has(n));
  if (ids.length === 0) return { ok: false, error: "グループに入れる講義を選んでください。" };
  const groups = loadGroups(storage);
  const group = { id: groups.reduce((m, g) => Math.max(m, g.id), 0) + 1, title: name, lecture_ids: ids };
  groups.push(group);
  saveLectures(storage, lectures, groups);
  return { ok: true, group };
}

// グループを1件取り除いて保存する（中の講義は消さない。deleteLecture と同じ形）。
// 戻り値: 取り除いたら true、その id のグループがなければ false（保存は変えない）。
export function deleteGroup(storage, id) {
  const groups = loadGroups(storage);
  const rest = groups.filter((g) => g.id !== Number(id));
  if (rest.length === groups.length) return false;
  saveLectures(storage, loadLectures(storage), rest);
  return true;
}

// 画面ごとの置き場。各画面の中身は後続の tasks.md のタスクで作る（モックは docs/mocks/S-0x.html）。
// render(container, params) は、画面の DOM を container に入れる。ユーザー入力を innerHTML に渡すときは escapeHtml を通すこと。
import { liveView, stepShown } from "../live-view.mjs";
import { startLiveTicker } from "../live-ticker.mjs";
import { registerLecture, editLecture, registerLectureForm, editLectureForm } from "../register.mjs";
import { blocksToTsv, blocksToFormRows } from "../schedule-import.mjs";
import { loadLectures, loadGroups, deleteLecture, addGroup, deleteGroup } from "../storage.mjs";
import { buildList } from "../lecture-list.mjs";
import { APP_VERSION } from "../version.mjs";
import { runImport } from "../import-action.mjs";
import { exportLectures, exportFileName, importLectures, replaceLectures } from "../backup.mjs";

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function placeholder(id, name, task) {
  return {
    id,
    name,
    render(container) {
      container.textContent = "";
      const h = document.createElement("h1");
      h.textContent = id + " " + name;
      const p = document.createElement("p");
      p.textContent = "（" + task + " で作る）";
      container.append(h, p);
    },
  };
}

// docs/mocks/S-02.html のスタイル（縦向き・横向き）
const LIVE_CSS = `
  body[data-screen="S-02"] #app { padding: 0; height: 100vh; height: 100dvh; }
  body[data-screen="S-02"] { --line: #2c343d; --muted: #8c98a4; --accent: #5cc8ff; --break: #ffc857; --warn: #ff7a6b; }
  .num { font-variant-numeric: tabular-nums; }
  .live { height: 100%; box-sizing: border-box;
    padding: max(16px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left));
    display: grid; grid-template-rows: auto auto 1fr auto; gap: 2vh; }
  .live { position: relative; }
  .live .back { position: absolute; top: max(8px, env(safe-area-inset-top)); left: max(8px, env(safe-area-inset-left)); z-index: 1;
    width: 44px; height: 44px; border-radius: 10px; border: 1px solid var(--line); background: transparent;
    color: var(--muted); font-size: 24px; line-height: 1; cursor: pointer; }
  .live .back:active { border-color: var(--accent); }
  .live .clock { font-size: clamp(28px, 9vw, 64px); font-weight: 600; color: var(--muted); padding-left: 52px; }
  .live .slides { font-size: clamp(30px, 10vw, 80px); font-weight: 800; color: var(--accent); line-height: 1.15; }
  .live .content { font-size: clamp(20px, 6vw, 44px); font-weight: 700; line-height: 1.35; align-self: center; overflow-wrap: anywhere; }
  .live .content.is-break { color: var(--break); font-size: clamp(44px, 16vw, 120px); text-align: center; }
  .live .remain-wrap { border-top: 1px solid var(--line); padding-top: 1.5vh; }
  .live .remain-label { font-size: clamp(13px, 3.5vw, 18px); color: var(--muted); }
  .live .remain { font-size: clamp(56px, 22vw, 160px); font-weight: 800; line-height: 1; }
  .live .remain.is-over { color: var(--warn); }
  .live .step { display: flex; gap: 12px; margin-top: 1.5vh; }
  .live .step button { flex: 1; min-height: 44px; border-radius: 10px; border: 1px solid var(--line); background: transparent;
    color: var(--accent); font-size: 18px; font-weight: 700; cursor: pointer; }
  .live .step button:disabled { color: var(--muted); opacity: .4; cursor: default; }
  @media (orientation: landscape) and (max-height: 600px) {
    .live { grid-template-columns: 1.4fr 1fr; grid-template-rows: auto 1fr auto; column-gap: 4vw; }
    .live .clock { grid-column: 2; grid-row: 1; text-align: right; font-size: clamp(24px, 6vh, 48px); }
    .live .slides { grid-column: 1; grid-row: 1; font-size: clamp(26px, 9vh, 64px); padding-left: 52px; }
    .live .clock { padding-left: 0; }
    .live .content { grid-column: 1; grid-row: 2 / 4; font-size: clamp(18px, 6vh, 40px); }
    .live .content.is-break { font-size: clamp(40px, 18vh, 110px); }
    .live .remain-wrap { grid-column: 2; grid-row: 2 / 4; align-self: end; border-top: none; text-align: right; }
    .live .remain { font-size: clamp(48px, 28vh, 150px); }
  }
`;

const STATE_TEXT = {
  before: "講義の開始前です",
  after: "講義は終了しました",
  none: "講義が選ばれていません",
};

// 講義中の表示画面。params: { blocks（進行表）, now（Date または 0時からの秒数。省略すると今）}
// clock（{ now, setInterval, clearInterval }）は時計の差し替え用（省略すると本物）。
// 1秒ごとに表示を更新し（tasks.md の T-006）、戻り値の関数でタイマーを止める（別の画面へ移るとき main.mjs が呼ぶ）。
// 一覧から講義を選ぶ流れは T-008。
const s02 = {
  id: "S-02",
  name: "講義中の表示",
  render(container, params = {}) {
    const blocks = params.blocks;
    const hasBlocks = Array.isArray(blocks) && blocks.length > 0;
    const clock = params.clock ?? {};
    const nowFn = clock.now ?? (() => params.now ?? new Date());
    let shown = null; // 手で進めたセクションの番号（null は時刻どおり）
    const v = hasBlocks
      ? liveView(blocks, nowFn(), shown)
      : { state: "none", clock: "--:--:--", slides: "", content: "", isBreak: false, remainText: "--:--", isOver: false, canNext: false, canPrev: false };
    const content = v.state === "during" ? v.content : STATE_TEXT[v.state];
    container.innerHTML =
      `<style>${LIVE_CSS}</style>` +
      `<section class="live" data-screen-id="S-02" id="s02">` +
      `<button type="button" class="back" id="backBtn" aria-label="一覧に戻る">←</button>` +
      `<div class="clock num" id="clock">${escapeHtml(v.clock)}</div>` +
      `<div class="slides" id="slides">${escapeHtml(v.slides)}</div>` +
      `<div class="content${v.isBreak ? " is-break" : ""}" id="content">${escapeHtml(content)}</div>` +
      `<div class="remain-wrap"><div class="remain-label" id="remainLabel">残り時間</div>` +
      `<div class="remain num${v.isOver ? " is-over" : ""}" id="remain">${escapeHtml(v.remainText)}</div>` +
      `<div class="step"><button type="button" id="prevBtn"${v.canPrev ? "" : " disabled"}>前へ</button>` +
      `<button type="button" id="nextBtn"${v.canNext ? "" : " disabled"}>次へ</button></div></div>` +
      `</section>`;
    const $ = (id) => container.querySelector("#" + id);
    const apply = (nv) => {
      $("clock").textContent = nv.clock;
      $("slides").textContent = nv.slides;
      $("content").textContent = nv.state === "during" ? nv.content : STATE_TEXT[nv.state];
      $("content").classList.toggle("is-break", nv.isBreak);
      $("remain").textContent = nv.remainText;
      $("remain").classList.toggle("is-over", nv.isOver);
      $("prevBtn").disabled = !nv.canPrev;
      $("nextBtn").disabled = !nv.canNext;
    };
    const step = (dir) => {
      if (!hasBlocks) return;
      shown = stepShown(blocks, nowFn(), shown, dir);
      apply(liveView(blocks, nowFn(), shown));
    };
    $("prevBtn").addEventListener("click", () => step(-1));
    $("nextBtn").addEventListener("click", () => step(1));
    // 「←」で S-03 へ。タイマーは navigator が前の画面のあと始末として止める
    const navigate = params.navigate ?? ((hash) => { location.hash = hash; });
    $("backBtn").addEventListener("click", () => navigate("#/S-03"));
    if (!hasBlocks) return () => {};
    return startLiveTicker(blocks, {
      now: nowFn,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      getShown: () => shown,
      onUpdate: apply,
    });
  },
};

// docs/mocks/S-04.html のスタイル（.import）
const REGISTER_CSS = `
  .import { --panel: #1a2027; --line: #2c343d; --text: #eef2f5; --muted: #8c98a4; --accent: #5cc8ff; --warn: #ff7a6b;
    min-height: 100%; box-sizing: border-box; color: var(--text);
    padding: max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom));
    display: flex; flex-direction: column; gap: 14px; max-width: 720px; margin: 0 auto; }
  .import h1 { font-size: 20px; font-weight: 700; }
  .import label { font-size: 14px; color: var(--muted); }
  .import textarea { flex: 1; min-height: 50vh; width: 100%; box-sizing: border-box;
    background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 10px;
    padding: 12px; font-size: 14px; line-height: 1.5;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; resize: vertical; }
  .import textarea:focus, .import input[type=text]:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .import .error { color: var(--warn); font-size: 14px; min-height: 1.4em; }
  .import .notice { color: var(--muted); font-size: 14px; }
  .import button { background: var(--accent); color: #06202e; border: none; border-radius: 10px;
    font-size: 18px; font-weight: 700; padding: 16px; cursor: pointer; }
  .import button:active { opacity: .8; }
  .import input[type=text] { background: var(--panel); color: var(--text); border: 1px solid var(--line);
    border-radius: 10px; padding: 12px; font-size: 16px; }
`;

// 進行表を1行ずつ入れるフォーム（S-04・S-05 の「フォーム」）。1行が1ブロック。
const FORM_CSS = `
  .import .modes { display: flex; gap: 8px; }
  .import .modes button { flex: 1; background: transparent; color: var(--muted); border: 1px solid var(--line); font-size: 16px; padding: 10px; }
  .import .modes button[aria-pressed=true] { background: var(--accent); color: #06202e; border-color: var(--accent); }
  .import .fRow { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .import .fRow label { display: flex; flex-direction: column; gap: 4px; }
  .import .fRow textarea { flex: none; min-height: 3.5em; font-family: inherit; }
  .import .fRow .fHead { display: flex; justify-content: space-between; align-items: center; color: var(--muted); font-size: 14px; }
  .import .fRow label.fBreak { flex-direction: row; align-items: center; gap: 8px; }
  .import .fRow .fDel, .import .fAdd { background: transparent; color: var(--accent); border: 1px solid var(--line); font-size: 16px; padding: 8px 14px; }
`;
const FORM_FIELDS = [
  ["start_time", "開始時間", "input", "9:30"],
  ["duration", "所要時間", "input", "0:10"],
  ["step", "ステップ", "textarea"],
  ["procedure", "進め方・手順", "textarea"],
  ["tools_materials", "使用ツール・資料", "textarea"],
  ["trouble_follow_up", "ハマりポイント／フォロー方法", "textarea"],
  ["time_adjustment", "時間調整ポイント", "textarea"],
];
export function emptyFormRow() {
  return { start_time: "", duration: "", step: "", procedure: "", tools_materials: "", trouble_follow_up: "", time_adjustment: "", is_break: false };
}
// フォームの行の HTML。入力された文字は escapeHtml を通す
export function formRowsHtml(rows) {
  return rows
    .map((r, i) => {
      let h = `<div class="fRow"><div class="fHead"><span>行 ${i + 1}</span><button type="button" class="fDel" aria-label="${i + 1}行目を削除">削除</button></div>`;
      for (const [key, label, kind, ph] of FORM_FIELDS) {
        const val = escapeHtml(r[key]);
        h += kind === "input"
          ? `<label>${label}<input type="text" data-f="${key}" value="${val}" autocomplete="off" placeholder="${ph}"></label>`
          : `<label>${label}<textarea data-f="${key}" spellcheck="false">${val}</textarea></label>`;
      }
      h += `<label class="fBreak"><input type="checkbox" data-f="is_break"${r.is_break ? " checked" : ""}>休憩（進め方・手順を「【休憩】」にする）</label></div>`;
      return h;
    })
    .join("");
}
function readFormRows(list) {
  return Array.from(list.querySelectorAll(".fRow")).map((el) => {
    const row = emptyFormRow();
    for (const [key] of FORM_FIELDS) row[key] = el.querySelector(`[data-f="${key}"]`).value;
    row.is_break = el.querySelector('[data-f="is_break"]').checked;
    return row;
  });
}
// 「貼り付け」「フォーム」の切り替えと、行の追加・削除をつなぐ。prefix は id の頭（reg / edit）。戻り値: 今のモードと行を返す関数
function bindForm(container, prefix, initialRows) {
  const $ = (id) => container.querySelector("#" + id);
  let mode = "paste";
  const list = $(prefix + "FormList");
  const setMode = (m) => {
    mode = m;
    $(prefix + "PasteBox").hidden = m !== "paste";
    $(prefix + "FormBox").hidden = m !== "form";
    $(prefix + "ModePaste").setAttribute("aria-pressed", String(m === "paste"));
    $(prefix + "ModeForm").setAttribute("aria-pressed", String(m === "form"));
  };
  $(prefix + "ModePaste").addEventListener("click", () => setMode("paste"));
  $(prefix + "ModeForm").addEventListener("click", () => setMode("form"));
  $(prefix + "AddRow").addEventListener("click", () => {
    const rows = readFormRows(list);
    rows.push(emptyFormRow());
    list.innerHTML = formRowsHtml(rows);
  });
  list.addEventListener("click", (e) => {
    const d = e.target.closest?.("button.fDel");
    if (!d) return;
    const rows = readFormRows(list);
    const idx = Array.from(list.children).indexOf(d.closest(".fRow"));
    if (idx < 0) return;
    rows.splice(idx, 1);
    list.innerHTML = formRowsHtml(rows);
  });
  return { mode: () => mode, rows: () => readFormRows(list) };
}
function formBoxHtml(prefix, pasteInner, rows) {
  return (
    `<div class="modes" role="group" aria-label="入力の方法">` +
    `<button type="button" id="${prefix}ModePaste" aria-pressed="true">貼り付け</button>` +
    `<button type="button" id="${prefix}ModeForm" aria-pressed="false">フォーム</button></div>` +
    `<div id="${prefix}PasteBox">${pasteInner}</div>` +
    `<div id="${prefix}FormBox" hidden><div id="${prefix}FormList" style="display:flex;flex-direction:column;gap:12px">${formRowsHtml(rows)}</div>` +
    `<button type="button" class="fAdd" id="${prefix}AddRow">行を追加</button></div>`
  );
}

// 講義の登録画面。params: { storage（省略すると localStorage）, navigate（省略すると location.hash を替える）}
// 登録の処理は js/register.mjs。「登録する」で保存して S-03 へ移る。
const s04 = {
  id: "S-04",
  name: "講義の登録",
  render(container, params = {}) {
    const storage = params.storage ?? globalThis.localStorage;
    const navigate = params.navigate ?? ((hash) => { location.hash = hash; });
    container.innerHTML =
      `<style>${REGISTER_CSS}${FORM_CSS}</style>` +
      `<section class="import" data-screen-id="S-04" id="s04">` +
      `<h1>講義の登録</h1>` +
      `<label for="regTitle">タイトル</label>` +
      `<input type="text" id="regTitle" maxlength="100" autocomplete="off" placeholder="例: 11/25 午前の講義">` +
      formBoxHtml(
        "reg",
        `<label for="regTsv">進行表のテキスト（スプレッドシートからコピーして貼り付け）</label>` +
          `<textarea id="regTsv" spellcheck="false" placeholder="開始時間\t所要時間\tステップ\t進め方・手順\t…"></textarea>`,
        [emptyFormRow()],
      ) +
      `<p class="error" id="regError" role="alert"></p>` +
      `<button type="button" id="registerBtn">登録する</button>` +
      `</section>`;
    const $ = (id) => container.querySelector("#" + id);
    const form = bindForm(container, "reg", [emptyFormRow()]);
    let saved = false;
    $("registerBtn").addEventListener("click", () => {
      if (saved) { navigate("#/S-03"); return; } // 警告を見せたあとの「一覧へ」
      const r = form.mode() === "form"
        ? registerLectureForm(storage, $("regTitle").value, form.rows())
        : registerLecture(storage, $("regTitle").value, $("regTsv").value);
      if (!r.ok) {
        $("regError").textContent = r.error;
        return;
      }
      // 100 に近づいた警告があるときは、画面に出して、もう一度押すと S-03 へ移る
      if (r.warning) {
        saved = true;
        $("regError").textContent = "";
        const p = document.createElement("p");
        p.className = "notice";
        p.setAttribute("role", "status");
        p.textContent = "登録しました。" + r.warning;
        $("regError").after(p);
        $("registerBtn").textContent = "一覧へ";
        return;
      }
      navigate("#/S-03");
    });
  },
};

// docs/mocks/S-03.html のスタイル
const LIST_CSS = `
  .list-screen { --panel: #1a2027; --line: #2c343d; --text: #eef2f5; --muted: #8c98a4; --accent: #5cc8ff;
    min-height: 100%; box-sizing: border-box; color: var(--text);
    padding: max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom));
    display: flex; flex-direction: column; gap: 18px; max-width: 720px; margin: 0 auto; }
  .list-screen h1 { font-size: 20px; font-weight: 700; }
  .day h2 { font-size: 15px; color: var(--muted); font-weight: 600; margin-bottom: 8px; }
  .day ul { list-style: none; display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; }
  .day li { display: flex; gap: 8px; align-items: stretch; }
  .del { flex: none; background: transparent; color: #ff7a6b; border: 1px solid var(--line); border-radius: 12px;
    padding: 0 14px; font: inherit; font-size: 14px; cursor: pointer; }
  .del:active { border-color: #ff7a6b; }
  .del.edit { color: var(--accent); }
  .del.edit:active { border-color: var(--accent); }
  .lecture { flex: 1; min-width: 0; text-align: left; cursor: pointer; background: var(--panel); color: var(--text);
    border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px;
    display: flex; flex-direction: column; gap: 4px; font: inherit; }
  .lecture:active { border-color: var(--accent); }
  .lecture .title { font-size: 17px; font-weight: 700; overflow-wrap: anywhere; }
  .day.grp { border: 1px solid var(--line); border-radius: 14px; padding: 10px; }
  .day.grp li.member { margin-left: 14px; }
  .list-screen .groupOpen { border-color: var(--accent); }
  .pick { display: flex; flex-direction: column; gap: 6px; }
  .pick label { display: flex; gap: 8px; align-items: center; font-size: 15px; color: var(--text); min-height: 36px; overflow-wrap: anywhere; }
  .list-screen input[type=text] { background: var(--panel); color: var(--text); border: 1px solid var(--line);
    border-radius: 10px; padding: 12px; font-size: 16px; }
  .lecture .time { font-size: 20px; font-weight: 700; color: var(--accent); }
  .lecture .first { font-size: 14px; color: var(--muted); }
  .empty { color: var(--muted); font-size: 15px; padding: 24px 0; text-align: center; }
  .list-screen .primary { background: var(--accent); color: #06202e; border: none; border-radius: 10px;
    font-size: 18px; font-weight: 700; padding: 16px; cursor: pointer; }
  .list-screen .primary:active { opacity: .8; }
  .backup { display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--line); padding-top: 14px; }
  .backup h2 { font-size: 15px; color: var(--muted); font-weight: 600; }
  .list-screen .secondary { background: var(--panel); color: var(--text); border: 1px solid var(--line);
    border-radius: 10px; font-size: 16px; font-weight: 600; padding: 14px; cursor: pointer; }
  .list-screen .secondary:disabled { opacity: .5; cursor: default; }
  .list-screen .secondary:active { border-color: var(--accent); }
  .list-screen .error { color: #ff7a6b; font-size: 14px; min-height: 1.4em; }
  .list-screen .notice { color: var(--muted); font-size: 14px; }
`;

// 文字列をファイルとしてダウンロードさせる（ブラウザ用）
function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// グループの開け閉めの状態（保存しない。画面の container ごとに、開いているグループの id を持つ）
const OPEN_GROUPS = new WeakMap();

// 講義の一覧画面。params: { storage（省略すると localStorage）, openLecture(lecture)（選んだ講義を S-02 へ渡す）, navigate(hash) }
// 並べ方は js/lecture-list.mjs。
const s03 = {
  id: "S-03",
  name: "講義の一覧",
  render(container, params = {}) {
    const storage = params.storage ?? globalThis.localStorage;
    const navigate = params.navigate ?? ((hash) => { location.hash = hash; });
    const lectures = loadLectures(storage);
    const { groups, singles } = buildList(lectures, loadGroups(storage));
    const lectureLi = (it, cls) =>
      `<li${cls ? ` class="${cls}"` : ""}><button type="button" class="lecture" data-id="${it.id}">` +
      `<span class="title">${escapeHtml(it.title)}</span>` +
      `<span class="time num">${escapeHtml(it.timeText)}</span>` +
      `<span class="first">${escapeHtml(it.first)}</span></button>` +
      `<button type="button" class="del edit" data-id="${it.id}" aria-label="${escapeHtml(it.title + " " + it.timeText + " を編集")}">編集</button>` +
      `<button type="button" class="del" data-id="${it.id}" aria-label="${escapeHtml(it.title + " " + it.timeText + " を削除")}">削除</button></li>`;
    let list = "";
    if (lectures.length === 0) {
      list = `<p class="empty">講義がまだ登録されていません。</p>`;
    } else {
      const openSet = OPEN_GROUPS.get(container) ?? new Set();
      OPEN_GROUPS.set(container, openSet);
      for (const g of groups) {
        const open = openSet.has(g.id);
        const word = open ? "閉じる" : "開く";
        list +=
          `<div class="day grp"><ul><li><button type="button" class="lecture groupOpen" data-gid="${g.id}">` +
          `<span class="title">${escapeHtml(g.title)}（グループ・通しで表示）</span>` +
          `<span class="time num">${escapeHtml(g.timeText)}</span>` +
          `<span class="first">${g.items.length} 件の講義</span></button>` +
          `<button type="button" class="del grpToggle" data-gid="${g.id}" aria-expanded="${open}" aria-controls="grpMembers-${g.id}" aria-label="${escapeHtml(g.title + " の講義を" + word)}">${word}</button>` +
          `<button type="button" class="del delGroup" data-gid="${g.id}" aria-label="${escapeHtml(g.title + " グループを削除")}">削除</button></li></ul>` +
          `<ul class="members" id="grpMembers-${g.id}"${open ? "" : " hidden"}>`;
        if (open) for (const it of g.items) list += lectureLi(it, "member");
        list += `</ul></div>`;
      }
      if (singles.length > 0) {
        list += `<div class="day"><ul>${singles.map((it) => lectureLi(it)).join("")}</ul></div>`;
      }
    }
    const pick = lectures
      .map(
        (l) =>
          `<label><input type="checkbox" class="pickBox" data-id="${l.id}">` +
          `<span>${escapeHtml(l.title)}（${escapeHtml(l.blocks[0]?.start_time ?? "")}〜）</span></label>`,
      )
      .join("");
    const groupMake =
      lectures.length === 0
        ? ""
        : `<div class="backup" id="groupMake"><h2>グループを作る（同じ日の講義を通しで表示）</h2>` +
          `<label for="groupTitle" class="notice">グループのタイトル</label>` +
          `<input type="text" id="groupTitle" maxlength="100" autocomplete="off">` +
          `<div class="pick" id="groupPick">${pick}</div>` +
          `<p class="error" id="groupError" role="alert"></p>` +
          `<button type="button" class="secondary" id="makeGroupBtn">グループを作る</button></div>`;
    container.innerHTML =
      `<style>${LIST_CSS}</style>` +
      `<section class="list-screen" data-screen-id="S-03" id="s03">` +
      `<h1>講義の一覧</h1><div id="lectureList">${list}</div>` +
      `<button type="button" class="primary" id="toRegister">講義を登録する</button>` +
      groupMake +
      `<div class="backup"><h2>講義のファイル</h2>` +
      `<button type="button" class="secondary" id="exportBtn">書き出す</button>` +
      `<button type="button" class="secondary" id="importFileBtn">ファイルから読み込む</button>` +
      `<input type="file" id="importFile" hidden>` +
      `<button type="button" class="secondary" id="replaceFileBtn">ファイルで置き換える</button>` +
      `<input type="file" id="replaceFile" hidden>` +
      `<p class="error" id="backupError" role="alert"></p>` +
      `<p class="notice" id="backupNotice" role="status"></p></div>` +
      `<p class="notice" id="appVersion"></p></section>`;
    container.querySelector("#appVersion").textContent = "版 " + APP_VERSION;
    container.querySelector("#toRegister").addEventListener("click", () => navigate("#/S-04"));
    const $ = (id) => container.querySelector("#" + id);
    const download = params.download ?? downloadText;
    const rerender = params.rerender ?? (() => s03.render(container, params));
    if (lectures.length === 0) {
      $("exportBtn").disabled = true;
      $("backupNotice").textContent = "書き出す講義がありません。";
    }
    $("exportBtn").addEventListener("click", () => {
      $("backupError").textContent = "";
      const text = exportLectures(storage);
      if (text === null) {
        $("backupNotice").textContent = "書き出す講義がありません。";
        return;
      }
      const name = exportFileName();
      download(name, text);
      $("backupNotice").textContent = `${name} を書き出しました。`;
    });
    $("importFileBtn").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", async () => {
      const file = $("importFile").files?.[0];
      if (!file) return;
      let text;
      try {
        text = await file.text();
      } catch {
        $("backupError").textContent = "ファイルを読めませんでした。";
        return;
      }
      const r = importLectures(storage, text);
      if (!r.ok) {
        $("importFile").value = "";
        $("backupNotice").textContent = "";
        $("backupError").textContent = r.error;
        return;
      }
      rerender();
      // 一覧を出し直したので、結果の文は新しい画面に入れる
      const err = container.querySelector("#backupError");
      const note = container.querySelector("#backupNotice");
      let msg = `${r.added} 件の講義を足しました。`;
      if (r.groupsAdded > 0) msg += `グループ ${r.groupsAdded} 件も足しました。`;
      if (r.skipped > 0) msg += `同じ講義の ${r.skipped} 件は足していません。`;
      if (r.warning) msg += r.warning;
      if (err) err.textContent = "";
      if (note) note.textContent = msg;
    });
    const confirmFn = params.confirm ?? ((m) => globalThis.confirm(m));
    $("replaceFileBtn").addEventListener("click", () => $("replaceFile").click());
    $("replaceFile").addEventListener("change", async () => {
      const file = $("replaceFile").files?.[0];
      if (!file) return;
      let text;
      try {
        text = await file.text();
      } catch {
        $("backupError").textContent = "ファイルを読めませんでした。";
        return;
      }
      // 確かめるために、保存を変えずに中身だけ調べる
      const probe = replaceLectures({ getItem: () => null, setItem() {} }, text);
      if (!probe.ok) {
        $("replaceFile").value = "";
        $("backupNotice").textContent = "";
        $("backupError").textContent = probe.error;
        return;
      }
      const now = loadLectures(storage).length;
      if (!confirmFn(`今の講義 ${now} 件を消して、ファイルの ${probe.count} 件にします。よろしいですか？`)) {
        $("replaceFile").value = "";
        return;
      }
      const r = replaceLectures(storage, text);
      rerender();
      const err = container.querySelector("#backupError");
      const note = container.querySelector("#backupNotice");
      if (err) err.textContent = r.ok ? "" : r.error;
      if (note) note.textContent = r.ok ? `${r.count} 件の講義に置き換えました。${r.warning ?? ""}` : "";
    });
    // グループに入れる講義の選び（チェックの変化で覚える）
    const picked = new Set();
    if (lectures.length > 0) {
      $("groupPick").addEventListener("change", (e) => {
        const cb = e.target;
        if (!cb?.dataset) return;
        const id = Number(cb.dataset.id);
        if (cb.checked) picked.add(id);
        else picked.delete(id);
      });
      $("makeGroupBtn").addEventListener("click", () => {
        // 選んだ順でなく、一覧の順（開始時刻は通しで並べ直すので、並びは表示に影響しない）
        const ids = lectures.map((l) => l.id).filter((id) => picked.has(id));
        const r = addGroup(storage, $("groupTitle").value, ids);
        if (!r.ok) {
          $("groupError").textContent = r.error;
          return;
        }
        rerender();
      });
    }
    container.querySelector("#lectureList").addEventListener("click", (e) => {
      const tg = e.target.closest?.("button.grpToggle");
      if (tg) {
        const gid = Number(tg.dataset.gid);
        const g = groups.find((x) => x.id === gid);
        const set = OPEN_GROUPS.get(container) ?? new Set();
        OPEN_GROUPS.set(container, set);
        const ul = container.querySelector("#grpMembers-" + gid);
        if (!g || !ul) return;
        const open = !set.has(gid);
        if (open) set.add(gid);
        else set.delete(gid);
        ul.innerHTML = open ? g.items.map((it) => lectureLi(it, "member")).join("") : "";
        ul.hidden = !open;
        tg.setAttribute("aria-expanded", String(open));
        tg.textContent = open ? "閉じる" : "開く";
        tg.setAttribute("aria-label", g.title + " の講義を" + (open ? "閉じる" : "開く"));
        return;
      }
      const ed = e.target.closest?.("button.edit");
      if (ed) {
        const id = Number(ed.dataset.id);
        if (params.open) params.open("S-05", { id });
        else navigate("#/S-05");
        return;
      }
      const del = e.target.closest?.("button.del");
      if (del) {
        if (del.dataset.gid !== undefined) {
          const g = groups.find((x) => x.id === Number(del.dataset.gid));
          if (!g || !confirmFn(`グループ「${g.title}」を削除します（中の講義は消えません）。よろしいですか？`)) return;
          deleteGroup(storage, g.id);
          rerender();
          return;
        }
        const lec = lectures.find((x) => x.id === Number(del.dataset.id));
        if (!lec) return;
        const range = [...singles, ...groups.flatMap((g) => g.items)].find((x) => x.id === lec.id)?.timeText ?? "";
        if (!confirmFn(`${lec.title} ${range} の講義を削除します。よろしいですか？`)) return;
        deleteLecture(storage, lec.id);
        rerender();
        return;
      }
      const btn = e.target.closest?.("button.lecture");
      if (!btn || !params.openLecture) return;
      if (btn.dataset.gid !== undefined) {
        // グループは、講義の行を開始時刻の順に並べた1つの進行表として S-02 に渡す
        const g = groups.find((x) => x.id === Number(btn.dataset.gid));
        if (g) params.openLecture({ id: null, title: g.title, blocks: g.blocks });
        return;
      }
      const lec = lectures.find((x) => x.id === Number(btn.dataset.id));
      if (lec) params.openLecture(lec);
    });
  },
};

// 講義の編集画面（S-05）。params: { id（編集する講義の id）, storage, navigate }
// 今のタイトルと、進行表を取り込みと同じタブ区切りに戻したものを入れて出す。保存しても確認は出さない。
// 「キャンセル」と「←」は、何も変えずに S-03 へ戻る。id がない・見つからないときは S-03 へ戻る。
const s05 = {
  id: "S-05",
  name: "講義の編集",
  render(container, params = {}) {
    const storage = params.storage ?? globalThis.localStorage;
    const navigate = params.navigate ?? ((hash) => { location.hash = hash; });
    const lec = loadLectures(storage).find((l) => l.id === Number(params.id));
    if (!lec) {
      container.textContent = "";
      navigate("#/S-03");
      return;
    }
    container.innerHTML =
      `<style>${REGISTER_CSS} .import .back { align-self: flex-start; background: transparent; color: var(--muted); border: 1px solid var(--line); font-size: 24px; padding: 6px 14px; }${FORM_CSS}</style>` +
      `<section class="import" data-screen-id="S-05" id="s05">` +
      `<button type="button" class="back" id="editBack" aria-label="一覧に戻る">←</button>` +
      `<h1>講義の編集</h1>` +
      `<label for="editTitle">タイトル</label>` +
      `<input type="text" id="editTitle" maxlength="100" autocomplete="off">` +
      formBoxHtml(
        "edit",
        `<label for="editTsv">進行表のテキスト（タブ区切り）</label>` + `<textarea id="editTsv" spellcheck="false"></textarea>`,
        blocksToFormRows(lec.blocks),
      ) +
      `<p class="error" id="editError" role="alert"></p>` +
      `<button type="button" id="saveBtn">保存する</button>` +
      `<button type="button" id="cancelBtn">キャンセル</button>` +
      `</section>`;
    const $ = (id) => container.querySelector("#" + id);
    $("editTitle").value = lec.title;
    $("editTsv").value = blocksToTsv(lec.blocks);
    const form = bindForm(container, "edit", []);
    $("saveBtn").addEventListener("click", () => {
      const r = form.mode() === "form"
        ? editLectureForm(storage, lec.id, $("editTitle").value, form.rows())
        : editLecture(storage, lec.id, $("editTitle").value, $("editTsv").value);
      if (!r.ok) {
        $("editError").textContent = r.error;
        return;
      }
      navigate("#/S-03");
    });
    $("cancelBtn").addEventListener("click", () => navigate("#/S-03"));
    $("editBack").addEventListener("click", () => navigate("#/S-03"));
  },
};

// 進行表の取り込み画面。params: { open(id, params)（S-02 へ blocks を渡して移る。navigator が渡す）}
// 取り込みの処理は js/import-action.mjs。取り込めないときは #importError に出して移らない。
const s01 = {
  id: "S-01",
  name: "進行表の取り込み",
  render(container, params = {}) {
    container.innerHTML =
      `<style>${REGISTER_CSS}</style>` +
      `<section class="import" data-screen-id="S-01" id="s01">` +
      `<h1>講義時間管理アプリ</h1>` +
      `<label for="tsv">進行表のテキスト（スプレッドシートからコピーして貼り付け）</label>` +
      `<textarea id="tsv" spellcheck="false" placeholder="開始時間\t所要時間\tステップ\t進め方・手順\t…"></textarea>` +
      `<p class="error" id="importError" role="alert"></p>` +
      `<button type="button" id="importBtn">取り込む</button>` +
      `</section>`;
    const $ = (id) => container.querySelector("#" + id);
    $("importBtn").addEventListener("click", () => {
      const r = runImport($("tsv").value, params.open ?? (() => {}));
      $("importError").textContent = r.ok ? "" : r.error;
    });
  },
};

export const screens = {
  "S-01": s01,
  "S-02": s02,
  "S-03": s03,
  "S-04": s04,
  "S-05": s05,
};

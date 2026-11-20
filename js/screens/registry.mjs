// 画面ごとの置き場。各画面の中身は後続の tasks.md のタスクで作る（モックは docs/mocks/S-0x.html）。
// render(container, params) は、画面の DOM を container に入れる。ユーザー入力を innerHTML に渡すときは escapeHtml を通すこと。
import { liveView } from "../live-view.mjs";
import { startLiveTicker } from "../live-ticker.mjs";
import { registerLecture } from "../register.mjs";
import { loadLectures } from "../storage.mjs";
import { groupLecturesByDate } from "../lecture-list.mjs";
import { runImport } from "../import-action.mjs";

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
  .live .clock { font-size: clamp(28px, 9vw, 64px); font-weight: 600; color: var(--muted); }
  .live .slides { font-size: clamp(30px, 10vw, 80px); font-weight: 800; color: var(--accent); line-height: 1.15; }
  .live .content { font-size: clamp(20px, 6vw, 44px); font-weight: 700; line-height: 1.35; align-self: center; overflow-wrap: anywhere; }
  .live .content.is-break { color: var(--break); font-size: clamp(44px, 16vw, 120px); text-align: center; }
  .live .remain-wrap { border-top: 1px solid var(--line); padding-top: 1.5vh; }
  .live .remain-label { font-size: clamp(13px, 3.5vw, 18px); color: var(--muted); }
  .live .remain { font-size: clamp(56px, 22vw, 160px); font-weight: 800; line-height: 1; }
  .live .remain.is-over { color: var(--warn); }
  @media (orientation: landscape) and (max-height: 600px) {
    .live { grid-template-columns: 1.4fr 1fr; grid-template-rows: auto 1fr auto; column-gap: 4vw; }
    .live .clock { grid-column: 2; grid-row: 1; text-align: right; font-size: clamp(24px, 6vh, 48px); }
    .live .slides { grid-column: 1; grid-row: 1; font-size: clamp(26px, 9vh, 64px); }
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
    const v = hasBlocks
      ? liveView(blocks, nowFn())
      : { state: "none", clock: "--:--:--", slides: "", content: "", isBreak: false, remainText: "--:--", isOver: false };
    const content = v.state === "during" ? v.content : STATE_TEXT[v.state];
    container.innerHTML =
      `<style>${LIVE_CSS}</style>` +
      `<section class="live" data-screen-id="S-02" id="s02">` +
      `<div class="clock num" id="clock">${escapeHtml(v.clock)}</div>` +
      `<div class="slides" id="slides">${escapeHtml(v.slides)}</div>` +
      `<div class="content${v.isBreak ? " is-break" : ""}" id="content">${escapeHtml(content)}</div>` +
      `<div class="remain-wrap"><div class="remain-label" id="remainLabel">残り時間</div>` +
      `<div class="remain num${v.isOver ? " is-over" : ""}" id="remain">${escapeHtml(v.remainText)}</div></div>` +
      `</section>`;
    if (!hasBlocks) return () => {};
    const $ = (id) => container.querySelector("#" + id);
    return startLiveTicker(blocks, {
      now: nowFn,
      setInterval: clock.setInterval,
      clearInterval: clock.clearInterval,
      onUpdate(nv) {
        $("clock").textContent = nv.clock;
        $("slides").textContent = nv.slides;
        $("content").textContent = nv.state === "during" ? nv.content : STATE_TEXT[nv.state];
        $("content").classList.toggle("is-break", nv.isBreak);
        $("remain").textContent = nv.remainText;
        $("remain").classList.toggle("is-over", nv.isOver);
      },
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
  .import textarea:focus, .import input[type=date]:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  .import .error { color: var(--warn); font-size: 14px; min-height: 1.4em; }
  .import .notice { color: var(--muted); font-size: 14px; }
  .import button { background: var(--accent); color: #06202e; border: none; border-radius: 10px;
    font-size: 18px; font-weight: 700; padding: 16px; cursor: pointer; }
  .import button:active { opacity: .8; }
  .import input[type=date] { background: var(--panel); color: var(--text); border: 1px solid var(--line);
    border-radius: 10px; padding: 12px; font-size: 16px; color-scheme: dark; }
`;

function todayString(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 講義の登録画面。params: { storage（省略すると localStorage）, navigate（省略すると location.hash を替える）, today（Date。省略すると今日）}
// 登録の処理は js/register.mjs。「登録する」で保存して S-03 へ移る。
const s04 = {
  id: "S-04",
  name: "講義の登録",
  render(container, params = {}) {
    const storage = params.storage ?? globalThis.localStorage;
    const navigate = params.navigate ?? ((hash) => { location.hash = hash; });
    container.innerHTML =
      `<style>${REGISTER_CSS}</style>` +
      `<section class="import" data-screen-id="S-04" id="s04">` +
      `<h1>講義の登録</h1>` +
      `<label for="regDate">日付</label>` +
      `<input type="date" id="regDate" value="${escapeHtml(todayString(params.today))}">` +
      `<label for="regTsv">進行表のテキスト（スプレッドシートからコピーして貼り付け）</label>` +
      `<textarea id="regTsv" spellcheck="false" placeholder="開始時間\t所要時間\tステップ\t進め方・手順\t…"></textarea>` +
      `<p class="error" id="regError" role="alert"></p>` +
      `<button type="button" id="registerBtn">登録する</button>` +
      `</section>`;
    const $ = (id) => container.querySelector("#" + id);
    let saved = false;
    $("registerBtn").addEventListener("click", () => {
      if (saved) { navigate("#/S-03"); return; } // 警告を見せたあとの「一覧へ」
      const r = registerLecture(storage, $("regDate").value, $("regTsv").value);
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
  .lecture { width: 100%; text-align: left; cursor: pointer; background: var(--panel); color: var(--text);
    border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px;
    display: flex; flex-direction: column; gap: 4px; font: inherit; }
  .lecture:active { border-color: var(--accent); }
  .lecture .time { font-size: 20px; font-weight: 700; color: var(--accent); }
  .lecture .first { font-size: 14px; color: var(--muted); }
  .empty { color: var(--muted); font-size: 15px; padding: 24px 0; text-align: center; }
  .list-screen .primary { background: var(--accent); color: #06202e; border: none; border-radius: 10px;
    font-size: 18px; font-weight: 700; padding: 16px; cursor: pointer; }
  .list-screen .primary:active { opacity: .8; }
`;

// 講義の一覧画面。params: { storage（省略すると localStorage）, openLecture(lecture)（選んだ講義を S-02 へ渡す）, navigate(hash) }
// 並べ方は js/lecture-list.mjs。
const s03 = {
  id: "S-03",
  name: "講義の一覧",
  render(container, params = {}) {
    const storage = params.storage ?? globalThis.localStorage;
    const navigate = params.navigate ?? ((hash) => { location.hash = hash; });
    const groups = groupLecturesByDate(loadLectures(storage));
    let list = "";
    if (groups.length === 0) {
      list = `<p class="empty">講義がまだ登録されていません。</p>`;
    } else {
      groups.forEach((g, gi) => {
        list += `<div class="day"><h2>${escapeHtml(g.date)}</h2><ul>`;
        g.items.forEach((it, ii) => {
          list +=
            `<li><button type="button" class="lecture" data-g="${gi}" data-i="${ii}">` +
            `<span class="time num">${escapeHtml(it.timeText)}</span>` +
            `<span class="first">${escapeHtml(it.first)}</span></button></li>`;
        });
        list += `</ul></div>`;
      });
    }
    container.innerHTML =
      `<style>${LIST_CSS}</style>` +
      `<section class="list-screen" data-screen-id="S-03" id="s03">` +
      `<h1>講義の一覧</h1><div id="lectureList">${list}</div>` +
      `<button type="button" class="primary" id="toRegister">講義を登録する</button></section>`;
    container.querySelector("#toRegister").addEventListener("click", () => navigate("#/S-04"));
    container.querySelector("#lectureList").addEventListener("click", (e) => {
      const btn = e.target.closest?.("button.lecture");
      if (!btn || !params.openLecture) return;
      params.openLecture(groups[Number(btn.dataset.g)].items[Number(btn.dataset.i)].lecture);
    });
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
};

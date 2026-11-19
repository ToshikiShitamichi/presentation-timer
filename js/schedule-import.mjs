// 進行表の取り込み（F-001。tasks.md の T-003）。画面は持たない。
// 列の並び（BR-001）: 開始時間・所要時間・ステップ・進め方・手順・使用ツール・資料・ハマりポイント／フォロー方法・時間調整ポイント
export const COLUMNS = [
  "start_time",
  "duration",
  "step",
  "procedure",
  "tools_materials",
  "trouble_follow_up",
  "time_adjustment",
];
export const BREAK_LABEL = "【休憩】";

const TIME_RE = /^\d{1,2}:\d{2}$/;

// タブ区切りのテキストを行×セルの配列にする。引用符で囲まれたセルの中の改行はセルの一部（BR-002）。
export function parseTsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  let cellStart = true;
  const s = String(text ?? "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"' && cellStart) {
      inQuotes = true;
      cellStart = false;
    } else if (c === "\t") {
      row.push(cell);
      cell = "";
      cellStart = true;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      cellStart = true;
    } else {
      cell += c;
      cellStart = false;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ヘッダー行か（BR-003）。1列目が「開始時間」の行
function isHeader(cells) {
  return cells[0].trim() === "開始時間";
}

// 進行表のテキストをブロックの配列にする。取り込めないときは Error（message が画面に出す文）。
// ブロックの id・lecture_id は保存のときに付ける（storage.mjs）ので、ここでは sort_order まで。
export function parseSchedule(text) {
  const blocks = [];
  for (const raw of parseTsv(text)) {
    const cells = COLUMNS.map((_, i) => (raw[i] ?? "").replace(/\r/g, ""));
    if (isHeader(cells)) continue;
    const start = cells[0].trim();
    const duration = cells[1].trim();
    const n = blocks.length + 1;
    if (!TIME_RE.test(start)) throw new Error(`${n}行目の開始時間「${start}」が読めません（例: 9:30）。`);
    if (!TIME_RE.test(duration)) throw new Error(`${n}行目の所要時間「${duration}」が読めません（例: 0:08）。`);
    blocks.push({
      sort_order: n,
      start_time: start,
      duration,
      step: cells[2],
      procedure: cells[3],
      tools_materials: cells[4],
      trouble_follow_up: cells[5],
      time_adjustment: cells[6],
      is_break: cells[3].trim() === BREAK_LABEL, // BR-004
    });
  }
  if (blocks.length === 0) throw new Error("取り込める行がありません。");
  return blocks;
}

// 画面 S-01〜S-04 を切り替える土台（DOM に触らない部分。node --test で確かめられる）
export const SCREEN_IDS = ["S-01", "S-02", "S-03", "S-04"];
export const DEFAULT_SCREEN = "S-03";

// "#/S-02" や "#S-02" から画面 ID を取り出す。読めなければ既定の画面（S-03）
export function parseHash(hash) {
  const m = /^#\/?(S-0[1-4])$/.exec(hash || "");
  return m ? m[1] : DEFAULT_SCREEN;
}

export function screenHash(id) {
  if (!SCREEN_IDS.includes(id)) throw new Error("知らない画面です: " + id);
  return "#/" + id;
}

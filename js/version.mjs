// 版の番号は js/version.mjs の APP_VERSION と、ルートの version.json の version の2か所を同じにする
// 公開のたびに、docs/deploy.md の「更新のたびに版の番号を上げる」手順で両方を上げる
export const APP_VERSION = "1";

// 公開先の version.json の中身から、新しい版があるかを決める純関数。
// 番号が違えば true。同じ・読めない・壊れた中身は false（何もしない）
export function hasNewVersion(current, latest) {
  if (latest === null || typeof latest !== "object") return false;
  const v = latest.version;
  if (typeof v !== "string" || v === "") return false;
  return typeof current === "string" && current !== "" && v !== current;
}

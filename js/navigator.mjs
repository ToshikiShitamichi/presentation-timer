// 画面の切り替え（main.mjs から使う。DOM を直接持たないので node --test で確かめられる）。
// 前の画面のあと始末（S-02 のタイマー停止など）をしてから、次の画面を描く。
import { parseHash, screenHash } from "./router.mjs";

// env: { screens, container, getHash(), setHash(hash), onScreen(id) }
export function createNavigator(env) {
  let cleanup = null;
  let pending = null; // open() で渡された、次の画面の params（1回だけ使う）

  function show() {
    if (typeof cleanup === "function") cleanup();
    cleanup = null;
    const id = parseHash(env.getHash());
    const params = { ...(pending ?? {}), openLecture, open, navigate: (hash) => env.setHash(hash) };
    pending = null;
    if (env.onScreen) env.onScreen(id);
    cleanup = env.screens[id].render(env.container, params);
  }

  // 画面 id へ移る。params はその画面の render に渡す。
  function open(id, params) {
    pending = params ?? null;
    const hash = screenHash(id);
    if (env.getHash() === hash) show(); // 同じアドレスだと hashchange が起きないので直接描く
    else env.setHash(hash);
  }

  // S-03 で選んだ講義を S-02 に渡す（R-008-2）
  function openLecture(lecture) {
    open("S-02", { blocks: lecture.blocks });
  }

  return { show, open, openLecture };
}

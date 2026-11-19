// 画面ごとの置き場。各画面の中身は後続の tasks.md のタスクで作る（モックは docs/mocks/S-0x.html）。
// render(container) は、画面の DOM を container に入れる。ユーザー入力を innerHTML に渡すときは escapeHtml を通すこと。
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

export const screens = {
  "S-01": placeholder("S-01", "進行表の取り込み", "tasks.md の T-009"),
  "S-02": placeholder("S-02", "講義中の表示", "tasks.md の T-005"),
  "S-03": placeholder("S-03", "講義の一覧", "tasks.md の T-008"),
  "S-04": placeholder("S-04", "講義の登録", "tasks.md の T-007"),
};

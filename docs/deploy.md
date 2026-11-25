# 公開の手順（GitHub Pages）

ビルドは要らない。リポジトリの main をそのまま配信する。公開 URL は `https://<ユーザー名>.github.io/presentation-timer/`。
読み込みはすべて相対パスで、`.nojekyll` で Jekyll の処理を止めている。

配信されるのはリポジトリの中身（画面のファイル・docs・package.json）。講義の実データは各端末の localStorage にあり、リポジトリには入らない。
リポジトリを公開にする操作と push は社長が行う。コマンドはコマンドプロンプト（cmd）で実行する。

## 前提
- Git と GitHub のアカウントがある（`git --version` でバージョンが出れば入っている）。
- GitHub CLI（gh）を使う場合は `gh auth status` でログイン済みか確かめる。使わないなら手順1・2を GitHub の画面（https://github.com/new）で行ってよい。

## 1. GitHub にリポジトリを作る（公開）
- `cd /d c:/work/presentation-timer && gh repo create presentation-timer --public --source . --remote origin`
  - 画面で作る場合: https://github.com/new で名前 presentation-timer、Public、README などは足さずに作る。その後、`cd /d c:/work/presentation-timer && git remote add origin https://github.com/<ユーザー名>/presentation-timer.git`

## 2. push する
- `cd /d c:/work/presentation-timer && git push -u origin main`

## 3. Pages を有効にする
- `gh api -X POST repos/<ユーザー名>/presentation-timer/pages -f "source[branch]=main" -f "source[path]=/"`
  - 画面で行う場合: リポジトリの Settings → Pages → Build and deployment の Source を「Deploy from a branch」、Branch を main・「/ (root)」にして Save。

## 4. 公開後の URL
- 1〜2分後に `https://<ユーザー名>.github.io/presentation-timer/` で開ける。
- 状態の確認: `gh api repos/<ユーザー名>/presentation-timer/pages --jq .status`（built になれば公開済み）

## 更新するとき
- 更新のたびに版の番号を上げる: `version.json` の version と、`js/version.mjs` の APP_VERSION を、同じ新しい番号（文字列。例 "2"）にする（違うとテストが失敗する）。`cd /d c:/work/presentation-timer && node scripts/bump-version.mjs 2` で2か所を同時に書き換えられる。
- `cd /d c:/work/presentation-timer && git push`（main に push すると自動で入れ替わる）
- 開いているアプリは、開いたときと画面が前に戻ったときに version.json を確かめ、番号が違えば自動で読み直す（講義中の表示 S-02 の間は待ち、S-02 を離れたときに読み直す）。Service Worker は使わない。

## 公開を止める
- Pages だけ止める: `gh api -X DELETE repos/<ユーザー名>/presentation-timer/pages`（画面なら Settings → Pages → Unpublish site）
- リポジトリごと非公開に戻す: `gh repo edit <ユーザー名>/presentation-timer --visibility private --accept-visibility-change-consequences`

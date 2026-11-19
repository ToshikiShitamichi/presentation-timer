# changes-pending.md（設計と違う変更・設計にない変更）

実装中に、設計（docs/00〜05）と違う・設計にない変更をしたら、ここへ書き足す。tasks.md の T-012 で変更報告JSON にまとめる。

## 書いてある変更

- 05_nonfunctional.md「オフラインで使うか：おまかせ」は、社長の答え（T-0381 の判断事項2）でオンライン前提に決まった。Service Worker は作らず、PWA は manifest とホーム画面への追加で満たす。
- 05_nonfunctional.md「自動テスト：おまかせ」は、判断事項7の B（Playwright など画面の自動テストも足す）に決まった。Playwright は開発用のパッケージで、入れてよいかは判断待ち I-0630。
- tasks.md の T-001: I-0630 の社長の答えは A（入れてよい）。package.json の devDependencies に @playwright/test を書いた（開発用だけ。アプリ本体はパッケージ0個）。npm install は社長が行う。
- 05_nonfunctional.md の技術スタック・公開範囲・データ量・公開先・バックアップは、決めたこと（docs/tasks.md の頭）のとおり。

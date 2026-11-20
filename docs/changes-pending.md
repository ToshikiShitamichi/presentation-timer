# changes-pending.md（設計と違う変更・設計にない変更）

実装中に、設計（docs/00〜05）と違う・設計にない変更をしたら、ここへ書き足す。tasks.md の T-012 で変更報告JSON にまとめる。

## 書いてある変更

- 05_nonfunctional.md「オフラインで使うか：おまかせ」は、社長の答え（T-0381 の判断事項2）でオンライン前提に決まった。Service Worker は作らず、PWA は manifest とホーム画面への追加で満たす。
- 05_nonfunctional.md「自動テスト：おまかせ」は、判断事項7の B（Playwright など画面の自動テストも足す）に決まった。Playwright は開発用のパッケージで、入れてよいかは判断待ち I-0630。
- tasks.md の T-001: I-0630 の社長の答えは A（入れてよい）。package.json の devDependencies に @playwright/test を書いた（開発用だけ。アプリ本体はパッケージ0個）。npm install は社長が行う。
- 05_nonfunctional.md の技術スタック・公開範囲・データ量・公開先・バックアップは、決めたこと（docs/tasks.md の頭）のとおり。
- 判断事項6（バックアップ・書き出しと読み込みは作らない）を、11/20 の社長の指示（T-0396。貼り付けなしでスマホに講義を入れたい）で変えた。S-03（講義の一覧）に「書き出す」と「ファイルから読み込む」を足した（js/backup.mjs・js/screens/registry.mjs・test/backup.test.mjs）。
  - 書き出す: 保存されている講義の全部を JSON ファイルにしてダウンロードする（名前の例 presentation-timer-lectures-2026-11-20.json）。講義が0件のときはボタンを押せず、「書き出す講義がありません。」と出す。
  - ファイルの形式: { "format": "presentation-timer-lectures", "version": 1, "exported_at": "ISO の日時", "lectures": [ { "lecture_date": "YYYY-MM-DD", "blocks": [ TB-02 の項目（start_time・duration・step・procedure・tools_materials・trouble_follow_up・time_adjustment・is_break・sort_order・id・lecture_id） ] } ] }。
  - 読み込む: 今の講義にファイルの講義を新しい id で足す。同じ日付で blocks の中身が同じ講義は足さない（同じファイルを2回読んでも増えない）。足した件数と足さなかった件数を出す。形式違い・壊れた JSON は保存を変えずに赤い文を出す。講義が 90 件を超えたときは既存の警告も出す。
- tasks.md の T-011: 公開先は GitHub Pages（main の root を配信）。.nojekyll と docs/deploy.md を足した。docs と package.json も配信される（機密は入っていない）。

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
- 11/20 の社長の指示（T-0398）: S-03 の講義のカードごとに「削除」ボタンを足した（window.confirm で日付と時間帯を見せ、OK なら保存から取り除く。deletedAt は使わない。js/storage.mjs の deleteLecture）。「ファイルで置き換える」を足した（確かめてから保存をファイルの講義だけにする。id は新しく付ける。js/backup.mjs の replaceLectures）。運用: PC の書き出しをスマホの正にし、スマホは「ファイルで置き換える」で読む。
- tasks.md の T-010: 画面のテストは e2e/screens.spec.mjs に置き、playwright.config.mjs で e2e/ だけを読む（node --test は test/ だけ）。テスト用サーバーは e2e/serve.mjs（127.0.0.1:4890。index.html・manifest.webmanifest・js/ の .mjs だけを配る）。時刻は page.clock.setFixedTime で固定。
- 11/20 の社長の指示（T-0397）: 04 の R-004-1「スライド範囲をそのまま表示」に、空のときは前のブロックのうち休憩でなく値のある一番近いものの値を出す（休憩のブロックは今のまま。前にも値がなければ空）を足した（js/live-view.mjs）。S-02（講義中の表示）の左上に「←」の一覧に戻るボタン（aria-label は一覧に戻る）を足し、押すと S-03 へ移る（js/screens/registry.mjs）。
- 11/25 の社長の指示（T-0422）: S-02 に「前へ」「次へ」のボタンを足した（js/screens/registry.mjs、js/live-view.mjs の stepShown・effectiveIndex）。次へは時刻で決まる今のセクションより後ろにだけ進める。前へは時刻で決まる今のセクションより前には戻れず、そこでは押せない（無効）。時刻が進めたセクションに追いついたら時刻どおりに戻る。R-004・BR-007 の残り時間の式を変えた: 「開始時刻＋所要時間−今」をやめ、「表示中の行の次の行の開始時刻−今」（最後の行は講義の終わりの時刻−今）にした。所要時間の列は残り時間に使わない。
- 11/25 の社長の指示（T-0423）: TB-01 の「日付（lecture_date）」を「タイトル（title。空は登録できない）」に替えた（js/storage.mjs・js/register.mjs。S-04 は日付の入力をタイトルの文字入力 regTitle に替えた。前の形の保存・version 1 のファイルは lecture_date をタイトルとして読む）。グループを足した（TB-03 グループ: id・title・lecture_ids〔講義の並び〕。js/storage.mjs の addGroup・deleteGroup）。S-03 はグループと、グループに入っていない講義を出す（日付ごとのまとめはやめた。js/lecture-list.mjs の buildList）。グループを選ぶと、講義の行を開始時刻の順に並べた1つの進行表を S-02 に渡し、通しで表示する（グループに入れた講義も1件ずつ開ける）。S-03 に「グループを作る」の欄（タイトルと講義のチェック）と、グループごとの「削除」を足した（確認は window.confirm。グループを消しても講義は消えない。講義を消すとグループの並びから外れ、空になったグループは消える）。書き出しの version を 2 にし、講義は title、ファイルに groups（title と lectures〔ファイル内の講義の番号〕）を足した（js/backup.mjs。version 1 も読める）。

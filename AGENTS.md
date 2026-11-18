# AGENTS.md（講義時間管理アプリ・改訂 v1）

## 1. このアプリの概要

- アプリ名：講義時間管理アプリ
- 一言で：講義中に、予定では現在どのスライドの説明をしているのか見えるためのツール
- 誰が使うか：私
- 成功の状態：次の4つが画面に表示される。休憩の時間帯は「【休憩】」と表示する。
・現在のブロックのスライド範囲（例：スライド1〜8枚目）
・講義内容（内容欄の1行目の見出し。例：【01 JavaScriptを動かしてみよう（説明）】）
・現在時刻
・現在のブロックの残り時間
- 詳しくは docs/00_vision.md

## 2. 設計書の場所と読む順番

1. docs/00_vision.md（①要求定義）
2. docs/01_requirements.md（②要件定義。EARS）
3. docs/02_functions.md（③-1 機能設計と業務ルール）
4. docs/03_screens.md（③-3 画面一覧と遷移図）
5. docs/04_database.md（③-4 テーブル定義・ER図・CRUD表）
6. docs/05_nonfunctional.md（③-2 非機能）

画面のレイアウトは docs/mocks/ のモックHTMLに従う（ある場合）。

## 3. ID体系

- D-01：ドメイン
- R-001：要件（R-001-1 はその受け入れ基準）
- F-001：機能
- BR-001：業務ルール
- S-01：画面
- C-01：共通部品
- TB-01：テーブル（TB-01-1 はそのカラム）

## 4. 技術スタック

- ③-2 では技術スタックを指定していない。実装前に案を出して確認を取ること（確認を待ってから進める）。

## 5. 制約（③-2 で確定した項目）

- 端末：スマホ
- 利用者の規模：自分だけ
- ログイン：不要
- 権限の分け方：分けない
- 個人情報を扱うか：扱わない
- お金・決済を扱うか：扱わない
- 反応の速さ：リアルタイム性が必要
- 月額費用の上限：0円
- 対応言語：日本語のみ
- ①の制約：・PWAで作る / ・取り込むデータは講義進行表の列構成に従う（開始時間・所要時間・ステップ・進め方・手順・使用ツール・資料・ハマりポイント・時間調整ポイント）

## 6. おまかせの項目

次の項目は実装前に案を出し、確認してから進めること。

- 技術スタック
- オフラインで使うか
- 公開範囲
- データ量の目安
- 公開先
- バックアップ
- 自動テスト

## 7. 作業ルール

- docs/tasks.md に沿って1タスクずつ進める
- 完了条件（対応する受け入れ基準）を満たしたらチェックを付ける
- スコープ外（docs/00_vision.md の7「やらないこと」）のことはしない
- 設計と違う変更・設計にない変更をしたら、そのたびに docs/changes-pending.md へ書き足す
- tasks.md の最後のタスクで、changes-pending.md を変更報告JSON（下の8）にまとめ、docs/change-reports/v1.json に保存する

## 8. 変更報告JSONの形式

```json
{
  "revision": 2,
  "changes": [
    { "type": "add", "target": "requirement", "id": "新しい要件A", "parent_id": "D-02",
      "content": { "role": "利用者", "want": "…", "value": "…", "priority": "Must" },
      "reason": "実装中に必要だと分かったため" },
    { "type": "change", "target": "column", "id": "TB-01-3", "content": { "required": true }, "reason": "…" },
    { "type": "deprecate", "target": "screen", "id": "S-05", "reason": "…" }
  ]
}
```

| キー | 内容 |
|---|---|
| type | add（追加）／change（変更）／deprecate（廃止） |
| target | requirement／criterion／function／business_rule／screen／component／table／column |
| id | 変更・廃止は既存のID。追加は仮の名前（取り込み時に正式なIDを付ける） |
| parent_id | 追加のときの親（要件→ドメイン、受け入れ基準→要件、カラム→テーブル） |
| content | 対象ごとの項目。変更は変わった項目だけでよい |
| reason | 変更の理由 |

content で使うキー：
- requirement：role、want、value、priority
- criterion：where、while、trigger_type（when／if／空）、trigger、response
- function：name、trigger、flow、requirements（IDの配列）、external
- business_rule：name、content、kind
- screen：name、kind、roles、entry、description、elements
- component：name、screens、links
- table：logical_name、physical_name、description、soft_delete
- column：logical_name、physical_name、type、required、unique、default、ref_table、options

# Spec-let: 一括商品登録（AI エンリッチ付き） — B1

**Status:** 仕様のみ。**実装は PM 承認待ち**（バッチ AI はまとまった API 費用が発生し、
ADR-0001 の方向性（カタログ取り込み (b) と統合するか）に依存するため）。

## 現状（既にあるもの）

- `POST /products/import.csv` — name/JAN/qty 等の CSV を下書き商品として一括登録
  （行単位エラー報告、カテゴリ/仕入先は名前解決、2MB 上限、UTF-8/Shift_JIS 対応）。
- `GET /products/import-template.csv` — テンプレート配布。
- 単品の AI ルックアップ（`POST /ai-suggestions`、mock/実 両対応、日次上限 C5）。

## 問題

クリニックの初期導入は数百 SKU。現行フローは「CSV で骨組みだけ入れて 1 商品ずつ
AI 補完」— AI の価値が初期導入のいちばん重い瞬間に効かない。

## ゴール

CSV 取り込み → **バッチ AI エンリッチ**（安価な batch モデル）→ **確認グリッド**で
人が一括承認 → 一括で下書き→公開。

## 非ゴール

- JAN-DB / カタログ前段検索（ADR-0001 で別判断）。
- 画像の一括取得。リアルタイム進捗の WebSocket 化（ポーリングで足りる）。

## 設計方針

1. `POST /products/import.csv?enrich=1` — 取り込み後、各行に対し AI セッションを
   **キューイング**（即実行しない）。
2. `import_batches` テーブル: batch_id / row 状態 (pending → enriched → failed) /
   checkpoint。**中断・再開可能**（未処理行のみ再実行）。レート: 直列 + 行間
   スリープ、C5 の日次上限を消費（上限到達で自動一時停止）。モデルは既存
   モデルマップの安価な batch モデル（gpt-4.1-mini）固定。
3. 確認グリッド（frontend 新ページ `#/products/import-review/:batchId`）:
   行 × フィールドで AI 候補 vs CSV 値を表示、行チェックで一括適用 → 公開。
   適用は既存の PATCH /products/:id を行単位で叩く（新 API 不要）。
4. A5 テレメトリはこの経路でも自動的に効く（ai_session_id 付き保存）。

## 受け入れ条件

- 100 行 CSV → enrich=1 で全行がエンリッチ or 明示 failed になり、途中クラッシュ後の
  再実行で処理済み行を再課金しない。
- 確認グリッドから 100 行を 5 分以内で承認→公開できる（人の操作時間ベース）。
- AI 上限（C5）到達時は 429 でなくバッチが pause し、翌日再開できる。

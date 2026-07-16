# Spec-let: 期限切れ在庫の廃棄処理（write-off） — B3

**Status:** 実装対象（このブランチで実装）。

## 現状（既にあるもの）

- ロット + 期限（mig 014、FEFO 払い出し、effective expiry = 最先ロット）。
- ダッシュボード: 期限間近 KPI・要対応リスト（expiring_soon）。
- 調整 reason enum: manual/sale/purchase_order_received/correction/damage/other/
  refund/transfer。

## 問題

期限切れを**見る**ことはできるが、**処理する**アクションがない。実務では期限切れ
= 廃棄記録（監査対象）であり、現状は correction で誤魔化すしかない＝廃棄量が
集計できない。

## ゴール

1. 調整 reason に `expired_write_off` を追加（mig 021、MySQL ENUM ALTER）。
2. `POST /variants/{id}/write-off-expired` — 期限切れロットの残量を一括で
   on_hand から減算し、ロット残を 0 化、理由 `expired_write_off` の調整行 +
   audit event を残す（既存 refund/transfer パターンの写し）。
3. 商品詳細のロットタブ: 期限切れロットに「期限切れを廃棄」ボタン（確認ダイアログ付き）。

## 非ゴール

- 廃棄の承認フロー（管理者専用にはする）。廃棄金額レポート（集計は audit +
  reason で後から可能になる — それがこの変更の狙い）。

## 受け入れ条件

- 期限切れロット（qty 5）に write-off 実行 → on_hand −5、ロット残 0、
  調整行 reason=expired_write_off、audit event 記録。
- 期限内ロットしか無い場合 → 400（誤操作ガード）。
- staff 実行 → 既存承認フローに載る or 403（管理者のみ）。実装は**管理者のみ**
  （廃棄は監査イベントであり、承認 payload 再生の複雑さに値しない）。
- テストで固定。

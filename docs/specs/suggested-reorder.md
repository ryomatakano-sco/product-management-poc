# Spec-let: 発注提案（リオーダーループを閉じる） — B2

**Status:** 実装対象（このブランチで velocity 対応を実装）。

## 現状（既にあるもの）

- 低在庫検知（notifier + dashboard、per-variant threshold）。
- `POST /purchase-orders/auto-draft` — 低在庫から仕入先ごとの下書き PO を自動生成。
  数量ヒューリスティック: `threshold*2 − available, min 1`。
- 承認モデル（mig 018）: 下書きはユーザーが確認してから送信。

## 問題

数量提案が **売れ行きを見ていない**。回転の速い商品は過小に、動かない商品は
過大に提案される。期限切れ間近の在庫があっても提案数量は減らない。

## ゴール

auto-draft の数量提案を「30日販売velocity × カバー日数 − 利用可能在庫 − 期限内に
使い切れない在庫」ベースに置き換える。提案は今まで通り**下書き**であり、人が
承認・編集して送信する（承認モデル変更なし）。

## 非ゴール

- 自動送信。需要予測モデル（移動平均で十分）。発注点(ROP)の最適化。

## 数量ロジック（実装仕様）

```
velocity_30d = 過去30日の販売数量合計 / 30          （返品行 qty<0 は除外）
target_cover = 30 日分 = ceil(velocity_30d * 30)
qty = max(target_cover − available, threshold*2 − available, 1)
     … velocity が 0 の商品は従来ヒューリスティックにフォールバック
```

- 期限考慮: 30日以内に期限切れになるロット在庫は available から差し引いて計算
  （どうせ使えない在庫を「ある」と数えない）。
- レスポンス各行に `suggested_reason`（"velocity" | "threshold"）を含め、
  UI が根拠を出せるようにする。

## 受け入れ条件

- 30日で 60 個売れた商品（available 5, threshold 10）→ 提案 55（velocity 根拠）。
- 販売実績ゼロの商品 → 従来通り threshold*2 − available。
- テストで両ケースを固定。

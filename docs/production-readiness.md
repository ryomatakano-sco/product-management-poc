# Production-Readiness Flags

PoC で意図的に許容している事項の台帳。**商用化判断の前に必ず棚卸しする。**
（review-improvements Phase D, 2026-07-16。修正済みの項目は打ち消しで残す。）

## セキュリティ

| # | 項目 | 現状 | 本番要件 |
|---|---|---|---|
| S1 | CORS | `allow_origins=["*"]`（main.py。同一オリジン運用なので実害なし） | 既知オリジンに限定、`allow_credentials` と併せて再設計 |
| S2 | `AUTH_SECRET` | コード内デフォルトあり（`services/auth.py`） | env 必須化（未設定なら起動拒否）。セッション cookie に `Secure` フラグ（HTTPS 前提） |
| S3 | X-Store-Id dev fallback | loopback 限定（review 済み） | 本番ビルドでは完全無効化（env フラグ） |
| S4 | ~~/ai-suggestions/compare 無認証~~ | **修正済み（C5）** — 認証 + 日次上限 | — |
| S5 | dev パネル | `DEV_PANEL_PASSWORD`（loopback 限定） | 本番では /dev/* をルーター登録ごと外す |
| S6 | レート制限 | AI エンドポイントのみ（C5 日次上限） | 全書き込み系に標準のレートリミット層 |

## 信頼性・運用

| # | 項目 | 現状 | 本番要件 |
|---|---|---|---|
| R1 | 通知スケジューラ | in-process（lifespan、ログあり、`ENABLE_SCHEDULER` で制御可）。**単一ワーカー前提** | 外部スケジューラ（cron / Cloud Scheduler）へ移設。多重起動ガードを DB ロックで |
| R2 | `except Exception` 飲み込み | `notifier.py` / `audit.py` は log して継続（設計通り: 非クリティカル経路が業務書き込みを壊さないため）。**データ整合性を隠す箇所は無いことを確認済み**（audit はステージのみ、notifier は別トランザクション） | エラーレポーティング（Sentry 等）に接続 |
| R3 | AI lookup キャッシュ | プロセスローカル FIFO 256 | マルチプロセス化するなら Redis 等へ（ADR-0001 帰結にも記載） |
| R4 | バックアップ / migration 運用 | alembic 手動実行 | CI での migration 検証 + 自動バックアップ |

## フロントエンド

| # | 項目 | 現状 | 本番要件 |
|---|---|---|---|
| F1 | Babel-in-browser | CDN + `@babel/standalone`（初回コンパイル数秒） | Vite 等の実ビルドへ移行（PoC 卒業の必須条件） |
| F2 | CDN 依存 | React/Babel/html5-qrcode/qrcodejs を unpkg/cdnjs から | self-host or bundle |
| F3 | i18n 三分割 | `i18n.js`+`i18n_autotr.js`+`i18n_strings.js`（計 ~1500 行、EN 辞書は JP 主体製品に対して維持コスト大） | **PM 判断**: 本気の二言語対応として 1 モジュールに統合 + fallback テスト、または EN 層を落とす。中途半端に残さない（このプロジェクト自体に非日本語話者がいる点は統合案の追い風） |

## テスト・CI

| # | 項目 | 現状 | 本番要件 |
|---|---|---|---|
| T1 | テスト | `backend/tests/` 45 件（tenancy/CRUD/stock/AI mock、`scripts/test.bat`）。**MySQL 必須**（raw SQL が MySQL 方言のため SQLite 不可） | CI に MySQL サービスコンテナで組み込み。カバレッジ計測 |
| T2 | AI 実測 golden run | `RUN_AI_GOLDEN=1` で手動（実費） | 週次の定期実行 + accept-rate ダッシュボード（/dev/ai-corrections が基礎データ） |
| T3 | フロントエンド | esbuild parse チェックのみ | E2E（Playwright）を Vite 移行とセットで |

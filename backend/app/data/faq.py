"""Static FAQ items shown on the サポート page.

Hard-coded for the PoC — these 8 questions are the design brief's required
content (§3.10). Real FAQ-from-CMS plumbing is future scope.
"""

from __future__ import annotations

from datetime import datetime, timezone


_UPDATED = datetime(2026, 5, 10, tzinfo=timezone.utc)


FAQ_ITEMS = [
    {
        "id": 1,
        "question": "商品を一括で登録するには？",
        "answer": (
            "現時点では1件ずつ登録する仕様です。CSV一括登録は v1.5 で対応予定です。"
            "AI入力サポートをご活用ください。"
        ),
        "category": "操作方法",
        "updated_at": _UPDATED,
    },
    {
        "id": 2,
        "question": "期限間近の商品を自動で通知する設定はどこですか？",
        "answer": "[設定] → [通知] から、期限間近（60日前）の通知を有効化できます。",
        "category": "操作方法",
        "updated_at": _UPDATED,
    },
    {
        "id": 3,
        "question": "仕入先のメールアドレスを変更したい",
        "answer": "[仕入先] 一覧から該当の仕入先を開き、[編集] ボタンから変更してください。",
        "category": "操作方法",
        "updated_at": _UPDATED,
    },
    {
        "id": 4,
        "question": "発注書PDFのフォーマットを変えたい",
        "answer": (
            "PDFフォーマットの変更は v1.5 で対応予定です。"
            "現在は標準テンプレートのみご利用いただけます。"
        ),
        "category": "機能",
        "updated_at": _UPDATED,
    },
    {
        "id": 5,
        "question": "在庫数が実際と合いません。再棚卸しの方法は？",
        "answer": (
            "[在庫] ページから [+ 在庫調整] を開き、調整タイプ「棚卸し補正」を選択して"
            "正しい数量を入力してください。理由には「棚卸し補正」をお選びください。"
        ),
        "category": "操作方法",
        "updated_at": _UPDATED,
    },
    {
        "id": 6,
        "question": "paylight Xの予約データと連携できますか？",
        "answer": (
            "現在 paylight X 本体との SSO 連携のみご利用いただけます。"
            "予約データの連携は v2.0 で対応予定です。"
        ),
        "category": "連携",
        "updated_at": _UPDATED,
    },
    {
        "id": 7,
        "question": "APIキーを誤って公開してしまいました",
        "answer": (
            "ただちに [設定] → [API・Webhooks] から該当のキーを失効（revoke）してください。"
            "新しいキーを発行後、関連するアプリケーションを更新してください。"
        ),
        "category": "セキュリティ",
        "updated_at": _UPDATED,
    },
    {
        "id": 8,
        "question": "退職スタッフのアカウントを削除する方法",
        "answer": (
            "[設定] → [ユーザー管理] から該当ユーザーを [無効化] してください。"
            "削除ではなく無効化を推奨します（過去の操作ログを保持するため）。"
        ),
        "category": "ユーザー管理",
        "updated_at": _UPDATED,
    },
]

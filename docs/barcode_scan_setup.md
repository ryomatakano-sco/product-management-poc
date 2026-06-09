# スマホ・バーコードスキャン セットアップ / Phone barcode scan — setup & reproducibility

別の人が GitHub から pull した場合に、スマホのカメラ機能を同じように動かすための手順です。
What another person needs to do, after pulling from GitHub, to run the phone-camera scan feature the same way.

---

## 結論 / Short answer

コードは pull すれば同じものが入りますが、**2つだけ各自のPCで用意が必要**です（どちらも安全のため Git に入れていません）：
The code is identical after a pull, but **two things must be created locally** (both are intentionally kept out of Git for safety):

1. **HTTPS用の自己署名証明書 / a self-signed TLS cert** — `scripts\gen-dev-cert.bat` で生成（その人のLAN IPを自動検出）。`backend/.certs/` は `.gitignore` 済みなのでリポジトリには入りません。
   Generate it with `scripts\gen-dev-cert.bat` (auto-detects that PC's LAN IP). `backend/.certs/` is gitignored, so it never travels in the repo.
2. **`.env` の `OPENAI_API_KEY`**（実際のAI検索を使う場合）/ `OPENAI_API_KEY` in `.env` (only if you want the real AI lookup). キーが無くてもスキャンとリレーは動作し、AI検索はモック動作になります。
   Without a key, scanning + relay still work; the AI lookup runs in mock mode.

IPは**ハードコードしていません**。サーバーが自身のLAN IPを自動検出し、QRのURLに使います。証明書も生成時に各自のIPをSANに含めます。だから別のPC・別のネットワークでも、手順どおりに用意すれば同じように動きます。
The IP is **not hardcoded** — the server auto-detects its own LAN IP for the QR URL, and the cert includes that PC's IP in its SAN at generation time. So it works the same on another PC/network once these steps are done.

---

## 必要なもの / Prerequisites

- **Python 3.11+** と **MySQL 8**（`scripts\setup.bat` で venv 作成・依存導入・DB作成・シード）。
- **インターネット接続**（フロントは `html5-qrcode` と `qrcodejs` を CDN から読み込みます。社内LANのみでオフラインだと読み込めません）。
- **openssl**（証明書生成用。**Git for Windows** に同梱。Windowsなら通常そのまま使えます）。
- **スマホとPCが同じWi‑Fi / 同一ネットワーク**にあること。
- カメラを使うには **HTTPS** が必須（スマホのブラウザ仕様）。`http` では手入力欄のみ。

---

## 手順 / Steps (Windows)

```bat
REM 1. 初回のみ: venv・依存・DB・シード
scripts\setup.bat

REM 2. (任意) 実AI検索を使うならルートの .env に追記
REM    OPENAI_API_KEY=sk-...

REM 3. このPC用のHTTPS証明書を生成（LAN IPを自動検出してSANに含める）
scripts\gen-dev-cert.bat

REM 4. HTTPSで起動（LAN公開 0.0.0.0、--ssl付き）
scripts\dev-https.bat
```

1. **PC**: ブラウザで `https://127.0.0.1:8000/app/` を開く（自己署名のため初回は警告 → 続行）。
2. **ファイアウォール**: 初回はWindowsが受信接続を確認 → **Python** を **プライベートネットワーク**で許可。
3. **スマホ**: 同じWi‑Fiで `https://<このPCのIP>:8000/app/` を開く（IPは `gen-dev-cert.bat` 実行時に表示されます）。証明書警告を承認：
   - Android/Chrome: 詳細設定 → アクセスする（安全ではありません）
   - iOS/Safari: 詳細を表示 → このWebサイトを閲覧
4. 登録画面 → 「AIで入力する」→ 「📱 スマホで連続スキャン」→ QRをスマホで読み取り → 商品バーコードを続けてスキャン。

---

## macOS / Linux で動かす場合 / On macOS or Linux

`*.bat` は Windows 用です。代わりに直接実行してください。
The `.bat` files are Windows-only. Run the equivalents directly:

```bash
# self-signed cert with your LAN IP in the SAN (replace 192.168.x.x with your IP)
mkdir -p backend/.certs
openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
  -keyout backend/.certs/dev.key -out backend/.certs/dev.crt \
  -subj "/CN=paylightx-dev" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.x.x"

# run over HTTPS, LAN-accessible
cd backend
FRONTEND_DIR="$(pwd)/../frontend" \
  .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 \
  --reload --reload-dir app \
  --ssl-keyfile .certs/dev.key --ssl-certfile .certs/dev.crt
```

---

## つまずきポイント / Troubleshooting

- **スマホがページを開けない** → サーバーが `0.0.0.0` で起動しているか（`dev-https.bat` を使用）、PCのファイアウォールでPythonが許可されているか、同じWi‑Fiかを確認。
- **カメラが起動しない / 「HTTPSが必要」** → `http` で開いています。`https://<PCのIP>:8000/app/` で開き、証明書警告を承認。`dev.bat`（http版）ではカメラは使えません（手入力は可）。
- **QRが `localhost` を指す** → サーバーがLAN IPを取得できなかった場合の表示。`https://<PCのIP>:8000/app/` でPC側アプリを開き直すと、QRもそのIPになります。
- **新しいタブが開かない** → ブラウザのポップアップブロック。サイトのポップアップを許可するか、一覧の「開く」ボタンを使用。
- **IPが変わった** → `scripts\gen-dev-cert.bat` を再実行（新IPで証明書を再生成）。
- **AI検索がモックになる** → ルート `.env` に `OPENAI_API_KEY` を設定。

---

## まとめ / Summary

| 項目 / Item | リポジトリに含まれる？ / In repo? | 各自で必要な対応 / What each user does |
|---|---|---|
| アプリのコード / App code | はい / Yes | pull するだけ / just pull |
| TLS証明書 / TLS cert (`backend/.certs/`) | いいえ（gitignore）/ No | `gen-dev-cert.bat` で生成 / generate |
| `OPENAI_API_KEY` (`.env`) | いいえ（gitignore）/ No | 実AI検索時に各自設定 / set for real lookup |
| LAN IP | ハードコードなし / not hardcoded | 自動検出 / auto-detected |
| CDNライブラリ / CDN libs | 実行時に取得 / fetched at runtime | インターネット接続 / internet access |

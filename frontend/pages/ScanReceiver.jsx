// ScanReceiver — standalone phone scan page for the desktop⟷phone companion
// scanner (Option 2). Opened on a phone via the desktop's pairing QR at
// `/app/#/scan?token=…`. Reads the product's JAN with the camera (reusing the
// shared BarcodeScanner) and POSTs it to the relay; the desktop is polling and
// picks it up. Rendered bare (no admin shell) — see app.jsx.
//
// Privacy: the camera stream is decoded in the browser; no image is captured,
// stored, or uploaded. Only the validated JAN string is sent to the relay.

function ScanReceiver({ token }) {
  // phase: scanning | submitting | done | expired | error | notoken
  const [phase, setPhase] = React.useState(token ? "scanning" : "notoken");
  const [error, setError] = React.useState(null);
  const [sentJan, setSentJan] = React.useState(null);
  const [manual, setManual] = React.useState("");
  const busyRef = React.useRef(false);

  const submit = React.useCallback(async (rawCode) => {
    if (busyRef.current) return;
    const clean = (window.plxCleanJan && window.plxCleanJan(rawCode)) || rawCode;
    if (!window.plxIsValidJan || !window.plxIsValidJan(clean)) {
      setError("有効なJANバーコードではありません。商品のバーコードを読み取ってください。");
      return;
    }
    busyRef.current = true;
    setPhase("submitting");
    setError(null);
    try {
      const res = await api.submitScanSession(token, clean);
      setSentJan(res.jan || clean);
      setPhase("done");
    } catch (e) {
      busyRef.current = false;
      if (e.status === 410) { setPhase("expired"); return; }
      setError(e.body?.detail || e.message || "送信に失敗しました");
      setPhase("error");
    }
  }, [token]);

  const wrap = (children) => (
    <div style={{
      minHeight: "100vh", background: "#0F1419", color: "#ECEEF1",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: 20, boxSizing: "border-box",
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>{children}</div>
    </div>
  );

  if (phase === "notoken") {
    return wrap(
      <div style={{ fontSize: 14, lineHeight: 1.7 }}>
        <div style={{ fontSize: 22, marginBottom: 10 }}>📱</div>
        リンクが無効です。デスクトップ画面の「📱 スマホでスキャン」から
        表示されるQRコードを読み取って、もう一度お試しください。
      </div>
    );
  }

  if (phase === "done") {
    return wrap(
      <div>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>送信しました</div>
        <div style={{ fontSize: 13, color: "#9CA3AF" }}>
          JAN: <span style={{ fontFamily: "ui-monospace,monospace" }}>{sentJan}</span>
        </div>
        <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 10, lineHeight: 1.7 }}>
          デスクトップ画面に戻ってください。自動で商品情報の検索が始まります。
        </div>
      </div>
    );
  }

  if (phase === "expired") {
    return wrap(
      <div style={{ fontSize: 14, lineHeight: 1.7 }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>⌛</div>
        ペアリングの有効期限が切れました。デスクトップでQRコードを
        もう一度表示して読み取ってください。
      </div>
    );
  }

  // scanning / submitting / error — show the camera + a manual fallback.
  return (
    <div style={{
      minHeight: "100vh", background: "#0F1419", color: "#ECEEF1",
      padding: "18px 16px 28px", boxSizing: "border-box",
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, textAlign: "center" }}>
          商品バーコードをスキャン
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14, textAlign: "center" }}>
          商品のJANバーコードをカメラの枠内に合わせてください
        </div>

        {phase === "scanning" && typeof window.BarcodeScanner !== "undefined" && (
          // Reuse the exact camera component from the desktop modal. Only a
          // valid JAN latches (validate); non-JAN reads are ignored.
          <div style={{ position: "relative", height: 320 }}>
            <BarcodeScanner
              onDetected={submit}
              onClose={() => {/* phone page has no parent to close to */}}
              validate={(c) => (window.plxIsValidJan ? window.plxIsValidJan(c) : true)}
            />
          </div>
        )}

        {phase === "scanning" && typeof window.BarcodeScanner === "undefined" && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10,
            padding: "12px 14px", fontSize: 12, color: "#991B1B", lineHeight: 1.6,
          }}>
            カメラ読み取りを初期化できませんでした。下の欄にJANコードを入力してください。
          </div>
        )}

        {phase === "submitting" && (
          <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>
            送信中…
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 14, background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10,
            padding: "10px 12px", fontSize: 12, color: "#991B1B", lineHeight: 1.6,
          }}>
            {error}
          </div>
        )}

        {/* Manual fallback — always available in case the camera is denied or
            the barcode is damaged. Validates client-side before submit. */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6 }}>
            読み取れない場合は手入力：
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              inputMode="numeric" pattern="[0-9]*"
              placeholder="例: 4901616009677"
              style={{
                flex: 1, height: 44, borderRadius: 10, border: "1px solid #374151",
                background: "#1F2937", color: "#ECEEF1", padding: "0 14px",
                fontSize: 16, fontFamily: "ui-monospace,monospace", outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={() => submit(manual)}
              disabled={!manual || phase === "submitting"}
              style={{
                height: 44, padding: "0 18px", borderRadius: 10, border: "none",
                background: "#1AA68A", color: "#fff", fontWeight: 700, fontSize: 13,
                cursor: "pointer", opacity: (!manual || phase === "submitting") ? 0.5 : 1,
              }}
            >送信</button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScanReceiver = ScanReceiver;

// ScanReceiver — standalone phone scan page for the desktop⟷phone companion
// scanner (Option 2, multi-scan). Opened on a phone via the desktop's pairing
// QR at `/app/#/scan?token=…`.
//
// Multi-scan: pair once, then scan many product barcodes in a row. Each valid
// JAN is POSTed to the relay (which the desktop polls) and added to an on-page
// history list. No image leaves the device — only the validated JAN string.

function ScanReceiver({ token }) {
  // phase: scanning | expired | notoken  (terminal: expired / notoken)
  const [phase, setPhase] = React.useState(token ? "scanning" : "notoken");
  const [history, setHistory] = React.useState([]);   // [{jan, at, ok, note}]
  const [notice, setNotice] = React.useState(null);   // transient {text, ok}
  const [manual, setManual] = React.useState("");
  const noticeTimer = React.useRef(null);

  const cameraAllowed =
    window.isSecureContext ||
    /^(localhost|127\.|\[::1\])/.test(window.location.hostname);

  const flash = (text, ok) => {
    setNotice({ text, ok });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2200);
  };

  const submit = React.useCallback(async (rawCode) => {
    const clean = (window.plxCleanJan && window.plxCleanJan(rawCode)) || rawCode;
    if (!window.plxIsValidJan || !window.plxIsValidJan(clean)) {
      flash("有効なJANではありません / not a valid JAN", false);
      return;
    }
    try {
      const res = await api.submitScanSession(token, clean);
      const jan = res.jan || clean;
      setHistory((h) => [{ jan, at: Date.now(), ok: true }, ...h].slice(0, 50));
      flash(`✓ 送信しました / sent: ${jan}`, true);
    } catch (e) {
      if (e.status === 410) { setPhase("expired"); return; }
      flash(e.body?.detail || e.message || "送信に失敗 / send failed", false);
    }
  }, [token]);

  React.useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

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
        表示されるQRコードを読み取ってください。
      </div>
    );
  }

  if (phase === "expired") {
    return wrap(
      <div style={{ fontSize: 14, lineHeight: 1.7 }}>
        <div style={{ fontSize: 30, marginBottom: 8 }}>⌛</div>
        ペアリングの有効期限が切れました。デスクトップでQRコードを
        もう一度表示して読み取ってください。
        {history.length > 0 && (
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 12 }}>
            このセッションで {history.length} 件スキャンしました。
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0F1419", color: "#ECEEF1",
      padding: "16px 16px 28px", boxSizing: "border-box", fontFamily: "var(--font-sans)",
    }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2, textAlign: "center" }}>
          連続スキャン / Continuous scan
        </div>
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12, textAlign: "center" }}>
          続けて商品のJANバーコードを読み取れます（{history.length} 件）
        </div>

        {!cameraAllowed && (
          <div style={{
            background: "#3a2a12", border: "1px solid #b45309", borderRadius: 10,
            padding: "12px 14px", fontSize: 12.5, color: "#FCD34D", lineHeight: 1.7, marginBottom: 12,
          }}>
            📷 カメラを使うには <b>HTTPS</b> 接続が必要です。いまは <b>http</b> のため
            カメラは起動できません。下の「手入力」をご利用ください。
          </div>
        )}

        {cameraAllowed && typeof window.BarcodeScanner !== "undefined" && (
          <div style={{ position: "relative", height: 320 }}>
            <BarcodeScanner
              continuous
              onDetected={submit}
              onClose={() => {/* phone page: no parent to close to */}}
              validate={(c) => (window.plxIsValidJan ? window.plxIsValidJan(c) : true)}
            />
          </div>
        )}

        {cameraAllowed && typeof window.BarcodeScanner === "undefined" && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10,
            padding: "12px 14px", fontSize: 12, color: "#991B1B", lineHeight: 1.6,
          }}>
            カメラ読み取りを初期化できませんでした。下の欄にJANコードを入力してください。
          </div>
        )}

        {/* transient confirmation / error */}
        {notice && (
          <div style={{
            marginTop: 12, borderRadius: 10, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5,
            background: notice.ok ? "#11331f" : "#3a1414",
            border: `1px solid ${notice.ok ? "#1AA68A" : "#FCA5A5"}`,
            color: notice.ok ? "#86efac" : "#fca5a5", textAlign: "center", fontWeight: 700,
          }}>{notice.text}</div>
        )}

        {/* manual fallback — always available; after submit it clears and stays */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6 }}>
            読み取れない場合は手入力 / manual：
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              inputMode="numeric" pattern="[0-9]*" placeholder="例: 4901616009677"
              onKeyDown={(e) => { if (e.key === "Enter" && manual) { submit(manual); setManual(""); } }}
              style={{
                flex: 1, height: 44, borderRadius: 10, border: "1px solid #374151",
                background: "#1F2937", color: "#ECEEF1", padding: "0 14px", fontSize: 16,
                fontFamily: "ui-monospace,monospace", outline: "none", boxSizing: "border-box",
              }}
            />
            <button
              onClick={() => { if (manual) { submit(manual); setManual(""); } }}
              disabled={!manual}
              style={{
                height: 44, padding: "0 18px", borderRadius: 10, border: "none",
                background: "#1AA68A", color: "#fff", fontWeight: 700, fontSize: 13,
                cursor: "pointer", opacity: manual ? 1 : 0.5,
              }}
            >送信</button>
          </div>
        </div>

        {/* scan history (this session) */}
        {history.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6 }}>
              スキャン履歴 / history（新しい順）
            </div>
            <div style={{
              border: "1px solid #1f2937", borderRadius: 10, overflow: "hidden",
            }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 12px", fontSize: 13,
                  borderTop: i === 0 ? "none" : "1px solid #1f2937",
                  background: i % 2 ? "#141a21" : "transparent",
                }}>
                  <span style={{ fontFamily: "ui-monospace,monospace" }}>{h.jan}</span>
                  <span style={{ fontSize: 11, color: "#86efac" }}>
                    ✓ {new Date(h.at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.ScanReceiver = ScanReceiver;

// レシート発行 — F12 (design PDF page 30).
//
// Split panel: left = format + recipient + purpose + tax breakdown controls;
// right = live receipt preview. `PDF で保存` and `印刷する` both use the
// browser print dialog (a print-only stylesheet hides everything except the
// preview so "Save as PDF" from the print dialog produces a clean receipt).
// `メールで送る` is a toast placeholder until an SMTP integration lands.

function ReceiptIssue({ saleId }) {
  const q = useFetch(() => api.getReceiptData(saleId), [saleId]);
  const [format, setFormat]   = React.useState("receipt");   // receipt | invoice | bill
  const [recipient, setRecipient] = React.useState("");
  const [purpose, setPurpose] = React.useState("デンタルケア用品代として");

  const FMT_LABEL = { receipt: "レシート", invoice: "領収書", bill: "請求書" };
  const yen = (v) => "¥" + Number(v || 0).toLocaleString("ja-JP");
  const fmtDate = (iso) => iso
    ? new Date(iso).toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";

  const d = q.data;
  const hasReduced = d?.lines?.some(l => l.is_reduced);
  const has10 = Number(d?.subtotal_10_tax_incl || 0) > 0;
  const has8  = Number(d?.subtotal_8_tax_incl  || 0) > 0;

  // Clone the receipt to a direct child of <body> and hide everything else
  // during print. This is the only reliable way to force a single-page PDF —
  // `visibility: hidden` alone keeps layout height, which caused a blank
  // 2nd page. The clone is removed after the print dialog closes.
  const doPrint = () => {
    const src = document.querySelector(".plx-receipt-preview");
    if (!src) { window.print(); return; }
    const clone = src.cloneNode(true);
    clone.classList.add("plx-print-clone");
    document.body.appendChild(clone);
    document.body.classList.add("plx-printing");
    const cleanup = () => {
      document.body.classList.remove("plx-printing");
      if (clone.parentNode) clone.parentNode.removeChild(clone);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // Safari doesn't always fire afterprint reliably — fallback timeout.
    setTimeout(cleanup, 5000);
  };

  return (
    <AdminShell currentNav="sales" breadcrumbs={["ホーム", "販売記録", "レシート発行"]}>
      <PlxPageHead
        title="レシート・領収書の発行"
        subtitle={d && `取引 ${d.transaction_id}  ・  適格請求書 (インボイス) 対応  ・  8% / 10% の税率区分を自動判定します`}
      />

      {q.loading && <div style={{ padding: 40, textAlign: "center", color: T.PLX_INK_500 }}>読み込み中…</div>}
      {q.error && <PlxErrorBanner error={q.error} onRetry={q.refetch} />}

      {d && (
        <div className="plx-receipt-layout" style={{
          display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 20,
          alignItems: "start",
        }}>
          {/* ── LEFT: form ─────────────────────────────────────── */}
          <div className="plx-no-print" style={{
            background: T.PLX_CARD_BG, border: `1px solid ${T.PLX_LINE_200}`,
            borderRadius: T.RADIUS_LG, padding: 20, gridColumn: 1,
          }}>
            <SectionLabel>書式</SectionLabel>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {["receipt", "invoice", "bill"].map((k) => {
                const on = format === k;
                return (
                  <button key={k} type="button" onClick={() => setFormat(k)} style={{
                    flex: 1, height: 40, padding: "0 12px", borderRadius: T.RADIUS_MD, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                    background: on ? T.PLX_GREEN_100 : T.PLX_SURFACE_100,
                    color: on ? T.PLX_GREEN_700 : T.PLX_INK_700,
                    border: on ? `1px solid ${T.PLX_GREEN_300}` : "1px solid transparent",
                  }}>{FMT_LABEL[k]}</button>
                );
              })}
            </div>

            {/* 宛名 + 但し書き — side-by-side, matches design */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div>
                <SectionLabel>宛名 (領収書のみ)</SectionLabel>
                <input
                  type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)}
                  placeholder="例: 田中 太郎 さま"
                  disabled={format !== "invoice"}
                  style={{ ...formInput, opacity: format === "invoice" ? 1 : 0.5 }}
                />
              </div>
              <div>
                <SectionLabel>但し書き</SectionLabel>
                <input
                  type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)}
                  placeholder="例: デンタルケア用品代として"
                  style={formInput}
                />
              </div>
            </div>

            <SectionLabel>税率の内訳</SectionLabel>
            <div style={{
              border: `1px solid ${T.PLX_LINE_200}`, borderRadius: T.RADIUS_MD,
              padding: "10px 14px", marginBottom: 20, fontSize: 12,
            }}>
              {d.lines.map((l, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto",
                  gap: 8, padding: "6px 0", alignItems: "center",
                  borderTop: i ? `1px solid ${T.PLX_LINE_100}` : "none",
                }}>
                  <span style={{ color: T.PLX_INK_900 }}>
                    {l.name} × {l.quantity}
                    {l.is_reduced && <span style={{ marginLeft: 6, color: T.PLX_AMBER_600, fontWeight: 700 }}>※</span>}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: l.is_reduced ? T.PLX_AMBER_600 : T.PLX_INK_500,
                    background: l.is_reduced ? T.PLX_AMBER_100 : T.PLX_SURFACE_50,
                    padding: "2px 8px", borderRadius: 9999,
                  }}>{l.tax_rate_pct}%{l.is_reduced ? " (軽減)" : ""}</span>
                  <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", minWidth: 70, textAlign: "right" }}>
                    {yen(l.line_total)}
                  </span>
                </div>
              ))}
              {hasReduced && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.PLX_LINE_100}`,
                  fontSize: 11, color: T.PLX_INK_500 }}>
                  ※ は軽減税率 (8%) 対象です。商品マスタの税率区分から自動で判定します。
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={doPrint} style={{
                ...btnSecondary, display: "inline-flex", alignItems: "center", gap: 6,
              }}>⬇ PDF で保存</button>
              <button type="button" onClick={doPrint} style={{
                ...btnPrimary, display: "inline-flex", alignItems: "center", gap: 6,
              }}>🖨 印刷する</button>
            </div>

            <div style={{ marginTop: 12, fontSize: 11, color: T.PLX_INK_500, textAlign: "right" }}>
              PDF は「印刷 → 送信先: PDF に保存」を選択してください。
            </div>
          </div>

          {/* ── RIGHT: receipt preview (plain card, no tray — design has none) */}
          <ReceiptPreview
            data={d} format={format} recipient={recipient} purpose={purpose}
            fmtDate={fmtDate} yen={yen} has10={has10} has8={has8}
          />
        </div>
      )}

      {/* Print stylesheet: `doPrint()` clones the receipt into <body> and
          adds .plx-printing so we can hide everything except the clone.
          `display: none` on siblings (not `visibility`) collapses their
          layout height, guaranteeing a single-page PDF. */}
      <style>{`
        @media print {
          @page { margin: 12mm; }
          html, body { background: #fff !important; }
          body.plx-printing > *:not(.plx-print-clone) { display: none !important; }
          .plx-print-clone {
            display: block !important;
            width: 100% !important; max-width: 100% !important;
            margin: 0 !important; padding: 0 !important;
            border: none !important; box-shadow: none !important;
            background: #fff !important;
            page-break-inside: avoid;
          }
        }
        /* Clone lives in the DOM only during printing; keep it invisible
           on screen so it doesn't briefly flash. */
        body.plx-printing .plx-print-clone { position: static; }
        .plx-print-clone { display: none; }
        @media print { .plx-print-clone { display: block !important; } }
      `}</style>
    </AdminShell>
  );
}

function ReceiptPreview({ data, format, recipient, purpose, fmtDate, yen, has10, has8 }) {
  const d = data;
  const showRecipient = format === "invoice";
  const TITLE = { receipt: "レシート", invoice: "領収書", bill: "請求書" }[format];

  return (
    <div className="plx-receipt-preview" style={{
      background: T.PLX_CARD_BG, border: `1px solid ${T.PLX_LINE_200}`,
      borderRadius: T.RADIUS_LG,
      boxShadow: "0 4px 14px rgba(15,27,45,.06)",
      padding: "22px 20px",
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      fontSize: 11, color: T.PLX_INK_900, lineHeight: 1.65,
      width: "100%", maxWidth: 340, margin: "0 auto",
    }}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.06em", marginBottom: 3 }}>
          {TITLE}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{d.store.company_name}</div>
        {d.store.address && <div style={{ fontSize: 10, color: T.PLX_INK_700 }}>{d.store.address}</div>}
        {d.store.phone && <div style={{ fontSize: 10, color: T.PLX_INK_700 }}>TEL {d.store.phone}</div>}
        {d.store.registration_no && (
          <div style={{ fontSize: 10, color: T.PLX_INK_700 }}>登録番号 {d.store.registration_no}</div>
        )}
      </div>

      <div style={{ borderTop: `1px dashed ${T.PLX_INK_400}`, marginBottom: 10 }} />

      {/* Transaction meta — matches design's "YYYY/MM/DD HH:mm ・ レジ #1 ・ 山田" line */}
      <div style={{ marginBottom: 10, textAlign: "center", fontSize: 11 }}>
        {fmtDate(d.sold_at)}
      </div>

      {showRecipient && (
        <div style={{
          border: `1px solid ${T.PLX_INK_400}`, padding: "10px 12px",
          margin: "10px 0", textAlign: "center", fontWeight: 700, fontSize: 14,
        }}>
          {recipient || "＿＿＿＿＿＿ 様"}
        </div>
      )}

      {purpose && (
        <div style={{ marginBottom: 10, fontSize: 11, color: T.PLX_INK_700 }}>
          但し: {purpose}
        </div>
      )}

      <div style={{ borderTop: `1px dashed ${T.PLX_INK_400}`, marginBottom: 10 }} />

      {/* Line items */}
      {d.lines.map((l, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, padding: "3px 0" }}>
          <span>
            {l.name}
            {l.is_reduced && <span style={{ marginLeft: 4, color: T.PLX_AMBER_600 }}>※</span>}
            <span style={{ color: T.PLX_INK_500 }}> ×{l.quantity}</span>
          </span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{yen(l.line_total)}</span>
        </div>
      ))}

      <div style={{ borderTop: `1px dashed ${T.PLX_INK_400}`, marginTop: 10, paddingTop: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, padding: "3px 0", fontWeight: 700 }}>
          <span>小計</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{yen(d.total)}</span>
        </div>
        {has10 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, padding: "3px 0" }}>
              <span>10%対象 (税抜 {yen(d.subtotal_10_tax_excl)})</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{yen(d.subtotal_10_tax_incl)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, padding: "3px 0", color: T.PLX_INK_700 }}>
              <span>　内消費税 10%</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{yen(d.tax_10)}</span>
            </div>
          </>
        )}
        {has8 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, padding: "3px 0" }}>
              <span>8%対象 (税抜 {yen(d.subtotal_8_tax_excl)}) <span style={{ color: T.PLX_AMBER_600 }}>※</span></span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{yen(d.subtotal_8_tax_incl)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, padding: "3px 0", color: T.PLX_INK_700 }}>
              <span>　内消費税 8%</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{yen(d.tax_8)}</span>
            </div>
          </>
        )}
      </div>

      <div style={{ borderTop: `2px solid ${T.PLX_INK_900}`, marginTop: 8, paddingTop: 8,
        display: "grid", gridTemplateColumns: "1fr auto", gap: 6, fontWeight: 800, fontSize: 13 }}>
        <span>合計</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{yen(d.total)}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, padding: "6px 0", marginTop: 4 }}>
        <span>{d.payment_method_label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{yen(d.total)}</span>
      </div>

      {(has8 || d.lines.some(l => l.is_reduced)) && (
        <div style={{ marginTop: 10, fontSize: 10, color: T.PLX_INK_500 }}>
          ※印は軽減税率(8%)適用商品
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: 10, color: T.PLX_INK_700 }}>
        取引ID: {d.transaction_id}
      </div>

      <div style={{ borderTop: `1px dashed ${T.PLX_INK_400}`, marginTop: 14, paddingTop: 10,
        textAlign: "center", fontSize: 11, color: T.PLX_INK_700 }}>
        ご来院ありがとうございました
      </div>
    </div>
  );
}

// Small label helper matching the design's uppercase-ish section headers.
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: T.PLX_INK_500,
      textTransform: "none", letterSpacing: "0.02em", marginBottom: 8,
    }}>{children}</div>
  );
}

window.ReceiptIssue = ReceiptIssue;

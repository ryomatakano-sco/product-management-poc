// サポート — hero search + FAQ accordion + contact form + footer info row.

function Support() {
  const faqQ = useFetch(() => api.getFaq(), []);
  const statusQ = useFetch(() => api.getSystemStatus(), []);
  const versionQ = useFetch(() => api.getVersion(), []);

  const [search, setSearch] = React.useState("");
  const [expandedId, setExpandedId] = React.useState(null);

  const faqs = faqQ.data ?? [];
  const filtered = search
    ? faqs.filter((f) => f.question.toLowerCase().includes(search.toLowerCase())
                      || (f.answer || "").toLowerCase().includes(search.toLowerCase()))
    : faqs;

  return (
    <AdminShell currentNav="support" breadcrumbs={["ホーム", "サポート"]}>
      {/* Hero */}
      <div style={{
        background: T.PLX_GREEN_050, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_GREEN_100}`,
        padding: 40, textAlign: "center", marginBottom: 20,
      }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: T.PLX_INK_900 }}>お困りですか？</h1>
        <div style={{ marginTop: 8, fontSize: 14, color: T.PLX_INK_500 }}>
          よくある質問やドキュメントから、お探しの情報を見つけてください。
        </div>
        <div style={{ marginTop: 18, position: "relative", maxWidth: 560, margin: "18px auto 0" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="ヘルプを検索"
            style={{ ...formInput, height: 46, fontSize: 14, paddingLeft: 42 }} />
          <span style={{ position: "absolute", left: 14, top: 14, color: T.PLX_INK_400, fontSize: 16 }}>🔍</span>
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <QuickLink icon="📚" title="ドキュメント"
          desc="paylight X 公式ヘルプを開く" onClick={() => window.open("https://x.pay-light.com/", "_blank")} />
        <QuickLink icon="✉️" title="お問い合わせ" desc="フォームから送信"
          onClick={() => document.getElementById("plx-contact-form")?.scrollIntoView({ behavior: "smooth" })}/>
        <QuickLink icon="📢" title="最近のお知らせ" desc="リリースノートを見る"
          onClick={() => document.getElementById("plx-recent-news")?.scrollIntoView({ behavior: "smooth" })}/>
      </div>

      {/* FAQ accordion */}
      <div style={{
        background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
        boxShadow: T.SHADOW_SM, padding: 24, marginBottom: 20,
      }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
          よくある質問 ({filtered.length} 件)
        </h3>
        {faqQ.loading && <div style={{ color: T.PLX_INK_500 }}>読み込み中…</div>}
        {!faqQ.loading && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: T.PLX_INK_500 }}>
            該当する質問が見つかりませんでした。
          </div>
        )}
        {filtered.map((f, i) => (
          <div key={f.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${T.PLX_LINE_100}` : "none" }}>
            <button onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
              style={{
                width: "100%", textAlign: "left", padding: "16px 0",
                background: "transparent", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12,
              }}>
              <span style={{
                fontSize: 14, color: T.PLX_INK_500,
                transform: expandedId === f.id ? "rotate(90deg)" : "none",
                transition: "transform .12s",
              }}>▶</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.PLX_INK_900, flex: 1 }}>{f.question}</span>
              <span style={{
                fontSize: 10, color: T.PLX_INK_500, background: T.PLX_SURFACE_100,
                padding: "2px 8px", borderRadius: 9999,
              }}>{f.category}</span>
            </button>
            {expandedId === f.id && (
              <div style={{
                padding: "0 0 16px 26px", fontSize: 13,
                color: T.PLX_INK_700, lineHeight: 1.8,
              }}>{f.answer}</div>
            )}
          </div>
        ))}
      </div>

      {/* Contact form */}
      <ContactForm />

      {/* Footer row */}
      <div id="plx-recent-news" style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 20,
      }}>
        <FooterCard title="システム状況">
          {statusQ.loading && <div style={{ fontSize: 13, color: T.PLX_INK_500 }}>確認中…</div>}
          {statusQ.data && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: statusQ.data.status === "ok" ? T.PLX_GREEN_500 : T.PLX_RED_600,
                }}/>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {statusQ.data.status === "ok" ? "すべてのシステムは正常です" : "問題が検出されました"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: T.PLX_INK_500 }}>
                最終確認 {formatJpDateTime(statusQ.data.checked_at)}
              </div>
            </div>
          )}
        </FooterCard>

        <FooterCard title="最近のお知らせ">
          <div style={{ fontSize: 13, color: T.PLX_INK_700, lineHeight: 1.8 }}>
            <div><b>v1.4.0</b> リリース — 商品管理モジュール (PoC)</div>
            <div style={{ color: T.PLX_INK_500, fontSize: 11, marginBottom: 8 }}>2026/05/10</div>
            <div>AI入力サポート公開</div>
            <div style={{ color: T.PLX_INK_500, fontSize: 11 }}>2026/05/02</div>
          </div>
        </FooterCard>

        <FooterCard title="バージョン情報">
          {versionQ.loading && <div style={{ fontSize: 13, color: T.PLX_INK_500 }}>確認中…</div>}
          {versionQ.data && (
            <div style={{ fontSize: 13, color: T.PLX_INK_700, lineHeight: 1.9 }}>
              <div>商品管理 <b>v{versionQ.data.app}</b></div>
              <div>paylight X <b>v{versionQ.data.paylight_x}</b></div>
              <div style={{ fontSize: 11, color: T.PLX_INK_500 }}>
                リリース {formatJpDate(versionQ.data.released_at)}
              </div>
            </div>
          )}
        </FooterCard>
      </div>
    </AdminShell>
  );
}

function ContactForm() {
  const [subject, setSubject] = React.useState("howto");
  const [page, setPage] = React.useState("");
  const [body, setBody] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [contactWindow, setContactWindow] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const submit = async () => {
    if (!body.trim() || !email.trim()) {
      window.PLX_TOAST.warn("お問い合わせ内容とメールアドレスを入力してください");
      return;
    }
    setSending(true);
    try {
      await api.createSupportTicket({
        subject_category: subject,
        related_page: page || null,
        body, email,
        contact_window: contactWindow || null,
      });
      window.PLX_TOAST.success("お問い合わせを送信しました。担当者よりご連絡いたします。");
      setBody(""); setEmail(""); setContactWindow("");
    } catch (e) {
      window.PLX_TOAST.error("送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSending(false);
    }
  };

  return (
    <div id="plx-contact-form" style={{
      background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
      boxShadow: T.SHADOW_SM, padding: 24, marginBottom: 20,
    }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, marginBottom: 14 }}>お問い合わせフォーム</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <FormRow label="件名">
          <Select value={subject} onChange={setSubject} options={[
            { value: "bug", label: "不具合報告" },
            { value: "feature", label: "機能要望" },
            { value: "howto", label: "操作方法" },
            { value: "other", label: "その他" },
          ]}/>
        </FormRow>
        <FormRow label="関連画面（任意）">
          <Select value={page} onChange={setPage} options={[
            { value: "", label: "選択してください" },
            { value: "dashboard", label: "ダッシュボード" },
            { value: "products", label: "商品" },
            { value: "categories", label: "カテゴリ" },
            { value: "inventory", label: "在庫" },
            { value: "purchase-orders", label: "発注書" },
            { value: "sales", label: "販売記録" },
            { value: "vendors", label: "仕入先" },
            { value: "branches", label: "院・店舗" },
            { value: "settings", label: "設定" },
            { value: "support", label: "サポート" },
          ]}/>
        </FormRow>
      </div>
      <FormRow label="お問い合わせ内容">
        <textarea value={body} onChange={(e) => setBody(e.target.value)}
          rows={6} style={{ ...formInput, height: 140, padding: "12px 14px", resize: "vertical" }}
          placeholder="詳細をご記入ください..." />
      </FormRow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <FormRow label="メールアドレス">
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            type="email" style={formInput} placeholder="you@example.com" />
        </FormRow>
        <FormRow label="連絡希望時間帯（任意）">
          <input value={contactWindow} onChange={(e) => setContactWindow(e.target.value)}
            style={formInput} placeholder="例：平日 10:00–17:00" />
        </FormRow>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={submit} disabled={sending} style={{ ...btnPrimary, opacity: sending ? 0.5 : 1 }}>
          {sending ? "送信中..." : "送信する"}
        </button>
      </div>
    </div>
  );
}

function QuickLink({ icon, title, desc, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
      padding: 20, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 14,
    }}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = T.SHADOW_MD}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}>
      <div style={{
        width: 44, height: 44, borderRadius: T.RADIUS_MD, background: T.PLX_GREEN_100,
        fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12, color: T.PLX_INK_500, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

function FooterCard({ title, children }) {
  return (
    <div style={{
      background: T.PLX_CARD_BG, borderRadius: T.RADIUS_LG, border: `1px solid ${T.PLX_LINE_200}`,
      padding: 20,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

window.Support = Support;

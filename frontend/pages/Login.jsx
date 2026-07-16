// ログイン — bare page (no AdminShell), rendered by the app.jsx auth gate when
// GET /auth/me returns 401. On success the gate refetches /auth/me and the
// normal app renders. Dev credentials: admin@example.com / admin.

function Login({ onLoggedIn }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(email.trim(), password);
      onLoggedIn();
    } catch (err) {
      setError(window.errText(err, "ログインに失敗しました"));
      setBusy(false);
    }
  };

  const input = {
    width: "100%", height: 44, padding: "0 14px", borderRadius: 10,
    border: `1px solid ${T.PLX_LINE_200}`, fontSize: 14, color: T.PLX_INK_900,
    background: T.PLX_SURFACE_0, boxSizing: "border-box", 
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: T.PLX_SURFACE_50, fontFamily: "'Inter','Noto Sans JP',sans-serif",
    }}>
      <div style={{ width: 380, maxWidth: "92vw" }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 22 }}>
          <span style={{
            width: 38, height: 38, borderRadius: 10, background: T.PLX_SIDEBAR_BG,
            color: T.PLX_ON_BRAND, display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 15,
          }}>pX</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: T.PLX_INK_900 }}>
            paylight <span style={{ color: T.PLX_GREEN_600 }}>X</span>
            <span style={{ fontWeight: 600, color: T.PLX_INK_500, marginLeft: 8, fontSize: 14 }}>商品管理</span>
          </span>
        </div>

        <form onSubmit={submit} style={{
          background: T.PLX_CARD_BG, borderRadius: 16, border: `1px solid ${T.PLX_LINE_200}`,
          boxShadow: T.SHADOW_MD || "0 10px 30px rgba(15,42,35,.08)", padding: "26px 28px",
        }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: T.PLX_INK_900 }}>ログイン</h1>
          <div style={{ fontSize: 12, color: T.PLX_INK_500, marginBottom: 18 }}>
            スタッフアカウントでサインインしてください
          </div>

          <TextInput id="login-email" label="メールアドレス"
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com" autoComplete="username" required
            style={{ ...input }} />

          <TextInput id="login-password" label="パスワード"
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" autoComplete="current-password" required
            style={{ ...input }} />

          {error && (
            <div style={{
              marginTop: 8, padding: "8px 12px", borderRadius: 8, fontSize: 12,
              background: T.PLX_RED_100, color: T.PLX_RED_600, fontWeight: 600,
            }}>{error}</div>
          )}

          <Button type="submit" variant="primary" loading={busy} style={{
            marginTop: 16, width: "100%", height: 44, fontSize: 14,
          }}>サインイン</Button>

          <div style={{ marginTop: 14, fontSize: 11, color: T.PLX_INK_400, textAlign: "center" }}>
            PoC 開発用: admin@example.com / admin
          </div>
        </form>
      </div>
    </div>
  );
}

window.Login = Login;

import { useState } from "react";

function AuthModal({ initTab = "login", onClose, onSuccess, T, useIsMobileHook, api }) {
  const isMobile = useIsMobileHook(720);
  const [tab, setTab] = useState(initTab);
  const [email, setEmail] = useState("");
  const [uname, setUname] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const isReg = tab === "register";
      const data = isReg ? await api.register(email, uname, pw) : await api.login(email, pw);
      if (data.error) throw new Error(data.error);
      localStorage.setItem("boardai_token", data.token);
      localStorage.setItem("boardai_user", JSON.stringify(data.user));
      onSuccess(data.user);
    } catch (ex) {
      setErr(ex.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  const inp = { background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 8, padding: "9px 12px", color: T.t0, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", width: "100%" };

  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(6px)", padding: isMobile ? 12 : 0 }} onClick={onClose}>
    <div className="pop" onClick={(e) => e.stopPropagation()} style={{ background: T.bg1, border: `1px solid ${T.b2}`, borderRadius: 20, padding: isMobile ? "20px 16px" : "32px 36px", width: "100%", maxWidth: isMobile ? "100%" : 420, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,.7)" }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div style={{ fontSize: 34, color: T.y, marginBottom: 6, animation: "float 3s ease-in-out infinite", display: "inline-block" }}>B</div>
        <h2 style={{ fontFamily: "'Instrument Serif',serif", fontSize: isMobile ? 24 : 28, color: T.t0, fontWeight: 800, letterSpacing: "-.03em", margin: 0 }}>Board<span style={{ color: T.y }}>AI</span></h2>
      </div>
      <div style={{ display: "flex", background: T.bg0, borderRadius: 10, padding: 3, marginBottom: 22 }}>
        {["login", "register"].map((t) => <button key={t} onClick={() => { setTab(t); setErr(""); }} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: tab === t ? T.bg3 : "transparent", color: tab === t ? T.t0 : T.t2, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", fontWeight: tab === t ? 600 : 400, transition: "all .15s" }}>{t === "login" ? "Sign In" : "Create Account"}</button>)}
      </div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {tab === "register" && <input value={uname} onChange={(e) => setUname(e.target.value)} placeholder="Your name" required style={inp} onFocus={(e) => e.target.style.borderColor = T.yDim} onBlur={(e) => e.target.style.borderColor = T.b1} />}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" required style={inp} onFocus={(e) => e.target.style.borderColor = T.yDim} onBlur={(e) => e.target.style.borderColor = T.b1} />
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password (min 6 chars)" required minLength={6} style={inp} onFocus={(e) => e.target.style.borderColor = T.yDim} onBlur={(e) => e.target.style.borderColor = T.b1} />
        {err && <div style={{ background: "rgba(239,68,68,.09)", border: "1px solid rgba(239,68,68,.35)", borderRadius: 7, padding: "7px 10px", fontSize: 11.5, color: "#fca5a5", fontFamily: "'JetBrains Mono',monospace" }}>{err}</div>}
        <button type="submit" disabled={loading} style={{ background: T.y, color: "#0c1829", border: "none", padding: "12px", borderRadius: 9, cursor: loading ? "not-allowed" : "pointer", fontSize: 14, fontFamily: "inherit", fontWeight: 700, marginTop: 4, opacity: loading ? .6 : 1, transition: "opacity .15s" }}>{loading ? "Loading…" : tab === "login" ? "Sign In" : "Create Account"}</button>
      </form>
      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11.5, color: T.t2 }}>
        {tab === "login" ? "No account? " : "Have an account? "}
        <button onClick={() => { setTab(tab === "login" ? "register" : "login"); setErr(""); }} style={{ background: "none", border: "none", color: T.y, cursor: "pointer", fontSize: 11.5, fontFamily: "inherit", textDecoration: "underline" }}>{tab === "login" ? "Create one" : "Sign in"}</button>
      </div>
    </div>
  </div>;
}

export default function LandingPage({ onLogin, themeMode = "dark", onToggleTheme, T, CSS, useIsMobileHook, api }) {
  const isMobile = useIsMobileHook(860);
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState("login");
  function openAuth(tab) { setAuthTab(tab); setShowAuth(true); }

  const features = [
    { icon: "AI", title: "AI-Powered", desc: "DeepSeek AI generates boards, analyzes files, and helps structure your thinking instantly" },
    { icon: "SYNC", title: "Real-time Collab", desc: "Work with your team simultaneously — see cursors, changes, and comments live" },
    { icon: "TPL", title: "12 Templates", desc: "Mind maps, flowcharts, kanban, SWOT, OKR, user journeys, roadmaps, and more" },
    { icon: "EDIT", title: "Rich Editing", desc: "Stickies, shapes, text, arrows, frames, swimlanes, tables — full creative control" },
    { icon: "TOOLS", title: "Workshop Tools", desc: "Voting, timer, dependency mode, and presentation mode for remote facilitation" },
    { icon: "FILE", title: "File Upload", desc: "Upload documents and images — AI maps them into visual boards instantly" },
  ];

  return <div style={{ minHeight: "100vh", background: T.bg0, fontFamily: "'DM Sans',sans-serif", overflow: "auto" }}>
    <style>{CSS}</style>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "18px 44px", borderBottom: `1px solid ${T.b0}`, position: "sticky", top: 0, background: T.bg0, zIndex: 50, backdropFilter: "blur(12px)", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22, color: T.y, animation: "float 3s ease-in-out infinite", display: "inline-block" }}>B</span>
        <span style={{ fontFamily: "'Instrument Serif',serif", fontSize: isMobile ? 18 : 21, color: T.t0, fontWeight: 800, letterSpacing: "-.03em" }}>Board<span style={{ color: T.y }}>AI</span></span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onToggleTheme} style={{ background: T.bg3, border: `1px solid ${T.b1}`, color: T.t1, padding: isMobile ? "6px 10px" : "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: isMobile ? 12 : 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
          {themeMode === "dark" ? "Light" : "Dark"}
        </button>
        <button onClick={() => openAuth("login")} style={{ background: "transparent", border: `1px solid ${T.b1}`, color: T.t1, padding: isMobile ? "6px 10px" : "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: isMobile ? 12 : 13, fontFamily: "inherit", transition: "all .15s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.b2; e.currentTarget.style.color = T.t0; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.b1; e.currentTarget.style.color = T.t1; }}>Sign in</button>
        <button onClick={() => openAuth("register")} style={{ background: T.yBg, border: `1px solid ${T.yDim}`, color: T.y, padding: isMobile ? "6px 10px" : "8px 20px", borderRadius: 8, cursor: "pointer", fontSize: isMobile ? 12 : 13, fontFamily: "inherit", fontWeight: 600 }}>Get Started</button>
      </div>
    </header>

    <section style={{ textAlign: "center", padding: isMobile ? "52px 14px 40px" : "88px 20px 64px", maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "inline-block", background: T.yBg, border: `1px solid ${T.yDim}`, color: T.y, padding: "4px 14px", borderRadius: 99, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, letterSpacing: ".06em", marginBottom: 30 }}>AI-POWERED COLLABORATIVE WHITEBOARD</div>
      <h1 style={{ fontFamily: "'Instrument Serif',serif", fontSize: "clamp(40px,6vw,68px)", fontWeight: 800, color: T.t0, lineHeight: 1.07, letterSpacing: "-.04em", marginBottom: 22 }}>
        Your ideas,{" "}
        <span style={{ color: T.y, fontStyle: "italic" }}>beautifully organized</span>
        <br />and alive
      </h1>
      <p style={{ color: T.t1, fontSize: isMobile ? 14 : 16, lineHeight: 1.75, maxWidth: 560, margin: "0 auto 40px" }}>BoardAI is a real-time collaborative whiteboard powered by AI. Build mind maps, flowcharts, kanban boards — in seconds. Together.</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={() => openAuth("register")} style={{ background: T.y, color: "#0c1829", border: "none", padding: "14px 32px", borderRadius: 11, cursor: "pointer", fontSize: 15, fontFamily: "inherit", fontWeight: 700, boxShadow: "0 4px 24px rgba(250,204,21,.35)", transition: "transform .15s" }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>Start for free</button>
        <button onClick={() => openAuth("login")} style={{ background: "transparent", border: `1px solid ${T.b2}`, color: T.t0, padding: "14px 28px", borderRadius: 11, cursor: "pointer", fontSize: 15, fontFamily: "inherit" }}>Sign in</button>
      </div>
    </section>

    <section style={{ maxWidth: 1000, margin: "0 auto", padding: isMobile ? "0 12px 42px" : "0 24px 80px" }}>
      <div style={{ background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 20, padding: isMobile ? 14 : 28, boxShadow: "0 24px 80px rgba(0,0,0,.5)", position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
          {[{ bg: "#fef9c3", t: "#713f12", text: "Sticky notes & mind maps" }, { bg: "#dbeafe", t: "#1e3a8a", text: "Shapes & diagrams" }, { bg: "#dcfce7", t: "#14532d", text: "Templates library" }].map((c, i) => <div key={i} style={{ background: c.bg, color: c.t, padding: "18px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>{c.text}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
          {[{ bg: "#fce7f3", t: "#831843", text: "Kanban & roadmaps" }, { bg: "#ede9fe", t: "#4c1d95", text: "OKR & strategy boards" }, { bg: "#ffedd5", t: "#7c2d12", text: "Real-time collaboration" }].map((c, i) => <div key={i} style={{ background: c.bg, color: c.t, padding: "18px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>{c.text}</div>)}
        </div>
        <div style={{ position: "absolute", top: 14, right: 14, background: T.y, color: "#0c1829", padding: "4px 11px", borderRadius: 99, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>AI</div>
      </div>
    </section>

    <section style={{ maxWidth: 1000, margin: "0 auto", padding: isMobile ? "0 12px 56px" : "0 24px 88px" }}>
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <h2 style={{ fontFamily: "'Instrument Serif',serif", fontSize: "clamp(28px,4vw,42px)", color: T.t0, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 14 }}>Everything you need to think, plan, and build</h2>
        <p style={{ color: T.t1, fontSize: 15, lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>From solo ideation to team workshops — all in one collaborative canvas.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
        {features.map((f, i) => <div key={i} style={{ background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 16, padding: "26px 22px", transition: "border-color .2s" }} onMouseEnter={(e) => e.currentTarget.style.borderColor = T.b2} onMouseLeave={(e) => e.currentTarget.style.borderColor = T.b1}>
          <div style={{ fontSize: 30, marginBottom: 14 }}>{f.icon}</div>
          <h3 style={{ fontSize: 14.5, color: T.t0, fontWeight: 700, marginBottom: 9 }}>{f.title}</h3>
          <p style={{ fontSize: 12.5, color: T.t1, lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
        </div>)}
      </div>
    </section>

    <section style={{ textAlign: "center", padding: isMobile ? "46px 14px 56px" : "64px 20px 80px", background: T.bg1, borderTop: `1px solid ${T.b0}`, borderBottom: `1px solid ${T.b0}` }}>
      <h2 style={{ fontFamily: "'Instrument Serif',serif", fontSize: "clamp(26px,4vw,40px)", color: T.t0, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 14 }}>Ready to think on a <span style={{ color: T.y }}>bigger canvas</span>?</h2>
      <p style={{ color: T.t1, fontSize: 14, lineHeight: 1.7, marginBottom: 30, maxWidth: 420, margin: "0 auto 30px" }}>Join your team on BoardAI — free to start, powerful from day one.</p>
      <button onClick={() => openAuth("register")} style={{ background: T.y, color: "#0c1829", border: "none", padding: "14px 34px", borderRadius: 11, cursor: "pointer", fontSize: 15, fontFamily: "inherit", fontWeight: 700, boxShadow: "0 4px 24px rgba(250,204,21,.35)" }}>Get started free →</button>
    </section>

    <footer style={{ padding: isMobile ? "14px 12px" : "22px 44px", display: "flex", alignItems: "center", justifyContent: "space-between", color: T.t3, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 6 : 0 }}>
      <span>◈ BoardAI · 2026</span>
      <span>collaborative whiteboard platform</span>
    </footer>

    {showAuth && <AuthModal initTab={authTab} onClose={() => setShowAuth(false)} onSuccess={(u) => { setShowAuth(false); onLogin(u); }} T={T} useIsMobileHook={useIsMobileHook} api={api} />}
  </div>;
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

  return <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(8px)", padding: isMobile ? 12 : 0 }}
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.9, y: 20, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0.9, y: 20, opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
      style={{ background: T.bg1, border: `1px solid ${T.b2}`, borderRadius: 24, padding: isMobile ? "24px 20px" : "40px 44px", width: "100%", maxWidth: isMobile ? "100%" : 440, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 32px 100px rgba(0,0,0,.8)" }}
    >
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
    </motion.div>
  </motion.div>;
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

  return <div style={{ minHeight: "100vh", background: T.bg0, fontFamily: "'DM Sans',sans-serif", overflowX: "hidden", overflowY: "auto" }}>
    <style>{CSS}</style>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "20px 44px", borderBottom: `1px solid ${T.b0}`, position: "sticky", top: 0, background: `${T.bg0}dd`, zIndex: 50, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", gap: 8 }}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        style={{ display: "flex", alignItems: "center", gap: 12 }}
      >
        <motion.span
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          style={{ fontSize: 24, color: T.y, fontWeight: 900, textShadow: "0 0 10px rgba(250,204,21,0.3)" }}
        >
          B
        </motion.span>
        <span style={{ fontFamily: "'Instrument Serif',serif", fontSize: isMobile ? 19 : 24, color: T.t0, fontWeight: 800, letterSpacing: "-.03em" }}>Board<span style={{ color: T.y }}>AI</span></span>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        style={{ display: "flex", gap: 10 }}
      >
        {!isMobile && <button onClick={onToggleTheme} style={{ background: T.bg3, border: `1px solid ${T.b1}`, color: T.t1, padding: "8px 14px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
          {themeMode === "dark" ? "Light Mode" : "Dark Mode"}
        </button>}
        <button onClick={() => openAuth("login")} style={{ background: "transparent", border: `1px solid ${T.b1}`, color: T.t1, padding: isMobile ? "8px 14px" : "8px 22px", borderRadius: 10, cursor: "pointer", fontSize: isMobile ? 13 : 14, fontWeight: 500 }}>Sign in</button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => openAuth("register")}
          style={{ background: T.yBg, border: `2px solid ${T.yDim}`, color: T.y, padding: isMobile ? "8px 14px" : "8px 24px", borderRadius: 10, cursor: "pointer", fontSize: isMobile ? 13 : 14, fontWeight: 700 }}
        >
          Get Started
        </motion.button>
      </motion.div>
    </header>

    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      style={{ textAlign: "center", padding: isMobile ? "64px 14px 48px" : "110px 20px 80px", maxWidth: 960, margin: "0 auto" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        style={{ display: "inline-block", background: T.yBg, border: `1px solid ${T.yDim}`, color: T.y, padding: "6px 18px", borderRadius: 99, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, letterSpacing: ".1em", marginBottom: 32 }}
      >
        AI-POWERED COLLABORATIVE WHITEBOARD
      </motion.div>
      <h1 style={{ fontFamily: "'Instrument Serif',serif", fontSize: "clamp(44px,7vw,76px)", fontWeight: 800, color: T.t0, lineHeight: 1.05, letterSpacing: "-.04em", marginBottom: 26 }}>
        Your ideas,{" "}
        <span style={{ color: T.y, fontStyle: "italic" }}>beautifully organized</span>
        <br />and brought to life
      </h1>
      <p style={{ color: T.t1, fontSize: isMobile ? 16 : 18, lineHeight: 1.7, maxWidth: 620, margin: "0 auto 48px" }}>
        BoardAI is a real-time collaborative workspace where DeepSeek AI helps you map concepts, generate execution plans, and synthesize data instantly.
      </p>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: "0 10px 30px rgba(250,204,21,.4)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => openAuth("register")}
          style={{ background: T.y, color: "#0c1829", border: "none", padding: "16px 44px", borderRadius: 14, cursor: "pointer", fontSize: 16, fontWeight: 800, boxShadow: "0 4px 20px rgba(250,204,21,.25)" }}
        >
          Start for free
        </motion.button>
        <button onClick={() => openAuth("login")} style={{ background: "transparent", border: `2px solid ${T.b2}`, color: T.t0, padding: "16px 40px", borderRadius: 14, cursor: "pointer", fontSize: 16, fontWeight: 600 }}>Live Demo</button>
      </div>
    </motion.section>

    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      style={{ maxWidth: 1080, margin: "0 auto", padding: isMobile ? "0 12px 48px" : "0 24px 100px" }}
    >
      <div style={{ background: `linear-gradient(145deg, ${T.bg1}, ${T.bg2})`, border: `1px solid ${T.b1}`, borderRadius: 32, padding: isMobile ? "20px 16px" : "40px 48px", boxShadow: "0 40px 120px rgba(0,0,0,0.6)", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12, marginBottom: 12 }}>
          {[{ bg: "#fef9c3", t: "#713f12", text: "Sticky notes & mind maps" }, { bg: "#dbeafe", t: "#1e3a8a", text: "Shapes & diagrams" }, { bg: "#dcfce7", t: "#14532d", text: "Templates library" }].map((c, i) => <div key={i} style={{ background: c.bg, color: c.t, padding: "18px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>{c.text}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12 }}>
          {[{ bg: "#fce7f3", t: "#831843", text: "Kanban & roadmaps" }, { bg: "#ede9fe", t: "#4c1d95", text: "OKR & strategy boards" }, { bg: "#ffedd5", t: "#7c2d12", text: "Real-time collaboration" }].map((c, i) => <div key={i} style={{ background: c.bg, color: c.t, padding: "18px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>{c.text}</div>)}
        </div>
        <div style={{ position: "absolute", top: 14, right: 14, background: T.y, color: "#0c1829", padding: "4px 11px", borderRadius: 99, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>AI</div>
      </div>
    </motion.section>

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

    <footer style={{ padding: isMobile ? "24px 12px" : "40px 44px", borderTop: `1px solid ${T.b0}`, display: "flex", alignItems: "center", justifyContent: "space-between", color: T.t3, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
      <span>◈ BOARD AI · STUDIO EDITION 2026</span>
      <div style={{ display: "flex", gap: 24 }}>
        <span>Privacy</span>
        <span>Terms</span>
        <span>Twitter</span>
      </div>
    </footer>

    <AnimatePresence>
      {showAuth && (
        <AuthModal
          initTab={authTab}
          onClose={() => setShowAuth(false)}
          onSuccess={(u) => { setShowAuth(false); onLogin(u); }}
          T={T}
          useIsMobileHook={useIsMobileHook}
          api={api}
        />
      )}
    </AnimatePresence>
  </div>;
}

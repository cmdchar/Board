import { useRef, useState } from "react";

export default function FileZone({ onFile, loading, fn, summary, error, T }) {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  const [replace, setReplace] = useState(true);

  function read(file) {
    const r = new FileReader();
    r.onload = ev => onFile(ev.target.result, file.name, replace);
    r.readAsText(file, "UTF-8");
  }

  return <div style={{ borderBottom: `1px solid ${T.b0}`, padding: 10, background: T.bg1, flexShrink: 0 }}>
    <div style={{ fontSize: 9.5, fontWeight: 600, color: T.y, marginBottom: 8, fontFamily: "'JetBrains Mono',monospace", display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ animation: loading ? "spin 1s linear infinite" : "none", display: "inline-block" }}>✦</span> SPIDER WEB · FILE
    </div>
    <div
      onClick={() => !loading && ref.current?.click()}
      onDrop={e => { e.preventDefault(); setDrag(false); if (!loading && e.dataTransfer.files[0]) read(e.dataTransfer.files[0]); }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      style={{ border: `1.5px dashed ${drag || loading ? T.y : T.b1}`, borderRadius: 9, padding: "11px 8px", cursor: loading ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: drag || loading ? T.yBg : "transparent", transition: "all .2s", minHeight: 70 }}
    >
      <input
        ref={ref}
        type="file"
        accept=".md,.txt,.csv,.json,.ts,.tsx,.js,.jsx,.html,.py,.yaml,.yml"
        onChange={e => { if (e.target.files?.[0]) read(e.target.files[0]); e.target.value = ""; }}
        style={{ display: "none" }}
      />
      {loading ? <>
        <div style={{ width: 18, height: 18, border: `2.5px solid ${T.yDim}`, borderTopColor: T.y, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        <span style={{ fontSize: 11, color: T.y, fontFamily: "'JetBrains Mono',monospace" }}>Analyzing...</span>
      </> : summary ? <>
        <span style={{ color: T.green, fontSize: 15 }}>✓</span>
        <span style={{ fontSize: 10.5, color: T.green, fontFamily: "'JetBrains Mono',monospace" }}>{fn?.slice(0, 22)}</span>
      </> : <>
        <span style={{ fontSize: 18 }}>📄</span>
        <span style={{ fontSize: 11.5, color: T.t1, fontWeight: 500 }}>Drop file or click</span>
        <span style={{ fontSize: 10, color: T.t2 }}>.md .txt .json .ts .py</span>
      </>}
    </div>
    {error && <div style={{ marginTop: 6, background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", color: "#fca5a5", fontSize: 11, padding: "5px 8px", borderRadius: 5, lineHeight: 1.5 }}>⚠ {error}</div>}
    {summary && <div style={{ marginTop: 6, background: "rgba(34,197,94,.07)", border: "1px solid rgba(34,197,94,.2)", color: "#86efac", fontSize: 11, padding: "5px 8px", borderRadius: 5, lineHeight: 1.5 }}>✦ {summary}</div>}
    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 10, color: T.t2, userSelect: "none", marginTop: 6 }}>
      <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />
      <span>Replace canvas</span>
    </label>
  </div>;
}


import { useEffect, useRef, useState } from "react";

export default function TimerWidget({ T }) {
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [preset, setPreset] = useState(300);
  const [remaining, setRemaining] = useState(300);
  const [visible, setVisible] = useState(false);
  const iv = useRef(null);

  useEffect(() => {
    if (running && remaining > 0) {
      iv.current = setInterval(() => setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          return 0;
        }
        return r - 1;
      }), 1000);
    }
    return () => clearInterval(iv.current);
  }, [running]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const pct = remaining / preset;
  const r = 22,
    circ = 2 * Math.PI * r;

  if (!visible)
    return (
      <button onClick={() => setVisible(true)} style={{ position: "absolute", top: 14, right: 20, background: T.bg2, border: `1px solid ${T.b1}`, color: T.t1, width: 36, height: 36, borderRadius: 8, cursor: "pointer", fontSize: 11, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
        TMR
      </button>
    );

  return (
    <div className="slide" style={{ position: "absolute", top: 14, right: 20, background: T.bg2, border: `1px solid ${running ? T.yDim : T.b1}`, borderRadius: 14, padding: "12px 16px", zIndex: 100, display: "flex", alignItems: "center", gap: 12, boxShadow: running ? "0 0 20px rgba(250,204,21,.15)" : "none", transition: "all .3s" }}>
      <svg width={52} height={52} style={{ animation: remaining < 30 && running ? "timerPulse .5s infinite" : "none" }}>
        <circle cx={26} cy={26} r={r} fill="none" stroke={T.b1} strokeWidth={3} />
        <circle cx={26} cy={26} r={r} fill="none" stroke={remaining < 30 ? T.red : T.y} strokeWidth={3} strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round" transform="rotate(-90 26 26)" style={{ transition: "stroke-dashoffset .5s,stroke .3s" }} />
        <text x={26} y={31} textAnchor="middle" fill={remaining < 30 ? T.red : T.y} fontSize={11} fontFamily="'JetBrains Mono',monospace" fontWeight={600}>
          {mm}:{ss}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[[60, "1m"], [180, "3m"], [300, "5m"], [600, "10m"]].map(([s, l]) => (
            <button key={s} onClick={() => { setPreset(s); setRemaining(s); setRunning(false); }} style={{ background: preset === s ? T.yBg : T.bg3, border: `1px solid ${preset === s ? T.yDim : T.b1}`, color: preset === s ? T.y : T.t1, padding: "2px 7px", borderRadius: 5, fontSize: 10, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setRunning((r) => !r)} style={{ background: running ? T.yBg : T.bg3, border: `1px solid ${running ? T.yDim : T.b1}`, color: running ? T.y : T.t0, padding: "4px 14px", borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
            {running ? "Pause" : "Start"}
          </button>
          <button onClick={() => { setRunning(false); setRemaining(preset); }} style={{ background: T.bg3, border: `1px solid ${T.b1}`, color: T.t1, padding: "4px 10px", borderRadius: 7, fontSize: 12, cursor: "pointer" }}>
            Reset
          </button>
          <button onClick={() => { setRunning(false); setVisible(false); }} style={{ background: "transparent", border: "none", color: T.t2, fontSize: 14, cursor: "pointer" }}>
            x
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CanvasHud({
  commentInput,
  setCommentInput,
  cmtRef,
  d,
  uid,
  ME,
  autoReturnToSelect,
  T,
  zoom,
  wRef,
  presentMode = false,
  colorInputBgValue,
  bgColor,
  snapGrid = false,
  GRID,
  visibleNodes = [],
  arrows = [],
  tool = "select",
  arrowFrom = "",
  sel = [],
  depMode = false,
}) {
  return (
    <>
      {/* COMMENT INPUT */}
      {commentInput && (
        <div className="pop" style={{ position: "absolute", left: commentInput.sx, top: commentInput.sy + 14, background: T.bg2, border: `1px solid ${T.yDim}`, borderRadius: 10, padding: 12, zIndex: 999, width: 220, boxShadow: "0 8px 32px rgba(0,0,0,.6)" }}>
          <textarea ref={cmtRef} autoFocus placeholder="Scrie comentariul…" rows={3} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 7, padding: "7px 9px", fontSize: 12, fontFamily: "inherit", resize: "none", outline: "none", color: T.t0, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button onClick={() => setCommentInput(null)} style={{ background: "transparent", border: `1px solid ${T.b1}`, color: T.t1, padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
              Anuleaza
            </button>
            <button
              onClick={() => {
                if (cmtRef.current?.value) {
                  d({
                    type: "ADD_COMMENT",
                    c: { id: uid(), x: commentInput.x, y: commentInput.y, nodeId: commentInput.nodeId || null, text: cmtRef.current.value, author: ME.name, ts: Date.now(), replies: [] },
                  });
                  if (autoReturnToSelect) d({ type: "EXIT_ADD_MODE" });
                  setCommentInput(null);
                }
              }}
              style={{ background: T.yBg, border: `1px solid ${T.yDim}`, color: T.y, padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
            >
              Adauga
            </button>
          </div>
        </div>
      )}

      {/* ZOOM */}
      <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.5)", zIndex: 50 }}>
        {[["-", () => d({ type: "ZOOM", v: zoom * 0.8 })], null, ["+", () => d({ type: "ZOOM", v: zoom * 1.25 })], ["1x", () => { d({ type: "ZOOM", v: 1 }); d({ type: "PAN", x: 0, y: 0 }); }], ["Fit", () => { const r = wRef.current; d({ type: "ZOOM_FIT", vw: r.offsetWidth, vh: r.offsetHeight }); }]].map((it, i) =>
          it === null ? (
            <span key="p" style={{ padding: "0 12px", fontSize: 11, color: T.t1, fontFamily: "'JetBrains Mono',monospace", minWidth: 52, textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
          ) : (
            <button key={i} onClick={it[1]} title={i === 4 ? "Fit all (Ctrl+Shift+H)" : undefined} style={{ background: "transparent", border: "none", width: 34, height: 32, cursor: "pointer", fontSize: 14, color: T.t1, fontFamily: "inherit" }} onMouseEnter={(e) => (e.target.style.color = T.y)} onMouseLeave={(e) => (e.target.style.color = T.t1)}>
              {it[0]}
            </button>
          ),
        )}
      </div>

      {/* BACKGROUND COLOR PICKER */}
      {!presentMode && (
        <div style={{ position: "absolute", bottom: 20, left: 20, zIndex: 50, display: "flex", alignItems: "center", gap: 4, background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 8, padding: "3px 6px" }}>
          <span style={{ fontSize: 9, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>BG</span>
          <input type="color" value={colorInputBgValue} onChange={(e) => d({ type: "SET_BG", v: e.target.value })} title="Canvas background color" style={{ width: 20, height: 20, borderRadius: 4, cursor: "pointer", border: `1px solid ${T.b0}`, background: "none", padding: 0 }} />
          {bgColor && (
            <button onClick={() => d({ type: "SET_BG", v: null })} title="Reset background" style={{ background: "transparent", border: "none", color: T.t2, fontSize: 11, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>
              x
            </button>
          )}
        </div>
      )}

      {/* SNAP INDICATOR */}
      {snapGrid && (
        <div style={{ position: "absolute", bottom: 20, right: 84, background: T.yBg, border: `1px solid ${T.yDim}`, color: T.y, padding: "4px 10px", borderRadius: 99, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", zIndex: 50 }}>
          SNAP {GRID}px
        </div>
      )}

      {/* STATS */}
      {visibleNodes.length > 0 && (
        <div style={{ position: "absolute", bottom: 20, right: 20, background: T.bg2, border: `1px solid ${T.b0}`, color: T.t2, padding: "4px 10px", borderRadius: 20, fontSize: 10, fontFamily: "'JetBrains Mono',monospace", zIndex: 50 }}>
          {visibleNodes.length}n · {arrows.length}c
        </div>
      )}

      {tool === "laser" && <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.35)", color: "#fca5a5", padding: "7px 16px", borderRadius: 20, fontSize: 12, pointerEvents: "none", fontFamily: "'JetBrains Mono',monospace" }}>LASER pointer: move to highlight</div>}
      {tool === "eraser" && <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: T.bg2, border: `1px solid ${T.b2}`, color: T.t1, padding: "7px 16px", borderRadius: 20, fontSize: 12, pointerEvents: "none", fontFamily: "'JetBrains Mono',monospace" }}>ERASER: click/drag to erase drawings</div>}
      {tool === "arrow" && <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: T.bg2, border: `1px solid ${T.yDim}`, color: T.y, padding: "7px 16px", borderRadius: 20, fontSize: 12, pointerEvents: "none", fontFamily: "'JetBrains Mono',monospace" }}>{arrowFrom ? "Click destination" : "Click source"}</div>}
      {tool === "vote" && <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: T.yBg, border: `1px solid ${T.yDim}`, color: T.y, padding: "7px 16px", borderRadius: 20, fontSize: 12, pointerEvents: "none", fontFamily: "'JetBrains Mono',monospace" }}>VOTE mode: click any node</div>}
      {tool === "draw" && <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: T.bg2, border: `1px solid ${T.b2}`, color: T.t1, padding: "7px 16px", borderRadius: 20, fontSize: 12, pointerEvents: "none", fontFamily: "'JetBrains Mono',monospace" }}>DRAW freehand</div>}
      {tool === "select" && sel.length === 1 && <div style={{ position: "absolute", top: 16, right: 20, background: T.bg2, border: `1px solid ${T.b1}`, color: T.t1, padding: "6px 10px", borderRadius: 99, fontSize: 10.5, pointerEvents: "none", fontFamily: "'JetBrains Mono',monospace" }}>Tab child · Enter sibling</div>}
      {depMode && <div style={{ position: "absolute", top: 16, left: 20, background: "rgba(59,130,246,.08)", border: "1px solid rgba(96,165,250,.35)", color: "#93c5fd", padding: "6px 10px", borderRadius: 99, fontSize: 10.5, pointerEvents: "none", fontFamily: "'JetBrains Mono',monospace" }}>DEP MODE · blue upstream · green downstream</div>}
    </>
  );
}

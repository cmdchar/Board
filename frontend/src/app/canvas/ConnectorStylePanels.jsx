import MobileBottomSheet from "../../components/MobileBottomSheet";

export default function ConnectorStylePanels({
  isMobile = false,
  selectedArrow,
  mobileCtxMenu,
  connectorById,
  normalizeConnectorJumpStyle,
  getConnectorDependencyType,
  dataConnectorIdSet,
  isDataConnector,
  dataConnectorPreviewById,
  dataConnectorErrorById,
  T,
  updateConnector,
  formatNumber,
  dependencyTypeLabel,
  cycleCap,
  d,
  reverseConnector,
  setSelectedArrow,
  setConnectorStyleAsDefault,
  resetConnectorStyleDefault,
  rememberLastConnectorStyle,
  setRememberLastConnectorStyle,
  zoom,
  px,
  py,
}) {
  return (
    <>
      {/* MOBILE CONNECTOR EDITOR */}
      {isMobile &&
        selectedArrow &&
        !mobileCtxMenu &&
        (() => {
          const conn = connectorById[selectedArrow];
          if (!conn) return null;
          const ar = conn.source;
          const style = conn.style;
          const jumpStyle = normalizeConnectorJumpStyle(ar.jumpStyle, "auto");
          const depType = getConnectorDependencyType(ar);
          const isDataFlowConnector = dataConnectorIdSet.has(selectedArrow) || isDataConnector(ar);
          const dataPreview = isDataFlowConnector ? dataConnectorPreviewById[selectedArrow] || null : null;
          const dataError = isDataFlowConnector ? String(dataConnectorErrorById[selectedArrow] || "").trim() : "";
          const ACOLS = ["#475569", "#64748b", T.y, T.blue, T.green, T.red, T.purple, T.teal];
          const setStyle = (patch) => updateConnector(ar, { style: patch });
          return (
            <MobileBottomSheet open title="Connector Style" subtitle={`Routing: ${conn.routing}`} onClose={() => setSelectedArrow(null)} T={T} zIndex={370} snapPoints={[0.32, 0.62, 0.92]}>
              <div style={{ padding: "10px", display: "grid", gap: 10 }}>
                {isDataFlowConnector && (
                  <div style={{ display: "grid", gap: 6, padding: "8px", border: `1px solid ${dataError ? T.red : T.b1}`, borderRadius: 10, background: T.bg1 }}>
                    <div style={{ fontSize: 10.5, color: dataError ? T.red : T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>DATA FLOW {dataError ? `- ${dataError}` : ""}</div>
                    {dataPreview && (
                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontSize: 11, color: T.t1 }}>{String(dataPreview.summary || "No output")}</div>
                        {dataPreview.kind === "number" && (
                          <div style={{ fontSize: 12, color: "#67e8f9", fontFamily: "'JetBrains Mono',monospace" }}>
                            {String(dataPreview.label || "value")}: {formatNumber(dataPreview.value)}
                          </div>
                        )}
                        {Array.isArray(dataPreview.columns) && dataPreview.columns.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{dataPreview.columns.slice(0, 6).map((col, idx) => <span key={`${selectedArrow}_m_col_${idx}`} style={{ fontSize: 10, color: T.t2, border: `1px solid ${T.b0}`, borderRadius: 999, padding: "2px 6px" }}>{col}</span>)}</div>}
                        {Array.isArray(dataPreview.rows) && dataPreview.rows.length > 0 && (
                          <div style={{ display: "grid", gap: 3, maxHeight: 120, overflowY: "auto" }}>
                            {dataPreview.rows.slice(0, 4).map((row, idx) => (
                              <div key={`${selectedArrow}_m_row_${idx}`} style={{ fontSize: 10, color: T.t1, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {Array.isArray(row) ? row.join(" | ") : String(row)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>Routing</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6 }}>
                    {[["-", "straight"], ["L", "ortho"], ["~", "curved"], ["w", "wavy"]].map(([ic, rt]) => (
                      <button key={rt} onClick={() => updateConnector(ar, { routing: rt })} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${conn.routing === rt ? T.yDim : T.b1}`, background: conn.routing === rt ? T.yBg : T.bg2, color: conn.routing === rt ? T.y : T.t0, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700 }}>
                        {ic} {rt}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>Dependency</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6 }}>
                    {[["", "None"], ["depends_on", "Depends"], ["blocks", "Blocks"], ["related", "Related"]].map(([tp, lbl]) => (
                      <button key={tp || "none"} onClick={() => (tp ? updateConnector(ar, { depType: tp, label: dependencyTypeLabel(tp) }) : updateConnector(ar, { depType: null, label: "" }))} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${depType === tp ? T.yDim : T.b1}`, background: depType === tp ? T.yBg : T.bg2, color: depType === tp ? T.y : T.t0, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>Color</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ACOLS.map((c) => (
                      <button key={c} onClick={() => setStyle({ stroke: c })} style={{ width: 32, height: 32, borderRadius: 99, border: `2px solid ${style.stroke === c ? T.y : T.b1}`, background: c, cursor: "pointer" }} />
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>Dash & Width</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6 }}>
                    {["solid", "dashed", "dotted"].map((st) => (
                      <button key={st} onClick={() => setStyle({ dash: st })} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${style.dash === st ? T.yDim : T.b1}`, background: style.dash === st ? T.yBg : T.bg2, color: style.dash === st ? T.y : T.t0, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                        {st}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((w) => (
                      <button key={w} onClick={() => setStyle({ width: w })} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${Math.round(style.width) === w ? T.yDim : T.b1}`, background: Math.round(style.width) === w ? T.yBg : T.bg2, color: Math.round(style.width) === w ? T.y : T.t0, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                        {w}px
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>Caps</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 6 }}>
                    <button onClick={() => setStyle({ startCap: cycleCap(style.startCap) })} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                      Start: {style.startCap}
                    </button>
                    <button onClick={() => setStyle({ endCap: cycleCap(style.endCap) })} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                      End: {style.endCap}
                    </button>
                  </div>
                </div>

                {(conn.routing === "ortho" || conn.routing === "straight") && (
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>Line Jumps</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6 }}>
                      {["auto", "on", "off"].map((mode) => (
                        <button key={mode} onClick={() => updateConnector(ar, { jumpStyle: mode })} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${jumpStyle === mode ? T.yDim : T.b1}`, background: jumpStyle === mode ? T.yBg : T.bg2, color: jumpStyle === mode ? T.y : T.t0, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 6 }}>
                  <button onClick={() => d({ type: "UPD_ARR", id: selectedArrow, p: reverseConnector(ar) })} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                    Reverse
                  </button>
                  <button onClick={() => setConnectorStyleAsDefault(ar)} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                    Set Default
                  </button>
                  <button onClick={resetConnectorStyleDefault} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t1, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                    Reset Default
                  </button>
                  <button onClick={() => setRememberLastConnectorStyle((v) => !v)} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${rememberLastConnectorStyle ? T.yDim : T.b1}`, background: rememberLastConnectorStyle ? T.yBg : T.bg2, color: rememberLastConnectorStyle ? T.y : T.t0, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                    Remember Last: {rememberLastConnectorStyle ? "ON" : "OFF"}
                  </button>
                </div>

                <button onClick={() => { d({ type: "DEL_ARR", id: selectedArrow }); setSelectedArrow(null); }} style={{ minHeight: 44, borderRadius: 10, border: `1px solid ${T.red}`, background: "transparent", color: T.red, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700 }}>
                  Delete Connector
                </button>
              </div>
            </MobileBottomSheet>
          );
        })()}

      {/* ARROW STYLE PANEL */}
      {selectedArrow &&
        !isMobile &&
        (() => {
          const conn = connectorById[selectedArrow];
          if (!conn) return null;
          const ar = conn.source;
          const mx = conn.mid.x * zoom + px;
          const my = conn.mid.y * zoom + py;
          const style = conn.style;
          const jumpStyle = normalizeConnectorJumpStyle(ar.jumpStyle, "auto");
          const depType = getConnectorDependencyType(ar);
          const isDataFlowConnector = dataConnectorIdSet.has(selectedArrow) || isDataConnector(ar);
          const dataPreview = isDataFlowConnector ? dataConnectorPreviewById[selectedArrow] || null : null;
          const dataError = isDataFlowConnector ? String(dataConnectorErrorById[selectedArrow] || "").trim() : "";
          const setStyle = (patch) => updateConnector(ar, { style: patch });
          const ACOLS = ["#475569", "#64748b", T.y, T.blue, T.green, T.red, T.purple, T.teal];
          return (
            <div key="asp" className="pop" style={{ position: "absolute", left: mx, top: Math.max(60, my - 54), transform: "translateX(-50%)", zIndex: 400, background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 10, padding: "8px 9px", display: "flex", flexDirection: "column", gap: 7, alignItems: "stretch", boxShadow: "0 4px 20px rgba(0,0,0,.6)", pointerEvents: "auto", minWidth: 262 }}>
              {isDataFlowConnector && (
                <div style={{ display: "grid", gap: 5, padding: "6px 7px", border: `1px solid ${dataError ? T.red : T.b1}`, borderRadius: 8, background: T.bg1 }}>
                  <div style={{ fontSize: 9.5, color: dataError ? T.red : T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>DATA FLOW {dataError ? `- ${dataError}` : ""}</div>
                  {dataPreview && (
                    <div style={{ display: "grid", gap: 3 }}>
                      <div style={{ fontSize: 10.5, color: T.t1 }}>{String(dataPreview.summary || "No output")}</div>
                      {dataPreview.kind === "number" && (
                        <div style={{ fontSize: 10.5, color: "#67e8f9", fontFamily: "'JetBrains Mono',monospace" }}>
                          {String(dataPreview.label || "value")}: {formatNumber(dataPreview.value)}
                        </div>
                      )}
                      {Array.isArray(dataPreview.columns) && dataPreview.columns.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{dataPreview.columns.slice(0, 5).map((col, idx) => <span key={`${selectedArrow}_d_col_${idx}`} style={{ fontSize: 9, color: T.t2, border: `1px solid ${T.b0}`, borderRadius: 999, padding: "1px 5px" }}>{col}</span>)}</div>}
                      {Array.isArray(dataPreview.rows) && dataPreview.rows.length > 0 && (
                        <div style={{ display: "grid", gap: 2, maxHeight: 72, overflowY: "auto" }}>
                          {dataPreview.rows.slice(0, 3).map((row, idx) => (
                            <div key={`${selectedArrow}_d_row_${idx}`} style={{ fontSize: 9.2, color: T.t1, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {Array.isArray(row) ? row.join(" | ") : String(row)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                {[["", "None"], ["depends_on", "Depends"], ["blocks", "Blocks"], ["related", "Related"]].map(([tp, lbl]) => <button key={tp || "none"} onClick={() => (tp ? updateConnector(ar, { depType: tp, label: dependencyTypeLabel(tp) }) : updateConnector(ar, { depType: null, label: "" }))} style={{ height: 22, padding: "0 7px", background: depType === tp ? T.yBg : T.bg3, border: `1px solid ${depType === tp ? T.yDim : T.b0}`, color: depType === tp ? T.y : T.t1, borderRadius: 4, cursor: "pointer", fontSize: 9, fontFamily: "'JetBrains Mono',monospace" }}>{lbl}</button>)}
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                {ACOLS.map((c) => <div key={c} onClick={() => setStyle({ stroke: c })} style={{ width: 14, height: 14, borderRadius: "50%", background: c, border: `2px solid ${style.stroke === c ? T.y : "rgba(255,255,255,.12)"}`, cursor: "pointer", flexShrink: 0 }} />)}
                <div style={{ width: 1, height: 18, background: T.b0, margin: "0 3px" }} />
                {["solid", "dashed", "dotted"].map((st) => <button key={st} onClick={() => setStyle({ dash: st })} style={{ height: 22, padding: "0 7px", background: style.dash === st ? T.yBg : T.bg3, border: `1px solid ${style.dash === st ? T.yDim : T.b0}`, color: style.dash === st ? T.y : T.t1, borderRadius: 4, cursor: "pointer", fontSize: 9, fontFamily: "'JetBrains Mono',monospace" }}>{st}</button>)}
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                {[1, 2, 3, 4, 5].map((w) => <button key={w} onClick={() => setStyle({ width: w })} style={{ width: 22, height: 22, background: Math.round(style.width) === w ? T.yBg : T.bg3, border: `1px solid ${Math.round(style.width) === w ? T.yDim : T.b0}`, color: Math.round(style.width) === w ? T.y : T.t1, borderRadius: 4, cursor: "pointer", fontSize: 9, fontFamily: "'JetBrains Mono',monospace" }}>{w}</button>)}
                <div style={{ width: 1, height: 18, background: T.b0, margin: "0 3px" }} />
                {[["-", "straight"], ["L", "ortho"], ["~", "curved"], ["w", "wavy"]].map(([ic, rt]) => <button key={rt} onClick={() => updateConnector(ar, { routing: rt })} title={rt} style={{ width: 24, height: 22, background: conn.routing === rt ? T.yBg : T.bg3, border: `1px solid ${conn.routing === rt ? T.yDim : T.b0}`, color: conn.routing === rt ? T.y : T.t1, borderRadius: 4, cursor: "pointer", fontSize: 11 }}>{ic}</button>)}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>
                <button onClick={() => setStyle({ startCap: cycleCap(style.startCap) })} title="Cycle start cap" style={{ height: 22, padding: "0 6px", background: T.bg3, border: `1px solid ${T.b0}`, color: T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10 }}>
                  Start:{style.startCap}
                </button>
                <button onClick={() => setStyle({ endCap: cycleCap(style.endCap) })} title="Cycle end cap" style={{ height: 22, padding: "0 6px", background: T.bg3, border: `1px solid ${T.b0}`, color: T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10 }}>
                  End:{style.endCap}
                </button>
                <button onClick={() => d({ type: "UPD_ARR", id: selectedArrow, p: reverseConnector(ar) })} title="Reverse direction" style={{ height: 22, padding: "0 7px", background: T.bg3, border: `1px solid ${T.b0}`, color: T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10 }}>
                  &lt;&gt;
                </button>
                <button onClick={() => { d({ type: "DEL_ARR", id: selectedArrow }); setSelectedArrow(null); }} style={{ height: 22, padding: "0 7px", background: "transparent", border: `1px solid rgba(239,68,68,.3)`, color: T.red, borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
                  x
                </button>
              </div>
              {(conn.routing === "ortho" || conn.routing === "straight") && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>
                  <span style={{ minWidth: 84 }}>Line jumps</span>
                  {["auto", "on", "off"].map((mode) => <button key={mode} onClick={() => updateConnector(ar, { jumpStyle: mode })} style={{ height: 22, padding: "0 7px", background: jumpStyle === mode ? T.yBg : T.bg3, border: `1px solid ${jumpStyle === mode ? T.yDim : T.b0}`, color: jumpStyle === mode ? T.y : T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10 }}>{mode}</button>)}
                  {conn.jumpCount > 0 && <span style={{ marginLeft: "auto", fontSize: 9, color: T.t2 }}>{conn.jumpCount} jumps</span>}
                </div>
              )}
              {conn.routing === "ortho" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: T.t2 }}>
                  <span style={{ minWidth: 84, fontFamily: "'JetBrains Mono',monospace" }}>Corner radius</span>
                  <input type="range" min={0} max={36} value={Math.round(style.cornerRadius)} onChange={(e) => setStyle({ cornerRadius: Number(e.target.value) || 0 })} style={{ flex: 1 }} />
                  <span style={{ width: 26, textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{Math.round(style.cornerRadius)}</span>
                </div>
              )}
              {conn.routing === "wavy" && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: T.t2 }}>
                    <span style={{ minWidth: 84, fontFamily: "'JetBrains Mono',monospace" }}>Wave amp</span>
                    <input type="range" min={2} max={36} value={Math.round(style.waveAmplitude)} onChange={(e) => setStyle({ waveAmplitude: Number(e.target.value) || 0 })} style={{ flex: 1 }} />
                    <span style={{ width: 26, textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{Math.round(style.waveAmplitude)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: T.t2 }}>
                    <span style={{ minWidth: 84, fontFamily: "'JetBrains Mono',monospace" }}>Wave len</span>
                    <input type="range" min={10} max={120} value={Math.round(style.waveLength)} onChange={(e) => setStyle({ waveLength: Number(e.target.value) || 0 })} style={{ flex: 1 }} />
                    <span style={{ width: 26, textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{Math.round(style.waveLength)}</span>
                  </div>
                </>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={rememberLastConnectorStyle} onChange={(e) => setRememberLastConnectorStyle(e.target.checked)} />
                  Remember last style
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setConnectorStyleAsDefault(ar)} style={{ height: 22, padding: "0 8px", background: T.bg3, border: `1px solid ${T.b0}`, color: T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10 }}>
                    Set default
                  </button>
                  <button onClick={resetConnectorStyleDefault} style={{ height: 22, padding: "0 8px", background: "transparent", border: `1px solid ${T.b0}`, color: T.t2, borderRadius: 4, cursor: "pointer", fontSize: 10 }}>
                    Reset
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}

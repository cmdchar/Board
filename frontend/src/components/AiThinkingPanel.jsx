const ACTION_BUTTONS = [
  { id: "board", label: "Generate Board", run: "runBoardGeneration" },
  { id: "flow", label: "Generate Flow", run: "runFlowGeneration" },
  { id: "expand", label: "Expand Ideas", run: "runIdeaExpansion", needsSelection: 1 },
  { id: "structure", label: "Organize Structure", run: "runStructureBuilder", needsSelection: 2 },
  { id: "decision", label: "Decision Helper", run: "runDecisionHelper", needsSelection: 2 },
  { id: "summary", label: "Summarize", run: "runSummary" },
];

function DecisionBlock({ title, items, T }) {
  if (!Array.isArray(items) || !items.length) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", marginBottom: 4, letterSpacing: ".05em" }}>{title}</div>
      <ul style={{ margin: 0, padding: "0 0 0 14px", color: T.t1, fontSize: 11.5, lineHeight: 1.45 }}>
        {items.map((item, idx) => <li key={`${title}-${idx}`}>{item}</li>)}
      </ul>
    </div>
  );
}

export default function AiThinkingPanel({ T, thinking }) {
  const {
    prompt,
    setPrompt,
    loading,
    error,
    preview,
    lastRun,
    replaceOnInsert,
    setReplaceOnInsert,
    selectedCount,
    smartSuggestions,
    examplePrompts,
    runBoardGeneration,
    runFlowGeneration,
    runIdeaExpansion,
    runStructureBuilder,
    runDecisionHelper,
    runSummary,
    runSuggestion,
    commitPreview,
    clearPreview,
  } = thinking;

  const runners = {
    runBoardGeneration,
    runFlowGeneration,
    runIdeaExpansion,
    runStructureBuilder,
    runDecisionHelper,
    runSummary,
  };

  return <div style={{ padding: "10px 12px 12px", borderBottom: `1px solid ${T.b0}`, display: "flex", flexDirection: "column", gap: 8, background: T.bg1 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.y, letterSpacing: ".06em", fontWeight: 700 }}>AI THINKING ENGINE</div>
      <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>Selected: {selectedCount}</div>
    </div>

    <textarea
      value={prompt}
      onChange={e => setPrompt(e.target.value)}
      placeholder="Ask the board..."
      rows={3}
      style={{
        width: "100%",
        resize: "vertical",
        minHeight: 72,
        background: T.bg3,
        border: `1px solid ${T.b1}`,
        borderRadius: 10,
        padding: "8px 10px",
        color: T.t0,
        outline: "none",
        fontSize: 12,
        lineHeight: 1.45,
      }}
      onFocus={e => (e.target.style.borderColor = T.yDim)}
      onBlur={e => (e.target.style.borderColor = T.b1)}
    />

    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {(examplePrompts || []).slice(0, 4).map(sample => (
        <button
          key={sample}
          onClick={() => setPrompt(sample)}
          style={{
            minHeight: 34,
            borderRadius: 8,
            border: `1px solid ${T.b1}`,
            background: T.bg3,
            color: T.t1,
            padding: "0 10px",
            fontSize: 10.5,
            cursor: "pointer",
            lineHeight: 1.2,
          }}
        >
          {sample}
        </button>
      ))}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {ACTION_BUTTONS.map(action => {
        const disabledBySelection = action.needsSelection && selectedCount < action.needsSelection;
        const disabled = loading || disabledBySelection;
        const run = runners[action.run];
        return (
          <button
            key={action.id}
            onClick={run}
            disabled={disabled}
            style={{
              minHeight: 38,
              borderRadius: 9,
              border: `1px solid ${disabled ? T.b1 : T.yDim}`,
              background: disabled ? T.bg3 : T.yBg,
              color: disabled ? T.t2 : T.y,
              padding: "0 8px",
              fontSize: 11,
              cursor: disabled ? "not-allowed" : "pointer",
              fontFamily: "'JetBrains Mono',monospace",
              fontWeight: 600,
            }}
            title={disabledBySelection ? `Needs ${action.needsSelection} selected node(s)` : action.label}
          >
            {action.label}
          </button>
        );
      })}
    </div>

    {(smartSuggestions || []).length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".05em" }}>SMART SUGGESTIONS</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {smartSuggestions.map(suggestion => (
          <button
            key={suggestion.id}
            onClick={() => runSuggestion(suggestion)}
            disabled={loading}
            title={suggestion.reason || suggestion.label}
            style={{
              minHeight: 34,
              borderRadius: 8,
              border: `1px solid ${T.b1}`,
              background: T.bg2,
              color: T.t1,
              padding: "0 10px",
              fontSize: 10.5,
              cursor: loading ? "not-allowed" : "pointer",
              lineHeight: 1.2,
            }}
          >
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>}

    {loading && <div style={{ borderRadius: 9, border: `1px solid ${T.yDim}`, background: T.yBg, color: T.y, padding: "8px 10px", fontSize: 11.5 }}>Thinking with board context...</div>}
    {error && <div style={{ borderRadius: 9, border: `1px solid ${T.red}`, background: T.bg3, color: T.red, padding: "8px 10px", fontSize: 11.5 }}>{error}</div>}

    {preview && <div style={{ borderRadius: 10, border: `1px solid ${T.b1}`, background: T.bg2, padding: "10px 10px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <div style={{ fontSize: 12, color: T.t0, fontWeight: 700 }}>{preview.title || "AI Preview"}</div>
        <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>{preview.intent || "preview"}</div>
      </div>
      {preview.summary && <div style={{ color: T.t1, fontSize: 11.5, lineHeight: 1.5 }}>{preview.summary}</div>}

      {!!preview.nodes?.length && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div style={{ fontSize: 10.5, color: T.t2 }}>Nodes: <b style={{ color: T.t0 }}>{preview.nodes.length}</b></div>
        <div style={{ fontSize: 10.5, color: T.t2 }}>Connectors: <b style={{ color: T.t0 }}>{preview.arrows?.length || 0}</b></div>
      </div>}

      {!!preview.nodes?.length && <div style={{ maxHeight: 120, overflowY: "auto", border: `1px solid ${T.b0}`, borderRadius: 8, background: T.bg1, padding: "6px 8px" }}>
        {preview.nodes.slice(0, 8).map(node => <div key={node.id} style={{ fontSize: 11, color: T.t1, padding: "3px 0", borderBottom: `1px dashed ${T.b0}` }}>{node.text || `(${node.type})`}</div>)}
      </div>}

      <div>
        <DecisionBlock title="PROS" items={preview.decision?.pros} T={T} />
        <DecisionBlock title="CONS" items={preview.decision?.cons} T={T} />
        <DecisionBlock title="RISKS" items={preview.decision?.risks} T={T} />
        {preview.decision?.recommendation && <div style={{ fontSize: 11.5, color: T.t1, lineHeight: 1.5 }}><b style={{ color: T.t0 }}>Recommendation:</b> {preview.decision.recommendation}</div>}
      </div>

      {!!preview.nodes?.length && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: T.t2 }}>
        <input type="checkbox" checked={replaceOnInsert} onChange={e => setReplaceOnInsert(e.target.checked)} />
        <span>Replace canvas on insert</span>
      </label>}

      <div style={{ display: "flex", gap: 6 }}>
        {!!preview.nodes?.length && <button onClick={() => commitPreview({ tidy: true })} style={{ flex: 1, minHeight: 38, borderRadius: 8, border: `1px solid ${T.yDim}`, background: T.yBg, color: T.y, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", cursor: "pointer", fontWeight: 700 }}>
          Confirm + Insert
        </button>}
        {!!preview.nodes?.length && <button onClick={() => commitPreview({ tidy: false })} style={{ flex: 1, minHeight: 38, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t1, fontSize: 11, cursor: "pointer" }}>
          Insert Raw
        </button>}
        <button onClick={clearPreview} style={{ minWidth: 86, minHeight: 38, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t1, fontSize: 11, cursor: "pointer" }}>
          Dismiss
        </button>
      </div>
    </div>}

    {lastRun && !preview && <div style={{ borderRadius: 8, border: `1px dashed ${T.b1}`, padding: "7px 9px", color: T.t2, fontSize: 10.5 }}>
      Last AI run: <span style={{ color: T.t1 }}>{lastRun.title}</span>
    </div>}
  </div>;
}

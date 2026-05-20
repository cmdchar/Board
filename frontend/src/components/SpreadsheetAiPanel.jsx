const ACTIONS = [
  { id: "analyze", label: "Analyze data", run: "runAnalyzeData" },
  { id: "trends", label: "Summarize trends", run: "runSummarizeTrends" },
  { id: "anomaly", label: "Detect anomalies", run: "runDetectAnomalies" },
  { id: "insights", label: "Generate insights", run: "runGenerateInsights" },
];

function toneBySeverity(T, severity) {
  if (severity === "high") return { bg: "rgba(239,68,68,.08)", border: "rgba(239,68,68,.35)", text: "#fca5a5" };
  if (severity === "medium") return { bg: "rgba(250,204,21,.08)", border: "rgba(250,204,21,.35)", text: T.y };
  return { bg: "rgba(148,163,184,.08)", border: T.b0, text: T.t1 };
}

export default function SpreadsheetAiPanel({ T, model }) {
  const {
    enabled,
    selectedSheetName,
    summary,
    insightCards,
    anomalies,
    relationships,
    query,
    setQuery,
    queryAnswer,
    actionLoading,
    queryLoading,
    error,
    numericColumns,
    runAnalyzeData,
    runSummarizeTrends,
    runDetectAnomalies,
    runGenerateInsights,
    runQuery,
    createChart,
    createKpi,
    applyRelationshipSuggestion,
  } = model;

  const runners = {
    runAnalyzeData,
    runSummarizeTrends,
    runDetectAnomalies,
    runGenerateInsights,
  };

  return <div style={{ padding: "10px 12px 12px", borderBottom: `1px solid ${T.b0}`, display: "flex", flexDirection: "column", gap: 8, background: T.bg1 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
      <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.y, letterSpacing: ".06em", fontWeight: 700 }}>SPREADSHEET AI</div>
      <div style={{ fontSize: 10, color: enabled ? T.t2 : T.red, fontFamily: "'JetBrains Mono',monospace" }}>
        {enabled ? selectedSheetName : "select a spreadsheet"}
      </div>
    </div>

    {!enabled && <div style={{ borderRadius: 9, border: `1px dashed ${T.b1}`, padding: "8px 10px", fontSize: 11, color: T.t2 }}>
      Select one spreadsheet node to unlock AI data analysis.
    </div>}

    {enabled && <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {ACTIONS.map((action) => {
          const busy = actionLoading === action.id;
          return <button
            key={action.id}
            onClick={runners[action.run]}
            disabled={Boolean(actionLoading)}
            style={{
              minHeight: 36,
              borderRadius: 8,
              border: `1px solid ${actionLoading ? T.b1 : T.yDim}`,
              background: actionLoading ? T.bg3 : T.yBg,
              color: actionLoading ? T.t2 : T.y,
              cursor: actionLoading ? "not-allowed" : "pointer",
              fontSize: 10.5,
              fontFamily: "'JetBrains Mono',monospace",
              fontWeight: 600,
            }}
          >
            {busy ? "Running..." : action.label}
          </button>;
        })}
      </div>

      {summary && <div style={{ borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg2, padding: "8px 10px", fontSize: 11.5, color: T.t1, lineHeight: 1.45 }}>
        {summary}
      </div>}

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".05em" }}>NATURAL LANGUAGE QUERY</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runQuery(); }}
            placeholder="What is the total revenue?"
            style={{
              flex: 1,
              minHeight: 36,
              borderRadius: 8,
              border: `1px solid ${T.b1}`,
              background: T.bg3,
              color: T.t0,
              padding: "0 10px",
              fontSize: 11,
              outline: "none",
            }}
          />
          <button
            onClick={runQuery}
            disabled={queryLoading || !String(query || "").trim()}
            style={{
              minWidth: 68,
              minHeight: 36,
              borderRadius: 8,
              border: `1px solid ${queryLoading || !String(query || "").trim() ? T.b1 : T.yDim}`,
              background: queryLoading || !String(query || "").trim() ? T.bg3 : T.yBg,
              color: queryLoading || !String(query || "").trim() ? T.t2 : T.y,
              cursor: queryLoading || !String(query || "").trim() ? "not-allowed" : "pointer",
              fontSize: 10.5,
              fontFamily: "'JetBrains Mono',monospace",
              fontWeight: 700,
            }}
          >
            {queryLoading ? "..." : "Ask"}
          </button>
        </div>
        {queryAnswer && <div style={{ borderRadius: 8, border: `1px solid ${T.yDim}`, background: T.yBg, color: T.y, padding: "7px 9px", fontSize: 11.5, lineHeight: 1.45 }}>
          {queryAnswer}
        </div>}
      </div>

      {insightCards?.length > 0 && <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".05em" }}>INSIGHT CARDS</div>
        <div style={{ maxHeight: 220, overflowY: "auto", display: "grid", gap: 6, paddingRight: 2 }}>
          {insightCards.map((card) => {
            const tone = toneBySeverity(T, card.severity);
            return <div key={card.id} style={{ borderRadius: 9, border: `1px solid ${tone.border}`, background: tone.bg, padding: "8px 9px", display: "grid", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 11, color: T.t0, fontWeight: 700 }}>{card.title}</div>
                <div style={{ fontSize: 9, color: tone.text, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".04em" }}>{String(card.type || "insight").toUpperCase()}</div>
              </div>
              <div style={{ fontSize: 11, color: T.t1, lineHeight: 1.42 }}>{card.message}</div>
            </div>;
          })}
        </div>
      </div>}

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".05em" }}>AUTO CHART GENERATION</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => createChart("bar")} style={{ flex: 1, minHeight: 34, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, cursor: "pointer", fontSize: 10.5 }}>Bar chart</button>
          <button onClick={() => createChart("line")} style={{ flex: 1, minHeight: 34, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, cursor: "pointer", fontSize: 10.5 }}>Line chart</button>
          <button onClick={() => createChart("pie")} style={{ flex: 1, minHeight: 34, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, cursor: "pointer", fontSize: 10.5 }}>Pie chart</button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".05em" }}>KPI WIDGETS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <button onClick={() => createKpi("sum")} style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, cursor: "pointer", fontSize: 10.5 }}>Total</button>
          <button onClick={() => createKpi("avg")} style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, cursor: "pointer", fontSize: 10.5 }}>Average</button>
          <button onClick={() => createKpi("count")} style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, cursor: "pointer", fontSize: 10.5 }}>Count</button>
        </div>
        {numericColumns?.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {numericColumns.slice(0, 4).map((column) => <button
            key={`kpi-${column.index}`}
            onClick={() => createKpi("sum", column.index)}
            style={{ minHeight: 30, borderRadius: 999, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t1, padding: "0 10px", cursor: "pointer", fontSize: 10 }}
          >
            KPI {column.header}
          </button>)}
        </div>}
      </div>

      {anomalies?.length > 0 && <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".05em" }}>
          ANOMALIES ({anomalies.length})
        </div>
        <div style={{ maxHeight: 120, overflowY: "auto", border: `1px solid ${T.b0}`, borderRadius: 8, background: T.bg2, padding: "6px 8px", display: "grid", gap: 5 }}>
          {anomalies.slice(0, 8).map((item, idx) => {
            const tone = toneBySeverity(T, item.severity);
            return <div key={`an-${idx}`} style={{ fontSize: 10.5, color: tone.text, lineHeight: 1.4 }}>{item.message}</div>;
          })}
        </div>
      </div>}

      {relationships?.length > 0 && <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".05em" }}>RELATIONSHIP DISCOVERY</div>
        <div style={{ display: "grid", gap: 6 }}>
          {relationships.slice(0, 6).map((entry) => <div key={entry.id} style={{ borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg2, padding: "7px 8px", display: "grid", gap: 5 }}>
            <div style={{ fontSize: 11, color: T.t0, fontWeight: 700 }}>{entry.label}</div>
            <div style={{ fontSize: 10.5, color: T.t1, lineHeight: 1.4 }}>{entry.message}</div>
            {(entry.formulaTemplate || entry.formulaSuggestion) && <button
              onClick={() => applyRelationshipSuggestion(entry)}
              style={{ justifySelf: "start", minHeight: 28, borderRadius: 7, border: `1px solid ${T.yDim}`, background: T.yBg, color: T.y, padding: "0 8px", cursor: "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}
            >
              Create formula
            </button>}
          </div>)}
        </div>
      </div>}
    </>}

    {error && <div style={{ borderRadius: 8, border: `1px solid ${T.red}`, background: T.bg3, color: T.red, padding: "7px 9px", fontSize: 11 }}>
      {error}
    </div>}
  </div>;
}

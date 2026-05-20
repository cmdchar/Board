import { useCallback, useEffect, useMemo, useState } from "react";
import { aiCall, parseAiJson } from "../ai/helpers";
import { SHEET_ANALYSIS_SYS } from "../ai/prompts";
import { createSpreadsheetEngine, sheetCellKey, sheetColLabel } from "../lib/spreadsheet/engine";
import {
  answerSpreadsheetQuery,
  buildChartGraph,
  buildDeterministicInsights,
  buildKpiNode,
  buildSpreadsheetAiContextPayload,
  buildSpreadsheetInsightCards,
  buildSpreadsheetRelationshipSuggestions,
  computeKpiValue,
  detectSpreadsheetAnomalies,
  extractSpreadsheetDataset,
  summarizeSpreadsheetDataset,
} from "../lib/spreadsheet/analysis";

function toText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function escapeSheetName(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function nextFrame() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function normalizeAiInsightCards(payload) {
  const raw = Array.isArray(payload?.insights) ? payload.insights : [];
  return raw
    .map((entry, idx) => {
      if (typeof entry === "string") {
        return {
          id: `ai_${idx + 1}`,
          type: "insight",
          severity: "low",
          title: `AI insight ${idx + 1}`,
          message: entry,
        };
      }
      if (!entry || typeof entry !== "object") return null;
      return {
        id: toText(entry.id) || `ai_${idx + 1}`,
        type: toText(entry.type) || "insight",
        severity: toText(entry.severity) || "low",
        title: toText(entry.title) || `AI insight ${idx + 1}`,
        message: toText(entry.message) || toText(entry.title),
      };
    })
    .filter((entry) => entry && entry.message);
}

function mergeAnomalies(localResult, aiPayload) {
  const list = Array.isArray(localResult?.anomalies) ? [...localResult.anomalies] : [];
  const map = { ...(localResult?.anomalyMap || {}) };
  const aiList = Array.isArray(aiPayload?.anomalies) ? aiPayload.anomalies : [];
  aiList.forEach((entry) => {
    const key = toText(entry?.key);
    const message = toText(entry?.message);
    if (!key || !message) return;
    const severity = ["low", "medium", "high"].includes(toText(entry?.severity).toLowerCase())
      ? toText(entry.severity).toLowerCase()
      : "medium";
    list.push({
      type: "ai_anomaly",
      severity,
      key,
      message,
    });
    map[key] = map[key] || severity;
  });
  return {
    anomalies: list.slice(0, 96),
    anomalyMap: map,
  };
}

function buildFormulaFromTemplate(template, sheetNode) {
  if (!template || !sheetNode) return "";
  const bits = String(sheetNode.sheetActive || "1,0").split(",");
  let activeRow = Number.parseInt(bits[0], 10);
  let activeCol = Number.parseInt(bits[1], 10);
  if (!Number.isInteger(activeRow) || activeRow < 1) activeRow = 1;
  if (!Number.isInteger(activeCol) || activeCol < 0) activeCol = 0;
  const rowNumber = activeRow + 1;

  if (template.mode === "same_sheet_multiply") {
    const leftCol = Number(template.leftColumnIndex);
    const rightCol = Number(template.rightColumnIndex);
    if (!Number.isInteger(leftCol) || !Number.isInteger(rightCol)) return "";
    return {
      formula: `=${sheetColLabel(leftCol)}${rowNumber}*${sheetColLabel(rightCol)}${rowNumber}`,
      row: activeRow,
      col: activeCol,
    };
  }

  if (template.mode === "cross_sheet_lookup_multiply") {
    const qtyCol = Number(template.quantityColumnIndex);
    const priceSheetName = toText(template.priceSheetName) || toText(template.priceSheetId);
    const priceHeader = toText(template.priceColumnHeader).replace(/[^A-Za-z0-9_ ]/g, " ").replace(/\s+/g, " ").trim();
    if (!Number.isInteger(qtyCol) || !priceSheetName || !priceHeader) return "";
    return {
      formula: `=sheet("${escapeSheetName(priceSheetName)}").${priceHeader}[A${rowNumber}]*${sheetColLabel(qtyCol)}${rowNumber}`,
      row: activeRow,
      col: activeCol,
    };
  }

  const explicit = toText(template.formulaSuggestion || template.formula || "");
  if (explicit.startsWith("=")) {
    return {
      formula: explicit,
      row: activeRow,
      col: activeCol,
    };
  }
  return "";
}

export function useSpreadsheetAi({
  s,
  d,
  uid,
  theme,
  notify,
  onAnomalyMapChange = null,
}) {
  const [actionLoading, setActionLoading] = useState("");
  const [query, setQuery] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryAnswer, setQueryAnswer] = useState("");
  const [summary, setSummary] = useState("");
  const [insightCards, setInsightCards] = useState([]);
  const [anomaliesResult, setAnomaliesResult] = useState({ anomalies: [], anomalyMap: {} });
  const [relationshipSuggestions, setRelationshipSuggestions] = useState([]);
  const [error, setError] = useState("");

  const allSheets = useMemo(
    () => (Array.isArray(s?.nodes) ? s.nodes.filter((node) => node?.type === "sheet") : []),
    [s?.nodes],
  );
  const selectedSheetNode = useMemo(() => {
    if (!Array.isArray(s?.sel) || s.sel.length !== 1) return null;
    const selectedId = s.sel[0];
    const node = (s.nodes || []).find((item) => item.id === selectedId);
    return node?.type === "sheet" ? node : null;
  }, [s?.sel, s?.nodes]);

  const spreadsheetEngine = useMemo(
    () => createSpreadsheetEngine({ nodes: s?.nodes || [], arrows: s?.arrows || [] }),
    [s?.nodes, s?.arrows],
  );

  const datasetsBySheetId = useMemo(() => {
    const map = new Map();
    allSheets.forEach((sheet) => {
      try {
        map.set(sheet.id, extractSpreadsheetDataset(sheet, spreadsheetEngine));
      } catch {
        // keep panel resilient against malformed cell data
      }
    });
    return map;
  }, [allSheets, spreadsheetEngine]);

  const selectedDataset = useMemo(
    () => (selectedSheetNode ? datasetsBySheetId.get(selectedSheetNode.id) || null : null),
    [datasetsBySheetId, selectedSheetNode],
  );

  const relatedDatasets = useMemo(() => {
    if (!selectedSheetNode) return [];
    const flow = spreadsheetEngine?.getSheetFlow ? spreadsheetEngine.getSheetFlow(selectedSheetNode.id) : {
      incomingEdges: [],
      outgoingEdges: [],
    };
    const relatedIds = new Set();
    (flow.incomingEdges || []).forEach((edge) => relatedIds.add(edge.fromSheetId));
    (flow.outgoingEdges || []).forEach((edge) => relatedIds.add(edge.toSheetId));
    const sheetIds = new Set(allSheets.map((sheet) => sheet.id));
    (Array.isArray(s?.arrows) ? s.arrows : []).forEach((arrow) => {
      const fromId = arrow?.from?.entityId || arrow?.fromId || "";
      const toId = arrow?.to?.entityId || arrow?.toId || "";
      if (!fromId || !toId) return;
      if (!sheetIds.has(fromId) || !sheetIds.has(toId)) return;
      if (fromId === selectedSheetNode.id) relatedIds.add(toId);
      if (toId === selectedSheetNode.id) relatedIds.add(fromId);
    });
    return [...relatedIds]
      .filter((sheetId) => sheetId && sheetId !== selectedSheetNode.id)
      .map((sheetId) => datasetsBySheetId.get(sheetId))
      .filter(Boolean);
  }, [allSheets, datasetsBySheetId, selectedSheetNode, spreadsheetEngine, s?.arrows]);

  const defaultAnomalies = useMemo(
    () => (selectedDataset ? detectSpreadsheetAnomalies(selectedDataset) : { anomalies: [], anomalyMap: {} }),
    [selectedDataset],
  );
  const defaultSummary = useMemo(
    () => (selectedDataset ? summarizeSpreadsheetDataset(selectedDataset) : { summary: "", trends: [] }),
    [selectedDataset],
  );
  const defaultInsights = useMemo(
    () => (selectedDataset ? buildDeterministicInsights(selectedDataset, defaultAnomalies) : []),
    [defaultAnomalies, selectedDataset],
  );
  const defaultRelationships = useMemo(
    () => (selectedSheetNode
      ? buildSpreadsheetRelationshipSuggestions({
        sheetNode: selectedSheetNode,
        spreadsheetEngine,
        allSheets,
        selectedDataset,
        relatedDatasets,
      })
      : []),
    [allSheets, relatedDatasets, selectedDataset, selectedSheetNode, spreadsheetEngine],
  );

  useEffect(() => {
    if (!selectedSheetNode || !selectedDataset) {
      setSummary("");
      setInsightCards([]);
      setAnomaliesResult({ anomalies: [], anomalyMap: {} });
      setRelationshipSuggestions([]);
      setQuery("");
      setQueryAnswer("");
      setError("");
      if (typeof onAnomalyMapChange === "function") onAnomalyMapChange("", {});
      return;
    }
    const cards = buildSpreadsheetInsightCards({
      dataset: selectedDataset,
      summaryResult: defaultSummary,
      anomaliesResult: defaultAnomalies,
      deterministicInsights: defaultInsights,
      aiInsights: [],
    });
    setSummary(defaultSummary.summary);
    setInsightCards(cards);
    setAnomaliesResult(defaultAnomalies);
    setRelationshipSuggestions(defaultRelationships);
    setError("");
    if (typeof onAnomalyMapChange === "function") onAnomalyMapChange(selectedSheetNode.id, defaultAnomalies.anomalyMap || {});
  }, [
    defaultAnomalies,
    defaultInsights,
    defaultRelationships,
    defaultSummary,
    onAnomalyMapChange,
    selectedDataset,
    selectedSheetNode,
  ]);

  const runAction = useCallback(async (mode) => {
    if (!selectedSheetNode || !selectedDataset || actionLoading) return;
    setActionLoading(mode);
    setError("");
    try {
      await nextFrame();
      const localAnomalies = detectSpreadsheetAnomalies(selectedDataset);
      const localSummary = summarizeSpreadsheetDataset(selectedDataset);
      const deterministic = buildDeterministicInsights(selectedDataset, localAnomalies);
      const payload = buildSpreadsheetAiContextPayload({
        selectedDataset,
        relatedDatasets,
      });
      const payloadTxt = JSON.stringify(payload).slice(0, 12000);
      const userPrompt = [
        `ACTION: ${mode}`,
        "Return concise spreadsheet insights and recommendations.",
        "SPREADSHEET_CONTEXT_JSON:",
        payloadTxt,
      ].join("\n");
      let aiPayload = {};
      try {
        const raw = await aiCall(userPrompt, SHEET_ANALYSIS_SYS);
        aiPayload = raw && typeof raw === "object" ? raw : parseAiJson(raw);
      } catch {
        aiPayload = {};
      }

      const mergedAnomalies = mergeAnomalies(localAnomalies, aiPayload);
      setAnomaliesResult(mergedAnomalies);
      if (typeof onAnomalyMapChange === "function") {
        onAnomalyMapChange(selectedSheetNode.id, mergedAnomalies.anomalyMap || {});
      }

      const aiInsights = normalizeAiInsightCards(aiPayload);
      const aiSummary = toText(aiPayload?.summary);
      const cards = buildSpreadsheetInsightCards({
        dataset: selectedDataset,
        summaryResult: localSummary,
        anomaliesResult: mergedAnomalies,
        deterministicInsights: deterministic,
        aiInsights,
      });
      setSummary(aiSummary || localSummary.summary);
      setInsightCards(cards);

      const aiRelationships = Array.isArray(aiPayload?.relationships) ? aiPayload.relationships : [];
      const mergedRelationships = [
        ...defaultRelationships,
        ...aiRelationships.map((entry, idx) => ({
          id: toText(entry?.id) || `ai_rel_${idx + 1}`,
          type: toText(entry?.type) || "relationship",
          label: toText(entry?.label) || `Suggestion ${idx + 1}`,
          message: toText(entry?.message) || "",
          formulaTemplate: entry?.formulaTemplate || null,
          formulaSuggestion: toText(entry?.formulaSuggestion),
        })),
      ].filter((entry, idx, arr) => {
        const key = `${entry.id}__${entry.label}`;
        return arr.findIndex((item) => `${item.id}__${item.label}` === key) === idx;
      });
      setRelationshipSuggestions(mergedRelationships.slice(0, 16));
      if (typeof notify === "function") notify(`Spreadsheet ${mode} completed`, "success");
    } catch (err) {
      setError(err?.message || "Spreadsheet analysis failed.");
      if (typeof notify === "function") notify(err?.message || "Spreadsheet analysis failed.", "error");
    } finally {
      setActionLoading("");
    }
  }, [
    actionLoading,
    defaultRelationships,
    notify,
    onAnomalyMapChange,
    relatedDatasets,
    selectedDataset,
    selectedSheetNode,
  ]);

  const runAnalyzeData = useCallback(() => runAction("analyze"), [runAction]);
  const runSummarizeTrends = useCallback(() => runAction("trends"), [runAction]);
  const runDetectAnomalies = useCallback(() => runAction("anomaly"), [runAction]);
  const runGenerateInsights = useCallback(() => runAction("insights"), [runAction]);

  const runQuery = useCallback(async () => {
    const q = toText(query);
    if (!q || queryLoading || !selectedDataset) return;
    setQueryLoading(true);
    setError("");
    try {
      await nextFrame();
      const local = answerSpreadsheetQuery(selectedDataset, q, { relatedDatasets });
      if (local?.ok && local.answer) {
        setQueryAnswer(local.answer);
        if (typeof notify === "function") notify("Spreadsheet answer ready", "success");
        return;
      }
      const payload = buildSpreadsheetAiContextPayload({
        selectedDataset,
        relatedDatasets,
      });
      const prompt = [
        "ACTION: answer_query",
        `QUERY: ${q}`,
        "SPREADSHEET_CONTEXT_JSON:",
        JSON.stringify(payload).slice(0, 12000),
      ].join("\n");
      const raw = await aiCall(prompt, SHEET_ANALYSIS_SYS);
      const parsed = raw && typeof raw === "object" ? raw : parseAiJson(raw);
      const answer = toText(parsed?.query?.answer) || toText(parsed?.answer);
      if (!answer) throw new Error("Unable to answer this query with current data.");
      setQueryAnswer(answer);
      if (typeof notify === "function") notify("Spreadsheet answer ready", "success");
    } catch (err) {
      const msg = err?.message || "Query failed.";
      setError(msg);
      if (typeof notify === "function") notify(msg, "error");
    } finally {
      setQueryLoading(false);
    }
  }, [notify, query, queryLoading, relatedDatasets, selectedDataset]);

  const createChart = useCallback((chartType) => {
    if (!selectedSheetNode || !selectedDataset) return;
    const graph = buildChartGraph({
      sheetNode: selectedSheetNode,
      dataset: selectedDataset,
      type: chartType,
      uid,
      theme,
    });
    if (!graph.nodes?.length) {
      if (typeof notify === "function") notify("Not enough data to generate chart.", "error");
      return;
    }
    d({ type: "APPLY", nodes: graph.nodes, arrows: graph.arrows || [] });
    if (typeof notify === "function") notify(`${String(chartType || "bar").toUpperCase()} chart created`, "success");
  }, [d, notify, selectedDataset, selectedSheetNode, theme, uid]);

  const createKpi = useCallback((metric, columnIndex = null) => {
    if (!selectedSheetNode || !selectedDataset) return;
    const numericColumns = selectedDataset.numericColumns || [];
    const targetColumn = Number.isInteger(Number(columnIndex))
      ? (selectedDataset.columns[Number(columnIndex)] || numericColumns[0] || null)
      : (numericColumns[0] || null);
    const binding = {
      sheetId: selectedSheetNode.id,
      metric: toText(metric) || "sum",
      columnIndex: targetColumn ? targetColumn.index : null,
      columnHeader: targetColumn ? targetColumn.header : "Value",
      title: `${toText(metric).toUpperCase() || "SUM"} ${targetColumn ? targetColumn.header : "Value"}`,
    };
    const value = computeKpiValue(selectedDataset, binding);
    const index = (s?.nodes || []).filter((node) => node?.kpiBinding?.sheetId === selectedSheetNode.id).length;
    const node = buildKpiNode({
      sheetNode: selectedSheetNode,
      binding,
      value,
      uid,
      theme,
      index,
    });
    d({
      type: "APPLY",
      nodes: [node],
      arrows: [{
        id: uid(),
        fromId: selectedSheetNode.id,
        toId: node.id,
        label: "data",
        flowType: "data",
        depType: "related",
      }],
    });
    if (typeof notify === "function") notify("KPI widget created", "success");
  }, [d, notify, s?.nodes, selectedDataset, selectedSheetNode, theme, uid]);

  const applyRelationshipSuggestion = useCallback((suggestion) => {
    if (!selectedSheetNode || !suggestion) return;
    const template = suggestion?.formulaTemplate || suggestion;
    const result = buildFormulaFromTemplate(template, selectedSheetNode);
    if (!result || !result.formula) {
      if (typeof notify === "function") notify("Suggestion has no formula payload.", "error");
      return;
    }
    const cells = selectedSheetNode.sheetCells && typeof selectedSheetNode.sheetCells === "object"
      ? { ...selectedSheetNode.sheetCells }
      : {};
    const targetKey = sheetCellKey(result.row, result.col);
    cells[targetKey] = result.formula;
    d({
      type: "UPD",
      id: selectedSheetNode.id,
      p: {
        sheetCells: cells,
        sheetActive: targetKey,
      },
    });
    if (typeof notify === "function") notify("Formula suggestion applied", "success");
  }, [d, notify, selectedSheetNode]);

  return {
    enabled: Boolean(selectedSheetNode && selectedDataset),
    selectedSheetId: selectedSheetNode?.id || "",
    selectedSheetName: toText(selectedSheetNode?.text) || "Spreadsheet",
    summary,
    insightCards,
    anomalies: anomaliesResult?.anomalies || [],
    anomalyMap: anomaliesResult?.anomalyMap || {},
    relationships: relationshipSuggestions,
    query,
    setQuery,
    queryAnswer,
    actionLoading,
    queryLoading,
    error,
    numericColumns: selectedDataset?.numericColumns || [],
    runAnalyzeData,
    runSummarizeTrends,
    runDetectAnomalies,
    runGenerateInsights,
    runQuery,
    createChart,
    createKpi,
    applyRelationshipSuggestion,
  };
}

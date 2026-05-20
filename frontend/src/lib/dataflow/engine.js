import { createSpreadsheetEngine } from "../spreadsheet/engine.js";
import { computeKpiValue, extractSpreadsheetDataset, formatKpiNodeText } from "../spreadsheet/analysis.js";

const DATA_NODE_TYPES = new Set(["sheet", "transform", "chart", "kpi"]);
const COMPATIBLE_INPUT_TYPES = new Set(["table", "grouped", "number"]);

const toNumber = (value) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
};
const text = (value) => (value === null || value === undefined ? "" : String(value).trim());

function normalizeChartType(value) {
  const raw = text(value).toLowerCase();
  if (raw === "line") return "line";
  if (raw === "pie") return "pie";
  return "bar";
}

function normalizeTransformType(value) {
  const raw = text(value).toLowerCase();
  if (raw === "average" || raw === "avg") return "average";
  if (raw === "filter") return "filter";
  if (raw === "group") return "group";
  return "sum";
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9 || (abs > 0 && abs < 1e-6)) return n.toExponential(4);
  return `${Math.round((n + Number.EPSILON) * 1000) / 1000}`;
}

function endpoints(connector) {
  const fromId = text(connector?.from?.entityId || connector?.fromId);
  const toId = text(connector?.to?.entityId || connector?.toId);
  return { fromId, toId };
}

export function isDataNodeType(type) {
  return DATA_NODE_TYPES.has(text(type).toLowerCase());
}

function connectorLabelLooksData(connector) {
  const raw = text(connector?.label).toLowerCase();
  return /data|chart|kpi|pipeline|transform|sum|avg|group|filter/.test(raw);
}

export function isDataConnector(connector, nodeById = null) {
  if (!connector || typeof connector !== "object") return false;
  if (connector.flowType === "data" || connector.dataFlow === true) return true;
  if (connectorLabelLooksData(connector)) return true;
  if (!nodeById) return false;
  const { fromId, toId } = endpoints(connector);
  if (!fromId || !toId) return false;
  const from = nodeById.get(fromId);
  const to = nodeById.get(toId);
  if (!from || !to) return false;
  return isDataNodeType(from.type) && isDataNodeType(to.type);
}

function nodeSignature(node) {
  if (!node) return "";
  const type = text(node.type);
  if (type === "sheet") {
    const cells = node.sheetCells && typeof node.sheetCells === "object" ? node.sheetCells : {};
    const keys = Object.keys(cells).sort().slice(0, 6000);
    // FNV-like rolling hash over sampled key/value content.
    let digest = 2166136261;
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const v = String(cells[k] ?? "");
      for (let j = 0; j < k.length && j < 48; j += 1) {
        digest ^= k.charCodeAt(j);
        digest = Math.imul(digest, 16777619) >>> 0;
      }
      digest ^= k.length;
      digest = Math.imul(digest, 16777619) >>> 0;
      for (let j = 0; j < v.length && j < 96; j += 1) {
        digest ^= v.charCodeAt(j);
        digest = Math.imul(digest, 16777619) >>> 0;
      }
      digest ^= v.length;
      digest = Math.imul(digest, 16777619) >>> 0;
    }
    return `${type}|${Number(node.sheetRows) || 0}|${Number(node.sheetCols) || 0}|${digest}`;
  }
  if (type === "transform") {
    return `${type}|${normalizeTransformType(node.transformType)}|${text(JSON.stringify(node.transformConfig || {}))}`;
  }
  if (type === "chart") {
    return `${type}|${normalizeChartType(node.chartType)}|${text(JSON.stringify(node.chartConfig || {}))}`;
  }
  if (type === "kpi" || (node.kpiBinding && typeof node.kpiBinding === "object")) {
    return `kpi|${text(node.kpiMetric || node.kpiBinding?.metric || "sum")}|${text(JSON.stringify(node.kpiBinding || {}))}`;
  }
  return `${type}|${text(node.id)}`;
}

function pickLabelColumn(dataset, preferred = null) {
  const cols = dataset?.columns || [];
  if (Number.isInteger(Number(preferred)) && cols[Number(preferred)]) return cols[Number(preferred)];
  return cols.find((c) => !c.numeric && c.nonEmptyCount > 0) || cols[0] || null;
}

function pickNumericColumn(dataset, preferred = null) {
  const cols = dataset?.columns || [];
  if (Number.isInteger(Number(preferred))) {
    const c = cols[Number(preferred)];
    if (c && c.numeric) return c;
  }
  return cols.find((c) => c.numeric && (c.stats?.count || 0) > 0) || null;
}

function tableOutput(dataset) {
  if (!dataset) return null;
  return { kind: "table", dataset, summary: `${dataset.rows || 0} rows` };
}

function groupedOutput(groups, label = "group", valueLabel = "value") {
  return { kind: "grouped", groups, label, valueLabel, summary: `${groups.length} groups` };
}

function numberOutput(value, label = "value") {
  return { kind: "number", value: Number(value) || 0, label, summary: `${label}: ${formatNumber(value)}` };
}

function transformOutput(node, input, errorRef) {
  const op = normalizeTransformType(node?.transformType);
  const cfg = node?.transformConfig && typeof node.transformConfig === "object" ? node.transformConfig : {};
  if (!input) {
    errorRef.message = "Transform has no incoming data.";
    return null;
  }
  if (op === "sum" || op === "average") {
    if (input.kind === "number") return numberOutput(input.value, op);
    const values = input.kind === "grouped"
      ? (input.groups || []).map((r) => toNumber(r.value)).filter(Number.isFinite)
      : input.kind === "table"
        ? (() => {
          const col = pickNumericColumn(input.dataset, cfg.numericColumnIndex);
          return col ? (col.numericValues || []).filter(Number.isFinite) : [];
        })()
        : [];
    if (!values.length) {
      errorRef.message = "SUM/AVERAGE needs numeric values.";
      return null;
    }
    const sum = values.reduce((acc, v) => acc + v, 0);
    return numberOutput(op === "sum" ? sum : (sum / values.length), op);
  }

  if (op === "filter") {
    if (input.kind !== "table") {
      errorRef.message = "FILTER expects table data.";
      return null;
    }
    const dataset = input.dataset;
    const cols = dataset?.columns || [];
    if (!cols.length) {
      errorRef.message = "FILTER source has no columns.";
      return null;
    }
    const col = cols[Number.isInteger(Number(cfg.filterColumnIndex)) ? Number(cfg.filterColumnIndex) : 0];
    const operator = text(cfg.filterOperator || "contains").toLowerCase();
    const targetRaw = text(cfg.filterValue);
    const targetNum = toNumber(targetRaw);
    const rows = (dataset.rowItems || []).filter((row) => {
      const cell = row.cells[col.index];
      if (!cell) return false;
      const cellText = text(cell.display);
      const cellNum = toNumber(cell.num);
      if (operator === "=" || operator === "==") return cellText === targetRaw || (Number.isFinite(cellNum) && Number.isFinite(targetNum) && cellNum === targetNum);
      if (operator === "!=") return cellText !== targetRaw;
      if (operator === ">") return Number.isFinite(cellNum) && Number.isFinite(targetNum) && cellNum > targetNum;
      if (operator === "<") return Number.isFinite(cellNum) && Number.isFinite(targetNum) && cellNum < targetNum;
      if (operator === ">=") return Number.isFinite(cellNum) && Number.isFinite(targetNum) && cellNum >= targetNum;
      if (operator === "<=") return Number.isFinite(cellNum) && Number.isFinite(targetNum) && cellNum <= targetNum;
      return cellText.toLowerCase().includes(targetRaw.toLowerCase());
    });
    return tableOutput({ ...dataset, rows: rows.length, rowItems: rows, sampleRows: rows.slice(0, 12) });
  }

  if (op === "group") {
    if (input.kind !== "table") {
      errorRef.message = "GROUP expects table data.";
      return null;
    }
    const dataset = input.dataset;
    const labelCol = pickLabelColumn(dataset, cfg.groupByColumnIndex);
    const valueCol = pickNumericColumn(dataset, cfg.valueColumnIndex);
    if (!labelCol || !valueCol) {
      errorRef.message = "GROUP needs one label and one numeric column.";
      return null;
    }
    const grouped = new Map();
    (dataset.rowItems || []).forEach((row) => {
      const label = text(row.cells[labelCol.index]?.display) || "Unknown";
      const value = toNumber(row.cells[valueCol.index]?.num);
      const bucket = grouped.get(label) || { label, value: 0, count: 0 };
      bucket.count += 1;
      if (Number.isFinite(value)) bucket.value += value;
      grouped.set(label, bucket);
    });
    const groups = [...grouped.values()].sort((a, b) => b.value - a.value);
    return groupedOutput(groups, labelCol.header, valueCol.header);
  }

  errorRef.message = "Unknown transform operation.";
  return null;
}

function chartDataForNode(node, input, errorRef) {
  if (!input) {
    errorRef.message = "Chart has no incoming data.";
    return [];
  }
  if (input.kind === "number") {
    return [{ label: text(input.label || "Value") || "Value", value: Number(input.value) || 0 }];
  }
  if (input.kind === "grouped") {
    return (input.groups || []).map((g) => ({ label: text(g.label) || "Group", value: Number(g.value) || 0 })).slice(0, 24);
  }
  if (input.kind === "table") {
    const cfg = node?.chartConfig && typeof node.chartConfig === "object" ? node.chartConfig : {};
    const labelCol = pickLabelColumn(input.dataset, cfg.labelColumnIndex);
    const valueCol = pickNumericColumn(input.dataset, cfg.valueColumnIndex);
    if (!labelCol || !valueCol) {
      errorRef.message = "Chart requires numeric table input.";
      return [];
    }
    return (input.dataset.rowItems || [])
      .map((row) => ({ label: text(row.cells[labelCol.index]?.display) || `Row ${row.row + 1}`, value: toNumber(row.cells[valueCol.index]?.num) }))
      .filter((entry) => Number.isFinite(entry.value))
      .slice(0, 24);
  }
  errorRef.message = "Unsupported chart input type.";
  return [];
}

function kpiStateForNode(node, input, sheetDatasetById, errorRef) {
  const metric = text(node?.kpiMetric || node?.kpiBinding?.metric || "sum").toLowerCase() || "sum";
  const bindingBase = node?.kpiBinding && typeof node.kpiBinding === "object" ? { ...node.kpiBinding } : {};
  if (!input && bindingBase.sheetId && sheetDatasetById.has(bindingBase.sheetId)) {
    input = tableOutput(sheetDatasetById.get(bindingBase.sheetId));
  }
  if (!input) {
    errorRef.message = "KPI has no source data.";
    return null;
  }
  if (input.kind === "number") {
    const binding = {
      ...bindingBase,
      metric,
      title: text(bindingBase.title || node?.kpiLabel || "KPI"),
      columnHeader: text(bindingBase.columnHeader || input.label || "Value"),
    };
    return { binding, value: Number(input.value) || 0 };
  }
  if (input.kind === "grouped") {
    const values = (input.groups || []).map((g) => toNumber(g.value)).filter(Number.isFinite);
    if (!values.length) {
      errorRef.message = "KPI source has no numeric groups.";
      return null;
    }
    const sum = values.reduce((acc, v) => acc + v, 0);
    const value = metric === "avg" || metric === "average"
      ? sum / values.length
      : metric === "min"
        ? Math.min(...values)
        : metric === "max"
          ? Math.max(...values)
          : metric === "count"
            ? values.length
            : sum;
    const binding = {
      ...bindingBase,
      metric,
      title: text(bindingBase.title || node?.kpiLabel || "KPI"),
      columnHeader: text(bindingBase.columnHeader || input.valueLabel || "Value"),
    };
    return { binding, value };
  }
  if (input.kind === "table") {
    const dataset = input.dataset;
    const numericCol = pickNumericColumn(dataset, bindingBase.columnIndex);
    const binding = {
      ...bindingBase,
      sheetId: text(bindingBase.sheetId || dataset.sheetId),
      metric,
      columnIndex: Number.isInteger(Number(bindingBase.columnIndex)) ? Number(bindingBase.columnIndex) : (numericCol?.index ?? null),
      columnHeader: text(bindingBase.columnHeader || numericCol?.header || "Value"),
      title: text(bindingBase.title || node?.kpiLabel || `${metric.toUpperCase()} KPI`),
    };
    return { binding, value: computeKpiValue(dataset, binding) };
  }
  errorRef.message = "Unsupported KPI input type.";
  return null;
}

function outputPreview(output) {
  if (!output) return { kind: "unknown", summary: "No output" };
  if (output.kind === "number") return { kind: "number", summary: output.summary, value: Number(output.value) || 0, label: text(output.label) };
  if (output.kind === "grouped") {
    return {
      kind: "grouped",
      summary: output.summary,
      columns: [text(output.label || "group"), text(output.valueLabel || "value")],
      rows: (output.groups || []).slice(0, 8).map((entry) => [text(entry.label), formatNumber(entry.value)]),
    };
  }
  if (output.kind === "table") {
    const dataset = output.dataset;
    return {
      kind: "table",
      summary: output.summary,
      columns: (dataset?.columns || []).slice(0, 8).map((col) => text(col.header) || `Col ${col.index + 1}`),
      rows: (dataset?.sampleRows || []).slice(0, 6).map((row) => row.cells.map((cell) => text(cell.display)).slice(0, 8)),
    };
  }
  return { kind: "unknown", summary: text(output.summary) || "No output" };
}

function patchDiff(node, patch) {
  const out = {};
  Object.entries(patch || {}).forEach(([key, value]) => {
    let same = false;
    const current = node?.[key];
    if (current === value) same = true;
    else if (typeof current === "number" && typeof value === "number" && Number.isFinite(current) && Number.isFinite(value)) same = Math.abs(current - value) < 1e-9;
    else if (typeof current === "object" && typeof value === "object") {
      try { same = JSON.stringify(current) === JSON.stringify(value); } catch { same = false; }
    }
    if (!same) out[key] = value;
  });
  return out;
}

function buildGraph(nodes, arrows) {
  const nodeById = new Map((nodes || []).map((node) => [node.id, node]));
  const edges = [];
  const incoming = new Map();
  const outgoing = new Map();
  (arrows || []).forEach((connector) => {
    const { fromId, toId } = endpoints(connector);
    if (!fromId || !toId || !nodeById.has(fromId) || !nodeById.has(toId)) return;
    if (!isDataConnector(connector, nodeById)) return;
    const edge = { id: text(connector.id) || `${fromId}->${toId}`, fromId, toId, connector };
    edges.push(edge);
    const inBucket = incoming.get(toId) || [];
    inBucket.push(edge);
    incoming.set(toId, inBucket);
    const outBucket = outgoing.get(fromId) || [];
    outBucket.push(edge);
    outgoing.set(fromId, outBucket);
  });
  const dataNodeIds = new Set(edges.flatMap((edge) => [edge.fromId, edge.toId]));
  return { nodeById, edges, incoming, outgoing, dataNodeIds };
}

function topo(graph) {
  const indeg = new Map();
  graph.dataNodeIds.forEach((id) => indeg.set(id, 0));
  graph.edges.forEach((edge) => indeg.set(edge.toId, (indeg.get(edge.toId) || 0) + 1));
  const queue = [];
  indeg.forEach((value, id) => { if (value === 0) queue.push(id); });
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    (graph.outgoing.get(id) || []).forEach((edge) => {
      const next = edge.toId;
      const v = (indeg.get(next) || 0) - 1;
      indeg.set(next, v);
      if (v === 0) queue.push(next);
    });
  }
  const cycleNodeIds = [];
  indeg.forEach((value, id) => { if (value > 0) cycleNodeIds.push(id); });
  return { order, cycleNodeIds };
}

function propagate(startIds, outgoing) {
  const set = new Set(startIds || []);
  const q = [...set];
  while (q.length) {
    const id = q.shift();
    (outgoing.get(id) || []).forEach((edge) => {
      if (set.has(edge.toId)) return;
      set.add(edge.toId);
      q.push(edge.toId);
    });
  }
  return set;
}

export function createEmptyDataFlowRuntime() {
  return {
    dataConnectorIds: [],
    cycleNodeIds: [],
    nodeErrorsById: {},
    connectorErrorsById: {},
    connectorPreviewById: {},
    upstreamByNode: {},
    downstreamByNode: {},
    affectedNodeIds: [],
    nodeOutputSummaryById: {},
  };
}

export function runDataFlowEngine({ nodes = [], arrows = [], previous = null } = {}) {
  const graph = buildGraph(nodes, arrows);
  const nodeById = graph.nodeById;
  const prev = previous && typeof previous === "object" ? previous : null;
  const signatures = {};
  const allDataNodeIds = new Set(
    (nodes || []).filter((n) => isDataNodeType(n?.type) || (n?.kpiBinding && typeof n.kpiBinding === "object")).map((n) => n.id),
  );
  allDataNodeIds.forEach((id) => { signatures[id] = nodeSignature(nodeById.get(id)); });

  const changed = new Set();
  allDataNodeIds.forEach((id) => {
    const prevSig = prev?.signatures?.[id] || "";
    if (!prev || prevSig !== signatures[id]) changed.add(id);
  });

  const graphKey = graph.edges.map((edge) => `${edge.id}:${edge.fromId}->${edge.toId}`).sort().join("|");
  const graphChanged = !prev || graphKey !== (prev.graphKey || "");
  if (graphChanged) graph.dataNodeIds.forEach((id) => changed.add(id));

  const affected = propagate(changed, graph.outgoing);
  const topoInfo = topo(graph);
  topoInfo.cycleNodeIds.forEach((id) => affected.add(id));

  const spreadsheetEngine = createSpreadsheetEngine({ nodes, arrows });
  const sheetDatasetById = new Map();
  const outputs = { ...(prev?.outputs || {}) };
  const nodeErrorsById = {};
  const connectorErrorsById = {};
  const connectorPreviewById = {};
  const nodePatches = {};

  const evalOrder = [...topoInfo.order, ...[...allDataNodeIds].filter((id) => !topoInfo.order.includes(id))];
  const cycleSet = new Set(topoInfo.cycleNodeIds);

  evalOrder.forEach((id) => {
    const node = nodeById.get(id);
    if (!node) return;
    if (cycleSet.has(id)) {
      outputs[id] = null;
      nodeErrorsById[id] = "Data flow cycle detected.";
      const patch = patchDiff(node, { dataFlowError: "Data flow cycle detected." });
      if (Object.keys(patch).length) nodePatches[id] = patch;
      return;
    }
    if (!affected.has(id) && id in outputs) return;

    const inputOutputs = (graph.incoming.get(id) || []).map((edge) => outputs[edge.fromId]).filter(Boolean);
    const errorRef = { message: "" };
    let output = null;
    let patch = { dataFlowError: null };

    if (node.type === "sheet") {
      try {
        const dataset = extractSpreadsheetDataset(node, spreadsheetEngine);
        sheetDatasetById.set(node.id, dataset);
        output = tableOutput(dataset);
      } catch {
        errorRef.message = "Unable to evaluate spreadsheet data.";
      }
    } else if (node.type === "transform") {
      output = transformOutput(node, inputOutputs[0] || null, errorRef);
      const op = normalizeTransformType(node.transformType);
      patch = {
        ...patch,
        transformType: op,
        transformOutput: output,
        text: `${(text(node.transformLabel) || op.toUpperCase())}\n${output ? (output.summary || output.kind) : "no output"}`,
      };
    } else if (node.type === "chart") {
      const rows = chartDataForNode(node, inputOutputs[0] || null, errorRef);
      patch = {
        ...patch,
        chartType: normalizeChartType(node.chartType),
        chartData: rows,
        chartSummary: rows.length ? `${rows.length} points` : "No chart data",
      };
      output = rows.length
        ? groupedOutput(rows.map((r) => ({ label: r.label, value: r.value, count: 1 })), "label", "value")
        : null;
    } else if (node.type === "kpi" || (node.kpiBinding && typeof node.kpiBinding === "object")) {
      const state = kpiStateForNode(node, inputOutputs[0] || null, sheetDatasetById, errorRef);
      if (state) {
        patch = {
          ...patch,
          kpiMetric: text(state.binding.metric),
          kpiLabel: text(state.binding.title || "KPI"),
          kpiBinding: state.binding,
          kpiValue: Number.isFinite(Number(state.value)) ? Number(state.value) : 0,
          text: formatKpiNodeText(state.binding, state.value),
        };
        output = numberOutput(state.value, state.binding.title || "kpi");
      }
    }

    if (errorRef.message) {
      patch.dataFlowError = errorRef.message;
      nodeErrorsById[id] = errorRef.message;
    }

    outputs[id] = output || null;
    const delta = patchDiff(node, patch);
    if (Object.keys(delta).length) nodePatches[id] = delta;
  });

  graph.edges.forEach((edge) => {
    const sourceOutput = outputs[edge.fromId] || null;
    const targetNode = nodeById.get(edge.toId);
    connectorPreviewById[edge.id] = outputPreview(sourceOutput);
    if (!sourceOutput) {
      connectorErrorsById[edge.id] = "Source node has no output data.";
      nodeErrorsById[edge.toId] = nodeErrorsById[edge.toId] || connectorErrorsById[edge.id];
    } else if ((targetNode?.type === "chart" || targetNode?.type === "kpi" || targetNode?.type === "transform") && !COMPATIBLE_INPUT_TYPES.has(sourceOutput.kind)) {
      connectorErrorsById[edge.id] = `Incompatible data type for ${text(targetNode.type)} node.`;
      nodeErrorsById[edge.toId] = nodeErrorsById[edge.toId] || connectorErrorsById[edge.id];
    }
  });

  const upstreamByNode = {};
  const downstreamByNode = {};
  graph.edges.forEach((edge) => {
    if (!upstreamByNode[edge.toId]) upstreamByNode[edge.toId] = [];
    if (!downstreamByNode[edge.fromId]) downstreamByNode[edge.fromId] = [];
    upstreamByNode[edge.toId].push(edge.fromId);
    downstreamByNode[edge.fromId].push(edge.toId);
  });

  const runtime = {
    dataConnectorIds: graph.edges.map((edge) => edge.id),
    cycleNodeIds: topoInfo.cycleNodeIds,
    nodeErrorsById,
    connectorErrorsById,
    connectorPreviewById,
    upstreamByNode,
    downstreamByNode,
    affectedNodeIds: [...affected],
    nodeOutputSummaryById: Object.fromEntries(Object.entries(outputs).map(([id, out]) => [id, text(out?.summary || out?.kind || "")])),
  };

  return {
    runtime,
    nodePatches,
    state: {
      graphKey,
      signatures,
      outputs,
    },
  };
}

export function createDataConnector({ uid, fromId, toId, label = "data", overrides = {} }) {
  return {
    id: uid(),
    fromId,
    toId,
    label: text(label) || "data",
    flowType: "data",
    depType: "related",
    ...overrides,
  };
}

export function createTransformNode({ uid, x, y, transformType = "sum", title = "" }) {
  const op = normalizeTransformType(transformType);
  return {
    id: uid(),
    type: "transform",
    x: Number(x) || 0,
    y: Number(y) || 0,
    w: 250,
    h: 134,
    text: text(title) || `${op.toUpperCase()}\nno output`,
    color: "#0b1220",
    textColor: "#dbeafe",
    borderColor: "#38bdf8",
    fontSize: 12,
    fontWeight: "700",
    transformType: op,
    transformConfig: {
      numericColumnIndex: null,
      filterColumnIndex: 0,
      filterOperator: "contains",
      filterValue: "",
      groupByColumnIndex: 0,
      valueColumnIndex: null,
    },
    transformOutput: null,
    dataFlowError: null,
  };
}

export function createChartNode({ uid, x, y, chartType = "bar", title = "" }) {
  const type = normalizeChartType(chartType);
  return {
    id: uid(),
    type: "chart",
    x: Number(x) || 0,
    y: Number(y) || 0,
    w: 360,
    h: 240,
    text: text(title) || `${type.toUpperCase()} Chart`,
    color: "#0b1220",
    textColor: "#e2e8f0",
    borderColor: "#22d3ee",
    fontSize: 12,
    fontWeight: "700",
    chartType: type,
    chartConfig: { labelColumnIndex: null, valueColumnIndex: null },
    chartData: [],
    chartSummary: "No chart data",
    dataFlowError: null,
  };
}

export function createKpiNode({ uid, x, y, metric = "sum", title = "KPI" }) {
  const normalizedMetric = text(metric).toLowerCase() || "sum";
  const binding = {
    metric: normalizedMetric,
    title: text(title) || "KPI",
    columnIndex: null,
    columnHeader: "Value",
    sheetId: "",
  };
  return {
    id: uid(),
    type: "kpi",
    x: Number(x) || 0,
    y: Number(y) || 0,
    w: 272,
    h: 110,
    text: formatKpiNodeText(binding, 0),
    color: "#0b1220",
    textColor: "#fef3c7",
    borderColor: "#f59e0b",
    fontSize: 12,
    fontWeight: "700",
    kpiMetric: normalizedMetric,
    kpiLabel: text(title) || "KPI",
    kpiValue: 0,
    kpiBinding: binding,
    dataFlowError: null,
  };
}

export function wouldCreateDataFlowCycle({ nodes = [], arrows = [], fromId = "", toId = "" } = {}) {
  const sourceId = text(fromId);
  const targetId = text(toId);
  if (!sourceId || !targetId) return false;
  if (sourceId === targetId) return true;

  const nodeById = new Map((nodes || []).map((node) => [node.id, node]));
  const fromNode = nodeById.get(sourceId);
  const toNode = nodeById.get(targetId);
  if (!fromNode || !toNode) return false;
  if (!(isDataNodeType(fromNode.type) && isDataNodeType(toNode.type))) return false;

  const outgoing = new Map();
  (arrows || []).forEach((connector) => {
    const ep = endpoints(connector);
    if (!ep.fromId || !ep.toId) return;
    if (!isDataConnector(connector, nodeById)) return;
    const list = outgoing.get(ep.fromId) || [];
    list.push(ep.toId);
    outgoing.set(ep.fromId, list);
  });
  const newList = outgoing.get(sourceId) || [];
  newList.push(targetId);
  outgoing.set(sourceId, newList);

  const q = [targetId];
  const seen = new Set(q);
  while (q.length) {
    const current = q.shift();
    if (current === sourceId) return true;
    (outgoing.get(current) || []).forEach((next) => {
      if (seen.has(next)) return;
      seen.add(next);
      q.push(next);
    });
  }
  return false;
}

export { normalizeChartType, normalizeTransformType };

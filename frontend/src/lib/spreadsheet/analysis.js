import { sheetColLabel, sheetCellKey } from "./engine.js";

function toNumber(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9 || (abs > 0 && abs < 1e-6)) return n.toExponential(4);
  const rounded = Math.round((n + Number.EPSILON) * 1000) / 1000;
  return `${rounded}`;
}

function clampCount(value, max = 999) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.floor(n));
}

function normalizeChartType(value) {
  const txt = safeText(value).toLowerCase();
  if (txt === "line") return "line";
  if (txt === "pie") return "pie";
  return "bar";
}

function pickLabelColumn(dataset) {
  const nonNumeric = dataset.columns.find((column) => !column.numeric && column.nonEmptyCount > 0);
  if (nonNumeric) return nonNumeric;
  return dataset.columns[0] || null;
}

function pickValueColumn(dataset) {
  const numeric = dataset.columns.filter((column) => column.numeric && column.numericCount > 0);
  return numeric[0] || null;
}

function normalizeHeader(value) {
  return safeText(value).toLowerCase();
}

function includesAnyKeyword(value, keywords = []) {
  const header = normalizeHeader(value);
  if (!header) return false;
  return keywords.some((keyword) => header.includes(normalizeHeader(keyword)));
}

function findColumnByKeywords(dataset, keywords = [], { numericOnly = false } = {}) {
  const columns = dataset?.columns || [];
  const filtered = columns.filter((column) => {
    if (numericOnly && !column.numeric) return false;
    return includesAnyKeyword(column.header, keywords);
  });
  if (!filtered.length) return null;
  return filtered.sort((a, b) => {
    const scoreA = (a.numeric ? 2 : 0) + (a.stats?.count || 0);
    const scoreB = (b.numeric ? 2 : 0) + (b.stats?.count || 0);
    return scoreB - scoreA;
  })[0];
}

function computeRevenueMetric(dataset) {
  if (!dataset) return null;
  const priceCol = findColumnByKeywords(dataset, ["price", "cost", "rate"], { numericOnly: true });
  const qtyCol = findColumnByKeywords(dataset, ["qty", "quantity", "units", "count"], { numericOnly: true });
  if (!priceCol || !qtyCol) return null;
  const rows = dataset.rowItems || [];
  let sum = 0;
  let count = 0;
  let max = -Infinity;
  let maxLabel = "";
  const labelCol = pickLabelColumn(dataset);
  rows.forEach((row) => {
    const p = row.cells[priceCol.index];
    const q = row.cells[qtyCol.index];
    if (!p?.numeric || !q?.numeric) return;
    const value = p.num * q.num;
    if (!Number.isFinite(value)) return;
    sum += value;
    count += 1;
    if (value > max) {
      max = value;
      maxLabel = labelCol ? safeText(row.cells[labelCol.index]?.display) : "";
    }
  });
  if (!count) return null;
  return {
    metric: "revenue",
    sum,
    avg: sum / count,
    count,
    max: Number.isFinite(max) ? max : 0,
    maxLabel,
    priceCol,
    qtyCol,
  };
}

function compactDatasets(selectedDataset, relatedDatasets = []) {
  return [selectedDataset, ...(Array.isArray(relatedDatasets) ? relatedDatasets : [])]
    .filter((dataset) => dataset && dataset.sheetId);
}

function numericStats(values) {
  if (!Array.isArray(values) || !values.length) {
    return { count: 0, min: 0, max: 0, sum: 0, avg: 0, std: 0 };
  }
  const clean = values.map(toNumber).filter(Number.isFinite);
  if (!clean.length) return { count: 0, min: 0, max: 0, sum: 0, avg: 0, std: 0 };
  const sum = clean.reduce((acc, n) => acc + n, 0);
  const avg = sum / clean.length;
  const variance = clean.reduce((acc, n) => acc + ((n - avg) ** 2), 0) / clean.length;
  const std = Math.sqrt(variance);
  return {
    count: clean.length,
    min: Math.min(...clean),
    max: Math.max(...clean),
    sum,
    avg,
    std,
  };
}

export function extractSpreadsheetDataset(sheetNode, spreadsheetEngine) {
  const rows = Math.max(1, Math.min(400, Number(sheetNode?.sheetRows) || 12));
  const cols = Math.max(1, Math.min(52, Number(sheetNode?.sheetCols) || 6));
  const sheetId = String(sheetNode?.id || "");
  const cells = sheetNode?.sheetCells && typeof sheetNode.sheetCells === "object" ? sheetNode.sheetCells : {};

  const columns = Array.from({ length: cols }, (_, col) => {
    let header = "";
    try {
      header = safeText(spreadsheetEngine.evaluateCell(sheetId, 0, col).display);
    } catch {
      header = safeText(cells[sheetCellKey(0, col)]);
    }
    if (!header) header = `Col ${sheetColLabel(col)}`;
    return {
      index: col,
      key: `c${col}`,
      letter: sheetColLabel(col),
      header,
      numeric: false,
      numericCount: 0,
      nonEmptyCount: 0,
      values: [],
      numericValues: [],
      stats: null,
    };
  });

  const tableRows = [];
  for (let row = 1; row < rows; row += 1) {
    const rowCells = [];
    let hasAnyValue = false;
    for (let col = 0; col < cols; col += 1) {
      let info = { display: "", num: 0, error: false, errorCode: "" };
      try {
        info = spreadsheetEngine.evaluateCell(sheetId, row, col);
      } catch {
        info = { display: "#REF!", num: 0, error: true, errorCode: "REF" };
      }
      const raw = safeText(cells[sheetCellKey(row, col)]);
      const text = safeText(info.display);
      const num = toNumber(info.num);
      const isNumeric = Number.isFinite(num) && !info.error;
      const empty = !raw && !text;
      if (!empty) hasAnyValue = true;
      const cell = {
        row,
        col,
        key: sheetCellKey(row, col),
        raw,
        display: text,
        num,
        numeric: isNumeric,
        error: Boolean(info.error),
        errorCode: info.errorCode || "",
        empty,
      };
      rowCells.push(cell);
      const colEntry = columns[col];
      if (!empty) {
        colEntry.nonEmptyCount += 1;
        colEntry.values.push(text);
      }
      if (isNumeric) {
        colEntry.numericCount += 1;
        colEntry.numericValues.push(num);
      }
    }
    if (hasAnyValue) {
      tableRows.push({
        row,
        rowLabel: `${row + 1}`,
        cells: rowCells,
      });
    }
  }

  columns.forEach((column) => {
    column.numeric = column.numericCount >= Math.max(2, Math.ceil(column.nonEmptyCount * 0.5));
    column.stats = numericStats(column.numericValues);
  });

  const numericColumns = columns.filter((column) => column.numeric);
  const totalNumericCells = numericColumns.reduce((sum, column) => sum + column.stats.count, 0);
  const totalNumericSum = numericColumns.reduce((sum, column) => sum + column.stats.sum, 0);
  const rowCount = tableRows.length;

  return {
    sheetId,
    sheetName: safeText(sheetNode?.text) || `Sheet ${sheetId}`,
    rows: rowCount,
    cols,
    columns,
    rowItems: tableRows,
    numericColumns,
    totalNumericCells,
    totalNumericSum,
    sampleRows: tableRows.slice(0, 12),
  };
}

export function detectSpreadsheetAnomalies(dataset) {
  const anomalies = [];
  const anomalyMap = {};
  const columns = dataset?.columns || [];
  const rowItems = dataset?.rowItems || [];

  columns.forEach((column) => {
    if (!column.numeric || !column.stats || column.stats.count < 2) return;
    const mean = column.stats.avg;
    const std = column.stats.std;
    rowItems.forEach((row) => {
      const cell = row.cells[column.index];
      if (!cell || cell.empty) return;
      if (cell.error) {
        anomalies.push({
          type: "formula_error",
          severity: "high",
          row: row.row,
          col: column.index,
          key: cell.key,
          message: `${column.header} has formula error at row ${row.row + 1}`,
        });
        anomalyMap[cell.key] = "high";
        return;
      }
      if (!cell.numeric) {
        anomalies.push({
          type: "missing_numeric",
          severity: "medium",
          row: row.row,
          col: column.index,
          key: cell.key,
          message: `${column.header} is missing numeric value at row ${row.row + 1}`,
        });
        anomalyMap[cell.key] = anomalyMap[cell.key] || "medium";
        return;
      }
      if (cell.num < 0) {
        anomalies.push({
          type: "negative_value",
          severity: "high",
          row: row.row,
          col: column.index,
          key: cell.key,
          message: `${column.header} has negative value (${formatNumber(cell.num)}) at row ${row.row + 1}`,
        });
        anomalyMap[cell.key] = "high";
      }
      if (std > 0) {
        const z = Math.abs((cell.num - mean) / std);
        if (z >= 2.5) {
          const isHigh = cell.num > mean;
          anomalies.push({
            type: "outlier",
            severity: z >= 3.5 ? "high" : "medium",
            row: row.row,
            col: column.index,
            key: cell.key,
            message: `${column.header} has ${isHigh ? "unusually high" : "unusually low"} value (${formatNumber(cell.num)}) at row ${row.row + 1}`,
          });
          anomalyMap[cell.key] = z >= 3.5 ? "high" : (anomalyMap[cell.key] || "medium");
        }
      }
    });
  });

  rowItems.forEach((row) => {
    columns.forEach((column) => {
      const cell = row.cells[column.index];
      if (!cell || !cell.empty) return;
      if (column.nonEmptyCount < Math.max(2, Math.ceil(rowItems.length * 0.3))) return;
      anomalies.push({
        type: "missing_value",
        severity: "low",
        row: row.row,
        col: column.index,
        key: cell.key,
        message: `${column.header} has missing value at row ${row.row + 1}`,
      });
      anomalyMap[cell.key] = anomalyMap[cell.key] || "low";
    });
  });

  return {
    anomalies: anomalies.slice(0, 64),
    anomalyMap,
  };
}

export function summarizeSpreadsheetDataset(dataset) {
  const rowCount = dataset?.rows || 0;
  const columnCount = dataset?.cols || 0;
  const numericColumns = dataset?.numericColumns || [];
  const summaryLines = [];

  summaryLines.push(`${rowCount} data rows and ${columnCount} columns.`);

  if (numericColumns.length) {
    const top = [...numericColumns]
      .sort((a, b) => Math.abs(b.stats.sum) - Math.abs(a.stats.sum))
      .slice(0, 2);
    top.forEach((column) => {
      summaryLines.push(`${column.header}: total ${formatNumber(column.stats.sum)}, avg ${formatNumber(column.stats.avg)}.`);
    });
  }

  const trends = [];
  numericColumns.forEach((column) => {
    if (column.stats.count < 2) return;
    const first = column.numericValues[0];
    const last = column.numericValues[column.numericValues.length - 1];
    if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return;
    const changePct = ((last - first) / Math.abs(first)) * 100;
    const direction = changePct > 0 ? "increased" : "decreased";
    trends.push({
      column: column.header,
      changePct,
      message: `${column.header} ${direction} by ${formatNumber(Math.abs(changePct))}% across visible rows.`,
    });
  });

  trends.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  return {
    summary: summaryLines.join(" "),
    trends: trends.slice(0, 4),
  };
}

export function buildDeterministicInsights(dataset, anomaliesResult) {
  const insights = [];
  const numericColumns = dataset?.numericColumns || [];
  const rowItems = dataset?.rowItems || [];
  const anomalies = anomaliesResult?.anomalies || [];

  if (!rowItems.length) {
    insights.push("Spreadsheet has no populated rows yet.");
    return insights;
  }

  numericColumns.forEach((column) => {
    if (!column.stats || column.stats.count < 2) return;
    const msg = `${column.header}: total ${formatNumber(column.stats.sum)}, average ${formatNumber(column.stats.avg)}, max ${formatNumber(column.stats.max)}.`;
    insights.push(msg);
  });

  if (anomalies.length) {
    const high = anomalies.filter((a) => a.severity === "high").length;
    const med = anomalies.filter((a) => a.severity === "medium").length;
    insights.push(`Detected ${anomalies.length} anomalies (${high} high, ${med} medium).`);
  } else {
    insights.push("No major anomalies detected in visible data.");
  }

  return insights.slice(0, 8);
}

export function buildSpreadsheetInsightCards({
  dataset,
  summaryResult = null,
  anomaliesResult = null,
  deterministicInsights = [],
  aiInsights = [],
} = {}) {
  const cards = [];
  const pushCard = (card) => {
    const title = safeText(card?.title);
    const message = safeText(card?.message);
    if (!title && !message) return;
    cards.push({
      id: safeText(card?.id) || `card_${cards.length + 1}`,
      type: safeText(card?.type) || "insight",
      severity: ["low", "medium", "high"].includes(safeText(card?.severity).toLowerCase())
        ? safeText(card?.severity).toLowerCase()
        : "low",
      title: title || "Insight",
      message: message || title,
    });
  };

  const summaryLine = safeText(summaryResult?.summary);
  if (summaryLine) {
    pushCard({
      id: "summary",
      type: "summary",
      severity: "low",
      title: "Data summary",
      message: summaryLine,
    });
  }

  (summaryResult?.trends || []).slice(0, 3).forEach((trend, idx) => {
    pushCard({
      id: `trend_${idx + 1}`,
      type: "trend",
      severity: Math.abs(Number(trend?.changePct) || 0) >= 20 ? "medium" : "low",
      title: safeText(trend?.column) || "Trend",
      message: safeText(trend?.message),
    });
  });

  (Array.isArray(deterministicInsights) ? deterministicInsights : []).slice(0, 6).forEach((message, idx) => {
    pushCard({
      id: `det_${idx + 1}`,
      type: "insight",
      severity: "low",
      title: `Insight ${idx + 1}`,
      message: safeText(message),
    });
  });

  (anomaliesResult?.anomalies || []).slice(0, 3).forEach((anomaly, idx) => {
    pushCard({
      id: `anomaly_${idx + 1}`,
      type: "anomaly",
      severity: anomaly?.severity || "medium",
      title: "Potential anomaly",
      message: safeText(anomaly?.message),
    });
  });

  (Array.isArray(aiInsights) ? aiInsights : []).slice(0, 6).forEach((insight, idx) => {
    if (typeof insight === "string") {
      pushCard({
        id: `ai_${idx + 1}`,
        type: "insight",
        severity: "low",
        title: `AI insight ${idx + 1}`,
        message: insight,
      });
      return;
    }
    pushCard({
      id: safeText(insight?.id) || `ai_${idx + 1}`,
      type: safeText(insight?.type) || "insight",
      severity: safeText(insight?.severity) || "low",
      title: safeText(insight?.title) || `AI insight ${idx + 1}`,
      message: safeText(insight?.message) || safeText(insight?.title),
    });
  });

  const rowCount = Number(dataset?.rows || 0);
  if (!cards.length && rowCount === 0) {
    pushCard({
      id: "empty_sheet",
      type: "summary",
      severity: "low",
      title: "No data yet",
      message: "Spreadsheet has no populated rows.",
    });
  }

  return cards.slice(0, 12);
}

export function answerSpreadsheetQuery(dataset, query, options = {}) {
  const q = safeText(query).toLowerCase();
  if (!q) return { ok: false, answer: "" };
  const relatedDatasets = Array.isArray(options?.relatedDatasets) ? options.relatedDatasets : [];
  const datasets = compactDatasets(dataset, relatedDatasets);
  const selected = dataset || datasets[0];
  if (!selected) return { ok: false, answer: "" };
  const numericColumns = selected?.numericColumns || [];
  const columns = selected?.columns || [];

  const matchColumn = () => {
    if (!columns.length) return null;
    const byHeader = columns.find((column) => q.includes(normalizeHeader(column.header)));
    if (byHeader) return byHeader;
    return numericColumns[0] || columns[0] || null;
  };

  const explicitDataset = datasets.find((entry) => q.includes(normalizeHeader(entry.sheetName)));
  const workingDataset = explicitDataset || selected;
  const target = explicitDataset
    ? (findColumnByKeywords(explicitDataset, [q], { numericOnly: false }) || pickValueColumn(explicitDataset) || pickLabelColumn(explicitDataset))
    : matchColumn();
  if (!target) return { ok: false, answer: "" };
  const revenueMetric = computeRevenueMetric(workingDataset);
  if (/revenue|sales/.test(q) && revenueMetric && /total|sum|overall|all/.test(q)) {
    return {
      ok: true,
      answer: `Total revenue: ${formatNumber(revenueMetric.sum)}.`,
      metric: "sum",
      sheetId: workingDataset.sheetId,
      sheetName: workingDataset.sheetName,
      columnIndex: target.index,
      columnHeader: target.header,
    };
  }
  if (/highest|top|max|best/.test(q) && /(revenue|sales|product|item)/.test(q) && revenueMetric) {
    return {
      ok: true,
      answer: revenueMetric.maxLabel
        ? `Highest revenue item: ${revenueMetric.maxLabel} (${formatNumber(revenueMetric.max)}).`
        : `Highest revenue value: ${formatNumber(revenueMetric.max)}.`,
      metric: "max",
      sheetId: workingDataset.sheetId,
      sheetName: workingDataset.sheetName,
      columnIndex: target.index,
      columnHeader: target.header,
    };
  }
  const stats = target.stats || { count: 0, sum: 0, avg: 0, max: 0, min: 0 };

  if (/total|sum|revenue|overall|all/.test(q)) {
    return {
      ok: true,
      answer: `Total ${target.header}: ${formatNumber(stats.sum)}.`,
      metric: "sum",
      sheetId: workingDataset.sheetId,
      sheetName: workingDataset.sheetName,
      columnIndex: target.index,
      columnHeader: target.header,
    };
  }
  if (/average|avg|mean/.test(q)) {
    if (/price/.test(q)) {
      const priceTarget = findColumnByKeywords(workingDataset, ["price", "cost", "rate"], { numericOnly: true });
      if (priceTarget?.stats) {
        return {
          ok: true,
          answer: `Average ${priceTarget.header}: ${formatNumber(priceTarget.stats.avg)}.`,
          metric: "avg",
          sheetId: workingDataset.sheetId,
          sheetName: workingDataset.sheetName,
          columnIndex: priceTarget.index,
          columnHeader: priceTarget.header,
        };
      }
    }
    return {
      ok: true,
      answer: `Average ${target.header}: ${formatNumber(stats.avg)}.`,
      metric: "avg",
      sheetId: workingDataset.sheetId,
      sheetName: workingDataset.sheetName,
      columnIndex: target.index,
      columnHeader: target.header,
    };
  }
  if (/highest|max|largest|top/.test(q)) {
    const row = (workingDataset?.rowItems || []).find((item) => item.cells[target.index]?.numeric && item.cells[target.index].num === stats.max);
    const labelCol = pickLabelColumn(workingDataset);
    const label = row && labelCol ? safeText(row.cells[labelCol.index]?.display) : "";
    return {
      ok: true,
      answer: label
        ? `Highest ${target.header}: ${formatNumber(stats.max)} (${label}).`
        : `Highest ${target.header}: ${formatNumber(stats.max)}.`,
      metric: "max",
      sheetId: workingDataset.sheetId,
      sheetName: workingDataset.sheetName,
      columnIndex: target.index,
      columnHeader: target.header,
    };
  }
  if (/lowest|min|smallest/.test(q)) {
    const row = (workingDataset?.rowItems || []).find((item) => item.cells[target.index]?.numeric && item.cells[target.index].num === stats.min);
    const labelCol = pickLabelColumn(workingDataset);
    const label = row && labelCol ? safeText(row.cells[labelCol.index]?.display) : "";
    return {
      ok: true,
      answer: label
        ? `Lowest ${target.header}: ${formatNumber(stats.min)} (${label}).`
        : `Lowest ${target.header}: ${formatNumber(stats.min)}.`,
      metric: "min",
      sheetId: workingDataset.sheetId,
      sheetName: workingDataset.sheetName,
      columnIndex: target.index,
      columnHeader: target.header,
    };
  }
  if (/count|how many|rows|entries/.test(q)) {
    return {
      ok: true,
      answer: `Data rows: ${workingDataset?.rows || 0}.`,
      metric: "count",
      sheetId: workingDataset.sheetId,
      sheetName: workingDataset.sheetName,
    };
  }

  return { ok: false, answer: "" };
}

export function buildSpreadsheetRelationshipSuggestions({
  sheetNode,
  spreadsheetEngine,
  allSheets = [],
  selectedDataset = null,
  relatedDatasets = [],
} = {}) {
  const suggestions = [];
  const flow = spreadsheetEngine?.getSheetFlow ? spreadsheetEngine.getSheetFlow(sheetNode.id) : {
    incomingEdges: [],
    outgoingEdges: [],
  };
  const sheetsById = new Map((allSheets || []).map((s) => [s.id, s]));
  (flow.incomingEdges || []).forEach((edge) => {
    const src = sheetsById.get(edge.fromSheetId);
    const srcName = safeText(src?.text) || edge.fromSheetId;
    suggestions.push({
      id: `incoming_${edge.fromSheetId}_${edge.toSheetId}`,
      type: "incoming",
      label: `Use data from ${srcName}`,
      message: `${srcName} -> ${safeText(sheetNode.text) || sheetNode.id} (${edge.count} dependencies).`,
    });
  });
  (flow.outgoingEdges || []).forEach((edge) => {
    const dst = sheetsById.get(edge.toSheetId);
    const dstName = safeText(dst?.text) || edge.toSheetId;
    suggestions.push({
      id: `outgoing_${edge.fromSheetId}_${edge.toSheetId}`,
      type: "outgoing",
      label: `Feed ${dstName}`,
      message: `${safeText(sheetNode.text) || sheetNode.id} -> ${dstName} (${edge.count} dependencies).`,
    });
  });

  const qtyCol = findColumnByKeywords(selectedDataset, ["qty", "quantity", "units", "count"], { numericOnly: true });
  const priceColInSelected = findColumnByKeywords(selectedDataset, ["price", "cost", "rate"], { numericOnly: true });
  if (qtyCol && priceColInSelected) {
    suggestions.push({
      id: `formula_revenue_same_sheet_${selectedDataset.sheetId}`,
      type: "formula",
      label: "Auto-fill revenue formula",
      message: `Multiply ${priceColInSelected.header} by ${qtyCol.header} in this sheet.`,
      formulaTemplate: {
        mode: "same_sheet_multiply",
        leftColumnIndex: priceColInSelected.index,
        rightColumnIndex: qtyCol.index,
      },
    });
  }
  if (qtyCol) {
    (Array.isArray(relatedDatasets) ? relatedDatasets : []).forEach((dataset) => {
      if (!dataset || dataset.sheetId === selectedDataset?.sheetId) return;
      const priceCol = findColumnByKeywords(dataset, ["price", "cost", "rate"], { numericOnly: true });
      if (!priceCol) return;
      suggestions.push({
        id: `formula_revenue_cross_${dataset.sheetId}`,
        type: "formula",
        label: "Calculate total revenue?",
        message: `Use ${dataset.sheetName}.${priceCol.header} with ${selectedDataset?.sheetName || "current sheet"}.${qtyCol.header}.`,
        formulaTemplate: {
          mode: "cross_sheet_lookup_multiply",
          priceSheetId: dataset.sheetId,
          priceSheetName: dataset.sheetName,
          priceColumnHeader: priceCol.header,
          quantityColumnIndex: qtyCol.index,
          quantityColumnHeader: qtyCol.header,
          rowKeyColumnIndex: 0,
        },
      });
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      id: "no_relation",
      type: "hint",
      label: "No cross-sheet dependencies yet",
      message: "Connect spreadsheets and reference cells to unlock relationship insights.",
    });
  }
  return suggestions.slice(0, 12);
}

function generatePalette(index) {
  const base = [
    "#60a5fa",
    "#34d399",
    "#f59e0b",
    "#f472b6",
    "#a78bfa",
    "#22d3ee",
    "#f87171",
    "#84cc16",
  ];
  return base[index % base.length];
}

function chartBasePosition(sheetNode) {
  const x = (Number(sheetNode?.x) || 0) + (Number(sheetNode?.w) || 600) + 120;
  const y = Number(sheetNode?.y) || 0;
  return { x, y };
}

export function buildChartGraph({ sheetNode, dataset, type = "bar", uid, theme }) {
  const chartType = normalizeChartType(type);
  const labelColumn = pickLabelColumn(dataset);
  const valueColumn = pickValueColumn(dataset);
  if (!sheetNode || !labelColumn || !valueColumn) return { nodes: [], arrows: [] };

  const rows = (dataset.rowItems || [])
    .map((row) => ({
      label: safeText(row.cells[labelColumn.index]?.display) || `Row ${row.row + 1}`,
      value: row.cells[valueColumn.index]?.numeric ? row.cells[valueColumn.index].num : NaN,
    }))
    .filter((row) => Number.isFinite(row.value))
    .slice(0, 8);
  if (!rows.length) return { nodes: [], arrows: [] };

  const maxValue = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  const base = chartBasePosition(sheetNode);
  const chartNode = {
    id: uid(),
    type: "chart",
    x: base.x,
    y: base.y,
    w: 380,
    h: 248,
    text: `${chartType.toUpperCase()} Chart`,
    color: theme.bg2,
    textColor: theme.t0,
    borderColor: theme.b1,
    fontSize: 12,
    fontWeight: "700",
    chartType,
    chartConfig: {
      labelColumnIndex: labelColumn.index,
      valueColumnIndex: valueColumn.index,
    },
    chartData: rows,
    chartSummary: `${valueColumn.header} by ${labelColumn.header} • max ${formatNumber(maxValue)}`,
    dataFlowError: null,
  };
  const arrow = {
    id: uid(),
    fromId: sheetNode.id,
    toId: chartNode.id,
    label: "data",
    flowType: "data",
    depType: "related",
  };
  return { nodes: [chartNode], arrows: [arrow] };
}

export function computeKpiValue(dataset, binding) {
  const metric = safeText(binding?.metric).toLowerCase() || "sum";
  const colIndex = Number.isInteger(Number(binding?.columnIndex)) ? Number(binding.columnIndex) : -1;
  const column = colIndex >= 0 ? (dataset.columns[colIndex] || null) : (pickValueColumn(dataset) || null);
  const stats = column?.stats || { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
  if (metric === "count") return dataset.rows || 0;
  if (metric === "avg") return stats.avg;
  if (metric === "min") return stats.min;
  if (metric === "max") return stats.max;
  return stats.sum;
}

export function formatKpiNodeText(binding, value) {
  const title = safeText(binding?.title) || safeText(binding?.label) || "KPI";
  const metric = safeText(binding?.metric).toUpperCase() || "SUM";
  const column = safeText(binding?.columnHeader) || "Value";
  const valText = typeof value === "number" ? formatNumber(value) : safeText(value);
  return `${title}\n${metric} (${column})\n${valText}`;
}

export function buildKpiNode({ sheetNode, binding, value, uid, theme, index = 0 }) {
  const baseX = (Number(sheetNode?.x) || 0) + (Number(sheetNode?.w) || 600) + 120;
  const baseY = (Number(sheetNode?.y) || 0) + 340 + index * 118;
  return {
    id: uid(),
    type: "kpi",
    x: baseX,
    y: baseY,
    w: 280,
    h: 108,
    text: formatKpiNodeText(binding, value),
    color: theme.bg2,
    textColor: theme.t0,
    borderColor: theme.yDim || "#facc15",
    fontSize: 12,
    fontWeight: "700",
    kpiMetric: safeText(binding?.metric || "sum").toLowerCase() || "sum",
    kpiLabel: safeText(binding?.title || binding?.label || "KPI"),
    kpiBinding: {
      sheetId: binding.sheetId,
      metric: binding.metric,
      columnIndex: binding.columnIndex,
      columnHeader: binding.columnHeader,
      title: binding.title || binding.label || "KPI",
    },
    kpiValue: Number.isFinite(Number(value)) ? Number(value) : null,
    dataFlowError: null,
  };
}

export function buildSpreadsheetAiContextPayload({ selectedDataset, relatedDatasets = [] }) {
  const compact = (dataset) => ({
    sheetId: dataset.sheetId,
    sheetName: dataset.sheetName,
    rows: dataset.rows,
    cols: dataset.cols,
    columns: dataset.columns.map((column) => ({
      index: column.index,
      header: column.header,
      numeric: column.numeric,
      count: column.stats?.count || 0,
      sum: column.stats?.sum || 0,
      avg: column.stats?.avg || 0,
      min: column.stats?.min || 0,
      max: column.stats?.max || 0,
    })),
    sampleRows: dataset.sampleRows.slice(0, 8).map((row) => row.cells.map((cell) => cell.display)),
  });
  return {
    selected: compact(selectedDataset),
    related: relatedDatasets.slice(0, 3).map(compact),
  };
}

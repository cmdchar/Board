const SHEET_TYPE = "sheet";
const FORMULA_SAFE_CHARS_RE = /^[A-Za-z0-9_+\-*/^().,:<>=! \t"'[\]]+$/;
const FORMULA_IDENTIFIER_RE = /[A-Za-z_][A-Za-z0-9_]*/g;
const FORMULA_ALLOWED_IDENTIFIERS = new Set([
  "__cell",
  "__range",
  "__xcell",
  "__xrange",
  "__xlookup",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "COUNT",
  "true",
  "false",
  "null",
  "undefined",
]);

function toNumber(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function asRefError(message) {
  const err = new Error(message || "Invalid reference");
  err.code = "REF";
  return err;
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeLooseToken(value) {
  return normalizeToken(value).replace(/[^a-z0-9]/g, "");
}

function alphaToIndex(alpha) {
  const txt = String(alpha || "").trim().toUpperCase();
  if (!txt || !/^[A-Z]+$/.test(txt)) return -1;
  let value = 0;
  for (let i = 0; i < txt.length; i += 1) {
    value = value * 26 + (txt.charCodeAt(i) - 64);
  }
  return value - 1;
}

function flattenFormulaArgs(args) {
  const out = [];
  const walk = (value) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    out.push(value);
  };
  args.forEach(walk);
  return out;
}

function formatFormulaValue(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "#ERR";
    const abs = Math.abs(value);
    if (abs >= 1e9 || (abs > 0 && abs < 1e-6)) return value.toExponential(4);
    const rounded = Math.round((value + Number.EPSILON) * 1e6) / 1e6;
    return String(rounded);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value === null || value === undefined) return "";
  return String(value);
}

function isFormulaIdentifierUnsafe(expr) {
  const scrubbed = String(expr || "")
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
  if (/[A-Za-z_][A-Za-z0-9_]*\s*\./.test(scrubbed)) return true;
  const ids = scrubbed.match(FORMULA_IDENTIFIER_RE) || [];
  return ids.some((id) => !FORMULA_ALLOWED_IDENTIFIERS.has(id));
}

function makePlaceholderStore() {
  const values = [];
  return {
    hold(code) {
      const key = `__TK${values.length}__`;
      values.push(code);
      return key;
    },
    inject(source) {
      let out = String(source || "");
      values.forEach((code, idx) => {
        const re = new RegExp(`__TK${idx}__`, "g");
        out = out.replace(re, code);
      });
      return out;
    },
  };
}

function tokenizeFormulaExpression(expr) {
  let source = String(expr || "").trim();
  if (!source) return "";
  if (!FORMULA_SAFE_CHARS_RE.test(source)) {
    throw new Error("invalid formula");
  }

  const placeholders = makePlaceholderStore();

  source = source.replace(
    /sheet\(\s*(['"])(.*?)\1\s*\)\s*\.\s*([A-Za-z]+[1-9][0-9]*)/gi,
    (_, __quote, sheetName, ref) => placeholders.hold(`__xcell(${JSON.stringify(String(sheetName || "").trim())},${JSON.stringify(String(ref || "").toUpperCase())})`),
  );

  source = source.replace(
    /sheet\(\s*(['"])(.*?)\1\s*\)\s*\.\s*([A-Za-z_][A-Za-z0-9_ ]*)\s*\[\s*([^\]]+?)\s*\]/gi,
    (_, __quote, sheetName, column, rowKey) => placeholders.hold(`__xlookup(${JSON.stringify(String(sheetName || "").trim())},${JSON.stringify(String(column || "").trim())},${JSON.stringify(String(rowKey || "").trim())})`),
  );

  source = source.replace(
    /(^|[^A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_ ]*)!([A-Za-z_][A-Za-z0-9_ ]*)\[([^\]]+?)\]/g,
    (whole, lead, sheetToken, columnToken, rowToken) => {
      if (!sheetToken || !columnToken) return whole;
      const token = placeholders.hold(`__xlookup(${JSON.stringify(String(sheetToken || "").trim())},${JSON.stringify(String(columnToken || "").trim())},${JSON.stringify(String(rowToken || "").trim())})`);
      return `${lead}${token}`;
    },
  );

  source = source.replace(
    /(^|[^A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_ ]*)!([A-Za-z]+[1-9][0-9]*)\s*:\s*([A-Za-z_][A-Za-z0-9_ ]*)!([A-Za-z]+[1-9][0-9]*)/g,
    (whole, lead, sheetA, refA, sheetB, refB) => {
      if (normalizeToken(sheetA) !== normalizeToken(sheetB)) return whole;
      const token = placeholders.hold(`__xrange(${JSON.stringify(String(sheetA || "").trim())},${JSON.stringify(String(refA || "").toUpperCase())},${JSON.stringify(String(refB || "").toUpperCase())})`);
      return `${lead}${token}`;
    },
  );

  source = source.replace(
    /(^|[^A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_ ]*)!([A-Za-z]+[1-9][0-9]*)\s*:\s*([A-Za-z]+[1-9][0-9]*)/g,
    (whole, lead, sheetToken, refA, refB) => {
      const token = placeholders.hold(`__xrange(${JSON.stringify(String(sheetToken || "").trim())},${JSON.stringify(String(refA || "").toUpperCase())},${JSON.stringify(String(refB || "").toUpperCase())})`);
      return `${lead}${token}`;
    },
  );

  source = source.replace(
    /(^|[^A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_ ]*)!([A-Za-z]+[1-9][0-9]*)/g,
    (whole, lead, sheetToken, ref) => {
      const token = placeholders.hold(`__xcell(${JSON.stringify(String(sheetToken || "").trim())},${JSON.stringify(String(ref || "").toUpperCase())})`);
      return `${lead}${token}`;
    },
  );

  source = source.replace(
    /([A-Za-z]+[1-9][0-9]*):([A-Za-z]+[1-9][0-9]*)/g,
    (_, aRef, bRef) => placeholders.hold(`__range(${JSON.stringify(String(aRef || "").toUpperCase())},${JSON.stringify(String(bRef || "").toUpperCase())})`),
  );

  source = source.replace(
    /\b([A-Za-z]+[1-9][0-9]*)\b/g,
    (_, ref) => `__cell(${JSON.stringify(String(ref || "").toUpperCase())})`,
  );

  const jsExpr = placeholders.inject(source).replace(/\^/g, "**");
  if (isFormulaIdentifierUnsafe(jsExpr)) {
    throw new Error("invalid formula");
  }
  return jsExpr;
}

function evaluateFormulaExpression(expr, resolvers) {
  const jsExpr = tokenizeFormulaExpression(expr);
  const fnNums = (args) => flattenFormulaArgs(args).map(toNumber).filter(Number.isFinite);
  const SUM = (...args) => fnNums(args).reduce((sum, value) => sum + value, 0);
  const AVG = (...args) => {
    const values = fnNums(args);
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };
  const MIN = (...args) => {
    const values = fnNums(args);
    return values.length ? Math.min(...values) : 0;
  };
  const MAX = (...args) => {
    const values = fnNums(args);
    return values.length ? Math.max(...values) : 0;
  };
  const COUNT = (...args) => fnNums(args).length;

  const numOrZero = (value) => {
    const n = toNumber(value);
    return Number.isFinite(n) ? n : 0;
  };

  const compiled = Function(
    "__cell",
    "__range",
    "__xcell",
    "__xrange",
    "__xlookup",
    "SUM",
    "AVG",
    "MIN",
    "MAX",
    "COUNT",
    `"use strict"; return (${jsExpr});`,
  );

  return compiled(
    (ref) => numOrZero(resolvers.cell(ref).num),
    (aRef, bRef) => resolvers.range(aRef, bRef).map((value) => numOrZero(value)),
    (sheetToken, ref) => numOrZero(resolvers.xcell(sheetToken, ref).num),
    (sheetToken, aRef, bRef) => resolvers.xrange(sheetToken, aRef, bRef).map((value) => numOrZero(value)),
    (sheetToken, columnToken, rowToken) => numOrZero(resolvers.xlookup(sheetToken, columnToken, rowToken).num),
    SUM,
    AVG,
    MIN,
    MAX,
    COUNT,
  );
}

function normalizeSheetNode(node) {
  const rows = clampInt(node?.sheetRows, 12, 1, 400);
  const cols = clampInt(node?.sheetCols, 6, 1, 52);
  return {
    id: String(node?.id || ""),
    name: String(node?.text || "").trim() || String(node?.id || "Sheet"),
    rows,
    cols,
    cells: node?.sheetCells && typeof node.sheetCells === "object" ? node.sheetCells : {},
  };
}

function collectSheetTokens(sheet) {
  const tokens = new Set();
  const loose = new Set();
  const add = (value) => {
    const token = normalizeToken(value);
    if (!token) return;
    tokens.add(token);
    const looseToken = normalizeLooseToken(token);
    if (looseToken) loose.add(looseToken);
  };
  add(sheet.id);
  add(sheet.name);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(sheet.name)) add(sheet.name);
  return { tokens, loose };
}

function buildSheetIndex(sheetNodes) {
  const ordered = [];
  const byId = new Map();
  const tokenToIds = new Map();
  const looseTokenToIds = new Map();

  sheetNodes.forEach((node) => {
    const normalized = normalizeSheetNode(node);
    if (!normalized.id) return;
    ordered.push(normalized);
    byId.set(normalized.id, normalized);
    const tokenData = collectSheetTokens(normalized);
    tokenData.tokens.forEach((token) => {
      const arr = tokenToIds.get(token) || [];
      if (!arr.includes(normalized.id)) arr.push(normalized.id);
      tokenToIds.set(token, arr);
    });
    tokenData.loose.forEach((token) => {
      const arr = looseTokenToIds.get(token) || [];
      if (!arr.includes(normalized.id)) arr.push(normalized.id);
      looseTokenToIds.set(token, arr);
    });
  });

  return {
    ordered,
    byId,
    tokenToIds,
    looseTokenToIds,
  };
}

function resolveSheetIdByToken(index, sheetToken, currentSheetId) {
  const txt = String(sheetToken || "").trim();
  if (!txt) return currentSheetId || "";
  const token = normalizeToken(txt);
  if (index.byId.has(txt)) return txt;
  if (index.byId.has(token)) return token;
  const direct = index.tokenToIds.get(token);
  if (direct && direct.length) return direct[0];
  const looseToken = normalizeLooseToken(token);
  if (looseToken) {
    const loose = index.looseTokenToIds.get(looseToken);
    if (loose && loose.length) return loose[0];
  }
  return "";
}

function parseLookupColumn(sheet, columnToken) {
  const txt = String(columnToken || "").trim();
  if (!txt) return -1;
  if (/^[A-Za-z]+$/.test(txt)) {
    const index = alphaToIndex(txt);
    if (index >= 0 && index < sheet.cols) return index;
  }
  const needle = normalizeToken(txt);
  for (let c = 0; c < sheet.cols; c += 1) {
    const header = String(sheet.cells[sheetCellKey(0, c)] || "").trim();
    if (normalizeToken(header) === needle) return c;
  }
  return -1;
}

function parseLookupRow(sheet, rowToken) {
  const txt = String(rowToken || "").trim();
  if (!txt) return -1;
  if (/^[1-9][0-9]*$/.test(txt)) {
    const row = Number(txt) - 1;
    return row >= 0 && row < sheet.rows ? row : -1;
  }
  const cellRef = parseSheetCellRef(txt);
  if (cellRef && cellRef.row >= 0 && cellRef.row < sheet.rows) return cellRef.row;

  const needle = normalizeToken(txt);
  for (let r = 0; r < sheet.rows; r += 1) {
    const value = String(sheet.cells[sheetCellKey(r, 0)] || "").trim();
    if (normalizeToken(value) === needle) return r;
  }
  if (/^[A-Za-z]+$/.test(txt)) {
    const idx = alphaToIndex(txt);
    const row = idx + 1;
    if (row >= 0 && row < sheet.rows) return row;
  }
  return -1;
}

function makeAbsoluteCellKey(sheetId, row, col) {
  return `${sheetId}::${sheetCellKey(row, col)}`;
}

function buildSheetReferenceToken(sheetNode, row, col) {
  const ref = `${sheetColLabel(col)}${row + 1}`;
  const rawName = String(sheetNode?.text || sheetNode?.id || "Sheet").trim();
  const safeName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(rawName);
  if (safeName) return `${rawName}!${ref}`;
  const escaped = rawName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `sheet("${escaped}").${ref}`;
}

function collectReferencedSheetIdsFromFormula(formula, currentSheetId, index) {
  const txt = String(formula || "");
  if (!txt.startsWith("=")) return [];
  const out = new Set();
  const addResolved = (token) => {
    const id = resolveSheetIdByToken(index, token, currentSheetId);
    if (id && id !== currentSheetId) out.add(id);
  };
  txt.replace(/sheet\(\s*(['"])(.*?)\1\s*\)/gi, (_, __quote, token) => {
    addResolved(token);
    return _;
  });
  txt.replace(/([A-Za-z_][A-Za-z0-9_ ]*)!/g, (_, token) => {
    addResolved(token);
    return _;
  });
  return [...out];
}

export function sheetColLabel(index) {
  let n = Number(index) || 0;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export function sheetCellKey(row, col) {
  return `${row},${col}`;
}

export function parseSheetCellRef(ref) {
  const m = String(ref || "")
    .trim()
    .toUpperCase()
    .match(/^([A-Z]+)([1-9][0-9]*)$/);
  if (!m) return null;
  const col = alphaToIndex(m[1]);
  if (col < 0) return null;
  return { row: Number(m[2]) - 1, col };
}

export function appendFormulaReference(expr, token) {
  const ref = String(token || "").trim();
  if (!ref) return String(expr || "");
  const raw = String(expr || "");
  if (!raw.startsWith("=")) return `=${ref}`;
  const body = raw.slice(1);
  if (!body.trim()) return `=${ref}`;
  const trimmed = body.replace(/\s+$/, "");
  if (/[+\-*/^(,]$/.test(trimmed)) return `=${trimmed}${ref}`;
  return `=${trimmed}+${ref}`;
}

export function createSpreadsheetEngine({ nodes = [], arrows = [] } = {}) {
  const sheets = nodes.filter((node) => node?.type === SHEET_TYPE);
  const index = buildSheetIndex(sheets);
  const memo = new Map();
  const stack = new Set();
  const dependencies = new Map();

  function evaluateCell(sheetId, row, col) {
    const sheet = index.byId.get(sheetId);
    if (!sheet) throw asRefError(`Unknown sheet "${sheetId}"`);
    const r = Number(row);
    const c = Number(col);
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= sheet.rows || c >= sheet.cols) {
      throw asRefError("Cell out of bounds");
    }
    const absKey = makeAbsoluteCellKey(sheet.id, r, c);
    if (memo.has(absKey)) return memo.get(absKey);
    const raw = String(sheet.cells[sheetCellKey(r, c)] ?? "");

    if (!raw.startsWith("=")) {
      const n = toNumber(raw);
      const info = {
        sheetId: sheet.id,
        row: r,
        col: c,
        raw,
        display: raw,
        num: Number.isFinite(n) ? n : 0,
        error: false,
        errorCode: "",
      };
      memo.set(absKey, info);
      dependencies.delete(absKey);
      return info;
    }

    if (stack.has(absKey)) {
      const info = {
        sheetId: sheet.id,
        row: r,
        col: c,
        raw,
        display: "#CYCLE!",
        num: 0,
        error: true,
        errorCode: "CYCLE",
      };
      memo.set(absKey, info);
      dependencies.set(absKey, new Set());
      return info;
    }

    stack.add(absKey);
    const depSet = new Set();
    dependencies.set(absKey, depSet);

    const readCell = (targetSheetId, targetRow, targetCol) => {
      const info = evaluateCell(targetSheetId, targetRow, targetCol);
      depSet.add(makeAbsoluteCellKey(targetSheetId, targetRow, targetCol));
      if (info?.error) {
        if (info.errorCode === "CYCLE") throw new Error("cycle");
        if (info.errorCode === "REF") throw asRefError("Reference error");
        throw new Error("Dependency error");
      }
      return info;
    };

    const resolveRange = (targetSheetId, aRef, bRef) => {
      const a = parseSheetCellRef(aRef);
      const b = parseSheetCellRef(bRef);
      if (!a || !b) throw asRefError("Invalid range");
      const result = [];
      const r1 = Math.min(a.row, b.row);
      const r2 = Math.max(a.row, b.row);
      const c1 = Math.min(a.col, b.col);
      const c2 = Math.max(a.col, b.col);
      for (let rr = r1; rr <= r2; rr += 1) {
        for (let cc = c1; cc <= c2; cc += 1) {
          result.push(readCell(targetSheetId, rr, cc).num);
        }
      }
      return result;
    };

    try {
      const value = evaluateFormulaExpression(raw.slice(1), {
        cell: (ref) => {
          const pos = parseSheetCellRef(ref);
          if (!pos) throw asRefError(`Invalid cell "${ref}"`);
          return readCell(sheet.id, pos.row, pos.col);
        },
        range: (aRef, bRef) => resolveRange(sheet.id, aRef, bRef),
        xcell: (sheetToken, ref) => {
          const targetId = resolveSheetIdByToken(index, sheetToken, sheet.id);
          if (!targetId) throw asRefError(`Unknown sheet "${sheetToken}"`);
          const pos = parseSheetCellRef(ref);
          if (!pos) throw asRefError(`Invalid cell "${ref}"`);
          return readCell(targetId, pos.row, pos.col);
        },
        xrange: (sheetToken, aRef, bRef) => {
          const targetId = resolveSheetIdByToken(index, sheetToken, sheet.id);
          if (!targetId) throw asRefError(`Unknown sheet "${sheetToken}"`);
          return resolveRange(targetId, aRef, bRef);
        },
        xlookup: (sheetToken, columnToken, rowToken) => {
          const targetId = resolveSheetIdByToken(index, sheetToken, sheet.id);
          if (!targetId) throw asRefError(`Unknown sheet "${sheetToken}"`);
          const target = index.byId.get(targetId);
          if (!target) throw asRefError(`Unknown sheet "${sheetToken}"`);
          const targetCol = parseLookupColumn(target, columnToken);
          const targetRow = parseLookupRow(target, rowToken);
          if (targetCol < 0 || targetRow < 0) {
            throw asRefError(`Lookup not found: ${columnToken}[${rowToken}]`);
          }
          return readCell(targetId, targetRow, targetCol);
        },
      });
      const num = toNumber(value);
      const display = formatFormulaValue(value);
      const info = {
        sheetId: sheet.id,
        row: r,
        col: c,
        raw,
        display,
        num: Number.isFinite(num) ? num : 0,
        error: display === "#ERR",
        errorCode: display === "#ERR" ? "ERR" : "",
      };
      memo.set(absKey, info);
      return info;
    } catch (error) {
      const isCycle = /cycle/i.test(String(error?.message || ""));
      const isRef = error?.code === "REF" || /reference|sheet|lookup|bounds|cell/i.test(String(error?.message || ""));
      const display = isCycle ? "#CYCLE!" : (isRef ? "#REF!" : "#ERR");
      const info = {
        sheetId: sheet.id,
        row: r,
        col: c,
        raw,
        display,
        num: 0,
        error: true,
        errorCode: isCycle ? "CYCLE" : (isRef ? "REF" : "ERR"),
      };
      memo.set(absKey, info);
      return info;
    } finally {
      stack.delete(absKey);
    }
  }

  index.ordered.forEach((sheet) => {
    Object.entries(sheet.cells).forEach(([key, value]) => {
      if (!String(value || "").startsWith("=")) return;
      const [rowTxt, colTxt] = String(key || "").split(",");
      const row = Number(rowTxt);
      const col = Number(colTxt);
      if (!Number.isInteger(row) || !Number.isInteger(col)) return;
      if (row < 0 || col < 0 || row >= sheet.rows || col >= sheet.cols) return;
      try {
        evaluateCell(sheet.id, row, col);
      } catch {
        // keep engine stable for invalid formulas
      }
    });
  });

  const dependents = new Map();
  dependencies.forEach((depSet, cellKey) => {
    depSet.forEach((depKey) => {
      const bucket = dependents.get(depKey) || new Set();
      bucket.add(cellKey);
      dependents.set(depKey, bucket);
    });
  });

  const sheetEdgeCounter = new Map();
  dependencies.forEach((depSet, cellKey) => {
    const targetSheetId = String(cellKey).split("::")[0] || "";
    depSet.forEach((depKey) => {
      const sourceSheetId = String(depKey).split("::")[0] || "";
      if (!sourceSheetId || !targetSheetId || sourceSheetId === targetSheetId) return;
      const edgeKey = `${sourceSheetId}->${targetSheetId}`;
      sheetEdgeCounter.set(edgeKey, (sheetEdgeCounter.get(edgeKey) || 0) + 1);
    });
  });

  const sheetEdges = [...sheetEdgeCounter.entries()].map(([key, count]) => {
    const parts = key.split("->");
    return {
      fromSheetId: parts[0],
      toSheetId: parts[1],
      count,
    };
  });

  const outgoingBySheet = new Map();
  const incomingBySheet = new Map();
  sheetEdges.forEach((edge) => {
    const out = outgoingBySheet.get(edge.fromSheetId) || [];
    out.push(edge);
    outgoingBySheet.set(edge.fromSheetId, out);
    const incoming = incomingBySheet.get(edge.toSheetId) || [];
    incoming.push(edge);
    incomingBySheet.set(edge.toSheetId, incoming);
  });

  const connectedSheetArrows = new Set(
    (Array.isArray(arrows) ? arrows : [])
      .map((arrow) => {
        const fromId = arrow?.from?.entityId || arrow?.fromId || "";
        const toId = arrow?.to?.entityId || arrow?.toId || "";
        if (!fromId || !toId) return "";
        if (!index.byId.has(fromId) || !index.byId.has(toId)) return "";
        return `${fromId}->${toId}`;
      })
      .filter(Boolean),
  );

  return {
    sheetCount: index.ordered.length,
    sheets: index.ordered,
    evaluateCell,
    evaluateDisplay(sheetId, row, col) {
      return evaluateCell(sheetId, row, col).display;
    },
    getReferencedSheetIds(formula, currentSheetId) {
      return collectReferencedSheetIdsFromFormula(formula, currentSheetId, index);
    },
    getDependentsForCell(sheetId, row, col) {
      const key = makeAbsoluteCellKey(sheetId, row, col);
      return [...(dependents.get(key) || new Set())];
    },
    getDependenciesForCell(sheetId, row, col) {
      const key = makeAbsoluteCellKey(sheetId, row, col);
      return [...(dependencies.get(key) || new Set())];
    },
    getSheetFlow(sheetId) {
      return {
        incoming: (incomingBySheet.get(sheetId) || []).reduce((sum, edge) => sum + edge.count, 0),
        outgoing: (outgoingBySheet.get(sheetId) || []).reduce((sum, edge) => sum + edge.count, 0),
        incomingEdges: incomingBySheet.get(sheetId) || [],
        outgoingEdges: outgoingBySheet.get(sheetId) || [],
      };
    },
    sheetEdges,
    isDataFlowEdge(fromSheetId, toSheetId) {
      return sheetEdgeCounter.has(`${fromSheetId}->${toSheetId}`);
    },
    isConnectorBackedDataFlow(fromSheetId, toSheetId) {
      return connectedSheetArrows.has(`${fromSheetId}->${toSheetId}`) && sheetEdgeCounter.has(`${fromSheetId}->${toSheetId}`);
    },
  };
}

export { buildSheetReferenceToken, collectReferencedSheetIdsFromFormula };

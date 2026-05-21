import { create } from 'zustand';
import { UI_TOKENS } from '../styles/tokens';

const T = UI_TOKENS;
const GRID = 24;

const ADD_TOOLS = new Set([
  "sticky", "text", "rect", "circle", "diamond", "triangle", "hexagon", "parallelogram", "cloud", "cylinder",
  "laneH", "laneV", "table", "sheet", "deck", "note", "task", "milestone", "decision", "transform", "frame", "comment", "vote", "arrow",
]);

const SHAPE_DEFAULTS = {
  rect: { w: 150, h: 76 },
  circle: { w: 100, h: 100 },
  diamond: { w: 130, h: 86 },
  triangle: { w: 150, h: 110 },
  hexagon: { w: 170, h: 108 },
  parallelogram: { w: 170, h: 96 },
  cloud: { w: 190, h: 124 },
  cylinder: { w: 160, h: 116 },
};

const TABLE_MIN_COLS = 2;
const TABLE_MIN_ROWS = 1;
const TIDY_GAP_X = 72;
const TIDY_GAP_Y = 72;

function cloneNodePayload(node) {
  const copy = { ...node };
  if (copy.reactions && typeof copy.reactions === "object") copy.reactions = { ...copy.reactions };
  if (copy.sheetCells && typeof copy.sheetCells === "object") copy.sheetCells = { ...copy.sheetCells };
  if (copy.sheetColSizes && typeof copy.sheetColSizes === "object") copy.sheetColSizes = { ...copy.sheetColSizes };
  if (copy.sheetRowSizes && typeof copy.sheetRowSizes === "object") copy.sheetRowSizes = { ...copy.sheetRowSizes };
  if (Array.isArray(copy.deckSlides)) copy.deckSlides = copy.deckSlides.map(sl => ({ ...sl }));
  return copy;
}

export const useStore = create((set, get) => ({
  // State
  nodes: [],
  arrows: [],
  sel: [],
  tool: "select",
  lastNonAddTool: "select",
  autoReturnToSelect: true,
  zoom: 1,
  px: 0,
  py: 0,
  arrowFrom: null,
  comments: [],
  drawings: [],
  votes: {},
  snapGrid: false,
  clipboard: [],
  depMode: false,
  bgColor: null,
  canvasTheme: null,
  focusMode: false,
  hist: [],
  fut: [],

  // Actions
  setTool: (v) => set(state => {
    const next = String(v || "select");
    return {
      tool: next,
      lastNonAddTool: next === "select" || next === "pan" ? next : (state.lastNonAddTool || "select"),
      arrowFrom: null,
    };
  }),

  exitAddMode: () => set({ tool: "select", lastNonAddTool: "select", arrowFrom: null }),

  setSel: (v) => set({ sel: v }),

  setZoom: (v) => set({ zoom: Math.max(0.08, Math.min(6, v)) }),

  setPan: (x, y) => set({ px: x, py: y }),

  addNode: (node) => set(state => {
    const nextTool = state.autoReturnToSelect && ADD_TOOLS.has(state.tool) ? "select" : state.tool;
    return {
      tool: nextTool,
      lastNonAddTool: nextTool === "select" || nextTool === "pan" ? nextTool : (state.lastNonAddTool || "select"),
      nodes: [...state.nodes, node],
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),

  updateNode: (id, p) => set(state => {
    const node = state.nodes.find(n => n.id === id);
    if (!node) return state;

    let nextNodes = state.nodes.map(n => n.id === id ? { ...n, ...p } : n);

    // Obsidian Rename Propagation: If title changes, update all wikilinks
    if (node.type === 'note' && p.text !== undefined) {
      const oldTitle = node.text.split('\n')[0].replace(/^#+\s*/, '').trim();
      const newTitle = p.text.split('\n')[0].replace(/^#+\s*/, '').trim();

      if (oldTitle && newTitle && oldTitle !== newTitle) {
        const escapedOld = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\[\\[${escapedOld}\\]\\]`, 'g');
        const newLink = `[[${newTitle}]]`;

        nextNodes = nextNodes.map(n => {
          if (n.type === 'note' && n.id !== id && n.text.includes(`[[${oldTitle}]]`)) {
            return { ...n, text: n.text.replace(re, newLink) };
          }
          return n;
        });
      }
    }

    return { nodes: nextNodes };
  }),

  updateSel: (p) => set(state => {
    let nextNodes = state.nodes.map(n => state.sel.includes(n.id) ? { ...n, ...p } : n);

    // Obsidian Rename Propagation for selection (e.g. via Inspector)
    if (p.text !== undefined && state.sel.length === 1) {
      const id = state.sel[0];
      const node = state.nodes.find(n => n.id === id);
      if (node && node.type === 'note') {
        const oldTitle = node.text.split('\n')[0].replace(/^#+\s*/, '').trim();
        const newTitle = p.text.split('\n')[0].replace(/^#+\s*/, '').trim();

        if (oldTitle && newTitle && oldTitle !== newTitle) {
          const escapedOld = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`\\[\\[${escapedOld}\\]\\]`, 'g');
          const newLink = `[[${newTitle}]]`;

          nextNodes = nextNodes.map(n => {
            if (n.type === 'note' && n.id !== id && n.text.includes(`[[${oldTitle}]]`)) {
              return { ...n, text: n.text.replace(re, newLink) };
            }
            return n;
          });
        }
      }
    }

    return { nodes: nextNodes };
  }),

  deleteSelected: (ids) => set(state => {
    const targets = ids || state.sel;
    const del = new Set(Array.isArray(targets) ? targets : []);
    state.nodes.forEach(n => { if (n.mergeParentId && del.has(n.mergeParentId)) del.add(n.id); });
    const finalIds = [...del];
    return {
      nodes: state.nodes.filter(n => !del.has(n.id)),
      arrows: state.arrows.filter(a => !finalIds.includes(a.fromId) && !finalIds.includes(a.toId)),
      sel: [],
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),

  addArrow: (arr) => set(state => ({ arrows: [...state.arrows, arr] })),
  deleteArrow: (id) => set(state => ({ arrows: state.arrows.filter(a => a.id !== id) })),
  updateArrow: (id, p) => set(state => ({ arrows: state.arrows.map(a => a.id === id ? { ...a, ...p } : a) })),
  updateMulti: (deltas) => set(state => ({
    nodes: state.nodes.map(n => deltas[n.id] ? { ...n, ...deltas[n.id] } : n)
  })),
  moveSel: (dx, dy) => set(state => ({
    nodes: state.nodes.map(n => state.sel.includes(n.id) && !n.locked ? { ...n, x: n.x + dx, y: n.y + dy } : n)
  })),
  selAll: () => set(state => ({
    sel: state.nodes.filter(n => !n.hidden).map(n => n.id)
  })),

  loadState: (data) => set({
    ...data,
    hist: [],
    fut: [],
  }),

  undo: () => set(state => {
    if (!state.hist.length) return state;
    const prev = state.hist[state.hist.length - 1];
    return {
      nodes: prev.n,
      arrows: prev.a,
      hist: state.hist.slice(0, -1),
      fut: [{ n: state.nodes, a: state.arrows }, ...state.fut]
    };
  }),

  redo: () => set(state => {
    if (!state.fut.length) return state;
    const nxt = state.fut[0];
    return {
      nodes: nxt.n,
      arrows: nxt.a,
      fut: state.fut.slice(1),
      hist: [...state.hist, { n: state.nodes, a: state.arrows }]
    };
  }),

  duplicateSelected: (uid) => set(state => {
    const td = state.nodes.filter(n => state.sel.includes(n.id));
    const nd = td.map(n => ({ ...cloneNodePayload(n), id: uid(), x: n.x + GRID, y: n.y + GRID }));
    return {
      nodes: [...state.nodes, ...nd],
      sel: nd.map(n => n.id),
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),

  tidy: (ids) => set(state => {
    const targets = ids || state.sel;
    const candidates = state.nodes.filter(n => (targets.length ? targets.includes(n.id) : true) && n.type !== "frame" && !n.locked);
    if (candidates.length < 2) return state;
    const sorted = [...candidates].sort((p, q) => p.y === q.y ? p.x - q.x : p.y - q.y);
    const startX = Math.min(...sorted.map(n => n.x));
    const startY = Math.min(...sorted.map(n => n.y));
    const cols = Math.max(2, Math.ceil(Math.sqrt(sorted.length)));
    const rowHeights = [];
    const colWidths = [];
    for (let i = 0; i < sorted.length; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const w = sorted[i].w || 120, h = sorted[i].h || 70;
      rowHeights[r] = Math.max(rowHeights[r] || 0, h);
      colWidths[c] = Math.max(colWidths[c] || 0, w);
    }
    const colStarts = [];
    let cx = startX;
    for (let c = 0; c < cols; c++) { colStarts[c] = cx; cx += (colWidths[c] || 120) + TIDY_GAP_X; }
    const rowStarts = [];
    let cy = startY;
    for (let r = 0; r < rowHeights.length; r++) { rowStarts[r] = cy; cy += (rowHeights[r] || 70) + TIDY_GAP_Y; }
    const upd = {};
    for (let i = 0; i < sorted.length; i++) {
      const r = Math.floor(i / cols), c = i % cols, n = sorted[i];
      const cellW = colWidths[c] || n.w || 120;
      const cellH = rowHeights[r] || n.h || 70;
      upd[n.id] = { x: colStarts[c] + (cellW - (n.w || 120)) / 2, y: rowStarts[r] + (cellH - (n.h || 70)) / 2 };
    }
    return {
      nodes: state.nodes.map(n => upd[n.id] ? { ...n, ...upd[n.id] } : n),
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),

  wrapFrame: (ids, title, uid) => set(state => {
    const targets = ids || state.sel;
    const nodeTargets = state.nodes.filter(n => targets.includes(n.id) && n.type !== "frame");
    if (!nodeTargets.length) return state;
    const minX = Math.min(...nodeTargets.map(n => n.x));
    const minY = Math.min(...nodeTargets.map(n => n.y));
    const maxX = Math.max(...nodeTargets.map(n => n.x + (n.w || 100)));
    const maxY = Math.max(...nodeTargets.map(n => n.y + (n.h || 60)));
    const frame = { id: uid(), type: "frame", x: minX - 40, y: minY - 56, w: (maxX - minX) + 80, h: (maxY - minY) + 96, text: title || "Frame", color: "transparent", borderColor: T.b1 };
    return {
      nodes: [...state.nodes, frame],
      sel: [frame.id],
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),

  groupSelected: (uid) => set(state => {
    const gid = uid();
    return { nodes: state.nodes.map(n => state.sel.includes(n.id) ? { ...n, groupId: gid } : n) };
  }),

  ungroupSelected: () => set(state => ({
    nodes: state.nodes.map(n => state.sel.includes(n.id) ? { ...n, groupId: null } : n)
  })),

  align: (d) => set(state => {
    const selNodes = state.nodes.filter(n => state.sel.includes(n.id));
    if (selNodes.length < 2) return state;
    let upd = {};
    if (d === "left") { const v = Math.min(...selNodes.map(n => n.x)); selNodes.forEach(n => upd[n.id] = { x: v }); }
    else if (d === "right") { const v = Math.max(...selNodes.map(n => n.x + n.w)); selNodes.forEach(n => upd[n.id] = { x: v - n.w }); }
    else if (d === "top") { const v = Math.min(...selNodes.map(n => n.y)); selNodes.forEach(n => upd[n.id] = { y: v }); }
    else if (d === "bottom") { const v = Math.max(...selNodes.map(n => n.y + n.h)); selNodes.forEach(n => upd[n.id] = { y: v - n.h }); }
    else if (d === "cx") { const v = (Math.min(...selNodes.map(n => n.x)) + Math.max(...selNodes.map(n => n.x + n.w))) / 2; selNodes.forEach(n => upd[n.id] = { x: v - n.w / 2 }); }
    else if (d === "cy") { const v = (Math.min(...selNodes.map(n => n.y)) + Math.max(...selNodes.map(n => n.y + n.h))) / 2; selNodes.forEach(n => upd[n.id] = { y: v - n.h / 2 }); }
    else if (d === "dh") {
      const sorted = [...selNodes].sort((a, b) => a.x - b.x);
      const span = sorted[sorted.length - 1].x + sorted[sorted.length - 1].w - sorted[0].x;
      const tw = sorted.reduce((s, n) => s + n.w, 0);
      const gap = sorted.length > 1 ? (span - tw) / (sorted.length - 1) : 0;
      let x = sorted[0].x;
      sorted.forEach(n => { upd[n.id] = { x }; x += n.w + gap; });
    }
    else if (d === "dv") {
      const sorted = [...selNodes].sort((a, b) => a.y - b.y);
      const span = sorted[sorted.length - 1].y + sorted[sorted.length - 1].h - sorted[0].y;
      const th = sorted.reduce((s, n) => s + n.h, 0);
      const gap = sorted.length > 1 ? (span - th) / (sorted.length - 1) : 0;
      let y = sorted[0].y;
      sorted.forEach(n => { upd[n.id] = { y }; y += n.h + gap; });
    }
    return {
      nodes: state.nodes.map(n => upd[n.id] ? { ...n, ...upd[n.id] } : n),
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),

  toggleSnap: () => set(state => ({ snapGrid: !state.snapGrid })),
  toggleDepMode: (v) => set(state => ({ depMode: v !== undefined ? Boolean(v) : !state.depMode })),
  toggleFocusMode: () => set(state => ({ focusMode: !state.focusMode })),

  addComment: (c) => set(state => ({ comments: [...state.comments, c] })),
  deleteComment: (id) => set(state => ({ comments: state.comments.filter(c => c.id !== id) })),
  updateComment: (id, patch) => set(state => ({
    comments: state.comments.map(c => c.id === id ? { ...c, ...patch } : c)
  })),

  addVote: (nodeId) => set(state => ({
    votes: { ...state.votes, [nodeId]: (state.votes[nodeId] || 0) + 1 }
  })),
  clearVotes: () => set({ votes: {} }),

  clearDraws: () => set({ drawings: [] }),
  addDraw: (d) => set(state => ({ drawings: [...state.drawings, d] })),

  setBg: (v) => set({ bgColor: v || null }),
  setCanvasTheme: (id, bg) => set({ canvasTheme: id, bgColor: bg }),

  addReaction: (nodeId, emoji) => set(state => ({
    nodes: state.nodes.map(n => {
      if (n.id !== nodeId) return n;
      const rx = { ...(n.reactions || {}) };
      rx[emoji] = (rx[emoji] || 0) + 1;
      return { ...n, reactions: rx };
    })
  })),

  removeReaction: (nodeId, emoji) => set(state => ({
    nodes: state.nodes.map(n => {
      if (n.id !== nodeId) return n;
      const rx = { ...(n.reactions || {}) };
      if (rx[emoji]) rx[emoji]--;
      if (rx[emoji] <= 0) delete rx[emoji];
      return { ...n, reactions: rx };
    })
  })),

  setStickySize: (v) => set(state => {
    const szMap = { S: { w: 120, h: 90 }, M: { w: 170, h: 130 }, L: { w: 240, h: 180 }, XL: { w: 320, h: 240 } };
    const sz = szMap[v] || szMap.M;
    return {
      nodes: state.nodes.map(n => state.sel.includes(n.id) && n.type === "sticky" ? { ...n, ...sz } : n)
    };
  }),

  setTextAlign: (v) => set(state => ({
    nodes: state.nodes.map(n => state.sel.includes(n.id) ? { ...n, textAlign: v } : n)
  })),

  zFront: () => set(state => {
    const mx = Math.max(0, ...state.nodes.map(n => n.zIndex || 0));
    return { nodes: state.nodes.map(n => state.sel.includes(n.id) ? { ...n, zIndex: mx + 1 } : n) };
  }),

  zBack: () => set(state => ({
    nodes: state.nodes.map(n => state.sel.includes(n.id) ? { ...n, zIndex: 0 } : n)
  })),

  lockSelected: () => set(state => ({
    nodes: state.nodes.map(n => state.sel.includes(n.id) ? { ...n, locked: !n.locked } : n)
  })),

  // Table Actions
  tableAddRow: (tableId, row, getTableInfo, uid) => set(state => {
    const info = getTableInfo(state.nodes, tableId);
    if (!info || info.rows.length >= 40) return state;
    const targetRow = Number.isInteger(row) ? Math.max(0, Math.min(row, info.rows.length)) : info.rows.length;

    const nextNodes = state.nodes.map(n => {
      if (n.tableId !== tableId || n.tableRole !== "cell") return n;
      const r = Number(n.tableRow);
      if (Number.isInteger(r) && r >= targetRow) {
        return { ...n, tableRow: r + 1, y: n.y + info.rowH };
      }
      return n;
    });

    let cursorX = info.x0;
    const created = info.cols.map(c => {
      const w = info.colWidths[c] || 156;
      const cell = {
        id: uid(),
        groupId: info.groupId,
        tableId,
        tableRole: "cell",
        tableRow: targetRow,
        tableCol: c,
        type: "shape",
        shapeType: "rect",
        x: cursorX,
        y: info.y0 + info.headH + targetRow * info.rowH,
        w,
        h: info.rowH,
        text: "",
        color: targetRow % 2 === 0 ? "#edf4ff" : "#f8fbff",
        textColor: "#1e293b",
        borderColor: "#cbd5e1",
        fontSize: 11,
      };
      cursorX += w;
      return cell;
    });

    return {
      nodes: [...nextNodes, ...created],
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),

  tableDelRow: (tableId, row, getTableInfo) => set(state => {
    const info = getTableInfo(state.nodes, tableId);
    if (!info || info.rows.length <= 1) return state;
    const targetRow = Number.isInteger(row) ? Math.max(0, Math.min(row, info.rows.length - 1)) : info.rows[info.rows.length - 1];

    const nextNodes = [];
    for (const n of state.nodes) {
      if (n.tableId !== tableId || n.tableRole !== "cell") { nextNodes.push(n); continue; }
      const r = Number(n.tableRow);
      if (!Number.isInteger(r)) { nextNodes.push(n); continue; }
      if (r === targetRow) continue;
      if (r > targetRow) nextNodes.push({ ...n, tableRow: r - 1, y: n.y - info.rowH });
      else nextNodes.push(n);
    }
    return {
      nodes: nextNodes,
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),

  tableAddCol: (tableId, col, getTableInfo, getTableColumnStart, uid, T) => set(state => {
    const info = getTableInfo(state.nodes, tableId);
    if (!info || info.cols.length >= 12) return state;
    const insertCol = Number.isInteger(col) ? Math.max(0, Math.min(col, info.cols.length)) : info.cols.length;
    const insW = 156;
    const insX = getTableColumnStart(info, insertCol);

    const updated = state.nodes.map(n => {
      if (n.tableId !== tableId) return n;
      if (n.tableRole === "title") return { ...n, w: (n.w || info.totalWidth) + insW };
      if ((n.tableRole === "header" || n.tableRole === "cell") && Number(n.tableCol) >= insertCol) {
        return { ...n, tableCol: Number(n.tableCol) + 1, x: n.x + insW };
      }
      return n;
    });

    const header = {
      id: uid(), groupId: info.groupId, tableId, tableRole: "header", tableCol: insertCol, type: "shape", shapeType: "rect",
      x: insX, y: info.y0, w: insW, h: info.headH, text: `Col ${insertCol + 1}`, color: T.bg4, textColor: T.y, borderColor: T.b2, fontSize: 12, fontWeight: "700",
    };
    const created = [header, ...info.rows.map(r => ({
      id: uid(), groupId: info.groupId, tableId, tableRole: "cell", tableRow: r, tableCol: insertCol, type: "shape", shapeType: "rect",
      x: insX, y: info.y0 + info.headH + r * info.rowH, w: insW, h: info.rowH, text: "", color: r % 2 === 0 ? "#edf4ff" : "#f8fbff", textColor: "#1e293b", borderColor: "#cbd5e1", fontSize: 11,
    }))];

    return {
      nodes: [...updated, ...created].map(n => {
        if (n.tableId !== tableId || n.tableRole !== "header") return n;
        const c = Number(n.tableCol);
        if (!Number.isInteger(c)) return n;
        return { ...n, text: `Col ${c + 1}` };
      }),
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),

  tableDelCol: (tableId, col, getTableInfo) => set(state => {
    const info = getTableInfo(state.nodes, tableId);
    if (!info || info.cols.length <= 2) return state;
    const targetCol = Number.isInteger(col) ? Math.max(0, Math.min(col, info.cols.length - 1)) : info.cols[info.cols.length - 1];
    const remW = info.colWidths[targetCol] || 156;

    const nextNodes = [];
    for (const n of state.nodes) {
      if (n.tableId !== tableId) { nextNodes.push(n); continue; }
      if (n.tableRole === "title") { nextNodes.push({ ...n, w: Math.max(96, (n.w || info.totalWidth) - remW) }); continue; }
      if (n.tableRole !== "header" && n.tableRole !== "cell") { nextNodes.push(n); continue; }
      const c = Number(n.tableCol);
      if (!Number.isInteger(c)) { nextNodes.push(n); continue; }
      if (c === targetCol) continue;
      if (c > targetCol) nextNodes.push({ ...n, tableCol: c - 1, x: n.x - remW });
      else nextNodes.push(n);
    }
    const renamed = nextNodes.map(n => {
      if (n.tableId !== tableId || n.tableRole !== "header") return n;
      const c = Number(n.tableCol);
      return { ...n, text: `Col ${c + 1}` };
    });
    return {
      nodes: renamed,
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),

  tableSetColWidth: (tableId, col, width, getTableInfo) => set(state => {
    const info = getTableInfo(state.nodes, tableId);
    if (!info) return state;
    const targetCol = Number(col);
    if (!Number.isInteger(targetCol) || !info.cols.includes(targetCol)) return state;
    const oldW = info.colWidths[targetCol] || 156;
    const newW = Math.max(96, Math.min(420, Number(width) || oldW));
    const diff = newW - oldW;
    if (Math.abs(diff) < .5) return state;
    const nextNodes = state.nodes.map(n => {
      if (n.tableId !== tableId) return n;
      if (n.tableRole === "title") return { ...n, w: Math.max(96, (n.w || info.totalWidth) + diff) };
      if (n.tableRole !== "header" && n.tableRole !== "cell") return n;
      const c = Number(n.tableCol);
      if (!Number.isInteger(c)) return n;
      if (c === targetCol) return { ...n, w: newW };
      if (c > targetCol) return { ...n, x: n.x + diff };
      return n;
    });
    return {
      nodes: nextNodes,
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),

  tableMerge: (getTableInfo) => set(state => {
    const cells = state.nodes.filter(n => state.sel.includes(n.id) && n.tableRole === "cell" && n.tableId && !n.hidden);
    if (cells.length < 2) return state;
    const tableId = cells[0].tableId;
    const info = getTableInfo(state.nodes, tableId);
    if (!info) return state;
    const rows = [...new Set(cells.map(n => Number(n.tableRow)).filter(Number.isInteger))].sort((a, b) => a - b);
    const cols = [...new Set(cells.map(n => Number(n.tableCol)).filter(Number.isInteger))].sort((a, b) => a - b);
    const minR = rows[0], maxR = rows[rows.length - 1], minC = cols[0], maxC = cols[cols.length - 1];
    const target = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const found = state.nodes.find(n => n.tableId === tableId && n.tableRole === "cell" && Number(n.tableRow) === r && Number(n.tableCol) === c);
        if (found) target.push(found);
      }
    }
    if (target.length !== (maxR - minR + 1) * (maxC - minC + 1)) return state;
    const root = target.find(n => Number(n.tableRow) === minR && Number(n.tableCol) === minC);
    if (!root) return state;
    const selCols = []; for (let c = minC; c <= maxC; c++) selCols.push(c);
    const selRows = []; for (let r = minR; r <= maxR; r++) selRows.push(r);
    const w = selCols.reduce((sum, c) => sum + (info.colWidths[c] || 156), 0);
    const h = selRows.length * info.rowH;
    const tIds = new Set(target.map(n => n.id));
    return {
      nodes: state.nodes.map(n => {
        if (n.id === root.id) return { ...n, w, h, hidden: false, mergeSpanCols: selCols.length, mergeSpanRows: selRows.length, mergeCols: selCols, mergeRows: selRows };
        if (tIds.has(n.id)) return { ...n, hidden: true, mergeParentId: root.id };
        return n;
      }),
      sel: [root.id],
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),

  tableUnmerge: (getTableInfo, getTableColumnStart) => set(state => {
    const root = state.nodes.find(n => state.sel.includes(n.id) && n.tableRole === "cell" && n.tableId && ((Number(n.mergeSpanCols) || 1) > 1 || (Number(n.mergeSpanRows) || 1) > 1));
    if (!root) return state;
    const info = getTableInfo(state.nodes, root.tableId);
    if (!info) return state;
    const r0 = Number(root.tableRow) || 0, c0 = Number(root.tableCol) || 0;
    return {
      nodes: state.nodes.map(n => {
        if (n.id === root.id) return { ...n, x: getTableColumnStart(info, c0), y: info.y0 + info.headH + r0 * info.rowH, w: info.colWidths[c0] || 156, h: info.rowH, hidden: false, mergeSpanCols: 1, mergeSpanRows: 1, mergeCols: null, mergeRows: null };
        if (n.mergeParentId === root.id) {
          const c = Number(n.tableCol), r = Number(n.tableRow);
          return { ...n, hidden: false, mergeParentId: null, x: getTableColumnStart(info, c), y: info.y0 + info.headH + r * info.rowH, w: info.colWidths[c] || 156, h: info.rowH };
        }
        return n;
      }),
      hist: [...state.hist.slice(-80), { n: state.nodes, a: state.arrows }],
      fut: [],
    };
  }),
}));

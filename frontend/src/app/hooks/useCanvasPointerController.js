export function useCanvasPointerController({
  setCtxMenu,
  setMobileCtxMenu,
  setRadialMenu,
  setSmartConnectSuggestion,
  setSelectedArrow,
  setSelectedConnectorIds,
  tool,
  sel,
  nodes,
  setCommentInput,
  toW,
  dPath,
  drag,
  dispatch,
  zoom,
  px,
  py,
  lasso,
  setLasso,
  isMobile,
  resolveSmartPlacement,
  snap,
  snapGrid,
  getNextStickySwatch,
  uid,
  composeTaskNodeText,
  composeMilestoneNodeText,
  composeDecisionNodeText,
  createTransformNode,
  isDataNodeType,
  buildConnectorFromDefaults,
  T,
  SHAPE_DEFAULTS,
  makeShapeNode,
  makeSheetNode,
  makeDeckNode,
  mobileStayInAdd,
  nextModeAfterAdd,
  toolToMode,
  modeToTool,
  arrowFrom,
  nextModeAfterConnect,
  moved,
  setNodeDragActive,
  wRef,
  setHoverNodeId,
  setGuides,
  resolveSmartConnectCandidate,
  setLivePath,
  appendLaserPoint,
  boardId,
  cursorEmitRef,
  socket,
  dColor,
  visibleNodes,
  connectorVisuals,
}) {
  function onDown(e) {
    if (e.button === 2) return;
    setCtxMenu(null); setMobileCtxMenu(null); setRadialMenu(null); setSmartConnectSuggestion(null);
    if (!e.shiftKey) {
      setSelectedArrow(null);
      setSelectedConnectorIds([]);
    }
    const connectorEl = e.target.closest("[data-connector-id]");
    if (connectorEl) {
      const connectorId = String(connectorEl.getAttribute("data-connector-id") || "").trim();
      if (connectorId) {
        if (e.shiftKey) {
          setSelectedConnectorIds((prev) => {
            if (prev.includes(connectorId)) {
              const next = prev.filter((id) => id !== connectorId);
              setSelectedArrow(next[next.length - 1] || null);
              return next;
            }
            const next = [...prev, connectorId];
            setSelectedArrow(connectorId);
            return next;
          });
        } else {
          setSelectedConnectorIds([connectorId]);
          setSelectedArrow(connectorId);
        }
      }
      return;
    }
    if (e.target.closest("[data-node]") || e.target.closest("[data-arr-label]")) return;
    if (tool === "comment") {
      const selected = sel.length === 1 ? nodes.find((n) => n.id === sel[0]) : null;
      if (selected) {
        const x = (Number(selected.x) || 0) + (Number(selected.w) || 120) + 12;
        const y = (Number(selected.y) || 0) - 8;
        setCommentInput({ x, y, nodeId: selected.id, sx: e.clientX, sy: e.clientY });
      } else {
        const { x, y } = toW(e.clientX, e.clientY);
        setCommentInput({ x, y, nodeId: null, sx: e.clientX, sy: e.clientY });
      }
      return;
    }
    if (tool === "draw") { dPath.current = [toW(e.clientX, e.clientY)]; drag.current = { type: "draw", sx: 0, sy: 0, px0: 0, py0: 0, nid: "", nx0: 0, ny0: 0, nw0: 0, nh0: 0, dir: "" }; return; }
    if (tool === "laser") return; // laser just tracks mouse, no drag
    if (tool === "eraser") { drag.current = { type: "eraser", sx: 0, sy: 0, px0: 0, py0: 0, nid: "", nx0: 0, ny0: 0, nw0: 0, nh0: 0, dir: "" }; const { x, y } = toW(e.clientX, e.clientY); dispatch({ type: "CLEAR_DRAWS_AREA", x, y, r: 30 / zoom }); return; }
    if (tool === "select") {
      if (e.isTouch) { drag.current = { type: "pan", sx: e.clientX, sy: e.clientY, px0: px, py0: py, nid: "", nx0: 0, ny0: 0, nw0: 0, nh0: 0, dir: "" }; return; }
      const { x, y } = toW(e.clientX, e.clientY); setLasso({ x1: x, y1: y, x2: x, y2: y }); drag.current = { type: "lasso", sx: 0, sy: 0, px0: 0, py0: 0, nid: "", nx0: 0, ny0: 0, nw0: 0, nh0: 0, dir: "" }; dispatch({ type: "SEL", v: [] }); return;
    }
    if (tool === "pan") { drag.current = { type: "pan", sx: e.clientX, sy: e.clientY, px0: px, py0: py, nid: "", nx0: 0, ny0: 0, nw0: 0, nh0: 0, dir: "" }; return; }
    const { x, y } = toW(e.clientX, e.clientY);
    const smart = isMobile ? resolveSmartPlacement(x, y, "right") : { x: snap(x, snapGrid), y: snap(y, snapGrid) };
    const sx = smart.x, sy = smart.y;
    const selectedMilestone = sel.length === 1 ? nodes.find((n) => n.id === sel[0] && n.type === "milestone") : null;
    const sc = getNextStickySwatch();
    let added = false;
    if (tool === "sticky") { dispatch({ type: "ADD", node: { id: uid(), type: "sticky", x: sx, y: sy, w: 170, h: 130, text: "", color: sc.bg, textColor: sc.t } }); added = true; }
    else if (tool === "task") {
      const task = {
        title: "New Task",
        description: "",
        status: "Todo",
        owner: "TBD",
        priority: "P2",
        dueDate: "TBD",
        tags: [],
        milestoneId: selectedMilestone?.executionMilestoneId || selectedMilestone?.id || "",
        milestoneTitle: selectedMilestone?.executionMilestone || String(selectedMilestone?.text || "").split("\n")[0] || "",
        githubUrl: "",
        jiraUrl: "",
      };
      dispatch({
        type: "ADD", node: {
          id: uid(),
          type: "task",
          x: sx,
          y: sy,
          w: 250,
          h: 150,
          text: composeTaskNodeText(task),
          color: "#0f172a",
          textColor: "#e2e8f0",
          borderColor: "#334155",
          fontSize: 11,
          fontWeight: "500",
          executionTaskId: uid(),
          executionTitle: task.title,
          executionDescription: task.description,
          executionStatus: task.status,
          executionOwner: task.owner,
          executionPriority: task.priority,
          executionDueDate: task.dueDate,
          executionTags: task.tags,
          executionMilestoneId: task.milestoneId || null,
          executionMilestone: task.milestoneTitle || "",
        },
      }); added = true;
    }
    else if (tool === "milestone") {
      const mile = { title: "Milestone", dueDate: "TBD", progressDone: 0, progressTotal: 0 };
      dispatch({
        type: "ADD", node: {
          id: uid(),
          type: "milestone",
          x: sx,
          y: sy,
          w: 320,
          h: 164,
          text: composeMilestoneNodeText(mile),
          color: "#111827",
          textColor: "#e5e7eb",
          borderColor: "#6366f1",
          fontSize: 12,
          fontWeight: "700",
          executionMilestoneId: uid(),
          executionMilestone: mile.title,
          executionDueDate: mile.dueDate,
        },
      }); added = true;
    }
    else if (tool === "decision") {
      const dec = { decision: "Decision", date: "TBD", owner: "TBD", context: "", outcome: "" };
      dispatch({
        type: "ADD", node: {
          id: uid(),
          type: "decision",
          x: sx,
          y: sy,
          w: 270,
          h: 170,
          text: composeDecisionNodeText(dec),
          color: "#1f2937",
          textColor: "#f3f4f6",
          borderColor: "#f59e0b",
          fontSize: 11,
          fontWeight: "600",
          executionDecisionId: uid(),
          executionDecision: dec.decision,
          executionDecisionDate: dec.date,
          executionOwner: dec.owner,
          executionContext: dec.context,
          executionOutcome: dec.outcome,
        },
      }); added = true;
    }
    else if (tool === "transform") {
      const transformNode = createTransformNode({ uid, x: sx, y: sy, transformType: "sum" });
      dispatch({ type: "ADD", node: transformNode });
      const sourceNode = sel.length === 1 ? nodes.find((n) => n.id === sel[0]) : null;
      if (sourceNode && sourceNode.id !== transformNode.id && isDataNodeType(sourceNode.type)) {
        const connector = buildConnectorFromDefaults({
          fromEntityId: sourceNode.id,
          toEntityId: transformNode.id,
          fromAnchor: { type: "port", portId: "right" },
          toAnchor: { type: "port", portId: "left" },
        }, { flowType: "data", label: "data" });
        if (connector) dispatch({ type: "ADD_ARR", arr: connector });
      }
      added = true;
    }
    else if (tool === "text") { dispatch({ type: "ADD", node: { id: uid(), type: "text", x: sx, y: sy, w: 180, h: 44, text: "Heading", color: T.t0, textColor: T.t0, fontSize: 24, fontWeight: "700" } }); added = true; }
    else if (SHAPE_DEFAULTS[tool]) { dispatch({ type: "ADD", node: makeShapeNode(tool, sx, sy) }); added = true; }
    else if (tool === "laneH") { dispatch({ type: "ADD", node: { id: uid(), type: "lane", orientation: "h", x: sx, y: sy, w: 920, h: 180, text: "Swimlane", color: T.bg3, textColor: T.t0, borderColor: T.b1 } }); added = true; }
    else if (tool === "laneV") { dispatch({ type: "ADD", node: { id: uid(), type: "lane", orientation: "v", x: sx, y: sy, w: 220, h: 640, text: "Swimlane", color: T.bg3, textColor: T.t0, borderColor: T.b1 } }); added = true; }
    else if (tool === "table" || tool === "sheet") { dispatch({ type: "ADD", node: makeSheetNode(sx, sy) }); added = true; }
    else if (tool === "deck") { dispatch({ type: "ADD", node: makeDeckNode(sx, sy) }); added = true; }
    else if (tool === "frame") { dispatch({ type: "ADD", node: { id: uid(), type: "frame", x: sx, y: sy, w: 400, h: 300, text: "Frame", color: "transparent", borderColor: T.b1 } }); added = true; }
    if (added && isMobile && !mobileStayInAdd) {
      const nextMode = nextModeAfterAdd(toolToMode(tool), false);
      dispatch({ type: "TOOL", v: modeToTool(nextMode) });
    }
  }

  function onNodeSel(id, multi, altKey) {
    if (tool === "arrow") {
      if (!arrowFrom) { dispatch({ type: "ARR_FROM", id }); dispatch({ type: "SEL", v: [id] }); }
      else if (arrowFrom !== id) {
        const connector = buildConnectorFromDefaults({
          fromEntityId: arrowFrom,
          toEntityId: id,
          fromAnchor: { type: "pos", xNorm: 0.5, yNorm: 0.5 },
          toAnchor: { type: "pos", xNorm: 0.5, yNorm: 0.5 },
        });
        if (connector) dispatch({ type: "ADD_ARR", arr: connector });
        dispatch({ type: "TOOL", v: modeToTool(nextModeAfterConnect()) });
      }
      return;
    }
    setSelectedConnectorIds([]);
    setSelectedArrow(null);
    if (multi) {
      const cur = nodes.find((n) => n.id === id);
      if (cur?.tableId && cur.tableRole === "cell" && !cur.hidden) {
        const anchor = nodes.find((n) => sel.includes(n.id) && n.tableId === cur.tableId && n.tableRole === "cell" && !n.hidden);
        if (anchor) {
          const r1 = Math.min(Number(anchor.tableRow), Number(cur.tableRow));
          const r2 = Math.max(Number(anchor.tableRow), Number(cur.tableRow));
          const c1 = Math.min(Number(anchor.tableCol), Number(cur.tableCol));
          const c2 = Math.max(Number(anchor.tableCol), Number(cur.tableCol));
          const ids = nodes.filter((n) => n.tableId === cur.tableId && n.tableRole === "cell" && !n.hidden && Number(n.tableRow) >= r1 && Number(n.tableRow) <= r2 && Number(n.tableCol) >= c1 && Number(n.tableCol) <= c2).map((n) => n.id);
          dispatch({ type: "SEL", v: ids });
          return;
        }
      }
      dispatch({ type: "SEL", v: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] });
    }
    else {
      if (altKey) {
        // Alt+drag: duplicate and drag copy
        const n = nodes.find((n) => n.id === id);
        if (n && !n.locked) {
          const newId = uid();
          dispatch({ type: "ADD", node: { ...n, id: newId } });
          dispatch({ type: "SEL", v: [newId] });
          moved.current = false;
          drag.current = { type: "node", sx: 0, sy: 0, px0: 0, py0: 0, nid: newId, nx0: n.x, ny0: n.y, nw0: n.w, nh0: n.h, dir: "" };
          setNodeDragActive(true);
        }
      } else if (sel.includes(id) && sel.length > 1) {
        // Multi-drag: keep selection, drag all selected
        moved.current = false;
        const selNodes = nodes.filter((n) => sel.includes(n.id) && !n.locked);
        drag.current = { type: "multi-node", sx: 0, sy: 0, px0: 0, py0: 0, nid: id, nx0: 0, ny0: 0, nw0: 0, nh0: 0, dir: "", origins: Object.fromEntries(selNodes.map((n) => [n.id, { x: n.x, y: n.y }])) };
        setNodeDragActive(true);
      } else {
        dispatch({ type: "SEL", v: [id] });
        const n = nodes.find((n) => n.id === id);
        if (n && !n.locked) {
          moved.current = false;
          const fc = n.type === "frame" ? nodes.filter((c) => c.id !== id && !c.locked && c.x + (c.w || 100) / 2 > n.x && c.x + (c.w || 100) / 2 < n.x + n.w && c.y + (c.h || 60) / 2 > n.y && c.y + (c.h || 60) / 2 < n.y + n.h) : [];
          drag.current = { type: "node", sx: 0, sy: 0, px0: 0, py0: 0, nid: id, nx0: n.x, ny0: n.y, nw0: n.w, nh0: n.h, dir: "", fc: fc.map((c) => c.id), fcOrigins: Object.fromEntries(fc.map((c) => [c.id, { x: c.x, y: c.y }])) };
          setNodeDragActive(true);
        }
      }
    }
  }

  function onMove(e) {
    const hoverEl = e.target?.closest?.("[data-node-id]");
    const hoverId = String(hoverEl?.getAttribute("data-node-id") || "").trim();
    setHoverNodeId((prev) => prev === hoverId ? prev : hoverId);
    const dr = drag.current;
    const dragThreshold = isMobile ? Math.max(6, 10 / Math.max(.6, zoom)) : 2;
    if (dr.type === "pan") dispatch({ type: "PAN", x: dr.px0 + e.clientX - dr.sx, y: dr.py0 + e.clientY - dr.sy });
    else if (dr.type === "node") {
      if (!dr.sx) { drag.current.sx = e.clientX; drag.current.sy = e.clientY; return; }
      const dx = (e.clientX - dr.sx) / zoom, dy = (e.clientY - dr.sy) / zoom;
      if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) moved.current = true;
      if (moved.current) {
        const nx = snap(dr.nx0 + dx, snapGrid), ny = snap(dr.ny0 + dy, snapGrid);
        dispatch({ type: "UPD", id: dr.nid, p: { x: nx, y: ny } });
        if (dr.fc?.length) { const deltas = Object.fromEntries(dr.fc.map((id) => { const o = dr.fcOrigins[id]; return [id, { x: snap(o.x + dx, snapGrid), y: snap(o.y + dy, snapGrid) }]; })); dispatch({ type: "UPD_MULTI", deltas }); }
        // Smart guides
        const draggedNode = nodes.find((n) => n.id === dr.nid);
        if (draggedNode) {
          const ox = dr.nx0 + dx, oy = dr.ny0 + dy, w = draggedNode.w || 100, h = draggedNode.h || 60;
          const others = nodes.filter((n) => n.id !== dr.nid && !n.hidden);
          const THRESH = 7 / zoom;
          const vHits = new Set();
          const hHits = new Set();
          for (const o of others) {
            const ow = o.w || 100, oh = o.h || 60;
            const myX = [ox, ox + w / 2, ox + w], otX = [o.x, o.x + ow / 2, o.x + ow];
            const myY = [oy, oy + h / 2, oy + h], otY = [o.y, o.y + oh / 2, o.y + oh];
            for (const me of myX) for (const oe of otX) if (Math.abs(me - oe) < THRESH) vHits.add(Number(oe).toFixed(2));
            for (const me of myY) for (const oe of otY) if (Math.abs(me - oe) < THRESH) hHits.add(Number(oe).toFixed(2));
          }
          const newGuides = [
            ...[...vHits].map((x) => ({ type: "v", x: Number(x) })),
            ...[...hHits].map((y) => ({ type: "h", y: Number(y) })),
          ];
          setGuides(newGuides);
        }
        const smartCandidate = resolveSmartConnectCandidate(dr.nid, nx, ny);
        setSmartConnectSuggestion((prev) => {
          if (!smartCandidate && !prev) return prev;
          if (!smartCandidate) return null;
          if (prev && prev.fromId === smartCandidate.fromId && prev.toId === smartCandidate.toId && prev.fromPort === smartCandidate.fromPort && prev.toPort === smartCandidate.toPort) return prev;
          return smartCandidate;
        });
      }
    }
    else if (dr.type === "resize") {
      const dx = (e.clientX - dr.sx) / zoom, dy = (e.clientY - dr.sy) / zoom;
      let nx = dr.nx0, ny = dr.ny0, nw = dr.nw0, nh = dr.nh0;
      if (dr.dir.includes("e")) nw = Math.max(60, snap(dr.nw0 + dx, snapGrid));
      if (dr.dir.includes("s")) nh = Math.max(40, snap(dr.nh0 + dy, snapGrid));
      if (dr.dir.includes("w")) { nw = Math.max(60, snap(dr.nw0 - dx, snapGrid)); nx = dr.nx0 + dr.nw0 - nw; }
      if (dr.dir.includes("n")) { nh = Math.max(40, snap(dr.nh0 - dy, snapGrid)); ny = dr.ny0 + dr.nh0 - nh; }
      // Proportional resize (Shift key)
      if (e.shiftKey && dr.nw0 && dr.nh0) {
        const aspect = dr.nw0 / dr.nh0;
        if (dr.dir.includes("e") || dr.dir.includes("w")) nh = Math.max(40, nw / aspect);
        else if (dr.dir.includes("s") || dr.dir.includes("n")) nw = Math.max(60, nh * aspect);
        if (dr.dir.includes("n")) ny = dr.ny0 + dr.nh0 - nh;
        if (dr.dir.includes("w")) nx = dr.nx0 + dr.nw0 - nw;
      }
      dispatch({ type: "UPD", id: dr.nid, p: { x: nx, y: ny, w: nw, h: nh } });
    }
    else if (dr.type === "draw") { const pt = toW(e.clientX, e.clientY); dPath.current = [...dPath.current, pt]; setLivePath([...dPath.current]); }
    else if (dr.type === "lasso") { const { x, y } = toW(e.clientX, e.clientY); setLasso((l) => ({ ...l, x2: x, y2: y })); }
    else if (dr.type === "multi-node") {
      if (!dr.sx) { drag.current.sx = e.clientX; drag.current.sy = e.clientY; return; }
      const dx = (e.clientX - dr.sx) / zoom, dy = (e.clientY - dr.sy) / zoom;
      if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) moved.current = true;
      if (moved.current) { const deltas = Object.fromEntries(Object.entries(dr.origins).map(([id, { x, y }]) => [id, { x: snap(x + dx, snapGrid), y: snap(y + dy, snapGrid) }])); dispatch({ type: "UPD_MULTI", deltas }); }
      setSmartConnectSuggestion(null);
    }
    else if (dr.type === "rotate") {
      const dx = e.clientX - dr.cx, dy = e.clientY - dr.cy;
      let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      if (e.shiftKey) angle = Math.round(angle / 15) * 15;
      dispatch({ type: "UPD", id: dr.nid, p: { rotation: Math.round(angle) } });
    }
    // Laser pointer trail
    if (tool === "laser") {
      appendLaserPoint(e.clientX, e.clientY);
    }
    // Eraser: clear drawings near cursor while mouse is down
    if (dr.type === "eraser") { const { x, y } = toW(e.clientX, e.clientY); dispatch({ type: "CLEAR_DRAWS_AREA", x, y, r: 30 / zoom }); }
    // Emit cursor to other collaborators (throttled)
    if (boardId) {
      const now = performance.now();
      if (now - cursorEmitRef.current.ts >= 32) {
        cursorEmitRef.current.ts = now;
        const { x, y } = toW(e.clientX, e.clientY);
        socket.volatile.emit("cursor:move", { boardId, x, y });
      }
    }
  }

  function onUp() {
    setGuides([]);
    setNodeDragActive(false);
    if (drag.current.type !== "node" && drag.current.type !== "multi-node") {
      setSmartConnectSuggestion(null);
    }
    if (drag.current.type === "draw" && dPath.current.length > 2) { dispatch({ type: "ADD_DRAW", d: { id: uid(), pts: dPath.current, color: dColor.current } }); dPath.current = []; setLivePath([]); }
    else if (drag.current.type === "lasso" && lasso) {
      const mx = Math.min(lasso.x1, lasso.x2), my = Math.min(lasso.y1, lasso.y2), mw = Math.abs(lasso.x2 - lasso.x1), mh = Math.abs(lasso.y2 - lasso.y1);
      if (mw > 10 && mh > 10) {
        const ids = visibleNodes.filter((n) => n.x < mx + mw && n.x + (n.w || 100) > mx && n.y < my + mh && n.y + (n.h || 60) > my).map((n) => n.id);
        const cx2 = mx + mw;
        const cy2 = my + mh;
        const connectorIds = connectorVisuals.filter((connector) => {
          const mid = connector.mid || { x: 0, y: 0 };
          const points = (Array.isArray(connector.routePoints) && connector.routePoints.length) ? connector.routePoints : [connector.start, connector.end];
          if (mid.x >= mx && mid.x <= cx2 && mid.y >= my && mid.y <= cy2) return true;
          if (points.some((pt) => pt && pt.x >= mx && pt.x <= cx2 && pt.y >= my && pt.y <= cy2)) return true;
          const validPoints = points.filter(Boolean);
          if (validPoints.length < 2) return false;
          const bx1 = Math.min(...validPoints.map((pt) => pt.x));
          const by1 = Math.min(...validPoints.map((pt) => pt.y));
          const bx2 = Math.max(...validPoints.map((pt) => pt.x));
          const by2 = Math.max(...validPoints.map((pt) => pt.y));
          return bx1 <= cx2 && bx2 >= mx && by1 <= cy2 && by2 >= my;
        }).map((connector) => connector.id);
        dispatch({ type: "SEL", v: ids });
        setSelectedConnectorIds(connectorIds);
        setSelectedArrow(connectorIds[0] || null);
      }
      setLasso(null);
    }
    drag.current.type = "none";
  }

  return {
    onDown,
    onNodeSel,
    onMove,
    onUp,
  };
}

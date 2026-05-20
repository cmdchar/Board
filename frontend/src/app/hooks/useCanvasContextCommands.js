export function useCanvasContextCommands({
  nodes,
  state,
  dispatch,
  uid,
  T,
  toasts,
  zoom,
  wRef,
  ctxUploadPosRef,
  ctxUploadRef,
  makeShapeNode,
  makeSheetNode,
  makeDeckNode,
  composeTaskNodeText,
  composeMilestoneNodeText,
  composeDecisionNodeText,
  createTransformNode,
  getPortWorldPosition,
  setPortConnect,
  getNextStickySwatch,
}) {
  function makeContextCommands({ wx, wy, effectiveSelIds, targetNode, detectedImportUrl }) {
    const scopedSel = Array.isArray(effectiveSelIds) ? effectiveSelIds : [];
    const scopedNodes = nodes.filter((n) => scopedSel.includes(n.id));
    const firstNode = targetNode || scopedNodes[0] || null;
    const allLocked = scopedNodes.length > 0 && scopedNodes.every((n) => n.locked);
    const hasGrouped = scopedNodes.some((n) => n.groupId);
    const canUndo = Boolean(state.hist?.length);
    const canRedo = Boolean(state.fut?.length);
    const baseAdd = (node) => { if (node) dispatch({ type: "ADD", node }); };
    const normalizeLink = (raw) => { const v = String(raw || "").trim(); if (!v) return ""; return /^https?:\/\//i.test(v) ? v : `https://${v}`; };
    const addSimpleLinkNode = (url) => {
      const safe = normalizeLink(url);
      if (!safe) return;
      baseAdd({ id: uid(), type: "text", x: wx, y: wy, w: 300, h: 44, text: safe.replace(/^https?:\/\/(www\.)?/i, ""), color: T.t0, textColor: T.t0, fontSize: 16, fontWeight: "700", url: safe });
    };
    const setPerSelection = (patch) => scopedSel.forEach((id) => dispatch({ type: "UPD", id, p: patch }));
    return {
      canUndo,
      canRedo,
      canToggleGrid: true,
      hasGroupedSelection: hasGrouped,
      isLockedSelection: allLocked,
      addSticky: () => { const sc = getNextStickySwatch(); baseAdd({ id: uid(), type: "sticky", x: wx, y: wy, w: 170, h: 130, text: "", color: sc.bg, textColor: sc.t }); },
      addText: () => baseAdd({ id: uid(), type: "text", x: wx, y: wy, w: 180, h: 44, text: "Text", color: T.t0, textColor: T.t0, fontSize: 22, fontWeight: "700" }),
      addTask: () => {
        const task = {
          id: uid(),
          type: "task",
          x: wx,
          y: wy,
          w: 250,
          h: 150,
          color: "#0f172a",
          textColor: "#e2e8f0",
          borderColor: "#334155",
          fontSize: 11,
          fontWeight: "500",
          executionTaskId: uid(),
          executionTitle: "New Task",
          executionDescription: "",
          executionStatus: "Todo",
          executionOwner: "TBD",
          executionPriority: "P2",
          executionDueDate: "TBD",
          executionTags: [],
          executionMilestoneId: null,
          executionMilestone: "",
          executionGithubUrl: null,
          executionJiraUrl: null,
        };
        task.text = composeTaskNodeText({
          title: task.executionTitle,
          description: task.executionDescription,
          status: task.executionStatus,
          owner: task.executionOwner,
          priority: task.executionPriority,
          dueDate: task.executionDueDate,
          tags: task.executionTags,
          githubUrl: "",
          jiraUrl: "",
        });
        baseAdd(task);
      },
      addMilestone: () => {
        const milestone = {
          id: uid(),
          type: "milestone",
          x: wx,
          y: wy,
          w: 320,
          h: 164,
          color: "#111827",
          textColor: "#e5e7eb",
          borderColor: "#6366f1",
          fontSize: 12,
          fontWeight: "700",
          executionMilestoneId: uid(),
          executionMilestone: "Milestone",
          executionDueDate: "TBD",
        };
        milestone.text = composeMilestoneNodeText({ title: milestone.executionMilestone, dueDate: milestone.executionDueDate, progressDone: 0, progressTotal: 0 });
        baseAdd(milestone);
      },
      addDecision: () => {
        const decision = {
          id: uid(),
          type: "decision",
          x: wx,
          y: wy,
          w: 270,
          h: 170,
          color: "#1f2937",
          textColor: "#f3f4f6",
          borderColor: "#f59e0b",
          fontSize: 11,
          fontWeight: "600",
          executionDecisionId: uid(),
          executionDecision: "Decision",
          executionDecisionDate: "TBD",
          executionOwner: "TBD",
          executionContext: "",
          executionOutcome: "",
        };
        decision.text = composeDecisionNodeText({
          decision: decision.executionDecision,
          date: decision.executionDecisionDate,
          owner: decision.executionOwner,
          context: decision.executionContext,
          outcome: decision.executionOutcome,
        });
        baseAdd(decision);
      },
      addTransform: () => {
        baseAdd(createTransformNode({ uid, x: wx, y: wy, transformType: "sum" }));
      },
      addShape: (shapeType) => baseAdd(makeShapeNode(shapeType || "rect", wx, wy)),
      addContainer: (kind) => {
        if (kind === "frame") { baseAdd({ id: uid(), type: "frame", x: wx, y: wy, w: 420, h: 280, text: "Frame", color: "transparent", borderColor: T.b1 }); return; }
        if (kind === "laneH") { baseAdd({ id: uid(), type: "lane", orientation: "h", x: wx, y: wy, w: 920, h: 180, text: "Swimlane", color: T.bg3, textColor: T.t0, borderColor: T.b1 }); return; }
        if (kind === "laneV") { baseAdd({ id: uid(), type: "lane", orientation: "v", x: wx, y: wy, w: 220, h: 640, text: "Swimlane", color: T.bg3, textColor: T.t0, borderColor: T.b1 }); return; }
        if (kind === "sheet") { baseAdd(makeSheetNode(wx, wy)); return; }
        if (kind === "deck") { baseAdd(makeDeckNode(wx, wy)); }
      },
      addChart: () => {
        baseAdd({
          id: uid(),
          type: "chart",
          x: wx,
          y: wy,
          w: 420,
          h: 300,
          text: "Chart",
          chartType: "bar",
          chartSummary: "3 points",
          chartData: [
            { label: "A", value: 30 },
            { label: "B", value: 55 },
            { label: "C", value: 22 },
          ],
          color: "#0f1929",
          textColor: "#e2e8f0",
          borderColor: "#334155",
          fontSize: 13,
          fontWeight: "600",
        });
      },
      generateBoardAi: () => {
        const raw = window.prompt("Describe the board to generate", "");
        if (raw === null) return;
        const prompt = String(raw || "").trim();
        if (!prompt) return;
        window.dispatchEvent(new CustomEvent("boardai:generate-board", { detail: { prompt } }));
      },
      addImageUpload: () => { ctxUploadPosRef.current = { wx, wy }; ctxUploadRef.current?.click(); },
      addLinkEmbed: () => {
        const raw = window.prompt("Paste URL", detectedImportUrl || "https://");
        if (raw === null) return;
        addSimpleLinkNode(raw);
      },
      addMindmapNode: () => {
        const node = makeShapeNode("circle", wx, wy);
        node.text = "Idea";
        node.color = "#1d4ed8";
        node.textColor = "#ffffff";
        node.w = 110;
        node.h = 110;
        baseAdd(node);
      },
      paste: () => dispatch({ type: "PASTE" }),
      importFromDetectedUrl: () => {
        const raw = detectedImportUrl || window.prompt("Paste Jira/GitHub URL", "");
        if (raw === null || raw === undefined) return;
        const safe = normalizeLink(raw);
        if (!safe) return;
        addSimpleLinkNode(safe);
        toasts.push("Link imported on board", "success");
      },
      zoomIn: () => dispatch({ type: "ZOOM", v: zoom * 1.15 }),
      zoomOut: () => dispatch({ type: "ZOOM", v: zoom * .87 }),
      fitView: () => { const r = wRef.current; if (!r) return; dispatch({ type: "ZOOM_FIT", vw: r.offsetWidth, vh: r.offsetHeight }); },
      toggleGrid: () => dispatch({ type: "SNAP_TOGGLE" }),
      undo: () => dispatch({ type: "UNDO" }),
      redo: () => dispatch({ type: "REDO" }),
      openBoardSettings: () => toasts.push("Board settings: open right panel", "info"),
      renameSelection: () => {
        if (!firstNode) return;
        const next = window.prompt("Rename", String(firstNode.text || ""));
        if (next === null) return;
        dispatch({ type: "UPD", id: firstNode.id, p: { text: next } });
      },
      duplicateSelection: () => { if (!scopedSel.length) return; dispatch({ type: "DUP" }); },
      toggleLockSelection: () => { if (!scopedSel.length) return; dispatch({ type: "LOCK_SEL" }); },
      deleteSelection: () => { if (!scopedSel.length) return; dispatch({ type: "DEL", ids: scopedSel }); },
      autoLayout: () => { if (scopedSel.length < 2) return; dispatch({ type: "TIDY", ids: scopedSel }); },
      align: (dir) => { if (scopedSel.length < 2) return; dispatch({ type: "ALIGN", d: dir }); },
      setFill: (color) => {
        if (!scopedSel.length) return;
        if (color === null) { setPerSelection({ color: T.bg3 }); return; }
        setPerSelection({ color });
      },
      toggleBorder: () => {
        if (!scopedSel.length) return;
        const next = scopedNodes.some((n) => n.borderColor) ? null : T.b1;
        setPerSelection({ borderColor: next });
      },
      addLinkToSelection: () => {
        if (!scopedSel.length) return;
        const raw = window.prompt("Link URL", String(firstNode?.url || "https://"));
        if (raw === null) return;
        const safe = normalizeLink(raw);
        if (!safe) return;
        setPerSelection({ url: safe });
      },
      startConnectFromSelection: () => {
        const sourceId = scopedSel[0] || firstNode?.id;
        if (!sourceId) return;
        const sourceNode = nodes.find((n) => n.id === sourceId);
        if (!sourceNode) return;
        const p = getPortWorldPosition(sourceNode, "right");
        setPortConnect({
          fromEntityId: sourceId,
          fromPortId: "right",
          start: { x: p.x, y: p.y },
          mouse: { x: p.x, y: p.y },
          targetPort: null,
        });
        dispatch({ type: "EXIT_ADD_MODE" });
        toasts.push("Drag to a target port to connect", "info");
      },
      manageConnections: () => { dispatch({ type: "DEP_MODE", v: true }); toasts.push("Dependency mode enabled", "info"); },
      groupSelection: () => { if (scopedSel.length < 2) return; dispatch({ type: "GROUP" }); },
      ungroupSelection: () => { if (!scopedSel.length) return; dispatch({ type: "UNGROUP" }); },
      bringToFront: () => { if (!scopedSel.length) return; dispatch({ type: "Z_FRONT" }); },
      sendToBack: () => { if (!scopedSel.length) return; dispatch({ type: "Z_BACK" }); },
      editSelection: () => {
        if (!firstNode) return;
        const next = window.prompt("Edit text", String(firstNode.text || ""));
        if (next === null) return;
        dispatch({ type: "UPD", id: firstNode.id, p: { text: next } });
      },
      convertSelection: (kind) => {
        if (!scopedSel.length) return;
        scopedSel.forEach((id) => {
          const n = nodes.find((x) => x.id === id);
          if (!n) return;
          const base = String(n.text || "").replace(/^\[(TASK|NOTE)\]\s*/i, "");
          if (kind === "task") dispatch({ type: "UPD", id, p: { text: `[TASK] ${base}`.trim(), color: "#fef3c7", textColor: "#713f12" } });
          else if (kind === "note") dispatch({ type: "UPD", id, p: { text: `[NOTE] ${base}`.trim(), color: "#dbeafe", textColor: "#1e3a8a" } });
          else if (kind === "text") dispatch({ type: "UPD", id, p: { text: base, fontSize: 20, fontWeight: "700" } });
        });
      },
      wrapInFrame: () => { if (scopedSel.length < 1) return; dispatch({ type: "WRAP_FRAME", ids: scopedSel, title: "Frame" }); },
    };
  }

  return { makeContextCommands };
}

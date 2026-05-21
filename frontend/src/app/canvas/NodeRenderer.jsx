export default function NodeRenderer({
  nodeDragActive = false,
  sortedNodes = [],
  dataNodeErrorById,
  sel = [],
  deps = null,
  focusSel = false,
  focusSet,
  normExecStatus,
  triggerTaskSuccessFx,
  onTaskComplete,
  d,
  onNodeSel,
  onNodeTouchStart,
  onRSt,
  onRotSt,
  votes = {},
  tool,
  blockedByDepNodeSet,
  milestoneStatsByNode,
  isKpiNodeLike,
  spreadsheetEngine,
  sheetFormulaSession,
  sheetFormulaPick,
  onSheetFormulaSessionChange,
  onSheetFormulaReferencePick,
  onConsumeSheetFormulaPick,
  formulaHighlightSheetSet,
  sheetAiAnomalyMapBySheet,
  components,
  T,
  nodes = [],
}) {
  const { Sticky, TaskNode, MilestoneNode, DecisionNode, TransformNode, ChartNode, KpiNode, Shape, TxtNode, ImgNode, FrameNode, LaneNode, SpreadsheetNode, DeckNode, NoteNode } = components || {};
  return (
    <div className={nodeDragActive ? "node-drag-active" : ""} style={{ position: "absolute", inset: 0, zIndex: 10 }}>
      {sortedNodes.map((node) => {
        const nodeError = String(dataNodeErrorById[node.id] || "").trim();
        const renderNode = nodeError && !String(node.dataFlowError || "").trim() ? { ...node, dataFlowError: nodeError } : node;
        const isSel = sel.includes(node.id);
        let depFade = 1;
        if (deps) {
          if (sel.includes(node.id) || deps.upNodes.has(node.id) || deps.downNodes.has(node.id)) depFade = 1;
          else depFade = 0.18;
        }
        if (focusSel && !focusSet.has(node.id)) depFade = Math.min(depFade, 0.15);
        const onNodeUpdate = (id, patch) => {
          if (renderNode.type === "task") {
            const prevStatus = normExecStatus(renderNode.executionStatus || renderNode.status);
            const nextStatus = normExecStatus(patch?.executionStatus ?? patch?.status ?? renderNode.executionStatus ?? renderNode.status);
            if (prevStatus !== "Done" && nextStatus === "Done") {
              triggerTaskSuccessFx(renderNode);
              onTaskComplete?.();
            }
          }
          d({ type: "UPD", id, p: patch });
        };
        const p = {
          node: renderNode,
          sel: isSel,
          depFade,
          onSel: onNodeSel,
          onTouchSel: onNodeTouchStart,
          onUpd: onNodeUpdate,
          onRSt,
          onRotSt,
          RH: components?.RH,
          votes: votes[renderNode.id] || 0,
          onVote: (id) => d({ type: "ADD_VOTE", nodeId: id }),
          voteMode: tool === "vote",
        };
        const nodeId = renderNode.id;
        if (renderNode.type === "sticky") return <Sticky key={nodeId} {...p} />;
        if (renderNode.type === "task") return <TaskNode key={nodeId} {...p} blockedByDeps={blockedByDepNodeSet.has(nodeId)} />;
        if (renderNode.type === "milestone") return <MilestoneNode key={nodeId} {...p} milestoneStats={milestoneStatsByNode[nodeId] || { done: 0, total: 0 }} />;
        if (renderNode.type === "decision") return <DecisionNode key={nodeId} {...p} />;
        if (renderNode.type === "transform") return <TransformNode key={nodeId} {...p} />;
        if (renderNode.type === "chart") return <ChartNode key={nodeId} {...p} />;
        if (isKpiNodeLike(renderNode)) return <KpiNode key={nodeId} {...p} />;
        if (renderNode.type === "shape") return <Shape key={nodeId} {...p} />;
        if (renderNode.type === "text") return <TxtNode key={nodeId} {...p} />;
        if (renderNode.type === "image") return <ImgNode key={nodeId} {...p} />;
        if (renderNode.type === "frame") return <FrameNode key={nodeId} {...p} />;
        if (renderNode.type === "lane") return <LaneNode key={nodeId} {...p} />;
        if (renderNode.type === "sheet")
          return (
            <SpreadsheetNode
              key={nodeId}
              {...p}
              spreadsheetEngine={spreadsheetEngine}
              formulaSession={sheetFormulaSession}
              formulaPick={sheetFormulaPick}
              onFormulaSessionChange={onSheetFormulaSessionChange}
              onFormulaReferencePick={onSheetFormulaReferencePick}
              onConsumeFormulaPick={onConsumeFormulaPick}
              formulaHighlight={formulaHighlightSheetSet.has(nodeId)}
              formulaSource={sheetFormulaSession?.sourceSheetId === nodeId}
              anomalyMap={sheetAiAnomalyMapBySheet?.[nodeId] || null}
            />
          );
        if (renderNode.type === "deck") return <DeckNode key={nodeId} {...p} />;
        if (renderNode.type === "note") return <NoteNode key={nodeId} {...p} T={T} nodes={nodes} RH={p.RH} />;
        return null;
      })}
    </div>
  );
}

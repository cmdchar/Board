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
}) {
  const { Sticky, TaskNode, MilestoneNode, DecisionNode, TransformNode, ChartNode, KpiNode, Shape, TxtNode, ImgNode, FrameNode, LaneNode, SpreadsheetNode, DeckNode } = components || {};
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
          key: renderNode.id,
          node: renderNode,
          sel: isSel,
          depFade,
          onSel: onNodeSel,
          onTouchSel: onNodeTouchStart,
          onUpd: onNodeUpdate,
          onRSt,
          onRotSt,
          votes: votes[renderNode.id] || 0,
          onVote: (id) => d({ type: "ADD_VOTE", nodeId: id }),
          voteMode: tool === "vote",
        };
        if (renderNode.type === "sticky") return <Sticky {...p} />;
        if (renderNode.type === "task") return <TaskNode {...p} blockedByDeps={blockedByDepNodeSet.has(renderNode.id)} />;
        if (renderNode.type === "milestone") return <MilestoneNode {...p} milestoneStats={milestoneStatsByNode[renderNode.id] || { done: 0, total: 0 }} />;
        if (renderNode.type === "decision") return <DecisionNode {...p} />;
        if (renderNode.type === "transform") return <TransformNode {...p} />;
        if (renderNode.type === "chart") return <ChartNode {...p} />;
        if (isKpiNodeLike(renderNode)) return <KpiNode {...p} />;
        if (renderNode.type === "shape") return <Shape {...p} />;
        if (renderNode.type === "text") return <TxtNode {...p} />;
        if (renderNode.type === "image") return <ImgNode {...p} />;
        if (renderNode.type === "frame") return <FrameNode {...p} />;
        if (renderNode.type === "lane") return <LaneNode {...p} />;
        if (renderNode.type === "sheet")
          return (
            <SpreadsheetNode
              {...p}
              spreadsheetEngine={spreadsheetEngine}
              formulaSession={sheetFormulaSession}
              formulaPick={sheetFormulaPick}
              onFormulaSessionChange={onSheetFormulaSessionChange}
              onFormulaReferencePick={onSheetFormulaReferencePick}
              onConsumeFormulaPick={onConsumeSheetFormulaPick}
              formulaHighlight={formulaHighlightSheetSet.has(renderNode.id)}
              formulaSource={sheetFormulaSession?.sourceSheetId === renderNode.id}
              anomalyMap={sheetAiAnomalyMapBySheet?.[renderNode.id] || null}
            />
          );
        if (renderNode.type === "deck") return <DeckNode {...p} />;
        return null;
      })}
    </div>
  );
}

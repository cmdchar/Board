import { useCallback } from "react";

export function useCanvasNodeTouchStart({
  touchMetaRef,
  beginMobilePress,
  tool,
  onNodeSel,
}) {
  const onNodeTouchStart = useCallback((e, nodeId) => {
    const t = e.touches?.[0];
    if (!t) return;
    e.stopPropagation();
    e.preventDefault();
    touchMetaRef.current = { targetType: "node", targetNodeId: nodeId };
    beginMobilePress({ x: t.clientX, y: t.clientY, targetType: "node", targetNodeId: nodeId });
    if (tool === "pan") {
      onNodeSel(nodeId, false, false);
      return;
    }
    onNodeSel(nodeId, false, false);
  }, [beginMobilePress, onNodeSel, tool, touchMetaRef]);

  return {
    onNodeTouchStart,
  };
}

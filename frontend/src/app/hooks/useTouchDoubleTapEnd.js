import { useCallback } from "react";

export function useTouchDoubleTapEnd({
  mobileInputRef,
  touchMetaRef,
  dragRef,
  toW,
  resolveSmartPlacement,
  dispatch,
  createCardNode,
  nodes,
  setMobileInlineEdit,
}) {
  const consumeDoubleTapEnd = useCallback((e) => {
    if (dragRef.current.type !== "none") return false;
    const t = e.changedTouches?.[0];
    if (t) {
      const tapResult = mobileInputRef.current?.registerTap?.({
        x: t.clientX,
        y: t.clientY,
        targetType: touchMetaRef.current?.targetType || "canvas",
        targetNodeId: touchMetaRef.current?.targetNodeId || "",
      });
      if (tapResult?.doubleTap) {
        if (tapResult.targetType === "canvas") {
          const w = toW(t.clientX, t.clientY);
          const p = resolveSmartPlacement(w.x, w.y, "right");
          dispatch({ type: "ADD", node: createCardNode(p.x, p.y) });
        } else if (tapResult.targetType === "node" && tapResult.targetNodeId) {
          const n = nodes.find((node) => node.id === tapResult.targetNodeId);
          if (n && !n.locked) {
            setMobileInlineEdit({
              nodeId: n.id,
              text: String(n.text || ""),
            });
          }
        }
      }
    }
    return true;
  }, [createCardNode, dispatch, dragRef, mobileInputRef, nodes, resolveSmartPlacement, setMobileInlineEdit, toW, touchMetaRef]);

  return {
    consumeDoubleTapEnd,
  };
}

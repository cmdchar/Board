import { useCallback } from "react";

export function useCanvasTouchStartTarget({
  touchEvt,
  touchMetaRef,
  beginMobilePress,
  setSelectedArrow,
  dragRef,
  onDown,
}) {
  const handleTouchStartTarget = useCallback((e) => {
    const ev = touchEvt(e);
    if (!ev) return;
    const connectorEl = e.target?.closest?.("[data-connector-id]");
    const connectorId = String(connectorEl?.getAttribute?.("data-connector-id") || "").trim();
    if (connectorId) {
      touchMetaRef.current = { targetType: "connector", targetNodeId: connectorId };
      beginMobilePress({ x: ev.clientX, y: ev.clientY, targetType: "connector", payload: { connectorId } });
      setSelectedArrow(connectorId);
      dragRef.current.type = "none";
      e.preventDefault();
      return;
    }
    touchMetaRef.current = { targetType: "canvas", targetNodeId: "" };
    beginMobilePress({ x: ev.clientX, y: ev.clientY, targetType: "canvas", targetNodeId: "" });
    e.preventDefault();
    onDown(ev);
  }, [beginMobilePress, dragRef, onDown, setSelectedArrow, touchEvt, touchMetaRef]);

  return {
    handleTouchStartTarget,
  };
}

import { useCallback } from "react";

export function useCanvasNodeTransformStart({
  nodes,
  wRef,
  zoom,
  px,
  py,
  dragRef,
  dispatch,
  setNodeDragActive,
}) {
  const onRotSt = useCallback((e, nodeId) => {
    e.stopPropagation();
    const n = nodes.find((node) => node.id === nodeId);
    if (!n) return;
    const r = wRef.current?.getBoundingClientRect?.();
    if (!r) return;
    const cx = r.left + (n.x + (n.w || 100) / 2) * zoom + px;
    const cy = r.top + (n.y + (n.h || 60) / 2) * zoom + py;
    dragRef.current = { type: "rotate", sx: 0, sy: 0, px0: 0, py0: 0, nid: nodeId, nx0: 0, ny0: 0, nw0: 0, nh0: 0, dir: "", cx, cy };
  }, [dragRef, nodes, px, py, wRef, zoom]);

  const onRSt = useCallback((e, nodeId, dir) => {
    e.stopPropagation();
    dispatch({ type: "SNAP" });
    const n = nodes.find((node) => node.id === nodeId);
    if (!n) return;
    dragRef.current = { type: "resize", sx: e.clientX, sy: e.clientY, px0: 0, py0: 0, nid: nodeId, nx0: n.x, ny0: n.y, nw0: n.w, nh0: n.h, dir };
    setNodeDragActive(true);
  }, [dispatch, dragRef, nodes, setNodeDragActive]);

  return {
    onRotSt,
    onRSt,
  };
}

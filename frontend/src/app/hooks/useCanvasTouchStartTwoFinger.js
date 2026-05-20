import { useCallback } from "react";

export function useCanvasTouchStartTwoFinger({
  dragRef,
  nodes,
  uid,
  snap,
  snapGrid,
  GRID,
  dispatch,
  notify,
  mobileInputRef,
  setRadialMenu,
  pinchRef,
  touchDistance,
  zoom,
  px,
  py,
  setLasso,
}) {
  const handleTwoFingerTouchStart = useCallback((e) => {
    if (e.touches?.length !== 2) return false;
    const [a, b] = e.touches;
    if (dragRef.current.type === "node" && dragRef.current.nid) {
      const src = nodes.find((n) => n.id === dragRef.current.nid);
      if (src && !src.locked) {
        const clone = {
          ...src,
          id: uid(),
          x: snap((Number(src.x) || 0) + GRID, snapGrid),
          y: snap((Number(src.y) || 0) + GRID, snapGrid),
        };
        dispatch({ type: "ADD", node: clone });
        dispatch({ type: "SEL", v: [clone.id] });
        dragRef.current = { ...dragRef.current, nid: clone.id, nx0: clone.x, ny0: clone.y, dupTriggered: true };
        notify?.("Duplicate drag mode", "info");
        e.preventDefault();
        return true;
      }
    }
    mobileInputRef.current?.cancelPress();
    setRadialMenu(null);
    mobileInputRef.current?.beginTwoFinger([
      { x: a.clientX, y: a.clientY },
      { x: b.clientX, y: b.clientY },
    ]);
    pinchRef.current = {
      startDist: touchDistance(a, b),
      startZoom: zoom,
      startPx: px,
      startPy: py,
      startMx: (a.clientX + b.clientX) / 2,
      startMy: (a.clientY + b.clientY) / 2,
      lastA: { x: a.clientX, y: a.clientY },
      lastB: { x: b.clientX, y: b.clientY },
    };
    dragRef.current.type = "none";
    setLasso(null);
    e.preventDefault();
    return true;
  }, [
    GRID,
    dispatch,
    dragRef,
    mobileInputRef,
    nodes,
    notify,
    pinchRef,
    px,
    py,
    setLasso,
    setRadialMenu,
    snap,
    snapGrid,
    touchDistance,
    uid,
    zoom,
  ]);

  return {
    handleTwoFingerTouchStart,
  };
}

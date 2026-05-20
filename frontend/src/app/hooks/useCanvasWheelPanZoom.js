import { useCallback, useEffect } from "react";

export function useCanvasWheelPanZoom({
  wRef,
  dispatch,
  px,
  py,
  zoom,
}) {
  const onWheel = useCallback((e) => {
    if (e.cancelable) e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const r = wRef.current.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const f = e.deltaY > 0 ? 0.9 : 1.11;
      const nz = Math.max(0.08, Math.min(6, zoom * f));
      dispatch({ type: "PAN", x: mx - (mx - px) * (nz / zoom), y: my - (my - py) * (nz / zoom) });
      dispatch({ type: "ZOOM", v: nz });
    } else {
      dispatch({ type: "PAN", x: px - e.deltaX, y: py - e.deltaY });
    }
  }, [dispatch, px, py, wRef, zoom]);

  useEffect(() => {
    const el = wRef.current;
    if (!el) return;
    const wheelHandler = (e) => onWheel(e);
    el.addEventListener("wheel", wheelHandler, { passive: false });
    return () => el.removeEventListener("wheel", wheelHandler);
  }, [onWheel, wRef]);
}

import { useCallback } from "react";

export function useCanvasMouseMoveRaf({
  mouseMovePendingRef,
  mouseMoveRafRef,
  onMove,
}) {
  const onMouseMove = useCallback((e) => {
    if (mouseMovePendingRef.current !== e) mouseMovePendingRef.current = e;
    if (mouseMoveRafRef.current) return;
    mouseMoveRafRef.current = window.requestAnimationFrame(() => {
      mouseMoveRafRef.current = 0;
      const ev = mouseMovePendingRef.current;
      mouseMovePendingRef.current = null;
      if (ev) onMove(ev);
    });
  }, [mouseMovePendingRef, mouseMoveRafRef, onMove]);

  return {
    onMouseMove,
  };
}

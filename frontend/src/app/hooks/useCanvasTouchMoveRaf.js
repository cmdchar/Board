import { useCallback } from "react";

export function useCanvasTouchMoveRaf({
  touchMovePendingRef,
  touchMoveRafRef,
  onMove,
}) {
  const scheduleTouchMove = useCallback((ev) => {
    touchMovePendingRef.current = ev;
    if (!touchMoveRafRef.current) {
      touchMoveRafRef.current = window.requestAnimationFrame(() => {
        touchMoveRafRef.current = 0;
        const nextEv = touchMovePendingRef.current;
        touchMovePendingRef.current = null;
        if (nextEv) onMove(nextEv);
      });
    }
  }, [onMove, touchMovePendingRef, touchMoveRafRef]);

  const cancelScheduledTouchMove = useCallback(() => {
    if (!touchMoveRafRef.current) return;
    window.cancelAnimationFrame(touchMoveRafRef.current);
    touchMoveRafRef.current = 0;
    touchMovePendingRef.current = null;
  }, [touchMovePendingRef, touchMoveRafRef]);

  return {
    scheduleTouchMove,
    cancelScheduledTouchMove,
  };
}

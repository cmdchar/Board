import { useCallback } from "react";

export function useCanvasTouchMoveNonPinch({
  touchPoint,
  mobileInputRef,
  radialMenu,
  resolveRadialActiveId,
  setRadialMenu,
  touchEvt,
  scheduleTouchMove,
}) {
  const runTouchMovePrelude = useCallback((e) => {
    const p = touchPoint(e);
    if (p) mobileInputRef.current?.movePress(p);
    if (radialMenu && e.touches?.length === 1 && p) {
      const activeId = resolveRadialActiveId(radialMenu, p);
      setRadialMenu((prev) => prev ? { ...prev, activeId } : prev);
      e.preventDefault();
      return false;
    }
    if (mobileInputRef.current?.getState()?.longPressTriggered) {
      e.preventDefault();
      return false;
    }
    return true;
  }, [mobileInputRef, radialMenu, resolveRadialActiveId, setRadialMenu, touchPoint]);

  const runTouchMoveTail = useCallback((e) => {
    if (e.touches?.length > 1) return;
    const ev = touchEvt(e);
    if (!ev) return;
    e.preventDefault();
    scheduleTouchMove(ev);
  }, [scheduleTouchMove, touchEvt]);

  return {
    runTouchMovePrelude,
    runTouchMoveTail,
  };
}

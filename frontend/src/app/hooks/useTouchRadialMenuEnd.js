import { useCallback } from "react";

export function useTouchRadialMenuEnd({
  radialMenu,
  resolveRadialActiveId,
  applyRadialAction,
  mobileInputRef,
  setRadialMenu,
  dragRef,
  setLasso,
}) {
  const consumeRadialTouchEnd = useCallback((e) => {
    if (!radialMenu) return false;
    const t = e.changedTouches?.[0];
    const activeId = radialMenu.activeId || resolveRadialActiveId(radialMenu, t ? { x: t.clientX, y: t.clientY } : null);
    mobileInputRef.current?.endPress?.();
    if (activeId) {
      applyRadialAction(activeId, { x: radialMenu.wx, y: radialMenu.wy });
    }
    setRadialMenu(null);
    dragRef.current.type = "none";
    setLasso(null);
    e.preventDefault();
    return true;
  }, [applyRadialAction, dragRef, mobileInputRef, radialMenu, resolveRadialActiveId, setLasso, setRadialMenu]);

  return {
    consumeRadialTouchEnd,
  };
}

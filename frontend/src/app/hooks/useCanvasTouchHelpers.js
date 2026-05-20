import { useCallback } from "react";

export function useCanvasTouchHelpers({
  isMobile,
  mobileInputRef,
}) {
  const touchEvt = useCallback((e) => {
    const t = e.touches?.[0] || e.changedTouches?.[0];
    if (!t) return null;
    return {
      clientX: t.clientX,
      clientY: t.clientY,
      button: 0,
      isTouch: true,
      target: e.target,
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation(),
    };
  }, []);

  const touchDistance = useCallback((a, b) => Math.hypot((a.clientX || 0) - (b.clientX || 0), (a.clientY || 0) - (b.clientY || 0)), []);

  const touchPoint = useCallback((e) => {
    const t = e.touches?.[0] || e.changedTouches?.[0];
    if (!t) return null;
    return { x: t.clientX, y: t.clientY };
  }, []);

  const beginMobilePress = useCallback((meta) => {
    if (!isMobile || !mobileInputRef.current) return;
    const x = Number(meta?.x);
    const y = Number(meta?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    mobileInputRef.current.beginPress({
      x,
      y,
      targetType: String(meta?.targetType || "canvas"),
      targetNodeId: String(meta?.targetNodeId || ""),
      payload: meta?.payload || null,
    });
  }, [isMobile, mobileInputRef]);

  return {
    touchEvt,
    touchDistance,
    touchPoint,
    beginMobilePress,
  };
}

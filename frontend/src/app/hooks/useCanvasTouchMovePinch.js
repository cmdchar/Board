import { useCallback } from "react";

export function useCanvasTouchMovePinch({
  mobileInputRef,
  pinchRef,
  touchDistance,
  dispatch,
}) {
  const handlePinchTouchMove = useCallback((e) => {
    if (!(e.touches?.length === 2 && pinchRef.current)) return false;
    const [a, b] = e.touches;
    mobileInputRef.current?.updateTwoFinger([
      { x: a.clientX, y: a.clientY },
      { x: b.clientX, y: b.clientY },
    ]);
    pinchRef.current.lastA = { x: a.clientX, y: a.clientY };
    pinchRef.current.lastB = { x: b.clientX, y: b.clientY };
    const dist = touchDistance(a, b);
    if (dist > 0 && pinchRef.current.startDist > 0) {
      const scale = dist / pinchRef.current.startDist;
      const nz = Math.max(.08, Math.min(6, pinchRef.current.startZoom * scale));
      const mx = (a.clientX + b.clientX) / 2;
      const my = (a.clientY + b.clientY) / 2;
      const wx = (pinchRef.current.startMx - pinchRef.current.startPx) / pinchRef.current.startZoom;
      const wy = (pinchRef.current.startMy - pinchRef.current.startPy) / pinchRef.current.startZoom;
      dispatch({ type: "PAN", x: mx - wx * nz, y: my - wy * nz });
      dispatch({ type: "ZOOM", v: nz });
    }
    e.preventDefault();
    return true;
  }, [dispatch, mobileInputRef, pinchRef, touchDistance]);

  return {
    handlePinchTouchMove,
  };
}

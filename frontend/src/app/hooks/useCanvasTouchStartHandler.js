import { useCallback } from "react";

export function useCanvasTouchStartHandler({
  handleTwoFingerTouchStart,
  pinchRef,
  handleTouchStartTarget,
}) {
  const onTouchStart = useCallback((e) => {
    if (handleTwoFingerTouchStart(e)) return;
    if (e.touches?.length > 2) return;
    pinchRef.current = null;
    handleTouchStartTarget(e);
  }, [handleTouchStartTarget, handleTwoFingerTouchStart, pinchRef]);

  return {
    onTouchStart,
  };
}

import { useCallback } from "react";

export function useTouchGestureUndoRedo({
  pinchRef,
  mobileInputRef,
  dispatch,
}) {
  const handleTwoFingerGestureEnd = useCallback(() => {
    const twoFingerResult = pinchRef.current && mobileInputRef.current?.endTwoFinger?.([
      pinchRef.current.lastA || { x: 0, y: 0 },
      pinchRef.current.lastB || { x: 0, y: 0 },
    ]);
    if (twoFingerResult?.direction === "down") {
      dispatch({ type: "UNDO" });
    }
    if (twoFingerResult?.direction === "up") {
      dispatch({ type: "REDO" });
    }
    pinchRef.current = null;
  }, [dispatch, mobileInputRef, pinchRef]);

  return {
    handleTwoFingerGestureEnd,
  };
}

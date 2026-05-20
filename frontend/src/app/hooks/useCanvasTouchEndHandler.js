import { useCallback } from "react";

export function useCanvasTouchEndHandler({
  handleTwoFingerGestureEnd,
  cancelScheduledTouchMove,
  consumeRadialTouchEnd,
  consumeLongPressEnd,
  consumeDoubleTapEnd,
  onUp,
}) {
  const onTouchEnd = useCallback((e) => {
    if (e.touches?.length >= 2) return;
    handleTwoFingerGestureEnd();
    cancelScheduledTouchMove();
    if (consumeRadialTouchEnd(e)) {
      return;
    }
    if (consumeLongPressEnd()) {
      return;
    }
    if (consumeDoubleTapEnd(e)) {
      return;
    }
    e.preventDefault();
    onUp();
  }, [
    cancelScheduledTouchMove,
    consumeDoubleTapEnd,
    consumeLongPressEnd,
    consumeRadialTouchEnd,
    handleTwoFingerGestureEnd,
    onUp,
  ]);

  return {
    onTouchEnd,
  };
}

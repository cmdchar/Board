import { useCallback } from "react";

export function useCanvasTouchMoveHandler({
  runTouchMovePrelude,
  handlePinchTouchMove,
  runTouchMoveTail,
}) {
  const onTouchMove = useCallback((e) => {
    if (!runTouchMovePrelude(e)) return;
    if (handlePinchTouchMove(e)) return;
    runTouchMoveTail(e);
  }, [runTouchMovePrelude, handlePinchTouchMove, runTouchMoveTail]);

  return {
    onTouchMove,
  };
}

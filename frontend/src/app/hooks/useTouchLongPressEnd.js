import { useCallback } from "react";

export function useTouchLongPressEnd({
  mobileInputRef,
  dragRef,
  setLasso,
}) {
  const consumeLongPressEnd = useCallback(() => {
    const consumedByLongPress = mobileInputRef.current?.endPress?.() || false;
    if (!consumedByLongPress) return false;
    dragRef.current.type = "none";
    setLasso(null);
    return true;
  }, [dragRef, mobileInputRef, setLasso]);

  return {
    consumeLongPressEnd,
  };
}

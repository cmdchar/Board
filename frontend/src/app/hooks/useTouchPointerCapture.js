import { useCallback } from "react";

export function useTouchPointerCapture({
  isMobile,
  wRef,
  mobilePointerCaptureRef,
}) {
  const onPointerDown = useCallback((e) => {
    if (!isMobile || e.pointerType !== "touch") return;
    if (!wRef.current) return;
    try {
      wRef.current.setPointerCapture(e.pointerId);
      mobilePointerCaptureRef.current = { active: true, pointerId: e.pointerId };
    } catch {
      mobilePointerCaptureRef.current = { active: false, pointerId: null };
    }
  }, [isMobile, mobilePointerCaptureRef, wRef]);

  const onPointerUp = useCallback((e) => {
    if (!isMobile || e.pointerType !== "touch") return;
    if (!wRef.current) return;
    if (mobilePointerCaptureRef.current.active && mobilePointerCaptureRef.current.pointerId === e.pointerId) {
      try {
        wRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // no-op
      }
      mobilePointerCaptureRef.current = { active: false, pointerId: null };
    }
  }, [isMobile, mobilePointerCaptureRef, wRef]);

  return {
    onPointerDown,
    onPointerUp,
  };
}

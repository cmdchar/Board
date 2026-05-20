import { useEffect, useMemo, useRef, useState } from "react";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export default function MobileBottomSheet({
  open,
  title,
  subtitle = "",
  onClose,
  children,
  footer = null,
  zIndex = 280,
  snapPoints = [0.25, 0.6, 0.94],
  initialSnap = 1,
  lockBackdropClose = false,
  T,
}) {
  const [snapIdx, setSnapIdx] = useState(clamp(initialSnap, 0, snapPoints.length - 1));
  const [dragHeight, setDragHeight] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 900
  );
  const [keyboardInset, setKeyboardInset] = useState(0);
  const dragRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setDragHeight(null);
      setSnapIdx(clamp(initialSnap, 0, snapPoints.length - 1));
    }
  }, [open, initialSnap, snapPoints.length]);

  useEffect(() => {
    if (!open) return undefined;
    const updateViewport = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setViewportHeight(window.innerHeight);
        setKeyboardInset(0);
        return;
      }
      const nextHeight = Math.max(180, Math.round(vv.height));
      const kb = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
      setViewportHeight(nextHeight);
      setKeyboardInset(kb);
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
    };
  }, [open]);

  const snapHeights = useMemo(() => {
    const vh = viewportHeight || (typeof window !== "undefined" ? window.innerHeight : 900);
    return snapPoints.map(v => clamp(Math.round(vh * v), 180, Math.round(vh * 0.98)));
  }, [snapPoints, viewportHeight]);

  useEffect(() => {
    const drag = dragRef.current;
    if (!drag) return;

    const onMove = e => {
      const vh = viewportHeight || (typeof window !== "undefined" ? window.innerHeight : 900);
      const dy = drag.startY - e.clientY;
      const next = clamp(drag.startHeight + dy, 180, Math.round(vh * 0.98));
      setDragHeight(next);
    };

    const onUp = () => {
      if (dragHeight === null) {
        dragRef.current = null;
        return;
      }
      let bestIdx = 0;
      let bestDist = Infinity;
      snapHeights.forEach((h, idx) => {
        const d = Math.abs(h - dragHeight);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      });
      setSnapIdx(bestIdx);
      setDragHeight(null);
      dragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragHeight, snapHeights, viewportHeight]);

  if (!open) return null;

  const currentHeight = dragHeight ?? snapHeights[snapIdx] ?? 420;
  const sheetBottom = 8 + keyboardInset;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex }}>
      <div
        className="slide"
        onClick={() => {
          if (!lockBackdropClose) onClose?.();
        }}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,.34)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />
      <div
        className="slide"
        style={{
          position: "absolute",
          left: 8,
          right: 8,
          bottom: sheetBottom,
          height: currentHeight,
          background: `linear-gradient(170deg, ${T.bg1}, ${T.bg2})`,
          border: `1px solid ${T.b1}`,
          borderRadius: 18,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow: "0 20px 52px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.05)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          paddingBottom: "env(safe-area-inset-bottom)",
          transition: "height var(--ui-motion-medium,180ms) var(--ui-ease-out,cubic-bezier(0.22,1,0.36,1)), bottom var(--ui-motion-fast,120ms) var(--ui-ease-out,cubic-bezier(0.22,1,0.36,1))",
        }}
      >
        <div
          onPointerDown={e => {
            dragRef.current = {
              startY: e.clientY,
              startHeight: currentHeight,
            };
          }}
          style={{
            padding: "8px 0 2px",
            cursor: "ns-resize",
            touchAction: "none",
            userSelect: "none",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 52,
              height: 6,
              borderRadius: 99,
              background: T.b1,
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${T.b0}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: T.t0, fontWeight: 700, letterSpacing: "-.01em" }}>{title || "Sheet"}</div>
            {subtitle && (
              <div style={{ fontSize: 10.5, color: T.t2, marginTop: 1, fontFamily: "'JetBrains Mono',monospace" }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={() => onClose?.()}
            style={{
              minWidth: 44,
              height: 40,
              borderRadius: 9,
              border: `1px solid ${T.b1}`,
              background: T.bg2,
              color: T.t1,
              fontSize: 12,
              fontFamily: "'JetBrains Mono',monospace",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>{children}</div>

        {footer && <div style={{ borderTop: `1px solid ${T.b0}`, padding: "8px 10px 10px" }}>{footer}</div>}
      </div>
    </div>
  );
}

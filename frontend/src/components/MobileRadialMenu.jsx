import { useMemo } from "react";

const POSITIONS = {
  top: { x: 0, y: -78 },
  right: { x: 78, y: 0 },
  bottom: { x: 0, y: 78 },
  left: { x: -78, y: 0 },
  topRight: { x: 56, y: -56 },
  topLeft: { x: -56, y: -56 },
};

export default function MobileRadialMenu({
  open = false,
  x = 0,
  y = 0,
  activeId = "",
  options = [],
  onCancel,
  T,
}) {
  const items = useMemo(() => {
    return options
      .map(option => {
        const pos = POSITIONS[String(option.position || "")];
        if (!pos) return null;
        return {
          ...option,
          dx: pos.x,
          dy: pos.y,
        };
      })
      .filter(Boolean);
  }, [options]);

  if (!open) return null;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 380, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: "translate(-50%, -50%)",
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: "transparent",
          pointerEvents: "none",
        }}
      >
        {items.map(item => {
          const isActive = item.id === activeId;
          return (
            <div
              key={item.id}
              style={{
                position: "absolute",
                left: `calc(50% + ${item.dx}px)`,
                top: `calc(50% + ${item.dy}px)`,
                transform: "translate(-50%, -50%)",
                minWidth: 48,
                minHeight: 48,
                padding: "8px 10px",
                borderRadius: 12,
                border: `1px solid ${isActive ? T.yDim : T.b1}`,
                background: isActive ? T.yBg : T.bg2,
                color: isActive ? T.y : T.t0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontSize: 11,
                fontFamily: "'JetBrains Mono',monospace",
                fontWeight: 700,
                boxShadow: isActive ? "0 8px 24px rgba(250,204,21,.18)" : "0 8px 24px rgba(0,0,0,.28)",
              }}
            >
              <span style={{ fontSize: 12, lineHeight: 1 }}>{item.icon || "+"}</span>
              <span>{item.label}</span>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onCancel}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            minWidth: 56,
            minHeight: 56,
            borderRadius: 99,
            border: `1px solid ${T.b1}`,
            background: T.bg1,
            color: T.t1,
            cursor: "pointer",
            pointerEvents: "auto",
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}


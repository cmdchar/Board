export default function GuidesOverlay({ guides = [], zoom = 1 }) {
  if (!guides.length) return null;
  return (
    <svg style={{ position: "absolute", inset: 0, width: 10000, height: 10000, overflow: "visible", pointerEvents: "none", zIndex: 102 }}>
      {guides.map((g, i) =>
        g.type === "v" ? (
          <line className="align-guide" key={i} x1={g.x} y1={-5000} x2={g.x} y2={15000} stroke="#3b82f6" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} opacity={0.8} />
        ) : (
          <line className="align-guide" key={i} x1={-5000} y1={g.y} x2={15000} y2={g.y} stroke="#ef4444" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} opacity={0.8} />
        ),
      )}
    </svg>
  );
}

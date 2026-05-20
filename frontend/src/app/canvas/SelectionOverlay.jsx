function Lasso({ l }) {
  if (!l) return null;
  const x = Math.min(l.x1, l.x2),
    y = Math.min(l.y1, l.y2),
    w = Math.abs(l.x2 - l.x1),
    h = Math.abs(l.y2 - l.y1);
  return <div style={{ position: "absolute", left: x, top: y, width: w, height: h, border: "1px dashed #60a5fa", background: "rgba(96,165,250,.12)", borderRadius: 6 }} />;
}

export default function SelectionOverlay({ lasso }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 99, pointerEvents: "none" }}>
      <Lasso l={lasso} />
    </div>
  );
}

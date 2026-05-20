export default function MobileBottomBarView({
  tool,
  canUndo,
  onToggleMode,
  onOpenInsert,
  onToggleConnect,
  onUndo,
  onOpenPanel,
  onOpenMore,
  onExitMode,
  T,
}) {
  const inAddMode = tool !== "select" && tool !== "pan";
  const inConnectMode = tool === "arrow";
  const navLabel = tool === "pan" ? "Pan" : "Select";

  const Btn = ({ label, active = false, danger = false, disabled = false, onClick }) => (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        minWidth: 52,
        minHeight: 44,
        padding: "0 10px",
        borderRadius: 11,
        border: `1px solid ${active ? (danger ? "rgba(239,68,68,.5)" : T.yDim) : T.b1}`,
        background: active ? (danger ? "rgba(239,68,68,.12)" : T.yBg) : T.bg2,
        color: disabled ? T.t3 : danger ? T.red : active ? T.y : T.t1,
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 11,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        flex: 1,
        opacity: disabled ? 0.66 : 1,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        right: 8,
        bottom: "max(8px, env(safe-area-inset-bottom))",
        zIndex: 230,
        padding: 6,
        borderRadius: 14,
        border: `1px solid ${T.b1}`,
        background: T.bg1,
        boxShadow: "0 12px 36px rgba(0,0,0,.4)",
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}
    >
      <Btn label={navLabel} active={tool === "pan" || tool === "select"} onClick={onToggleMode} />
      <Btn label="Add" active={inAddMode} onClick={onOpenInsert} />
      <Btn label="Connect" active={inConnectMode} onClick={onToggleConnect} />
      <Btn label="Undo" onClick={onUndo} active={false} disabled={!canUndo} />
      <Btn label="Panel" onClick={onOpenPanel} />
      <Btn label="More" onClick={onOpenMore} />
      {(inAddMode || inConnectMode) && <Btn label="Done" danger onClick={onExitMode} />}
    </div>
  );
}

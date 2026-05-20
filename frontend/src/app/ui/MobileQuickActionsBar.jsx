export default function MobileQuickActionsBarView({
  visible = false,
  onDuplicate,
  onStyle,
  onConnect,
  onDelete,
  onArrange,
  canArrange = false,
  T,
}) {
  if (!visible) return null;
  const ActionBtn = ({ label, onClick, danger = false }) => (
    <button
      onClick={onClick}
      style={{
        minHeight: 44,
        minWidth: 44,
        flex: 1,
        borderRadius: 11,
        border: `1px solid ${danger ? "rgba(239,68,68,.45)" : T.b1}`,
        background: danger ? "rgba(239,68,68,.12)" : T.bg2,
        color: danger ? T.red : T.t0,
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
        padding: "0 10px",
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
        bottom: "calc(max(8px, env(safe-area-inset-bottom)) + 64px)",
        zIndex: 232,
        padding: 6,
        borderRadius: 14,
        border: `1px solid ${T.b1}`,
        background: T.bg1,
        boxShadow: "0 10px 28px rgba(0,0,0,.35)",
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}
    >
      <ActionBtn label="Duplicate" onClick={onDuplicate} />
      <ActionBtn label="Style" onClick={onStyle} />
      <ActionBtn label="Connect" onClick={onConnect} />
      {canArrange && <ActionBtn label="Arrange" onClick={onArrange} />}
      <ActionBtn label="Delete" danger onClick={onDelete} />
    </div>
  );
}

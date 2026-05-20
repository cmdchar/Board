import { useMemo, useRef, useState } from "react";
import { TOOL_PANEL_TOKENS } from "../styles/tokens";

const PANEL_COLORS = TOOL_PANEL_TOKENS;
const SHAPE_TOOLS = ["rect", "circle", "diamond", "triangle", "hexagon", "parallelogram", "cloud", "cylinder"];

function isAddMode(tool) {
  return tool !== "select" && tool !== "pan";
}

function ToolIcon({ name, size = 22, stroke = 1.8 }) {
  const C = "currentColor";
  const common = { stroke: C, strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {name === "select" && <path d="m5 4 12 7-5 1 2 5-2 1-2-5-4 3z" {...common} />}
      {name === "pan" && (
        <>
          <path d="M7 11V6a1 1 0 1 1 2 0v5" {...common} />
          <path d="M10 11V5a1 1 0 1 1 2 0v6" {...common} />
          <path d="M13 11V6a1 1 0 1 1 2 0v5" {...common} />
          <path d="M16 11V8a1 1 0 1 1 2 0v5c0 3-2 6-5 6h-2c-2 0-4-2-4-4v-4a1 1 0 1 1 2 0v1" {...common} />
        </>
      )}
      {name === "sticky" && (
        <>
          <rect x="4" y="4" width="15" height="15" rx="2" {...common} />
          <path d="M13 19v-4h6" {...common} />
        </>
      )}
      {name === "text" && <path d="M4 6h16M12 6v12" {...common} />}
      {name === "shapes" && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" {...common} />
          <circle cx="17.5" cy="6.5" r="3.5" {...common} />
          <path d="M6.5 14.5 10 20H3z" {...common} />
        </>
      )}
      {name === "arrow" && <path d="m4 12 14 0m0 0-4-4m4 4-4 4" {...common} />}
      {name === "sheet" && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" {...common} />
          <path d="M3 9h18M3 14h18M9 4v16M15 4v16" {...common} />
        </>
      )}
      {name === "deck" && (
        <>
          <rect x="4" y="5" width="14" height="11" rx="1.8" {...common} />
          <path d="M8 16h10a2 2 0 0 0 2-2V8" {...common} />
        </>
      )}
      {name === "task" && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" {...common} />
          <path d="m7 12 3 3 7-7" {...common} />
        </>
      )}
      {name === "milestone" && (
        <>
          <path d="M4 19V5" {...common} />
          <path d="M4 6h11l-2.4 3L15 12H4" {...common} />
        </>
      )}
      {name === "decision" && (
        <>
          <path d="M12 4 20 9v6l-8 5-8-5V9z" {...common} />
          <path d="m9.5 11.5 2 2 3.5-3.5" {...common} />
        </>
      )}
      {name === "transform" && (
        <>
          <path d="M6 6h12M6 18h12" {...common} />
          <path d="m10 6 4 6-4 6" {...common} />
        </>
      )}
      {name === "image" && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" {...common} />
          <circle cx="9" cy="10" r="1.2" {...common} />
          <path d="m6 17 4-4 3 3 2-2 3 3" {...common} />
        </>
      )}
      {name === "video" && (
        <>
          <rect x="3" y="5" width="14" height="14" rx="2" {...common} />
          <path d="m11 10 4 2-4 2z" {...common} />
          <path d="m17 10 4-2v8l-4-2" {...common} />
        </>
      )}
      {name === "upload" && (
        <>
          <path d="M12 16V4m0 0-4 4m4-4 4 4" {...common} />
          <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" {...common} />
        </>
      )}
      {name === "frame" && (
        <>
          <rect x="4" y="4" width="16" height="16" rx="2" {...common} />
          <path d="M9 4v3M15 4v3M9 17v3M15 17v3M4 9h3M4 15h3M17 9h3M17 15h3" {...common} />
        </>
      )}
      {name === "template" && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" {...common} />
          <path d="M3 10h18M9 10v10" {...common} />
        </>
      )}
      {name === "section" && (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" {...common} />
          <path d="M3 9h18M3 14h18" {...common} />
        </>
      )}
      {name === "comment" && <path d="M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" {...common} />}
      {name === "share" && (
        <>
          <circle cx="6" cy="12" r="2" {...common} />
          <circle cx="18" cy="6" r="2" {...common} />
          <circle cx="18" cy="18" r="2" {...common} />
          <path d="m8 11 8-4m-8 6 8 4" {...common} />
        </>
      )}
      {name === "export" && (
        <>
          <path d="M12 4v11m0 0-4-4m4 4 4-4" {...common} />
          <rect x="4" y="16" width="16" height="4" rx="1.4" {...common} />
        </>
      )}
      {name === "undo" && <path d="M9 8H5v4M5 12c1.5-3 4-5 8-5 3.8 0 6.3 1.8 7 5" {...common} />}
      {name === "redo" && <path d="M15 8h4v4M19 12c-1.5-3-4-5-8-5-3.8 0-6.3 1.8-7 5" {...common} />}
      {name === "snap" && <path d="M5 5h4v4H5zM15 5h4v4h-4zM5 15h4v4H5zM15 15h4v4h-4z" {...common} />}
      {name === "dep" && <path d="M8 7h8m-8 10h8M8 7l4 5m0 0 4 5m-8-5 4-5" {...common} />}
    </svg>
  );
}

function Section({ title, open, onToggle, children }) {
  return (
    <div style={{ borderBottom: `1px solid ${PANEL_COLORS.border}` }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          border: "none",
          background: "transparent",
          color: PANEL_COLORS.textMuted,
          fontSize: 11,
          letterSpacing: ".08em",
          fontWeight: 700,
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 12 }}>{open ? "v" : ">"}</span>
      </button>
      {open && <div style={{ padding: "0 10px 10px", display: "grid", gap: 6 }}>{children}</div>}
    </div>
  );
}

function ToolRow({ icon, label, shortcut = "", description = "", active = false, onClick, danger = false }) {
  const title = [label, shortcut ? `(${shortcut})` : "", description || ""].filter(Boolean).join(" ");
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 44,
        borderRadius: 10,
        border: `1px solid ${active ? PANEL_COLORS.primary : PANEL_COLORS.border}`,
        background: active ? PANEL_COLORS.primarySoft : PANEL_COLORS.surface,
        color: danger ? PANEL_COLORS.danger : active ? PANEL_COLORS.primary : PANEL_COLORS.text,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        cursor: "pointer",
        transition: "all var(--ui-motion-fast,120ms) var(--ui-ease-out,cubic-bezier(0.22,1,0.36,1))",
        textAlign: "left",
      }}
      onMouseEnter={e => {
        if (active) return;
        e.currentTarget.style.background = PANEL_COLORS.hover;
        e.currentTarget.style.borderColor = PANEL_COLORS.borderStrong;
      }}
      onMouseLeave={e => {
        if (active) return;
        e.currentTarget.style.background = PANEL_COLORS.surface;
        e.currentTarget.style.borderColor = PANEL_COLORS.border;
      }}
    >
      <span style={{ width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <ToolIcon name={icon} />
      </span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{label}</span>
      {shortcut && (
        <span
          style={{
            fontSize: 10,
            color: PANEL_COLORS.textMuted,
            fontFamily: "'JetBrains Mono',monospace",
            border: `1px solid ${PANEL_COLORS.shortcutBorder}`,
            borderRadius: 6,
            padding: "2px 6px",
            background: PANEL_COLORS.shortcutBg,
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
}

function IconAction({ icon, description, active = false, onClick }) {
  return (
    <button
      title={description}
      onClick={onClick}
      style={{
        minHeight: 38,
        borderRadius: 10,
        border: `1px solid ${active ? PANEL_COLORS.primary : PANEL_COLORS.border}`,
        background: active ? PANEL_COLORS.primarySoft : PANEL_COLORS.surface,
        color: active ? PANEL_COLORS.primary : PANEL_COLORS.text,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all var(--ui-motion-fast,120ms) var(--ui-ease-out,cubic-bezier(0.22,1,0.36,1))",
      }}
      onMouseEnter={e => {
        if (active) return;
        e.currentTarget.style.background = PANEL_COLORS.hover;
        e.currentTarget.style.borderColor = PANEL_COLORS.borderStrong;
      }}
      onMouseLeave={e => {
        if (active) return;
        e.currentTarget.style.background = PANEL_COLORS.surface;
        e.currentTarget.style.borderColor = PANEL_COLORS.border;
      }}
    >
      <ToolIcon name={icon} />
    </button>
  );
}

function RailButton({ icon, label, active = false, onClick }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        border: `1px solid ${active ? PANEL_COLORS.primary : PANEL_COLORS.border}`,
        background: active ? PANEL_COLORS.primarySoft : PANEL_COLORS.surface,
        color: active ? PANEL_COLORS.primary : PANEL_COLORS.text,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all var(--ui-motion-fast,120ms) var(--ui-ease-out,cubic-bezier(0.22,1,0.36,1))",
      }}
      onMouseEnter={e => {
        if (active) return;
        e.currentTarget.style.background = PANEL_COLORS.hover;
        e.currentTarget.style.borderColor = PANEL_COLORS.borderStrong;
      }}
      onMouseLeave={e => {
        if (active) return;
        e.currentTarget.style.background = PANEL_COLORS.surface;
        e.currentTarget.style.borderColor = PANEL_COLORS.border;
      }}
    >
      <ToolIcon name={icon} size={22} />
    </button>
  );
}

function downloadBlob(filename, blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function RightToolPanel({
  s,
  d,
  uid,
  onOpenTemplates,
  notify,
  onRequestClose = null,
  side = "right",
  leftInset = 16,
  rightInset = 16,
  topOffset = 68,
  isMobile = false,
  embedded = false,
}) {
  const { tool, zoom, px, py, autoReturnToSelect } = s;
  const [open, setOpen] = useState({
    nav: true,
    board: true,
    media: true,
    structure: true,
    interaction: true,
    shapes: false,
  });
  const [query, setQuery] = useState("");
  const imageRef = useRef(null);
  const fileRef = useRef(null);
  const q = query.trim().toLowerCase();
  const addMode = isAddMode(tool);
  const activeShape = useMemo(() => (SHAPE_TOOLS.includes(tool) ? tool : ""), [tool]);

  const matches = (label, description = "") => {
    if (!q) return true;
    const l = String(label || "").toLowerCase();
    const dsc = String(description || "").toLowerCase();
    return l.includes(q) || dsc.includes(q);
  };

  const centerPos = () => {
    const x = (window.innerWidth * 0.5 - px) / zoom;
    const y = (window.innerHeight * 0.45 - py) / zoom;
    return { x, y };
  };

  const activateTool = next => {
    if (next === "select") {
      d({ type: "EXIT_ADD_MODE" });
      return;
    }
    d({ type: "TOOL", v: next });
  };

  const addNode = node => d({ type: "ADD", node });
  const exitAddMode = () => d({ type: "EXIT_ADD_MODE" });

  const onImageFiles = files => {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      notify?.("Please select an image file", "error");
      return;
    }
    const r = new FileReader();
    r.onload = ev => {
      const { x, y } = centerPos();
      addNode({ id: uid(), type: "image", src: ev.target.result, x: x - 170, y: y - 110, w: 340, h: 220 });
      notify?.("Image inserted", "success");
    };
    r.readAsDataURL(f);
  };

  const onFileUpload = files => {
    const f = files?.[0];
    if (!f) return;
    if (f.type.startsWith("image/")) return onImageFiles(files);
    const { x, y } = centerPos();
    addNode({
      id: uid(),
      type: "shape",
      shapeType: "rect",
      x: x - 140,
      y: y - 64,
      w: 280,
      h: 128,
      text: `File\n${f.name}`,
      color: "#0f1929",
      textColor: "#e2e8f0",
      borderColor: "#334155",
      fontSize: 13,
      fontWeight: "600",
    });
    notify?.("File card added to board", "success");
  };

  const addVideoCard = () => {
    const url = window.prompt("Paste video URL");
    if (!url) return;
    const { x, y } = centerPos();
    addNode({
      id: uid(),
      type: "shape",
      shapeType: "rect",
      x: x - 170,
      y: y - 96,
      w: 340,
      h: 192,
      text: `Video\n${url}`,
      url,
      color: "#0f172a",
      textColor: "#e2e8f0",
      borderColor: "#334155",
      fontSize: 13,
      fontWeight: "600",
    });
    notify?.("Video card added", "success");
  };

  const addQuickChart = () => {
    const { x, y } = centerPos();
    addNode({
      id: uid(),
      type: "chart",
      x: x - 210,
      y: y - 150,
      w: 420,
      h: 300,
      text: "Chart",
      chartType: "bar",
      chartSummary: "3 points",
      chartData: [
        { label: "A", value: 30 },
        { label: "B", value: 55 },
        { label: "C", value: 22 },
      ],
      color: "#0f1929",
      textColor: "#e2e8f0",
      borderColor: "#334155",
      fontSize: 13,
      fontWeight: "600",
    });
    notify?.("Chart inserted", "success");
  };

  const shareBoard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify?.("Board link copied", "success");
    } catch {
      notify?.("Could not copy link", "error");
    }
  };

  const exportJson = () => {
    downloadBlob("boardai.json", new Blob([JSON.stringify({ nodes: s.nodes, arrows: s.arrows, comments: s.comments }, null, 2)], { type: "application/json" }));
    notify?.("JSON exported", "success");
  };

  const shellStyle = embedded
    ? {
        position: "relative",
        width: "100%",
        height: "100%",
        background: `linear-gradient(160deg, ${PANEL_COLORS.surface}, ${PANEL_COLORS.surface2})`,
        border: "none",
        borderRadius: 0,
        boxShadow: "none",
        overflow: "hidden",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
      }
    : {
        position: "absolute",
        top: topOffset,
        ...(side === "left" ? { left: leftInset } : { right: rightInset }),
        bottom: 14,
        width: isMobile ? "min(92vw,340px)" : 324,
        background: `linear-gradient(160deg, ${PANEL_COLORS.surface}, ${PANEL_COLORS.surface2})`,
        border: `1px solid ${PANEL_COLORS.border}`,
        borderRadius: 14,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        boxShadow: "0 20px 46px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.05)",
        overflow: "hidden",
        zIndex: 240,
        display: "flex",
        flexDirection: "column",
      };

  if (!embedded && !isMobile) {
    const activeSet = new Set([tool]);
    if (SHAPE_TOOLS.includes(tool)) activeSet.add("shapes");
    if (tool === "sheet" || tool === "table") activeSet.add("sheet");
    return (
      <>
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          onChange={e => {
            onImageFiles(e.target.files);
            e.target.value = "";
          }}
          style={{ display: "none" }}
        />
        <aside
          className="slide"
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute",
            top: topOffset,
            left: leftInset,
            bottom: 14,
            width: 70,
            borderRadius: 16,
            border: `1px solid ${PANEL_COLORS.border}`,
            background: `linear-gradient(180deg, ${PANEL_COLORS.surface2}, ${PANEL_COLORS.surface})`,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 20px 46px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.05)",
            zIndex: 240,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "12px 10px",
            gap: 8,
          }}
        >
          <RailButton icon="select" label="Select tool" active={activeSet.has("select")} onClick={() => activateTool("select")} />
          <RailButton icon="pan" label="Hand / Pan tool" active={activeSet.has("pan")} onClick={() => activateTool("pan")} />
          <RailButton icon="arrow" label="Connector tool" active={activeSet.has("arrow")} onClick={() => activateTool("arrow")} />
          <RailButton icon="text" label="Text" active={activeSet.has("text")} onClick={() => activateTool("text")} />
          <RailButton icon="sticky" label="Sticky" active={activeSet.has("sticky")} onClick={() => activateTool("sticky")} />
          <RailButton icon="shapes" label="Shape / Node" active={activeSet.has("shapes")} onClick={() => activateTool("rect")} />
          <RailButton icon="frame" label="Container" active={activeSet.has("frame")} onClick={() => activateTool("frame")} />
          <RailButton icon="image" label="Image" onClick={() => imageRef.current?.click()} />
          <RailButton icon="sheet" label="Spreadsheet" active={activeSet.has("sheet")} onClick={() => activateTool("sheet")} />
          <RailButton icon="deck" label="Chart" onClick={addQuickChart} />
          <div style={{ width: 44, height: 1, background: PANEL_COLORS.border, margin: "4px 0" }} />
          <RailButton icon="template" label="Templates" onClick={onOpenTemplates} />
          <RailButton icon="undo" label="Undo" onClick={() => d({ type: "UNDO" })} />
          <RailButton icon="redo" label="Redo" onClick={() => d({ type: "REDO" })} />
        </aside>
      </>
    );
  }

  return (
    <>
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        onChange={e => {
          onImageFiles(e.target.files);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
      <input
        ref={fileRef}
        type="file"
        onChange={e => {
          onFileUpload(e.target.files);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />

      <aside
        className="slide"
        onClick={e => e.stopPropagation()}
        style={shellStyle}
      >
        <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${PANEL_COLORS.border}`, background: `linear-gradient(180deg, ${PANEL_COLORS.surface2}, ${PANEL_COLORS.surface})` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: PANEL_COLORS.primarySoft, color: PANEL_COLORS.primary }}>
              <ToolIcon name={addMode ? "shapes" : tool === "pan" ? "pan" : "select"} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: PANEL_COLORS.text }}>Tools</div>
              <div style={{ fontSize: 11, color: PANEL_COLORS.textMuted }}>Active: {tool}</div>
            </div>
            {addMode && (
              <button
                onClick={exitAddMode}
                title="Done (Esc)"
                style={{
                  height: 30,
                  minWidth: 56,
                  padding: "0 10px",
                  borderRadius: 8,
                  border: `1px solid ${PANEL_COLORS.primary}`,
                  background: PANEL_COLORS.primarySoft,
                  color: PANEL_COLORS.primary,
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono',monospace",
                  fontWeight: 700,
                }}
              >
                Done
              </button>
            )}
            {isMobile && onRequestClose && (
              <button
                onClick={onRequestClose}
                style={{
                  height: 30,
                  minWidth: 56,
                  padding: "0 10px",
                  borderRadius: 8,
                  border: `1px solid ${PANEL_COLORS.border}`,
                  background: PANEL_COLORS.surface,
                  color: PANEL_COLORS.textMuted,
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono',monospace",
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            )}
          </div>

          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tools..."
            style={{
              width: "100%",
              height: 36,
              borderRadius: 10,
              border: `1px solid ${PANEL_COLORS.border}`,
              background: PANEL_COLORS.surface,
              padding: "0 10px",
              fontSize: 13,
              color: PANEL_COLORS.text,
              outline: "none",
            }}
            onFocus={e => {
              e.target.style.borderColor = PANEL_COLORS.primary;
            }}
            onBlur={e => {
              e.target.style.borderColor = PANEL_COLORS.border;
            }}
          />
        </div>

        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, WebkitOverflowScrolling: "touch" }}>
          <Section title="Navigation" open={open.nav} onToggle={() => setOpen(v => ({ ...v, nav: !v.nav }))}>
            {matches("Select", "Exit add mode and pick elements") && (
              <ToolRow icon="select" label="Select" shortcut="V / Esc" description="Exit add mode and pick elements" active={tool === "select"} onClick={() => activateTool("select")} />
            )}
            {matches("Pan / Move Canvas", "Move around board quickly") && (
              <ToolRow icon="pan" label="Pan / Move Canvas" shortcut="H / Space" description="Move around board quickly" active={tool === "pan"} onClick={() => activateTool("pan")} />
            )}
          </Section>

          <Section title="Board Elements" open={open.board} onToggle={() => setOpen(v => ({ ...v, board: !v.board }))}>
            {matches("Sticky Notes", "Create sticky notes quickly") && <ToolRow icon="sticky" label="Sticky Notes" shortcut="S" description="Create sticky notes quickly" active={tool === "sticky"} onClick={() => activateTool("sticky")} />}
            {matches("Text", "Insert text blocks and headings") && <ToolRow icon="text" label="Text" shortcut="T" description="Insert text blocks and headings" active={tool === "text"} onClick={() => activateTool("text")} />}
            {matches("Task", "Create execution task node") && <ToolRow icon="task" label="Task Node" shortcut="Z" description="Create execution task with owner/status/due date" active={tool === "task"} onClick={() => activateTool("task")} />}
            {matches("Milestone", "Create milestone container") && <ToolRow icon="milestone" label="Milestone" shortcut="W" description="Create milestone and track progress" active={tool === "milestone"} onClick={() => activateTool("milestone")} />}
            {matches("Decision", "Create decision memory node") && <ToolRow icon="decision" label="Decision" shortcut="1" description="Capture decision, owner, context and outcome" active={tool === "decision"} onClick={() => activateTool("decision")} />}
            {matches("Transform", "Insert data transform node") && <ToolRow icon="transform" label="Transform Node" shortcut="2" description="SUM, AVG, FILTER, GROUP data in pipeline flow" active={tool === "transform"} onClick={() => activateTool("transform")} />}
            {matches("Spreadsheet", "Insert functional spreadsheet with formulas") && <ToolRow icon="sheet" label="Spreadsheet (Excel)" shortcut="N / B" description="Insert spreadsheet container with formula support" active={tool === "sheet" || tool === "table"} onClick={() => activateTool("sheet")} />}
            {matches("Slides", "Insert functional presentation container") && <ToolRow icon="deck" label="Slides (PowerPoint)" shortcut="O" description="Insert slides container and edit decks directly" active={tool === "deck"} onClick={() => activateTool("deck")} />}
            {(matches("Shapes", "Create geometric and flow shapes") || activeShape) && <ToolRow icon="shapes" label="Shapes" shortcut="R / C / D" description="Create geometric and flow shapes" active={Boolean(activeShape)} onClick={() => setOpen(v => ({ ...v, shapes: !v.shapes }))} />}
            {open.shapes && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 6 }}>
                {[
                  ["rect", "Rectangle"],
                  ["circle", "Circle"],
                  ["diamond", "Diamond"],
                  ["triangle", "Triangle"],
                  ["hexagon", "Hexagon"],
                  ["parallelogram", "Parallelogram"],
                  ["cloud", "Cloud"],
                  ["cylinder", "Cylinder"],
                ]
                  .filter(([, label]) => matches(label, "shape"))
                  .map(([id, label]) => (
                    <ToolRow key={id} icon="shapes" label={label} active={tool === id} onClick={() => activateTool(id)} />
                  ))}
              </div>
            )}
            {matches("Lines & Arrows", "Connect ideas with arrows") && <ToolRow icon="arrow" label="Lines & Arrows" shortcut="A" description="Connect ideas with arrows" active={tool === "arrow"} onClick={() => activateTool("arrow")} />}
          </Section>

          <Section title="Media" open={open.media} onToggle={() => setOpen(v => ({ ...v, media: !v.media }))}>
            {matches("Image", "Upload image to board") && <ToolRow icon="image" label="Image" description="Upload image to board" onClick={() => imageRef.current?.click()} />}
            {matches("Video", "Insert video link card") && <ToolRow icon="video" label="Video" description="Insert video link card" onClick={addVideoCard} />}
            {matches("File Upload", "Attach file card to board") && <ToolRow icon="upload" label="File Upload" description="Attach file card to board" onClick={() => fileRef.current?.click()} />}
          </Section>

          <Section title="Structure" open={open.structure} onToggle={() => setOpen(v => ({ ...v, structure: !v.structure }))}>
            {matches("Frames", "Create presentation frames") && <ToolRow icon="frame" label="Frames" shortcut="F" description="Create presentation frames" active={tool === "frame"} onClick={() => activateTool("frame")} />}
            {matches("Templates", "Open template library") && <ToolRow icon="template" label="Templates" description="Open template library" onClick={onOpenTemplates} />}
            {matches("Sections", "Add horizontal or vertical sections") && <ToolRow icon="section" label="Sections" shortcut="J / K" description="Add horizontal or vertical sections" active={tool === "laneH" || tool === "laneV"} onClick={() => activateTool("laneH")} />}
          </Section>

          <Section title="Interaction" open={open.interaction} onToggle={() => setOpen(v => ({ ...v, interaction: !v.interaction }))}>
            {matches("Comments", "Drop a board comment marker") && <ToolRow icon="comment" label="Comments" shortcut="M" description="Drop a board comment marker" active={tool === "comment"} onClick={() => activateTool("comment")} />}
            {matches("Auto return", "After placing one element return to Select") && (
              <ToolRow
                icon="select"
                label="Auto Return To Select"
                shortcut={autoReturnToSelect ? "ON" : "OFF"}
                description="After placing one element return to Select"
                active={autoReturnToSelect}
                onClick={() => d({ type: "TOGGLE_AUTO_RETURN_TO_SELECT" })}
              />
            )}
            {matches("Share", "Copy board link to clipboard") && <ToolRow icon="share" label="Share" description="Copy board link to clipboard" onClick={shareBoard} />}
            {matches("Export", "Export board as JSON") && <ToolRow icon="export" label="Export" description="Export board as JSON" onClick={exportJson} />}
          </Section>
        </div>

        <div style={{ borderTop: `1px solid ${PANEL_COLORS.border}`, padding: 10, display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6, background: PANEL_COLORS.surface2 }}>
          <IconAction icon="undo" description="Undo" onClick={() => d({ type: "UNDO" })} />
          <IconAction icon="redo" description="Redo" onClick={() => d({ type: "REDO" })} />
          <IconAction icon="snap" description="Toggle snap" active={s.snapGrid} onClick={() => d({ type: "SNAP_TOGGLE" })} />
          <IconAction icon="dep" description="Dependency mode" active={s.depMode} onClick={() => d({ type: "DEP_MODE" })} />
        </div>
      </aside>
    </>
  );
}

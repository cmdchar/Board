import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AI_CHIPS, FILE_TEMPLATE_LABELS } from "../ai/prompts";
import { useRightPanelAi } from "../hooks/useRightPanelAi";
import { useThinkingCopilot } from "../hooks/useThinkingCopilot";
import { useExecutionIntelligence } from "../hooks/useExecutionIntelligence";
import { useBoardAgents } from "../hooks/useBoardAgents";
import { useSpreadsheetAi } from "../hooks/useSpreadsheetAi";
import BoardAccessPanel from "./BoardAccessPanel";
import VersionHistoryPanel from "./VersionHistoryPanel";
import AuditTimelinePanel from "./AuditTimelinePanel";
import PropsPanel from "./PropsPanel";
import FileZone from "./FileZone";
import AiThinkingPanel from "./AiThinkingPanel";
import SpreadsheetAiPanel from "./SpreadsheetAiPanel";
import ExecutionPanel from "./ExecutionPanel";
import CollaborationPanel from "./CollaborationPanel";
import AgentPanel from "./AgentPanel";
import VaultPanel from "./VaultPanel";
import KnowledgeBasePanel from "./KnowledgeBasePanel";
import { Book } from "lucide-react";

export default function RightPanel({
  s,
  d,
  T,
  SC,
  uid,
  SHAPE_TYPES,
  SHAPE_DEFAULTS,
  getTableInfo,
  TABLE_DEFAULT_COL_WIDTH,
  TABLE_MIN_COLS,
  TABLE_MIN_ROWS,
  TABLE_MIN_COL_WIDTH,
  TABLE_MAX_COL_WIDTH,
  boardId,
  historyApi,
  accessApi,
  auditApi,
  githubApi,
  jiraApi,
  vaultApi,
  currentUser,
  onRestoreVersion,
  notify,
  onToggleTimeline = null,
  timelineOpen = false,
  collab = null,
  onEmitActivity = null,
  panelWidth = 324,
  topOffset = 68,
  rightInset = 12,
  onRequestClose = null,
  onSpreadsheetAnomalyMapChange = null,
  selectedConnector = null,
  onUpdateConnector = null,
  onDeleteConnector = null,
  fill = false,
}) {
  const {
    prompt,
    setPrompt,
    loading,
    fl,
    fn,
    fs,
    fe,
    fileDraft,
    filePlan,
    msgs,
    open,
    setOpen,
    execInput,
    setExecInput,
    execLoading,
    execError,
    execSummary,
    execReplace,
    setExecReplace,
    endRef,
    voteResults,
    send,
    runFileGeneration,
    runExecutionPlan,
    ghRepo,
    setGhRepo,
    ghState,
    setGhState,
    ghIncremental,
    setGhIncremental,
    ghConflictStrategy,
    setGhConflictStrategy,
    ghAuthLoading,
    ghConnected,
    ghAvailable,
    ghSource,
    ghAccount,
    ghLoading,
    ghError,
    ghSummary,
    jiraSite,
    setJiraSite,
    jiraProject,
    setJiraProject,
    jiraEmail,
    setJiraEmail,
    jiraToken,
    setJiraToken,
    jiraState,
    setJiraState,
    jiraLoading,
    jiraError,
    jiraSummary,
    runGitHubConnect,
    runGitHubDisconnect,
    runGitHubImport,
    runGitHubPush,
    runJiraImport,
    handleFile,
    clearAll,
  } = useRightPanelAi({
    s,
    d,
    uid,
    palette: SC,
    theme: T,
    shapeTypes: SHAPE_TYPES,
    shapeDefaults: SHAPE_DEFAULTS,
    githubApi,
    jiraApi,
    notify,
  });
  const [execOpen, setExecOpen] = useState(false);
  const [fileOpen, setFileOpen] = useState(true);
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [spreadsheetOpen, setSpreadsheetOpen] = useState(true);
  const [executionOpen, setExecutionOpen] = useState(true);
  const [vaultOpen, setVaultOpen] = useState(true);
  const [collabOpen, setCollabOpen] = useState(true);
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [kbOpen, setKbOpen] = useState(true);
  const thinking = useThinkingCopilot({
    s,
    d,
    uid,
    theme: T,
    palette: SC,
    shapeTypes: SHAPE_TYPES,
    shapeDefaults: SHAPE_DEFAULTS,
    notify,
  });
  const spreadsheetAi = useSpreadsheetAi({
    s,
    d,
    uid,
    theme: T,
    notify,
    onAnomalyMapChange: onSpreadsheetAnomalyMapChange,
  });
  const execution = useExecutionIntelligence({
    s,
    d,
    uid,
    notify,
  });
  const agents = useBoardAgents({
    s,
    d,
    uid,
    notify,
    emitActivity: onEmitActivity,
  });
  const selectedNode = useMemo(() => {
    if (!Array.isArray(s?.sel) || s.sel.length !== 1) return null;
    const nodeId = s.sel[0];
    return (s?.nodes || []).find((node) => node?.id === nodeId) || null;
  }, [s?.nodes, s?.sel]);
  const contextMode = selectedConnector
    ?"connector"
    :selectedNode?.type === "sheet"
      ?"spreadsheet"
      :selectedNode
        ?"node"
        :"board";
  const contextLabel = contextMode === "connector"
    ?"Connector properties"
    :contextMode === "spreadsheet"
      ?"Spreadsheet panel"
      :contextMode === "node"
        ?"Node properties"
        :"Board settings";
  const connectorStyle = selectedConnector?.style || {};
  const updateConnectorStyle = (patch) => {
    if (!selectedConnector?.id || typeof onUpdateConnector !== "function") return;
    onUpdateConnector(selectedConnector.id, { style: patch });
  };
  const panelStyle = fill
    ? {
      width: panelWidth,
      background: `${T.bg1}ee`,
      borderLeft: `1px solid ${T.b0}`,
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,.02)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 1,
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
    }
    : {
      position: "absolute",
      top: topOffset,
      right: rightInset,
      bottom: 14,
      width: panelWidth,
      background: `${T.bg1}dd`,
      border: `1px solid ${T.b1}`,
      borderRadius: 20,
      backdropFilter: "blur(32px)",
      WebkitBackdropFilter: "blur(32px)",
      boxShadow: "0 32px 64px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.05)",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      display: "flex",
      flexDirection: "column",
      zIndex: 240,
    };

  const sectionContentVariants = {
    open: { height: "auto", opacity: 1, overflow: "hidden" },
    collapsed: { height: 0, opacity: 0, overflow: "hidden" }
  };

  return <motion.div
    initial={fill ? {} : { x: 400, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: 400, opacity: 0 }}
    transition={{ type: "spring", damping: 25, stiffness: 200 }}
    style={panelStyle}
  >
    {!fill && (
      <div style={{
        padding: "20px 18px 16px",
        borderBottom: `1px solid ${T.b0}`,
        background: `${T.bg2}55`,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexShrink: 0,
        backdropFilter: "blur(10px)"
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: T.yBg,
          color: T.y,
          border: `1px solid ${T.yDim}`,
          boxShadow: `0 0 15px ${T.y}22`
        }}>
          <Book size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.t0, fontFamily: "'Instrument Serif',serif", letterSpacing: "-.01em" }}>Obsidian Studio</div>
          <div style={{ fontSize: 11, color: T.t2, fontFamily: "'JetBrains Mono',monospace", opacity: 0.7 }}>EDITION 2026</div>
        </div>
        {onRequestClose && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRequestClose}
            style={{
              height: 28,
              padding: "0 12px",
              borderRadius: 8,
              border: `1px solid ${T.b1}`,
              background: T.bg3,
              color: T.t1,
              fontSize: 10,
              cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace",
              fontWeight: 700,
              letterSpacing: ".05em"
            }}
          >
            CLOSE
          </motion.button>
        )}
      </div>
    )}
    <div style={{ borderBottom: `1px solid ${T.b0}`, padding: "14px 18px", background: `${T.bg1}55`, flexShrink: 0 }}>
      <div style={{ fontSize: 9, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".1em", opacity: 0.6, marginBottom: 4 }}>CONTEXT INSPECTOR</div>
      <div style={{ fontSize: 14, color: T.t0, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>{contextLabel}</div>
      {contextMode === "connector" && selectedConnector && (
        <div style={{ marginTop: 12, display: "grid", gap: 8, border: `1px solid ${T.b1}`, borderRadius: 12, background: `${T.bg2}aa`, padding: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 6 }}>
            {["straight", "ortho", "curved", "wavy"].map((routing) => (
              <button key={routing} onClick={() => onUpdateConnector?.(selectedConnector.id, { routing })} style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${selectedConnector.routing === routing ? T.yDim : T.b1}`, background: selectedConnector.routing === routing ? T.yBg : T.bg3, color: selectedConnector.routing === routing ? T.y : T.t1, cursor: "pointer", fontSize: 9, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
                {routing}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6 }}>
            {["solid", "dashed", "dotted"].map((dash) => (
              <button key={dash} onClick={() => updateConnectorStyle({ dash })} style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${connectorStyle.dash === dash ? T.yDim : T.b1}`, background: connectorStyle.dash === dash ? T.yBg : T.bg3, color: connectorStyle.dash === dash ? T.y : T.t1, cursor: "pointer", fontSize: 9, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
                {dash}
              </button>
            ))}
          </div>
          <input
            value={selectedConnector.label || ""}
            onChange={(e) => onUpdateConnector?.(selectedConnector.id, { label: e.target.value })}
            placeholder="Connector label..."
            style={{ minHeight: 36, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 10px", fontSize: 12, outline: "none", fontFamily: "inherit" }}
          />
          <button onClick={() => onDeleteConnector?.(selectedConnector.id)} style={{ minHeight: 36, borderRadius: 8, border: `1px solid ${T.red}33`, background: `${T.red}11`, color: T.red, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
            REMOVE CONNECTOR
          </button>
        </div>
      )}
    </div>
    <div style={{ borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
      <div onClick={() => setThinkingOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 18px", cursor: "pointer", userSelect: "none", transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = `${T.bg2}33`} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <span style={{ fontSize: 10, fontWeight: 800, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".12em" }}>CO-PILOT THINKING</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: T.t3, fontFamily: "'JetBrains Mono',monospace" }}>{thinking.loading ? "PROCESSING" : "READY"}</span>
        <motion.span animate={{ rotate: thinkingOpen ? 90 : 0 }} style={{ fontSize: 10, color: T.t3 }}>→</motion.span>
      </div>
      <AnimatePresence>
        {thinkingOpen && (
          <motion.div initial="collapsed" animate="open" exit="collapsed" variants={sectionContentVariants}>
            <div style={{ padding: "0 6px 12px" }}>
              <AiThinkingPanel T={T} thinking={thinking} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    {contextMode === "spreadsheet" && <div style={{ borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
      <div onClick={() => setSpreadsheetOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>SPREADSHEET AI</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.t2, opacity: 0.8 }}>{spreadsheetAi.enabled ? "active" : "idle"}</span>
        <motion.span animate={{ rotate: spreadsheetOpen ? 90 : 0 }} style={{ fontSize: 10, color: T.t3 }}>→</motion.span>
      </div>
      <AnimatePresence>
        {spreadsheetOpen && (
          <motion.div initial="collapsed" animate="open" exit="collapsed" variants={sectionContentVariants}>
            <SpreadsheetAiPanel T={T} model={spreadsheetAi} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>}
    <div style={{ borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
      <div onClick={() => setKbOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>KNOWLEDGE BASE</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.t2, opacity: 0.8 }}>{s.nodes.filter(n => n.type === 'note').length} notes</span>
        <motion.span animate={{ rotate: kbOpen ? 90 : 0 }} style={{ fontSize: 10, color: T.t3 }}>→</motion.span>
      </div>
      <AnimatePresence>
        {kbOpen && (
          <motion.div initial="collapsed" animate="open" exit="collapsed" variants={sectionContentVariants}>
            <KnowledgeBasePanel
              nodes={s.nodes}
              T={T}
              selectedNodeId={s.sel.length === 1 ? s.sel[0] : null}
              onFocusNote={(id) => {
                d({ type: "SEL", v: [id] });
                const node = s.nodes.find(n => n.id === id);
                if (node) {
                  const cx = (node.x || 0) + (node.w || 300) / 2;
                  const cy = (node.y || 0) + (node.h || 400) / 2;
                  const tx = window.innerWidth * 0.5 - cx * s.zoom;
                  const ty = window.innerHeight * 0.42 - cy * s.zoom;
                  d({ type: "PAN", x: tx, y: ty });
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    <div style={{ borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
      <div onClick={() => setExecutionOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>EXECUTION</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.t2, opacity: 0.8 }}>{execution.stats.totalTasks} tasks</span>
        <motion.span animate={{ rotate: executionOpen ? 90 : 0 }} style={{ fontSize: 10, color: T.t3 }}>→</motion.span>
      </div>
      <AnimatePresence>
        {executionOpen && (
          <motion.div initial="collapsed" animate="open" exit="collapsed" variants={sectionContentVariants}>
            <ExecutionPanel T={T} execution={execution} onToggleTimeline={onToggleTimeline} timelineOpen={timelineOpen} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    <div style={{ borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
      <div onClick={() => setVaultOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>PROJECT VAULT</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.t2, opacity: 0.8 }}>registry</span>
        <motion.span animate={{ rotate: vaultOpen ? 90 : 0 }} style={{ fontSize: 10, color: T.t3 }}>→</motion.span>
      </div>
      <AnimatePresence>
        {vaultOpen && (
          <motion.div initial="collapsed" animate="open" exit="collapsed" variants={sectionContentVariants}>
            <VaultPanel T={T} vaultApi={vaultApi} notify={notify} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    <div style={{ borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
      <div onClick={() => setCollabOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>COLLABORATION</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.t2, opacity: 0.8 }}>{Array.isArray(collab?.users) ? collab.users.length : 0} online</span>
        <motion.span animate={{ rotate: collabOpen ? 90 : 0 }} style={{ fontSize: 10, color: T.t3 }}>→</motion.span>
      </div>
      <AnimatePresence>
        {collabOpen && (
          <motion.div initial="collapsed" animate="open" exit="collapsed" variants={sectionContentVariants}>
            <CollaborationPanel
              T={T}
              users={collab?.users || []}
              myPresence={collab?.presence || "active"}
              onPresenceChange={collab?.setPresence}
              activity={collab?.activity || []}
              comments={collab?.comments || []}
              onFocusComment={collab?.focusComment}
              onDeleteComment={collab?.deleteComment}
              onReplyComment={collab?.replyComment}
              meetingNotes={collab?.meetingNotes || ""}
              setMeetingNotes={collab?.setMeetingNotes}
              runMeetingAssistant={collab?.runMeetingAssistant}
              meetingBusy={Boolean(collab?.meetingBusy)}
              meetingSuggestions={collab?.meetingSuggestions || null}
              applyMeetingSuggestions={collab?.applyMeetingSuggestions}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    <div style={{ borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
      <div onClick={() => setAgentsOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>AI AGENTS</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.t2, opacity: 0.8 }}>{agents.busyAgent ? "running" : "idle"}</span>
        <motion.span animate={{ rotate: agentsOpen ? 90 : 0 }} style={{ fontSize: 10, color: T.t3 }}>→</motion.span>
      </div>
      <AnimatePresence>
        {agentsOpen && (
          <motion.div initial="collapsed" animate="open" exit="collapsed" variants={sectionContentVariants}>
            <AgentPanel T={T} agents={agents} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    <div style={{ borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
      <div onClick={() => setFileOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>SPIDER WEB - FILE</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.t2, opacity: 0.8 }}>{fl ? "loading..." : (fn ? "ready" : "idle")}</span>
        <motion.span animate={{ rotate: fileOpen ? 90 : 0 }} style={{ fontSize: 10, color: T.t3 }}>→</motion.span>
      </div>
      <AnimatePresence>
      {fileOpen&&<motion.div initial="collapsed" animate="open" exit="collapsed" variants={sectionContentVariants}>
    <FileZone onFile={handleFile} loading={fl} fn={fn} summary={fs} error={fe} T={T} />
    {filePlan && fileDraft && !fl && <div style={{ borderBottom: `1px solid ${T.b0}`, padding: "10px 12px", background: T.bg1, flexShrink: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: T.y, marginBottom: 8, fontFamily: "'JetBrains Mono',monospace", display: "flex", alignItems: "center", gap: 6 }}>
        <span>* TEMPLATE PICKER</span>
      </div>
      <div style={{ fontSize: 11, color: T.t0, lineHeight: 1.45, marginBottom: 6 }}>
        Recomandat: <b style={{ color: T.y }}>{FILE_TEMPLATE_LABELS[filePlan.recommended] || filePlan.recommended}</b>
      </div>
      {filePlan.reason && <div style={{ fontSize: 10.5, color: T.t1, lineHeight: 1.45, marginBottom: 7 }}>{filePlan.reason}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 7 }}>
        <span style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", padding: "2px 6px", border: `1px solid ${T.b0}`, borderRadius: 999 }}>
          complexity: {filePlan.complexity}
        </span>
        <span style={{ fontSize: 10.5, color: filePlan.needsTable ? T.y : T.t2, fontFamily: "'JetBrains Mono',monospace", padding: "2px 6px", border: `1px solid ${filePlan.needsTable ? T.yDim : T.b0}`, borderRadius: 999, background: filePlan.needsTable ? T.yBg : "transparent" }}>
          table: {filePlan.needsTable ? "yes" : "no"}
        </span>
      </div>
      {filePlan.needsTable && filePlan.tableReason && <div style={{ fontSize: 10, color: T.t2, lineHeight: 1.4, marginBottom: 7 }}>{filePlan.tableReason}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
        {filePlan.options.map(key => {
          const active = (filePlan.selected || filePlan.recommended) === key;
          return <button key={key} onClick={() => runFileGeneration(key)} style={{ background: active ? T.yBg : T.bg3, border: `1px solid ${active ? T.yDim : T.b1}`, color: active ? T.y : T.t1, padding: "3px 7px", borderRadius: 5, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
            {FILE_TEMPLATE_LABELS[key] || key}
          </button>;
        })}
      </div>
      <button onClick={() => runFileGeneration(filePlan.recommended)} style={{ width: "100%", background: T.bg3, border: `1px solid ${T.yDim}`, color: T.y, padding: "6px 8px", borderRadius: 7, fontSize: 10.5, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
        Genereaza cu recomandarea AI
      </button>
    </div>}
      </motion.div>}
      </AnimatePresence>
    </div>
    <div style={{ borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
      <div onClick={() => setExecOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>EXECUTION PLAN</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.t2, opacity: 0.8 }}>{execLoading ? "running..." : "mvp"}</span>
        <motion.span animate={{ rotate: execOpen ? 90 : 0 }} style={{ fontSize: 10, color: T.t3 }}>→</motion.span>
      </div>
      <AnimatePresence>
      {execOpen && <motion.div initial="collapsed" animate="open" exit="collapsed" variants={sectionContentVariants} style={{ padding: "0 10px 10px" }}>
        <textarea
          value={execInput}
          onChange={e => setExecInput(e.target.value)}
          placeholder="Paste PRD + repo context + issues list..."
          rows={6}
          style={{ width: "100%", background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 7, padding: "7px 8px", fontSize: 11, color: T.t0, lineHeight: 1.4, resize: "vertical", outline: "none", marginBottom: 6 }}
          onFocus={e => (e.target.style.borderColor = T.yDim)}
          onBlur={e => (e.target.style.borderColor = T.b1)}
        />
        {execError && <div style={{ fontSize: 10.5, color: "#fca5a5", marginBottom: 6 }}>{execError}</div>}
        {execSummary && <div style={{ fontSize: 10.5, color: "#86efac", marginBottom: 6 }}>{execSummary}</div>}
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 10, color: T.t2, userSelect: "none", marginBottom: 6 }}>
          <input type="checkbox" checked={execReplace} onChange={e => setExecReplace(e.target.checked)} />
          <span>Replace canvas</span>
        </label>
        <button onClick={runExecutionPlan} disabled={execLoading || !String(execInput || "").trim()} style={{ width: "100%", background: execLoading ? T.bg3 : T.yBg, border: `1px solid ${execLoading ? T.b1 : T.yDim}`, color: execLoading ? T.t2 : T.y, padding: "6px 8px", borderRadius: 7, fontSize: 10.5, cursor: execLoading ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
          {execLoading ? "Generating..." : "Generate execution board"}
        </button>
        <div style={{ height: 1, background: T.b0, margin: "10px 0 8px" }} />
        <div style={{ fontSize: 10.5, fontWeight: 600, color: T.y, marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>GITHUB SYNC (BIDIRECTIONAL)</div>
        <input
          value={ghRepo}
          onChange={e => setGhRepo(e.target.value)}
          placeholder="owner/repo (ex: org/platform)"
          style={{ width: "100%", background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 7, padding: "6px 8px", fontSize: 10.5, color: T.t0, marginBottom: 6, outline: "none" }}
          onFocus={e => (e.target.style.borderColor = T.yDim)}
          onBlur={e => (e.target.style.borderColor = T.b1)}
        />
        <div style={{ background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 7, padding: "7px 8px", marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: T.t2, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span>Auth:</span>
            <span style={{ color: ghConnected ? "#86efac" : (ghAvailable ? T.y : "#fca5a5"), fontFamily: "'JetBrains Mono',monospace" }}>
              {ghConnected ? `connected${ghAccount?.login ? ` @${ghAccount.login}` : ""}` : (ghAvailable ? "env fallback" : "not connected")}
            </span>
            {ghSource && <span style={{ marginLeft: "auto", color: T.t3, fontSize: 9 }}>{ghSource}</span>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {!ghConnected && <button onClick={runGitHubConnect} disabled={ghAuthLoading} style={{ flex: 1, background: ghAuthLoading ? T.bg2 : T.yBg, border: `1px solid ${ghAuthLoading ? T.b1 : T.yDim}`, color: ghAuthLoading ? T.t2 : T.y, padding: "5px 8px", borderRadius: 6, fontSize: 10, cursor: ghAuthLoading ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
              {ghAuthLoading ? "Connecting..." : "Connect GitHub"}
            </button>}
            {ghConnected && <button onClick={runGitHubDisconnect} disabled={ghAuthLoading} style={{ flex: 1, background: "transparent", border: `1px solid ${T.b1}`, color: T.t1, padding: "5px 8px", borderRadius: 6, fontSize: 10, cursor: ghAuthLoading ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono',monospace" }}>
              Disconnect
            </button>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <label style={{ fontSize: 10, color: T.t2 }}>Issues:</label>
          <select value={ghState} onChange={e => setGhState(e.target.value)} style={{ flex: 1, background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 6, color: T.t0, fontSize: 10.5, padding: "4px 6px", outline: "none" }}>
            <option value="open">open</option>
            <option value="all">all</option>
            <option value="closed">closed</option>
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 10, color: T.t2, userSelect: "none", marginBottom: 6 }}>
          <input type="checkbox" checked={ghIncremental} onChange={e => setGhIncremental(e.target.checked)} />
          <span>Incremental import (from last sync)</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <label style={{ fontSize: 10, color: T.t2, minWidth: 56 }}>Conflict:</label>
          <select value={ghConflictStrategy} onChange={e => setGhConflictStrategy(e.target.value)} style={{ flex: 1, background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 6, color: T.t0, fontSize: 10.5, padding: "4px 6px", outline: "none" }}>
            <option value="skip_remote_newer">skip if remote newer</option>
            <option value="prefer_board">prefer board changes</option>
            <option value="prefer_remote">prefer remote changes</option>
          </select>
        </div>
        {ghError && <div style={{ fontSize: 10, color: "#fca5a5", marginBottom: 6 }}>{ghError}</div>}
        {ghSummary && <div style={{ fontSize: 10, color: "#86efac", marginBottom: 6 }}>{ghSummary}</div>}
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={runGitHubImport} disabled={ghLoading || ghAuthLoading || !ghAvailable || !String(ghRepo || "").trim()} style={{ flex: 1, background: ghLoading ? T.bg3 : T.bg3, border: `1px solid ${ghLoading ? T.b1 : T.yDim}`, color: ghLoading ? T.t2 : T.y, padding: "6px 8px", borderRadius: 7, fontSize: 10, cursor: ghLoading ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
            {ghLoading ? "Working..." : "Import -> Board"}
          </button>
          <button onClick={runGitHubPush} disabled={ghLoading || ghAuthLoading || !ghAvailable || !String(ghRepo || "").trim()} style={{ flex: 1, background: ghLoading ? T.bg3 : T.yBg, border: `1px solid ${ghLoading ? T.b1 : T.yDim}`, color: ghLoading ? T.t2 : T.y, padding: "6px 8px", borderRadius: 7, fontSize: 10, cursor: ghLoading ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
            {ghLoading ? "Working..." : "Push Board -> Issues"}
          </button>
        </div>
        <div style={{ height: 1, background: T.b0, margin: "10px 0 8px" }} />
        <div style={{ fontSize: 10.5, fontWeight: 600, color: T.y, marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>JIRA IMPORT (MVP)</div>
        <input
          value={jiraSite}
          onChange={e => setJiraSite(e.target.value)}
          placeholder="https://company.atlassian.net"
          style={{ width: "100%", background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 7, padding: "6px 8px", fontSize: 10.5, color: T.t0, marginBottom: 6, outline: "none" }}
          onFocus={e => (e.target.style.borderColor = T.yDim)}
          onBlur={e => (e.target.style.borderColor = T.b1)}
        />
        <input
          value={jiraProject}
          onChange={e => setJiraProject(e.target.value.toUpperCase())}
          placeholder="PROJECT KEY (ex: ENG)"
          style={{ width: "100%", background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 7, padding: "6px 8px", fontSize: 10.5, color: T.t0, marginBottom: 6, outline: "none" }}
          onFocus={e => (e.target.style.borderColor = T.yDim)}
          onBlur={e => (e.target.style.borderColor = T.b1)}
        />
        <input
          value={jiraEmail}
          onChange={e => setJiraEmail(e.target.value)}
          placeholder="Jira email (optional if server env set)"
          style={{ width: "100%", background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 7, padding: "6px 8px", fontSize: 10.5, color: T.t0, marginBottom: 6, outline: "none" }}
          onFocus={e => (e.target.style.borderColor = T.yDim)}
          onBlur={e => (e.target.style.borderColor = T.b1)}
        />
        <input
          type="password"
          value={jiraToken}
          onChange={e => setJiraToken(e.target.value)}
          placeholder="Jira API token (optional if server env set)"
          style={{ width: "100%", background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 7, padding: "6px 8px", fontSize: 10.5, color: T.t0, marginBottom: 6, outline: "none" }}
          onFocus={e => (e.target.style.borderColor = T.yDim)}
          onBlur={e => (e.target.style.borderColor = T.b1)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <label style={{ fontSize: 10, color: T.t2 }}>Issues:</label>
          <select value={jiraState} onChange={e => setJiraState(e.target.value)} style={{ flex: 1, background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 6, color: T.t0, fontSize: 10.5, padding: "4px 6px", outline: "none" }}>
            <option value="open">open</option>
            <option value="all">all</option>
            <option value="closed">closed</option>
          </select>
        </div>
        {jiraError && <div style={{ fontSize: 10, color: "#fca5a5", marginBottom: 6 }}>{jiraError}</div>}
        {jiraSummary && <div style={{ fontSize: 10, color: "#86efac", marginBottom: 6 }}>{jiraSummary}</div>}
        <button onClick={runJiraImport} disabled={jiraLoading || !String(jiraSite || "").trim()} style={{ width: "100%", background: jiraLoading ? T.bg3 : T.yBg, border: `1px solid ${jiraLoading ? T.b1 : T.yDim}`, color: jiraLoading ? T.t2 : T.y, padding: "6px 8px", borderRadius: 7, fontSize: 10, cursor: jiraLoading ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
          {jiraLoading ? "Importing..." : "Import Jira -> Board"}
        </button>
      </motion.div>}
      </AnimatePresence>
    </div>
    {(contextMode === "node" || contextMode === "spreadsheet") && <PropsPanel
      s={s}
      d={d}
      T={T}
      getTableInfo={getTableInfo}
      TABLE_DEFAULT_COL_WIDTH={TABLE_DEFAULT_COL_WIDTH}
      TABLE_MIN_COLS={TABLE_MIN_COLS}
      TABLE_MIN_ROWS={TABLE_MIN_ROWS}
      TABLE_MIN_COL_WIDTH={TABLE_MIN_COL_WIDTH}
      TABLE_MAX_COL_WIDTH={TABLE_MAX_COL_WIDTH}
    />}
    {contextMode === "board" && <BoardAccessPanel boardId={boardId} currentUser={currentUser} T={T} accessApi={accessApi} notify={notify} />}
    {contextMode === "board" && <VersionHistoryPanel
      boardId={boardId}
      T={T}
      historyApi={historyApi}
      onRestoreVersion={onRestoreVersion}
      notify={notify}
    />}
    {contextMode === "board" && <AuditTimelinePanel boardId={boardId} T={T} auditApi={auditApi} />}

    {voteResults.length > 0 && <div style={{ borderBottom: `1px solid ${T.b0}`, padding: "10px 12px", background: T.bg1, flexShrink: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: T.y, marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>* REZULTATE VOT</div>
      {voteResults.slice(0, 5).map(({ node, v }, i) => <div key={node.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, padding: "5px 8px", background: T.bg3, borderRadius: 6, border: `1px solid ${T.b1}` }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace", minWidth: 18 }}>#{i + 1}</span>
        <span style={{ flex: 1, fontSize: 11, color: T.t0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.text?.slice(0, 30) || "(gol)"}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace" }}>{v}*</span>
      </div>)}
    </div>}

    <div onClick={() => setOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", cursor: "pointer", userSelect: "none", borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: loading ? T.y : T.green, animation: loading ? "pulse 1s infinite" : "none" }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: T.t0, fontFamily: "'JetBrains Mono',monospace", flex: 1, letterSpacing: ".06em" }}>ASISTENT AI</span>
      <motion.span animate={{ rotate: open ? 90 : 0 }} style={{ fontSize: 10, color: T.t3 }}>→</motion.span>
    </div>
    <AnimatePresence>
    {open && <motion.div initial="collapsed" animate="open" exit="collapsed" variants={{ open: { flex: 1, opacity: 1 }, collapsed: { flex: 0, height: 0, opacity: 0 } }} style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: "9px 9px 7px", minHeight: 0 }}>
      {msgs.length === 0 && <div style={{ marginBottom: 9 }}>
        <p style={{ fontSize: 11, color: T.t2, marginBottom: 7, lineHeight: 1.5 }}>Generez orice structura pe canvas:</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {AI_CHIPS.map(chip => <button key={chip} onClick={() => send(chip)} style={{ background: T.bg3, border: `1px solid ${T.b1}`, color: T.t1, padding: "3px 8px", borderRadius: 5, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit", lineHeight: 1.4, transition: "all .12s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = T.yDim; e.currentTarget.style.color = T.y; e.currentTarget.style.background = T.yBg; }} onMouseLeave={e => { e.currentTarget.style.borderColor = T.b1; e.currentTarget.style.color = T.t1; e.currentTarget.style.background = T.bg3; }}>{chip}</button>)}
        </div>
      </div>}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5, paddingRight: 2 }}>
        {msgs.map((m, i) => <div key={i} style={{ display: "flex", gap: 6, fontSize: 11.5, lineHeight: 1.5, padding: "6px 9px", borderRadius: 7, background: m.role === "user" ? T.bg3 : "rgba(250,204,21,.05)", border: `1px solid ${m.role === "user" ? T.b1 : T.yDim}`, color: m.role === "user" ? T.t0 : T.y, animation: "fadeUp .18s ease" }}>
          <span style={{ fontSize: 9, opacity: .5, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0, marginTop: 2 }}>{m.role === "user" ? "you" : " ai"}</span>
          <span>{m.text}</span>
        </div>)}
        {loading && <div style={{ display: "flex", gap: 6, padding: "6px 9px", borderRadius: 7, background: "rgba(250,204,21,.05)", border: `1px solid ${T.yDim}`, color: T.y, fontSize: 11.5, animation: "pulse 1s infinite" }}><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, opacity: .5 }}> ai</span><span>Generez...</span></div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 5, alignItems: "flex-end", marginTop: 7, flexShrink: 0 }}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="ce sa creez..."
          rows={2}
          style={{ flex: 1, background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 7, padding: "6px 8px", fontSize: 11.5, fontFamily: "'DM Sans',sans-serif", resize: "none", outline: "none", color: T.t0, lineHeight: 1.4 }}
          onFocus={e => (e.target.style.borderColor = T.yDim)}
          onBlur={e => (e.target.style.borderColor = T.b1)}
        />
        <button onClick={() => send()} disabled={loading} style={{ width: 32, height: 32, background: loading ? T.bg3 : T.yBg, border: `1px solid ${loading ? T.b1 : T.yDim}`, borderRadius: 7, color: loading ? T.t3 : T.y, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", flexShrink: 0 }}>{"->"}</button>
      </div>
      <button onClick={clearAll} style={{ marginTop: 5, background: "transparent", border: `1px solid ${T.b0}`, color: T.t2, padding: "4px", borderRadius: 5, fontSize: 10, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".04em" }} onMouseEnter={e => { e.currentTarget.style.borderColor = T.red; e.currentTarget.style.color = "#fca5a5"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = T.b0; e.currentTarget.style.color = T.t2; }}>CLEAR ALL</button>
    </motion.div>}
    </AnimatePresence>
  </motion.div>;
}


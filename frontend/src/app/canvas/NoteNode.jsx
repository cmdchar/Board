import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { Maximize2, Minimize2, Edit3, Save, Link as LinkIcon, Bold, Italic, Code, Eye } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function NoteNode({ node, sel, onSel, onTouchSel, onUpd, onRSt, onRotSt, depFade = 1, T, nodes = [], RH: GlobalRH }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(node.text || '');
  const [previewNote, setPreviewNote] = useState(null);
  const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });
  const editorRef = useRef(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(node.text || '');
    }
  }, [node.text, isEditing]);

  const handleSave = () => {
    onUpd(node.id, { text: draft });
    setIsEditing(false);
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (!node.locked) {
      setIsEditing(true);
    }
  };

  const insertFormatting = (prefix, suffix = prefix) => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const newText = before + prefix + selection + suffix + after;
    setDraft(newText);

    // Reset focus and selection
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const shadow = sel ? `0 0 0 2px ${T.y}, 0 20px 50px rgba(0,0,0,0.5)` : `0 10px 30px rgba(0,0,0,0.3)`;

  // Bi-directional link parser with Hover Preview
  const renderTextWithLinks = (text) => {
    if (typeof text !== 'string') return text;
    const parts = text.split(/(\[\[.*?\]\])/g);
    return parts.map((part, i) => {
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const targetStr = part.slice(2, -2).trim();

        // Find target note for preview
        const targetNote = nodes.find(n => {
          if (n.id === targetStr) return true;
          const title = n.text?.split('\n')[0].replace(/^#+\s*/, '').trim();
          return title?.toLowerCase() === targetStr.toLowerCase();
        });

        return (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('boardai:focus-note', { detail: { id: targetStr } }));
            }}
            onMouseEnter={(e) => {
              if (targetNote) {
                setPreviewNote(targetNote);
                setPreviewPos({ x: e.clientX, y: e.clientY });
              }
            }}
            onMouseLeave={() => setPreviewNote(null)}
            style={{ color: T.y, cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
          >
            {targetStr}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div
      data-node="1"
      data-node-id={node.id}
      data-node-type="note"
      data-selected={sel ? "1" : "0"}
      className="na"
      onMouseDown={e => { e.stopPropagation(); onSel(node.id, e.shiftKey, e.altKey); }}
      onDoubleClick={handleDoubleClick}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        zIndex: node.zIndex || 5,
        opacity: (node.opacity ?? 1) * depFade,
        background: node.color || T.bg1,
        border: `1px solid ${sel ? T.y : T.b1}`,
        borderRadius: 12,
        boxShadow: shadow,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        cursor: isEditing ? "text" : (node.locked ? "default" : "move"),
        transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
        transition: "box-shadow 0.2s ease, border-color 0.2s ease"
      }}
    >
      {/* Header / Toolbar */}
      <div style={{
        height: 36,
        padding: "0 12px",
        background: "rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        userSelect: "none"
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.y }}></div>
          <span style={{ fontSize: 10, fontWeight: 700, color: T.t2, fontFamily: "'JetBrains Mono', monospace" }}>OBSIDIAN NOTE</span>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {isEditing ? (
            <>
              <button onClick={(e) => { e.stopPropagation(); insertFormatting('**'); }} title="Bold" style={toolButtonStyle}><Bold size={12} /></button>
              <button onClick={(e) => { e.stopPropagation(); insertFormatting('_'); }} title="Italic" style={toolButtonStyle}><Italic size={12} /></button>
              <button onClick={(e) => { e.stopPropagation(); insertFormatting('`'); }} title="Code" style={toolButtonStyle}><Code size={12} /></button>
              <button onClick={(e) => { e.stopPropagation(); insertFormatting('[[', ']]'); }} title="Bi-link" style={toolButtonStyle}><LinkIcon size={12} /></button>
              <button
                onClick={(e) => { e.stopPropagation(); handleSave(); }}
                style={{ ...toolButtonStyle, background: T.yBg, color: T.y, borderColor: T.yDim, marginLeft: 4 }}
              >
                <Save size={12} /> <span style={{ fontSize: 9, fontWeight: 800, marginLeft: 4 }}>SAVE</span>
              </button>
            </>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} style={toolButtonStyle}><Edit3 size={12} /></button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {isEditing ? (
          <textarea
            ref={editorRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSave();
              }
            }}
            style={{
              width: "100%",
              height: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#c9d1d9",
              padding: 16,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              resize: "none",
              lineHeight: 1.6
            }}
            autoFocus
          />
        ) : (
          <div className="markdown-body" style={{
            height: "100%",
            overflowY: "auto",
            padding: 20,
            color: T.t1,
            fontSize: 14,
            lineHeight: 1.6
          }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                p: ({children}) => <p style={{marginBottom: 12}}>{React.Children.map(children, child => typeof child === 'string' ? renderTextWithLinks(child) : child)}</p>,
                li: ({children}) => <li style={{marginBottom: 4}}>{React.Children.map(children, child => typeof child === 'string' ? renderTextWithLinks(child) : child)}</li>,
                h1: ({children}) => <h1 style={{fontSize: '1.8em', fontWeight: 800, borderBottom: `1px solid ${T.b1}`, paddingBottom: 10, marginBottom: 20, color: T.t0, fontFamily: "'Instrument Serif', serif"}}>{children}</h1>,
                h2: ({children}) => <h2 style={{fontSize: '1.4em', fontWeight: 700, marginBottom: 16, color: T.t0, marginTop: 24}}>{children}</h2>,
                h3: ({children}) => <h3 style={{fontSize: '1.2em', fontWeight: 700, marginBottom: 12, color: T.t0, marginTop: 20}}>{children}</h3>,
                blockquote: ({children}) => <blockquote style={{borderLeft: `4px solid ${T.y}`, paddingLeft: 16, margin: '16px 0', color: T.t2, fontStyle: 'italic'}}>{children}</blockquote>,
                code: ({node, inline, className, children, ...props}) => {
                  return !inline ? (
                    <pre style={{background: T.bg0, padding: 16, borderRadius: 10, overflow: 'auto', marginBottom: 20, border: `1px solid ${T.b1}`}}>
                      <code className={className} style={{fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px'}} {...props}>{children}</code>
                    </pre>
                  ) : (
                    <code style={{background: T.bg3, padding: '2px 6px', borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: '12.5px', color: T.y}} {...props}>{children}</code>
                  )
                }
              }}
            >
              {node.text}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {sel && !node.locked && (GlobalRH ? <GlobalRH nodeId={node.id} onStart={onRSt} /> : <RH nodeId={node.id} onStart={onRSt} />)}

      <AnimatePresence>
        {previewNote && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            style={{
              position: 'fixed',
              left: previewPos.x + 20,
              top: previewPos.y - 100,
              width: 320,
              maxHeight: 240,
              background: T.bg2,
              border: `1px solid ${T.yDim}`,
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              zIndex: 10000,
              pointerEvents: 'none',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 10, color: T.y, fontWeight: 800 }}>
              <Eye size={12} /> PREVIEW
            </div>
            <div style={{ color: T.t0, fontSize: 15, fontWeight: 800, marginBottom: 8, fontFamily: "'Instrument Serif', serif" }}>
              {previewNote.text?.split('\n')[0].replace(/^#+\s*/, '').trim() || 'Untitled'}
            </div>
            <div style={{ color: T.t2, fontSize: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {previewNote.text?.split('\n').slice(1).join('\n').trim()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const toolButtonStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 4,
  color: "#8b949e",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  padding: 0,
  transition: "all 0.1s ease"
};

// Mock RH since it's injected normally
function RH({ nodeId, onStart }) {
  const RDS = [
    { d: "se", s: { bottom: -5, right: -5, cursor: "se-resize" } },
    { d: "sw", s: { bottom: -5, left: -5, cursor: "sw-resize" } },
    { d: "ne", s: { top: -5, right: -5, cursor: "ne-resize" } },
    { d: "nw", s: { top: -5, left: -5, cursor: "nw-resize" } }
  ];
  return RDS.map(({ d, s }) => (
    <div key={d}
      onMouseDown={e => { e.stopPropagation(); onStart(e, nodeId, d); }}
      style={{ ...s, position: "absolute", width: 10, height: 10, background: "#0d1117", border: "1.5px solid #facc15", borderRadius: 2, zIndex: 30 }}
    />
  ));
}

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Command, MousePointer2, Hand, StickyNote, Type,
  FileText, ArrowRight, Square, Circle, Diamond,
  Undo2, Redo2, Maximize, Trash2, Sun, Moon,
  Map, PanelRight, Calendar, BrainCircuit
} from 'lucide-react';

export default function CommandPalette({ isOpen, onClose, s, d, T, themes, themeMode, onToggleTheme, onToggleMinimap, onToggleTimeline, showMinimap, showTimeline, rightOpen, onToggleRight, api, boardId }) {
  const [query, setQ] = useState("");
  const [semanticResults, setSemanticResults] = useState([]);
  const semanticTimeout = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQ("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands = useMemo(() => [
    // Tools
    { id: 'tool-select', label: 'Select Tool', icon: <MousePointer2 size={16} />, category: 'Tools', shortcut: 'V', action: () => d({ type: "TOOL", v: "select" }) },
    { id: 'tool-pan', label: 'Pan Tool', icon: <Hand size={16} />, category: 'Tools', shortcut: 'H', action: () => d({ type: "TOOL", v: "pan" }) },
    { id: 'tool-sticky', label: 'Add Sticky Note', icon: <StickyNote size={16} />, category: 'Tools', shortcut: 'S', action: () => d({ type: "TOOL", v: "sticky" }) },
    { id: 'tool-text', label: 'Add Text', icon: <Type size={16} />, category: 'Tools', shortcut: 'T', action: () => d({ type: "TOOL", v: "text" }) },
    { id: 'tool-note', label: 'Add Obsidian Note', icon: <FileText size={16} />, category: 'Tools', shortcut: 'N', action: () => d({ type: "TOOL", v: "note" }) },
    { id: 'tool-arrow', label: 'Add Connector', icon: <ArrowRight size={16} />, category: 'Tools', shortcut: 'A', action: () => d({ type: "TOOL", v: "arrow" }) },

    // Shapes
    { id: 'shape-rect', label: 'Add Rectangle', icon: <Square size={16} />, category: 'Shapes', shortcut: 'R', action: () => d({ type: "TOOL", v: "rect" }) },
    { id: 'shape-circle', label: 'Add Circle', icon: <Circle size={16} />, category: 'Shapes', shortcut: 'C', action: () => d({ type: "TOOL", v: "circle" }) },
    { id: 'shape-diamond', label: 'Add Diamond', icon: <Diamond size={16} />, category: 'Shapes', shortcut: 'D', action: () => d({ type: "TOOL", v: "diamond" }) },

    // Board Actions
    { id: 'action-undo', label: 'Undo', icon: <Undo2 size={16} />, category: 'Actions', shortcut: '⌘Z', action: () => d({ type: "UNDO" }) },
    { id: 'action-redo', label: 'Redo', icon: <Redo2 size={16} />, category: 'Actions', shortcut: '⌘Y', action: () => d({ type: "REDO" }) },
    { id: 'action-fit', label: 'Zoom to Fit', icon: <Maximize size={16} />, category: 'Actions', action: () => d({ type: "ZOOM_FIT", vw: window.innerWidth, vh: window.innerHeight }) },
    { id: 'action-clear', label: 'Clear Canvas', icon: <Trash2 size={16} />, category: 'Actions', action: () => { if(confirm("Clear everything?")) d({ type: "CLEAR" }); } },

    // View & UI
    { id: 'ui-theme', label: `Switch to ${themeMode === 'dark' ? 'Light' : 'Dark'} Mode`, icon: themeMode === 'dark' ? <Sun size={16} /> : <Moon size={16} />, category: 'View', action: onToggleTheme },
    { id: 'ui-minimap', label: `${showMinimap ? 'Hide' : 'Show'} Minimap`, icon: <Map size={16} />, category: 'View', action: onToggleMinimap },
    { id: 'ui-timeline', label: `${showTimeline ? 'Hide' : 'Show'} Timeline`, icon: <Calendar size={16} />, category: 'View', action: onToggleTimeline },
    { id: 'ui-inspector', label: `${rightOpen ? 'Hide' : 'Show'} Inspector`, icon: <PanelRight size={16} />, category: 'View', action: onToggleRight },
  ], [d, themeMode, onToggleTheme, showMinimap, onToggleMinimap, showTimeline, onToggleTimeline, rightOpen, onToggleRight]);

  const nodeResults = useMemo(() => {
    if (query.length < 2) return [];
    return s.nodes
      .filter(n => !n.hidden && n.text?.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)
      .map(n => ({
        id: `node-${n.id}`,
        label: n.text?.split('\n')[0] || 'Untitled Node',
        category: 'Nodes',
        icon: <Search size={14} />,
        action: () => {
          d({ type: "SEL", v: [n.id] });
          d({ type: "PAN", x: -n.x * s.zoom + window.innerWidth / 2 - (n.w / 2) * s.zoom, y: -n.y * s.zoom + window.innerHeight / 2 - (n.h / 2) * s.zoom });
        }
      }));
  }, [query, s.nodes, s.zoom, d]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setSemanticResults([]);
      return;
    }
    if (semanticTimeout.current) clearTimeout(semanticTimeout.current);
    semanticTimeout.current = setTimeout(async () => {
      try {
        const data = await api.semanticSearch(boardId, query, 3);
        if (data.results) {
          const mapped = data.results.map(res => {
            const node = s.nodes.find(n => n.id === res.nodeId);
            return {
              id: `sem-${res.nodeId}`,
              label: res.content.split('\n')[0] || 'AI Match',
              category: 'AI Semantic Search',
              icon: <BrainCircuit size={14} />,
              shortcut: `${Math.round(res.similarity * 100)}%`,
              action: () => {
                if (node) {
                  d({ type: "SEL", v: [node.id] });
                  d({ type: "PAN", x: -node.x * s.zoom + window.innerWidth / 2 - (node.w / 2) * s.zoom, y: -node.y * s.zoom + window.innerHeight / 2 - (node.h / 2) * s.zoom });
                }
              }
            };
          });
          setSemanticResults(mapped);
        }
      } catch (e) {
        console.error('Semantic palette search failed', e);
      }
    }, 500);
    return () => clearTimeout(semanticTimeout.current);
  }, [query, boardId, api, s.nodes, s.zoom, d]);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    const cmdMatches = commands.filter(c => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
    return [...cmdMatches, ...nodeResults, ...semanticResults];
  }, [query, commands, nodeResults, semanticResults]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    const item = scrollRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        animation: 'shineIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(90vw, 600px)',
          background: T.bg2,
          border: `1px solid ${T.b2}`,
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '60vh'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: `1px solid ${T.b1}`, gap: '12px' }}>
          <Command size={20} color={T.y} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search nodes..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: T.t0,
              fontSize: '16px',
              fontFamily: 'inherit'
            }}
          />
          <div style={{ fontSize: '10px', color: T.t2, border: `1px solid ${T.b1}`, padding: '2px 6px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace" }}>ESC</div>
        </div>

        <div ref={scrollRef} style={{ overflowY: 'auto', padding: '8px' }}>
          {filteredItems.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: T.t2, fontSize: '14px' }}>
              No commands or nodes found matching "{query}"
            </div>
          ) : (
            <div>
              {filteredItems.map((item, index) => {
                const isSelected = index === selectedIndex;
                const showCategory = index === 0 || filteredItems[index - 1].category !== item.category;

                return (
                  <React.Fragment key={item.id}>
                    {showCategory && (
                      <div style={{ padding: '8px 12px 4px', fontSize: '10px', fontWeight: 800, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {item.category}
                      </div>
                    )}
                    <div
                      data-index={index}
                      onClick={() => { item.action(); onClose(); }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: isSelected ? T.bg3 : 'transparent',
                        color: isSelected ? T.y : T.t1,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.1s ease'
                      }}
                    >
                      <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? T.yBg : T.bg1, borderRadius: '6px', color: isSelected ? T.y : T.t2 }}>
                        {item.icon}
                      </div>
                      <span style={{ flex: 1, fontSize: '14px', fontWeight: isSelected ? 600 : 500 }}>{item.label}</span>
                      {item.shortcut && (
                        <div style={{ fontSize: '10px', color: T.t3, border: `1px solid ${isSelected ? T.yDim : T.b0}`, padding: '2px 6px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                          {item.shortcut}
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '10px 16px', background: T.bg1, borderTop: `1px solid ${T.b1}`, display: 'flex', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: T.t2 }}>
            <div style={{ border: `1px solid ${T.b1}`, padding: '1px 4px', borderRadius: '3px' }}>↑↓</div>
            <span>Navigate</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: T.t2 }}>
            <div style={{ border: `1px solid ${T.b1}`, padding: '1px 4px', borderRadius: '3px' }}>ENTER</div>
            <span>Select</span>
          </div>
        </div>
      </div>
    </div>
  );
}

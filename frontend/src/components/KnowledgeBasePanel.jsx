import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Book, Link as LinkIcon, Clock, ChevronRight, Share2, Network, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function KnowledgeBasePanel({ nodes, onFocusNote, T, selectedNodeId }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'graph'

  const notes = useMemo(() => {
    return nodes.filter(n => n.type === 'note' && !n.hidden);
  }, [nodes]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(n =>
      n.text.toLowerCase().includes(q) ||
      n.id.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  const titleToIdMap = useMemo(() => {
    const map = {};
    notes.forEach(note => {
      const title = note.text.split('\n')[0].replace(/^#+\s*/, '').trim();
      if (title) map[title.toLowerCase()] = note.id;
    });
    return map;
  }, [notes]);

  const { backlinksMap, outgoingLinksMap, allEdges } = useMemo(() => {
    const bMap = {};
    const oMap = {};
    const edges = [];

    notes.forEach(note => {
      const links = note.text.match(/\[\[(.*?)\]\]/g);
      if (links) {
        links.forEach(link => {
          const targetStr = link.slice(2, -2).trim();
          const targetId = titleToIdMap[targetStr.toLowerCase()];

          if (targetId) {
            // Backlinks
            if (!bMap[targetId]) bMap[targetId] = [];
            bMap[targetId].push({
              id: note.id,
              title: note.text.split('\n')[0].replace(/^#+\s*/, '').trim() || 'Untitled Note'
            });

            // Outgoing links
            if (!oMap[note.id]) oMap[note.id] = [];
            oMap[note.id].push({
              targetId,
              targetTitle: targetStr
            });

            edges.push({ source: note.id, target: targetId });
          }
        });
      }
    });
    return { backlinksMap: bMap, outgoingLinksMap: oMap, allEdges: edges };
  }, [notes, titleToIdMap]);

  const selectedNote = useMemo(() => {
    if (!selectedNodeId) return null;
    return notes.find(n => n.id === selectedNodeId);
  }, [notes, selectedNodeId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: T.t0 }}>
      <div style={{ padding: '16px', borderBottom: `1px solid ${T.b1}`, background: `${T.bg2}aa`, backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: T.y, letterSpacing: '0.05em' }}>
            <Network size={16} /> OBSIDIAN KNOWLEDGE BASE
          </h3>
          <div style={{ display: 'flex', background: T.bg1, borderRadius: '6px', padding: '2px' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: viewMode === 'list' ? T.bg3 : 'transparent', color: viewMode === 'list' ? T.t0 : T.t2, fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('graph')}
              style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: viewMode === 'graph' ? T.bg3 : 'transparent', color: viewMode === 'graph' ? T.t0 : T.t2, fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}
            >
              Graph
            </button>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: T.t2 }} />
          <input
            type="text"
            placeholder="Filter obsidian notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: T.bg0,
              border: `1px solid ${T.b1}`,
              borderRadius: '8px',
              padding: '8px 8px 8px 32px',
              color: T.t0,
              fontSize: '12px',
              outline: 'none',
              fontFamily: "'JetBrains Mono', monospace"
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: viewMode === 'list' ? 'auto' : 'hidden', position: 'relative' }}>
        {viewMode === 'list' ? (
          <div style={{ padding: '12px' }}>
            {selectedNote && !searchQuery && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: '20px', padding: '16px', background: `${T.yBg}22`, border: `1px solid ${T.yDim}`, borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.y }}></div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: T.y, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Selected Context</div>
                </div>
                <h4 style={{ fontSize: '16px', fontWeight: 800, color: T.t0, marginBottom: '14px', fontFamily: "'Instrument Serif', serif" }}>
                  {selectedNote.text.split('\n')[0].replace(/^#+\s*/, '').trim() || 'Untitled Note'}
                </h4>

                <div style={{ display: 'grid', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: T.t2, marginBottom: '6px', fontWeight: 600 }}>OUTGOING LINKS ({outgoingLinksMap[selectedNote.id]?.length || 0})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {outgoingLinksMap[selectedNote.id]?.map(link => (
                        <button
                          key={link.targetId}
                          onClick={() => onFocusNote(link.targetId)}
                          style={{ padding: '4px 10px', background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: '6px', fontSize: '11px', color: T.t1, cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.y; e.currentTarget.style.color = T.y; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.b1; e.currentTarget.style.color = T.t1; }}
                        >
                          {link.targetTitle} →
                        </button>
                      )) || <div style={{ fontSize: '11px', color: T.t3, fontStyle: 'italic' }}>No outgoing links</div>}
                    </div>
                  </div>

                  <div style={{ borderTop: `1px dashed ${T.b1}`, paddingTop: '12px' }}>
                    <div style={{ fontSize: '10px', color: T.t2, marginBottom: '6px', fontWeight: 600 }}>BACKLINKS ({backlinksMap[selectedNote.id]?.length || 0})</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {backlinksMap[selectedNote.id]?.map(link => (
                        <button
                          key={link.id}
                          onClick={() => onFocusNote(link.id)}
                          style={{ padding: '4px 10px', background: `${T.yBg}44`, border: `1px solid ${T.yDim}`, borderRadius: '6px', fontSize: '11px', color: T.y, cursor: 'pointer', fontWeight: 600 }}
                        >
                          ← {link.title}
                        </button>
                      )) || <div style={{ fontSize: '11px', color: T.t3, fontStyle: 'italic' }}>No incoming links</div>}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {filteredNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: T.t3 }}>
                <Book size={40} style={{ marginBottom: '16px', opacity: 0.15 }} />
                <p style={{ fontSize: '13px', fontWeight: 500 }}>No Obsidian notes found.</p>
                <p style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>Create notes and use [[Link]] syntax.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: T.t2, marginBottom: '4px', letterSpacing: '0.05em' }}>ALL NOTES ({filteredNotes.length})</div>
                {filteredNotes.map(note => {
                  const title = note.text.split('\n')[0].replace(/^#+\s*/, '').trim() || 'Untitled Note';
                  const backlinks = backlinksMap[note.id] || [];
                  const outgoing = outgoingLinksMap[note.id] || [];
                  const isSelected = selectedNodeId === note.id;

                  return (
                    <motion.div
                      key={note.id}
                      layoutId={note.id}
                      onClick={() => onFocusNote(note.id)}
                      style={{
                        padding: '14px',
                        background: isSelected ? T.bg3 : T.bg2,
                        border: `1px solid ${isSelected ? T.y : T.b1}`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                        position: 'relative',
                        boxShadow: isSelected ? `0 4px 16px ${T.y}22` : 'none'
                      }}
                      onMouseEnter={(e) => { if(!isSelected) e.currentTarget.style.borderColor = T.t2; }}
                      onMouseLeave={(e) => { if(!isSelected) e.currentTarget.style.borderColor = T.b1; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 700, color: isSelected ? T.y : T.t1, fontFamily: isSelected ? "'Instrument Serif', serif" : 'inherit' }}>{title}</h4>
                        {isSelected && <div style={{ background: T.y, width: 6, height: 6, borderRadius: '50%' }}></div>}
                      </div>

                      <div style={{ fontSize: '11px', color: T.t2, lineHeight: 1.4, marginBottom: '10px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {note.text.split('\n').slice(1).join(' ').trim() || 'No additional content...'}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        {backlinks.length > 0 && (
                          <span style={{ fontSize: '9px', color: T.y, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px', background: `${T.yBg}22`, padding: '2px 8px', borderRadius: '4px', border: `1px solid ${T.yDim}66` }}>
                            <Share2 size={10} /> {backlinks.length}
                          </span>
                        )}
                        {outgoing.length > 0 && (
                          <span style={{ fontSize: '9px', color: T.t2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px', background: T.bg1, padding: '2px 8px', borderRadius: '4px', border: `1px solid ${T.b0}` }}>
                            <LinkIcon size={10} /> {outgoing.length}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <LocalGraphView
            notes={notes}
            edges={allEdges}
            selectedNodeId={selectedNodeId}
            onFocusNote={onFocusNote}
            T={T}
          />
        )}
      </div>

      <div style={{ padding: '14px', borderTop: `1px solid ${T.b1}`, background: T.bg0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '10px', color: T.t2, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
          <Clock size={12} style={{ color: T.y }} /> Bi-directional Sync Active
        </div>
        <div style={{ fontSize: '9px', color: T.t3, fontFamily: "'JetBrains Mono', monospace" }}>{notes.length} NODES · {allEdges.length} LINKS</div>
      </div>
    </div>
  );
}

function LocalGraphView({ notes, edges, selectedNodeId, onFocusNote, T }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }
  }, []);

  // Simple layout logic for the graph
  const graphData = useMemo(() => {
    if (dimensions.width === 0) return { nodes: [], edges: [] };

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    // We only show the local neighborhood of the selected node or all if none selected
    const focusId = selectedNodeId;
    let relevantNodeIds = new Set();

    if (focusId) {
      relevantNodeIds.add(focusId);
      edges.forEach(e => {
        if (e.source === focusId) relevantNodeIds.add(e.target);
        if (e.target === focusId) relevantNodeIds.add(e.source);
      });
    } else {
      notes.forEach(n => relevantNodeIds.add(n.id));
    }

    const filteredNodes = notes.filter(n => relevantNodeIds.has(n.id));
    const filteredEdges = edges.filter(e => relevantNodeIds.has(e.source) && relevantNodeIds.has(e.target));

    // Circular layout
    const radius = Math.min(centerX, centerY) * 0.7;
    const nodePositions = {};

    filteredNodes.forEach((node, i) => {
      if (node.id === focusId) {
        nodePositions[node.id] = { x: centerX, y: centerY };
      } else {
        const angle = (i / (filteredNodes.length - (focusId ? 1 : 0))) * Math.PI * 2;
        nodePositions[node.id] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius
        };
      }
    });

    return {
      nodes: filteredNodes.map(n => ({ ...n, ...nodePositions[n.id] })),
      edges: filteredEdges.map(e => ({
        ...e,
        x1: nodePositions[e.source].x,
        y1: nodePositions[e.source].y,
        x2: nodePositions[e.target].x,
        y2: nodePositions[e.target].y
      }))
    };
  }, [notes, edges, selectedNodeId, dimensions]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: T.bg0, position: 'relative', overflow: 'hidden' }}>
      <svg style={{ width: '100%', height: '100%' }}>
        {/* Render Edges */}
        {graphData.edges.map((edge, i) => (
          <motion.line
            key={`edge-${i}`}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.3 }}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke={T.y}
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />
        ))}

        {/* Render Nodes */}
        {graphData.nodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const title = node.text.split('\n')[0].replace(/^#+\s*/, '').trim() || 'Untitled';

          return (
            <g key={node.id} onClick={() => onFocusNote(node.id)} style={{ cursor: 'pointer' }}>
              <motion.circle
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                cx={node.x}
                cy={node.y}
                r={isSelected ? 8 : 5}
                fill={isSelected ? T.y : T.bg3}
                stroke={isSelected ? T.bg0 : T.y}
                strokeWidth={isSelected ? 2 : 1.5}
                whileHover={{ r: 10, fill: T.y }}
              />
              <motion.text
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                x={node.x}
                y={node.y + (isSelected ? 20 : 16)}
                textAnchor="middle"
                fill={isSelected ? T.y : T.t2}
                style={{
                  fontSize: isSelected ? '11px' : '9px',
                  fontWeight: isSelected ? 800 : 500,
                  fontFamily: isSelected ? "'Instrument Serif', serif" : 'inherit',
                  pointerEvents: 'none',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}
              >
                {title}
              </motion.text>
            </g>
          );
        })}
      </svg>

      {!selectedNodeId && notes.length > 0 && (
        <div style={{ position: 'absolute', bottom: '12px', left: '12px', background: `${T.bg2}aa`, padding: '6px 10px', borderRadius: '8px', border: `1px solid ${T.b1}`, fontSize: '10px', color: T.t2, backdropFilter: 'blur(4px)' }}>
          Select a note to see its local neighborhood
        </div>
      )}
    </div>
  );
}

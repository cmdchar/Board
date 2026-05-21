import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, FileText, StickyNote, Type, Square, BrainCircuit } from "lucide-react";

export default function SearchPanelView({ onClose, s, d, isMobile = false, T, api, boardId }) {
  const [q, setQ] = useState("");
  const [semanticResults, setSemanticResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const r = useRef(null);
  const searchTimeout = useRef(null);

  useEffect(() => r.current?.focus(), []);

  const results =
    q.trim().length > 1 ? s.nodes.filter((n) => !n.hidden && n.text?.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];

  useEffect(() => {
    if (q.trim().length < 3) {
      setSemanticResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.semanticSearch(boardId, q);
        if (data.results) {
          setSemanticResults(data.results.filter(res => !results.some(r => r.id === res.nodeId)));
        }
      } catch (e) {
        console.error('Semantic search failed', e);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(searchTimeout.current);
  }, [q, boardId, api]);
  function goTo(node) {
    d({ type: "SEL", v: [node.id] });
    d({ type: "PAN", x: -node.x * s.zoom + window.innerWidth / 2 - (node.w / 2) * s.zoom, y: -node.y * s.zoom + window.innerHeight / 2 - (node.h / 2) * s.zoom });
    onClose();
  }
  const getTypeIcon = (type) => {
    if (type === 'note') return <FileText size={14} />;
    if (type === 'sticky') return <StickyNote size={14} />;
    if (type === 'text') return <Type size={14} />;
    return <Square size={14} />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95, x: "-50%" }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      style={{
        position: "absolute",
        top: 74,
        left: "50%",
        background: T.bg2,
        border: `1px solid ${T.b2}`,
        borderRadius: 16,
        padding: 16,
        zIndex: 600,
        width: isMobile ? "min(92vw,440px)" : 440,
        boxShadow: "0 24px 60px rgba(0,0,0,.6)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <Search size={18} color={T.y} />
        <input
          ref={r}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cauta în noduri sau note…"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T.t0, fontSize: 15, fontFamily: "'DM Sans',sans-serif" }}
        />
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.t2, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <X size={18} />
        </button>
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            style={{ borderTop: `1px solid ${T.b0}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6, maxHeight: "40vh", overflowY: "auto" }}
          >
            {results.map((n) => (
              <motion.button
                key={n.id}
                whileHover={{ x: 4, backgroundColor: T.bg3 }}
                onClick={() => goTo(n)}
                style={{
                  background: "transparent",
                  border: `1px solid transparent`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  cursor: "pointer",
                  textAlign: "left",
                  color: T.t0,
                  fontSize: 13,
                  fontFamily: "'DM Sans',sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  transition: "color 0.2s"
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 8, background: T.bg1, display: "flex", alignItems: "center", justifyContent: "center", color: T.t2 }}>
                  {getTypeIcon(n.type)}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                    {n.text?.split('\n')[0] || "(gol)"}
                  </div>
                  <div style={{ fontSize: 10, color: T.t3, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                    {n.type}
                  </div>
                </div>
              </motion.button>
            ))}

            {semanticResults.length > 0 && (
              <div style={{ padding: '8px 12px 4px', fontSize: '9px', fontWeight: 800, color: T.y, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8 }}>
                Semantic Matches (AI Concept Search)
              </div>
            )}

            {semanticResults.map((res) => {
              const node = s.nodes.find(n => n.id === res.nodeId);
              if (!node) return null;
              return (
                <motion.button
                  key={`sem-${res.nodeId}`}
                  whileHover={{ x: 4, backgroundColor: T.yBg }}
                  onClick={() => goTo(node)}
                  style={{
                    background: "transparent",
                    border: `1px solid ${T.y}22`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    cursor: "pointer",
                    textAlign: "left",
                    color: T.t0,
                    fontSize: 13,
                    fontFamily: "'DM Sans',sans-serif",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    transition: "color 0.2s"
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: T.yBg, display: "flex", alignItems: "center", justifyContent: "center", color: T.y }}>
                    <BrainCircuit size={14} />
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                      {res.content.split('\n')[0] || "(gol)"}
                    </div>
                    <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", display: 'flex', justifyContent: 'space-between' }}>
                      <span>{node.type}</span>
                      <span style={{ opacity: 0.6 }}>{Math.round(res.similarity * 100)}% match</span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {q.length > 1 && results.length === 0 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: T.t2, fontSize: 13, textAlign: "center", padding: "16px 0", fontStyle: "italic" }}>
          Nimic gasit pentru "{q}"
        </motion.p>
      )}

      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.b1}`, fontSize: 10, color: T.t3, textAlign: "center", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.05em" }}>
        CMD+K PENTRU PALETA · ESC PENTRU ÎNCHIDERE
      </div>
    </motion.div>
  );
}

import { useCallback, useMemo } from "react";
import TemplateMarketplacePanel from "../../components/TemplateMarketplacePanel";

export default function TplPanelView({ onClose, isMobile = false, currentUser, onOpenBoard, s, d, boardId, api, T, uid, notify }) {
  const boardData = useMemo(() => ({ nodes: s.nodes || [], arrows: s.arrows || [], comments: s.comments || [], votes: s.votes || {} }), [s.nodes, s.arrows, s.comments, s.votes]);

  const handleInsertData = useCallback(
    (payload) => {
      const sourceNodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
      const sourceArrows = Array.isArray(payload?.arrows) ? payload.arrows : [];
      if (!sourceNodes.length) return;
      const idMap = new Map();
      const minX = Math.min(...sourceNodes.map((n) => Number(n?.x) || 0));
      const minY = Math.min(...sourceNodes.map((n) => Number(n?.y) || 0));
      const maxX = Math.max(...sourceNodes.map((n) => (Number(n?.x) || 0) + (Number(n?.w) || 120)));
      const maxY = Math.max(...sourceNodes.map((n) => (Number(n?.y) || 0) + (Number(n?.h) || 80)));
      const sourceCx = minX + (maxX - minX) * 0.5;
      const sourceCy = minY + (maxY - minY) * 0.5;
      const viewCx = (-s.px + window.innerWidth * 0.5) / Math.max(0.01, s.zoom);
      const viewCy = (-s.py + window.innerHeight * 0.42) / Math.max(0.01, s.zoom);
      const offsetX = Math.round(viewCx - sourceCx);
      const offsetY = Math.round(viewCy - sourceCy);
      const nodes = sourceNodes.map((node) => {
        const id = uid();
        const fromId = String(node?.id || id);
        idMap.set(fromId, id);
        return {
          ...(node || {}),
          id,
          x: Math.round((Number(node?.x) || 0) + offsetX),
          y: Math.round((Number(node?.y) || 0) + offsetY),
        };
      });
      const nodeIds = new Set(nodes.map((n) => n.id));
      const arrows = sourceArrows
        .map((arr) => {
          const fromId = idMap.get(String(arr?.fromId || "")) || "";
          const toId = idMap.get(String(arr?.toId || "")) || "";
          if (!fromId || !toId || fromId === toId || !nodeIds.has(fromId) || !nodeIds.has(toId)) return null;
          return {
            ...(arr || {}),
            id: uid(),
            fromId,
            toId,
          };
        })
        .filter(Boolean);
      nodes.forEach((node) => d({ type: "ADD", node }));
      arrows.forEach((arr) => d({ type: "ADD_ARR", arr }));
      const ids = nodes.map((n) => n.id);
      if (ids.length > 1) d({ type: "TIDY", ids });
      d({ type: "SEL", v: ids.slice(0, 12) });
    },
    [d, s.px, s.py, s.zoom, uid],
  );

  return (
    <TemplateMarketplacePanel
      open
      onClose={onClose}
      isMobile={isMobile}
      api={api}
      T={T}
      uid={uid}
      boardId={boardId}
      boardData={boardData}
      currentUser={currentUser}
      onInsertData={handleInsertData}
      onOpenBoard={onOpenBoard}
      notify={(msg, type) => notify?.(msg, type)}
    />
  );
}

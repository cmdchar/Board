import { useEffect, useMemo } from "react";

export function usePortConnectController({
  hoverNodeId,
  sel,
  portConnect,
  setPortConnect,
  visibleNodes,
  DEFAULT_PORTS,
  getPortWorldPosition,
  nodes,
  d,
  toW,
  buildConnectorFromDefaults,
  addNodeAndConnector,
  triggerConnectorSnapFx,
  zoom,
}) {
  const portVisibleNodeIds = new Set([hoverNodeId, ...sel, portConnect?.fromEntityId || "", portConnect?.targetPort?.nodeId || ""]);
  const visiblePortNodes = visibleNodes.filter((n) => portVisibleNodeIds.has(n.id));

  const getPortPointsForNode = (node) => DEFAULT_PORTS.map((port) => {
    const p = getPortWorldPosition(node, port.id);
    return { ...p, nodeId: node.id, nodeType: node.type, portId: port.id };
  });

  function findClosestPort(wx, wy, excludeNodeId = null) {
    let best = null;
    let bestD = Infinity;
    for (const n of visibleNodes) {
      if (excludeNodeId && n.id === excludeNodeId) continue;
      for (const port of getPortPointsForNode(n)) {
        const d2 = (port.x - wx) * (port.x - wx) + (port.y - wy) * (port.y - wy);
        if (d2 < bestD) { bestD = d2; best = port; }
      }
    }
    if (!best) return null;
    const dist = Math.sqrt(bestD);
    const threshold = Math.max(16, 26 / Math.max(.2, zoom));
    return dist <= threshold ? { ...best, dist } : null;
  }

  function startPortConnect(e, nodeId, portId) {
    e.preventDefault();
    e.stopPropagation();
    const n = nodes.find((x) => x.id === nodeId);
    if (!n) return;
    const p = getPortWorldPosition(n, portId);
    setPortConnect({ fromEntityId: nodeId, fromPortId: portId, start: { x: p.x, y: p.y }, mouse: { x: p.x, y: p.y }, targetPort: null });
    d({ type: "EXIT_ADD_MODE" });
  }

  useEffect(() => {
    if (!portConnect) return;
    const raf = { id: 0, last: null };
    const commitMove = () => {
      raf.id = 0;
      if (!raf.last) return;
      const pt = raf.last;
      raf.last = null;
      const hit = findClosestPort(pt.x, pt.y, portConnect.fromEntityId);
      setPortConnect((prev) => prev ? { ...prev, mouse: pt, targetPort: hit } : prev);
    };
    const move = (e) => {
      if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
      const pt = toW(e.clientX, e.clientY);
      raf.last = pt;
      if (!raf.id) {
        raf.id = window.requestAnimationFrame(commitMove);
      }
    };
    const up = (e) => {
      if (raf.id) {
        window.cancelAnimationFrame(raf.id);
        raf.id = 0;
      }
      const pt = toW(e.clientX, e.clientY);
      const hit = portConnect.targetPort || findClosestPort(pt.x, pt.y, portConnect.fromEntityId);
      if (hit && hit.nodeId && hit.nodeId !== portConnect.fromEntityId) {
        const connector = buildConnectorFromDefaults({
          fromEntityId: portConnect.fromEntityId,
          toEntityId: hit.nodeId,
          fromAnchor: { type: "port", portId: portConnect.fromPortId },
          toAnchor: { type: "port", portId: hit.portId },
        });
        if (connector) {
          d({ type: "ADD_ARR", arr: connector });
          triggerConnectorSnapFx({ x: hit.x, y: hit.y });
        }
      } else {
        addNodeAndConnector(portConnect.fromEntityId, pt);
      }
      setPortConnect(null);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    return () => {
      if (raf.id) window.cancelAnimationFrame(raf.id);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [addNodeAndConnector, buildConnectorFromDefaults, portConnect, triggerConnectorSnapFx, zoom, visibleNodes]);

  const previewConnectorPath = useMemo(() => {
    if (!portConnect) return "";
    const start = portConnect.start || { x: 0, y: 0 };
    const end = portConnect.targetPort
      ? { x: portConnect.targetPort.x, y: portConnect.targetPort.y }
      : (portConnect.mouse || start);
    return `M${start.x},${start.y} L${end.x},${end.y}`;
  }, [portConnect]);

  return {
    visiblePortNodes,
    getPortPointsForNode,
    startPortConnect,
    previewConnectorPath,
  };
}

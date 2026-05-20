import { connectorCapMarkerId, dashArrayForStyle } from "../../lib/geometry/connectors/model";

export default function ConnectorRenderer({
  connectorVisuals = [],
  selectedConnectorIdSet,
  sel = [],
  selectedArrow = null,
  setSelectedArrow,
  setHoveredConnectorId,
  hoveredConnectorId = "",
  spreadsheetFlowEdgeSet,
  dataConnectorIdSet,
  dataConnectorErrorById,
  deps = null,
  T,
  onConnectorCtx,
  isDataConnector,
  getConnectorDependencyType,
  previewConnectorPath = "",
}) {
  return (
    <svg style={{ position: "absolute", inset: 0, width: 10000, height: 10000, overflow: "visible", pointerEvents: "auto", zIndex: 6 }}>
      <defs>
        <marker id="connector-cap-arrow-end" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <path d="M0 0 L8 3.5 L0 7 Z" fill="context-stroke" />
        </marker>
        <marker id="connector-cap-arrow-start" markerWidth="9" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
          <path d="M0 0 L8 3.5 L0 7 Z" fill="context-stroke" />
        </marker>
        <marker id="connector-cap-triangle-end" markerWidth="10" markerHeight="9" refX="9" refY="4.5" orient="auto">
          <path d="M0 0 L9 4.5 L0 9 Z" fill="context-stroke" />
        </marker>
        <marker id="connector-cap-triangle-start" markerWidth="10" markerHeight="9" refX="1" refY="4.5" orient="auto-start-reverse">
          <path d="M0 0 L9 4.5 L0 9 Z" fill="context-stroke" />
        </marker>
        <marker id="connector-cap-circle-end" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <circle cx="3.5" cy="3.5" r="2.5" fill="context-stroke" />
        </marker>
        <marker id="connector-cap-circle-start" markerWidth="7" markerHeight="7" refX="2" refY="3.5" orient="auto-start-reverse">
          <circle cx="3.5" cy="3.5" r="2.5" fill="context-stroke" />
        </marker>
      </defs>
      {connectorVisuals.map((connector) => {
        const a = connector.source;
        const connectorSelected = selectedConnectorIdSet.has(String(a.id || ""));
        const isSel = sel.includes(connector.fromId) || sel.includes(connector.toId) || selectedArrow === a.id || connectorSelected;
        const isHover = hoveredConnectorId === a.id;
        const isSheetDataFlow = spreadsheetFlowEdgeSet.has(`${connector.fromId}->${connector.toId}`);
        const isDataFlowConnector = dataConnectorIdSet.has(a.id) || isSheetDataFlow || isDataConnector(a);
        const dataError = String(dataConnectorErrorById[a.id] || "").trim();
        const depEdge = deps ? deps.upEdges.has(a.id) || deps.downEdges.has(a.id) || sel.includes(connector.fromId) || sel.includes(connector.toId) : false;
        const depType = getConnectorDependencyType(a);
        const hasDepType = Boolean(depType);
        const depCol = depType === "blocks" ? "#f97316" : depType === "related" ? "#22c55e" : "#60a5fa";
        const depDash = depType === "related" ? "dotted" : depType === "blocks" ? "dashed" : "solid";
        const baseStroke = deps
          ? deps.upEdges.has(a.id)
            ? "#60a5fa"
            : deps.downEdges.has(a.id)
              ? "#34d399"
              : "#334155"
          : isSel || isHover
            ? T.y
            : hasDepType
              ? depCol
              : isDataFlowConnector
                ? "#22d3ee"
                : connector.style.stroke || T.t2;
        const stroke = dataError ? T.red : baseStroke;
        const sw = deps ? (depEdge ? Math.max(2, connector.style.width) : Math.max(1, connector.style.width * 0.75)) : isSel || isHover ? Math.max(2, connector.style.width + 0.2) : connector.style.width;
        const op = deps ? (depEdge ? 1 : 0.2) : isSel || isHover ? 1 : isDataFlowConnector ? 0.96 : 1;
        const dashArray = dashArrayForStyle(hasDepType ? depDash : isDataFlowConnector ? "dashed" : connector.style.dash, sw);
        const routePoints = connector.routePoints.length ? connector.routePoints : [connector.start, connector.end];
        return (
          <g
            key={a.id}
            data-connector-id={a.id}
            style={{ pointerEvents: "auto" }}
            onPointerEnter={() => setHoveredConnectorId(a.id)}
            onPointerLeave={() => setHoveredConnectorId((v) => (v === a.id ? "" : v))}
            onPointerDown={(e) => {
              if (e.pointerType === "touch") {
                e.stopPropagation();
                setSelectedArrow(a.id);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey) return;
              setSelectedArrow(a.id === selectedArrow ? null : a.id);
            }}
            onContextMenu={(e) => onConnectorCtx(e, connector)}
          >
            <path data-connector-id={a.id} d={connector.path} fill="none" stroke="transparent" strokeWidth={22} style={{ cursor: "pointer" }} />
            <path
              className={`connector-line${isDataFlowConnector ? " connector-line-data" : ""}${isSel ? " connector-line-selected" : ""}`}
              data-connector-id={a.id}
              d={connector.path}
              fill="none"
              stroke={stroke}
              strokeWidth={sw}
              strokeDasharray={dashArray}
              style={{ ...(connector.style.dash !== "solid" ? { animation: "dash 1.5s linear infinite" } : {}), opacity: op }}
              markerEnd={connectorCapMarkerId(connector.style.endCap, false)}
              markerStart={connectorCapMarkerId(connector.style.startCap, true)}
            />
            {selectedArrow === a.id &&
              routePoints.map((pt, idx) => <circle key={`${a.id}_cp_${idx}`} cx={pt.x} cy={pt.y} r={3.5} fill={T.yBg} stroke={T.y} strokeWidth={1.1} style={{ pointerEvents: "none" }} />)}
            {isDataFlowConnector && (
              <g style={{ pointerEvents: "none" }}>
                <circle cx={connector.mid.x} cy={connector.mid.y} r={8} fill={dataError ? "rgba(239,68,68,.25)" : "rgba(34,211,238,.22)"} stroke={dataError ? T.red : "#22d3ee"} strokeWidth={1.2} />
                <text x={connector.mid.x} y={connector.mid.y + 3.1} textAnchor="middle" fontSize="8" fill={dataError ? T.red : "#67e8f9"} fontFamily="'JetBrains Mono',monospace" fontWeight="700">
                  D
                </text>
              </g>
            )}
          </g>
        );
      })}
      {previewConnectorPath && <path d={previewConnectorPath} fill="none" stroke={T.y} strokeWidth={1.8} strokeDasharray="6 6" opacity={0.9} />}
    </svg>
  );
}

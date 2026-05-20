export function useConnectorContextMenu({
  connectorById,
  T,
  updateConnector,
  d,
  setSelectedArrow,
  wRef,
  setCtxMenu,
  setMobileCtxMenu,
}) {
  const cycleCap = (cap) => {
    const order = ["none", "arrow", "circle", "triangle"];
    const idx = order.indexOf(String(cap || "none").toLowerCase());
    return order[(idx + 1 + order.length) % order.length];
  };

  function buildConnectorContextGroups(connector) {
    if (!connector?.source?.id) return [];
    const c = connector.source;
    const style = connector.style;
    return [
      {
        id: "connector-routing",
        label: "Change routing",
        items: [
          { id: "connector-route-straight", label: "Straight", icon: "-", enabled: connector.routing !== "straight", onSelect: () => updateConnector(c, { routing: "straight" }) },
          { id: "connector-route-ortho", label: "Orthogonal", icon: "L", enabled: connector.routing !== "ortho", onSelect: () => updateConnector(c, { routing: "ortho" }) },
          { id: "connector-route-curved", label: "Curved", icon: "~", enabled: connector.routing !== "curved", onSelect: () => updateConnector(c, { routing: "curved" }) },
          { id: "connector-route-wavy", label: "Wavy", icon: "w", enabled: connector.routing !== "wavy", onSelect: () => updateConnector(c, { routing: "wavy" }) },
        ],
      },
      {
        id: "connector-style",
        label: "Change style",
        items: [
          { id: "connector-color-default", label: "Color: default", icon: "C", onSelect: () => updateConnector(c, { style: { stroke: T.t2 } }) },
          { id: "connector-color-accent", label: "Color: accent", icon: "C", onSelect: () => updateConnector(c, { style: { stroke: T.y } }) },
          { id: "connector-color-blue", label: "Color: blue", icon: "C", onSelect: () => updateConnector(c, { style: { stroke: T.blue } }) },
          { id: "connector-dash-solid", label: "Solid", icon: "S", enabled: style.dash !== "solid", onSelect: () => updateConnector(c, { style: { dash: "solid" } }) },
          { id: "connector-dash-dashed", label: "Dashed", icon: "D", enabled: style.dash !== "dashed", onSelect: () => updateConnector(c, { style: { dash: "dashed" } }) },
          { id: "connector-dash-dotted", label: "Dotted", icon: "O", enabled: style.dash !== "dotted", onSelect: () => updateConnector(c, { style: { dash: "dotted" } }) },
          { id: "connector-width-2", label: "Thickness: 2px", icon: "2", enabled: Math.round(style.width) !== 2, onSelect: () => updateConnector(c, { style: { width: 2 } }) },
          { id: "connector-width-3", label: "Thickness: 3px", icon: "3", enabled: Math.round(style.width) !== 3, onSelect: () => updateConnector(c, { style: { width: 3 } }) },
          { id: "connector-width-4", label: "Thickness: 4px", icon: "4", enabled: Math.round(style.width) !== 4, onSelect: () => updateConnector(c, { style: { width: 4 } }) },
        ],
      },
      {
        id: "connector-label",
        label: "Add label",
        items: [
          {
            id: "connector-label-edit", label: "Edit label", icon: "L", onSelect: () => {
              const next = window.prompt("Connector label", String(c.label || ""));
              if (next === null) return;
              updateConnector(c, { label: String(next || "") });
            },
          },
        ],
      },
      {
        id: "connector-actions",
        label: "Delete",
        items: [
          { id: "connector-delete", label: "Delete", icon: "x", danger: true, onSelect: () => { d({ type: "DEL_ARR", id: c.id }); setSelectedArrow(null); } },
        ],
      },
    ];
  }

  function openConnectorMobileMenu(connectorId) {
    const connector = connectorById[connectorId];
    if (!connector) return false;
    setSelectedArrow(connectorId);
    setCtxMenu(null);
    setMobileCtxMenu({
      target: "connector",
      nodeType: "connector",
      menu: buildConnectorContextGroups(connector),
    });
    return true;
  }

  function onConnectorCtx(e, connector) {
    e.preventDefault();
    e.stopPropagation();
    if (!connector?.source?.id) return;
    setSelectedArrow(connector.source.id);
    const rect = wRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuW = 286;
    const menuMaxH = Math.min(460, Math.floor(rect.height * .72));
    const edge = 10;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const sx = Math.max(edge, Math.min(localX, rect.width - menuW - edge));
    const sy = Math.max(edge, Math.min(localY, rect.height - menuMaxH - edge));
    const menu = buildConnectorContextGroups(connector);
    setCtxMenu({ sx, sy, maxH: menuMaxH, menu });
  }

  return {
    cycleCap,
    openConnectorMobileMenu,
    onConnectorCtx,
  };
}

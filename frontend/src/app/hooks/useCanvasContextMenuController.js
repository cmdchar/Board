import { useMemo } from "react";
import { buildContextMenu } from "../../components/context-menu/menuBuilder";

const isContainerType = (type) => type === "frame" || type === "lane" || type === "sheet" || type === "deck" || type === "milestone";

export function useCanvasContextMenuController({
  wRef,
  toW,
  nodes,
  sel,
  dispatch,
  clipboard,
  makeContextCommands,
  setCtxMenu,
  setMobileCtxMenu,
  mobileCtxMenu,
}) {
  function openContextMenuAt(clientX, clientY, targetNodeId = "", mobile = false) {
    const rect = wRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { x, y } = toW(clientX, clientY);
    const menuW = 286;
    const menuMaxH = Math.min(520, Math.floor(rect.height * .76));
    const edge = 10;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const sx = Math.max(edge, Math.min(localX, rect.width - menuW - edge));
    const sy = Math.max(edge, Math.min(localY, rect.height - menuMaxH - edge));
    const hitNodeId = String(targetNodeId || "").trim();
    const hitNode = hitNodeId ? nodes.find((n) => n.id === hitNodeId) || null : null;
    const effectiveSel = hitNode ? (sel.includes(hitNode.id) ? sel : [hitNode.id]) : sel;
    if (hitNode && !sel.includes(hitNode.id)) dispatch({ type: "SEL", v: [hitNode.id] });
    const selectionCount = effectiveSel.length;
    const target = selectionCount > 1 ? "selection" : hitNode ? (isContainerType(hitNode.type) ? "container" : "node") : "canvas";
    const baseCtx = {
      target,
      selectionCount,
      entityType: hitNode?.type || "",
      targetNodeId: hitNode?.id || "",
      effectiveSelIds: effectiveSel,
      canPaste: Boolean(clipboard?.length),
      canImportFromUrl: true,
      detectedImportUrl: "",
    };
    const menu = buildContextMenu({
      ...baseCtx,
      commands: makeContextCommands({
        wx: x,
        wy: y,
        effectiveSelIds: effectiveSel,
        targetNode: hitNode,
        detectedImportUrl: "",
      }),
    });
    if (mobile) {
      setCtxMenu(null);
      setMobileCtxMenu({
        target,
        nodeType: hitNode?.type || "",
        menu,
      });
      return;
    }
    setMobileCtxMenu(null);
    setCtxMenu({ wx: x, wy: y, sx, sy, maxH: menuMaxH, menu });
  }

  function onCtx(e) {
    e.preventDefault();
    e.stopPropagation();
    const nodeEl = e.target.closest("[data-node-id]");
    const hitNodeId = String(nodeEl?.getAttribute("data-node-id") || "").trim();
    openContextMenuAt(e.clientX, e.clientY, hitNodeId, false);
  }

  function flattenMobileContextGroups(groups) {
    return (groups || []).map((group) => {
      const items = [];
      (group.items || []).forEach((item) => {
        if (Array.isArray(item.subMenu) && item.subMenu.length) {
          item.subMenu.forEach((subGroup) => {
            (subGroup.items || []).forEach((subItem) => {
              items.push({
                ...subItem,
                label: `${item.label}: ${subItem.label}`,
              });
            });
          });
        } else {
          items.push(item);
        }
      });
      return {
        ...group,
        items,
      };
    }).filter((group) => Array.isArray(group.items) && group.items.length);
  }

  const mobileCtxGroups = useMemo(() => flattenMobileContextGroups(mobileCtxMenu?.menu), [mobileCtxMenu]);
  const mobileCtxTitle = useMemo(() => {
    if (!mobileCtxMenu) return "Actions";
    if (mobileCtxMenu.target === "canvas") return "Canvas Actions";
    if (mobileCtxMenu.target === "container") return "Container Actions";
    if (mobileCtxMenu.target === "connector") return "Connector Actions";
    if (mobileCtxMenu.target === "selection") return "Selection Actions";
    return "Element Actions";
  }, [mobileCtxMenu]);

  return {
    openContextMenuAt,
    onCtx,
    mobileCtxGroups,
    mobileCtxTitle,
  };
}

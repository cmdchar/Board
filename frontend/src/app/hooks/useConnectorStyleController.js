import { useCallback, useEffect } from "react";
import { normalizeConnectorDefaultStyle, normalizeConnectorJumpStyle, normalizeConnectorRouting, normalizeConnectorStyle } from "../../lib/geometry/connectors/model";
import { isDataNodeType, wouldCreateDataFlowCycle } from "../../lib/dataflow/engine";

export function useConnectorStyleController({
  arrows,
  nodes,
  dispatch,
  connectorDefaults,
  setConnectorDefaults,
  connectorDefaultsRef,
  rememberLastConnectorStyle,
  notify,
  uid,
  saveStoredConnectorDefaultStyle,
  saveStoredRememberLastConnectorStyle,
}) {
  useEffect(() => {
    const normalized = normalizeConnectorDefaultStyle(connectorDefaults);
    connectorDefaultsRef.current = normalized;
    saveStoredConnectorDefaultStyle(normalized);
  }, [connectorDefaults, connectorDefaultsRef, saveStoredConnectorDefaultStyle]);

  useEffect(() => {
    saveStoredRememberLastConnectorStyle(rememberLastConnectorStyle);
  }, [rememberLastConnectorStyle, saveStoredRememberLastConnectorStyle]);

  const connectorPresetFromConnector = useCallback((connector) => {
    if (!connector) return normalizeConnectorDefaultStyle(connectorDefaultsRef.current);
    return normalizeConnectorDefaultStyle({
      routing: connector.routing,
      style: normalizeConnectorStyle(connector),
      jumpStyle: normalizeConnectorJumpStyle(connector.jumpStyle, "auto"),
    });
  }, [connectorDefaultsRef]);

  const setConnectorStyleAsDefault = useCallback((connector) => {
    setConnectorDefaults(connectorPresetFromConnector(connector));
  }, [connectorPresetFromConnector, setConnectorDefaults]);

  const resetConnectorStyleDefault = useCallback(() => {
    setConnectorDefaults(normalizeConnectorDefaultStyle({}));
  }, [setConnectorDefaults]);

  const buildConnectorFromDefaults = useCallback((spec, overrides = {}) => {
    if (!spec?.fromEntityId || !spec?.toEntityId) return null;
    const fromNode = nodes.find((n) => n.id === spec.fromEntityId) || null;
    const toNode = nodes.find((n) => n.id === spec.toEntityId) || null;
    const base = normalizeConnectorDefaultStyle(connectorDefaultsRef.current);
    const stylePatch = overrides && typeof overrides.style === "object" && overrides.style ? overrides.style : {};
    const style = normalizeConnectorStyle({ style: { ...base.style, ...stylePatch } });
    const explicitFlowType = String(overrides?.flowType || "").trim().toLowerCase();
    const inferredData = explicitFlowType === "data" || (isDataNodeType(fromNode?.type) && isDataNodeType(toNode?.type));
    if (inferredData && wouldCreateDataFlowCycle({ nodes, arrows, fromId: spec.fromEntityId, toId: spec.toEntityId })) {
      notify?.("Data flow cycle prevented", "error");
      return null;
    }
    const connector = {
      id: uid(),
      fromId: spec.fromEntityId,
      toId: spec.toEntityId,
      from: { entityId: spec.fromEntityId, anchor: spec.fromAnchor || { type: "pos", xNorm: 0.5, yNorm: 0.5 } },
      to: { entityId: spec.toEntityId, anchor: spec.toAnchor || { type: "pos", xNorm: 0.5, yNorm: 0.5 } },
      routing: normalizeConnectorRouting(overrides?.routing ?? base.routing),
      style,
      jumpStyle: normalizeConnectorJumpStyle(overrides?.jumpStyle ?? base.jumpStyle, base.jumpStyle),
      label: String(overrides?.label ?? ""),
    };
    if (inferredData) {
      connector.flowType = "data";
      if (!String(connector.label || "").trim()) connector.label = "data";
      if (!overrides?.depType) connector.depType = "related";
    }
    return connector;
  }, [arrows, connectorDefaultsRef, nodes, notify, uid]);

  const updateConnector = useCallback((connectorOrId, patch, options = {}) => {
    const source = typeof connectorOrId === "string" ? arrows.find((a) => a.id === connectorOrId) || null : connectorOrId && connectorOrId.id ? connectorOrId : null;
    if (!source?.id || !patch || typeof patch !== "object") return;
    const hasStyle = Object.prototype.hasOwnProperty.call(patch, "style");
    const hasRouting = Object.prototype.hasOwnProperty.call(patch, "routing");
    const hasJumpStyle = Object.prototype.hasOwnProperty.call(patch, "jumpStyle");
    const currentStyle = normalizeConnectorStyle(source);
    const nextStyle = hasStyle ? normalizeConnectorStyle({ style: { ...currentStyle, ...(patch.style || {}) } }) : currentStyle;
    const nextRouting = hasRouting ? normalizeConnectorRouting(patch.routing) : normalizeConnectorRouting(source.routing);
    const nextJumpStyle = hasJumpStyle ? normalizeConnectorJumpStyle(patch.jumpStyle, normalizeConnectorJumpStyle(source.jumpStyle, "auto")) : normalizeConnectorJumpStyle(source.jumpStyle, "auto");
    const payload = { ...patch };
    if (hasStyle) payload.style = nextStyle;
    if (hasRouting) payload.routing = nextRouting;
    if (hasJumpStyle) payload.jumpStyle = nextJumpStyle;
    dispatch({ type: "UPD_ARR", id: source.id, p: payload });
    const remember = options?.rememberLast !== false;
    if (remember && rememberLastConnectorStyle && (hasStyle || hasRouting || hasJumpStyle)) {
      setConnectorDefaults(
        normalizeConnectorDefaultStyle({
          routing: nextRouting,
          style: nextStyle,
          jumpStyle: nextJumpStyle,
        }),
      );
    }
  }, [arrows, dispatch, rememberLastConnectorStyle, setConnectorDefaults]);

  return {
    connectorPresetFromConnector,
    setConnectorStyleAsDefault,
    resetConnectorStyleDefault,
    buildConnectorFromDefaults,
    updateConnector,
  };
}

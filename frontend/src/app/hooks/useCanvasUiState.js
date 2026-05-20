import { useEffect, useRef, useState } from "react";

export function useCanvasUiState({
  defaultDrawColor,
  nodes,
  loadStoredConnectorDefaultStyle,
  loadStoredRememberLastConnectorStyle,
  createInputController,
}) {
  const wRef = useRef(null);
  const drag = useRef({ type: "none", sx: 0, sy: 0, px0: 0, py0: 0, nid: "", nx0: 0, ny0: 0, nw0: 0, nh0: 0, dir: "" });
  const moved = useRef(false);
  const dPath = useRef([]);
  const dColor = useRef(defaultDrawColor);
  const [livePath, setLivePath] = useState([]);
  const [lasso, setLasso] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [mobileCtxMenu, setMobileCtxMenu] = useState(null);
  const [radialMenu, setRadialMenu] = useState(null);
  const [commentInput, setCommentInput] = useState(null);
  const [selectedArrow, setSelectedArrow] = useState(null);
  const [selectedConnectorIds, setSelectedConnectorIds] = useState([]);
  const [hoveredConnectorId, setHoveredConnectorId] = useState("");
  const [guides, setGuides] = useState([]);
  const [nodeDragActive, setNodeDragActive] = useState(false);
  const [hoverNodeId, setHoverNodeId] = useState("");
  const [smartConnectSuggestion, setSmartConnectSuggestion] = useState(null);
  const [portConnect, setPortConnect] = useState(null);
  const [mobileInlineEdit, setMobileInlineEdit] = useState(null);
  const [connectorSnapFx, setConnectorSnapFx] = useState(null);
  const [taskSuccessFx, setTaskSuccessFx] = useState(null);
  const [routeNodes, setRouteNodes] = useState(nodes);
  const [connectorDefaults, setConnectorDefaults] = useState(() => loadStoredConnectorDefaultStyle());
  const [rememberLastConnectorStyle, setRememberLastConnectorStyle] = useState(() => loadStoredRememberLastConnectorStyle());
  const [jumpConnectorSource, setJumpConnectorSource] = useState([]);
  const [sheetFormulaSession, setSheetFormulaSession] = useState(null);
  const [sheetFormulaPick, setSheetFormulaPick] = useState(null);

  const cmtRef = useRef(null);
  const pinch = useRef(null);
  const mobileInputRef = useRef(null);
  const mobilePointerCaptureRef = useRef({ active: false, pointerId: null });
  const touchMoveRafRef = useRef(0);
  const touchMovePendingRef = useRef(null);
  const mouseMoveRafRef = useRef(0);
  const mouseMovePendingRef = useRef(null);
  const touchMetaRef = useRef({ targetType: "canvas", targetNodeId: "" });
  const cursorEmitRef = useRef({ ts: 0 });
  const ctxUploadRef = useRef(null);
  const ctxUploadPosRef = useRef(null);
  const connectorSnapTimerRef = useRef(null);
  const taskSuccessTimerRef = useRef(null);
  const connectorDefaultsRef = useRef(connectorDefaults);

  if (!mobileInputRef.current) {
    mobileInputRef.current = createInputController({
      longPressMs: 400,
      moveTolerance: 10,
    });
  }

  useEffect(
    () => () => {
      if (touchMoveRafRef.current) {
        window.cancelAnimationFrame(touchMoveRafRef.current);
        touchMoveRafRef.current = 0;
        touchMovePendingRef.current = null;
      }
      if (mouseMoveRafRef.current) {
        window.cancelAnimationFrame(mouseMoveRafRef.current);
        mouseMoveRafRef.current = 0;
        mouseMovePendingRef.current = null;
      }
      if (connectorSnapTimerRef.current) {
        clearTimeout(connectorSnapTimerRef.current);
        connectorSnapTimerRef.current = null;
      }
      if (taskSuccessTimerRef.current) {
        clearTimeout(taskSuccessTimerRef.current);
        taskSuccessTimerRef.current = null;
      }
    },
    [],
  );

  return {
    wRef,
    drag,
    moved,
    dPath,
    dColor,
    livePath,
    setLivePath,
    lasso,
    setLasso,
    ctxMenu,
    setCtxMenu,
    mobileCtxMenu,
    setMobileCtxMenu,
    radialMenu,
    setRadialMenu,
    commentInput,
    setCommentInput,
    selectedArrow,
    setSelectedArrow,
    selectedConnectorIds,
    setSelectedConnectorIds,
    hoveredConnectorId,
    setHoveredConnectorId,
    guides,
    setGuides,
    nodeDragActive,
    setNodeDragActive,
    hoverNodeId,
    setHoverNodeId,
    smartConnectSuggestion,
    setSmartConnectSuggestion,
    portConnect,
    setPortConnect,
    mobileInlineEdit,
    setMobileInlineEdit,
    connectorSnapFx,
    setConnectorSnapFx,
    taskSuccessFx,
    setTaskSuccessFx,
    routeNodes,
    setRouteNodes,
    connectorDefaults,
    setConnectorDefaults,
    rememberLastConnectorStyle,
    setRememberLastConnectorStyle,
    jumpConnectorSource,
    setJumpConnectorSource,
    sheetFormulaSession,
    setSheetFormulaSession,
    sheetFormulaPick,
    setSheetFormulaPick,
    cmtRef,
    pinch,
    mobileInputRef,
    mobilePointerCaptureRef,
    touchMoveRafRef,
    touchMovePendingRef,
    mouseMoveRafRef,
    mouseMovePendingRef,
    touchMetaRef,
    cursorEmitRef,
    ctxUploadRef,
    ctxUploadPosRef,
    connectorSnapTimerRef,
    taskSuccessTimerRef,
    connectorDefaultsRef,
  };
}

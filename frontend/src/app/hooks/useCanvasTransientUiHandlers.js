import { useEffect } from "react";

export function useCanvasTransientUiHandlers({
  dispatch,
  selectedConnectorIds,
  hasNodeSelection,
  setCommentInput,
  setCtxMenu,
  setMobileCtxMenu,
  setSelectedArrow,
  setSelectedConnectorIds,
  setLasso,
  setPortConnect,
  setSheetFormulaSession,
  setSheetFormulaPick,
  setRadialMenu,
  mobileInputRef,
  dragRef,
  notify,
}) {
  useEffect(() => {
    const onEscape = (e) => {
      if (e.key !== "Escape") return;
      setCommentInput(null);
      setCtxMenu(null);
      setMobileCtxMenu(null);
      setSelectedArrow(null);
      setSelectedConnectorIds([]);
      setLasso(null);
      setPortConnect(null);
      setSheetFormulaSession(null);
      setSheetFormulaPick(null);
      mobileInputRef.current?.cancelPress();
      dispatch({ type: "EXIT_ADD_MODE" });
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [
    dispatch,
    mobileInputRef,
    setCommentInput,
    setCtxMenu,
    setLasso,
    setMobileCtxMenu,
    setPortConnect,
    setSelectedArrow,
    setSelectedConnectorIds,
    setSheetFormulaPick,
    setSheetFormulaSession,
  ]);

  useEffect(() => {
    const onDeleteConnectors = (e) => {
      const target = e.target;
      const tag = String(target?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      if (!selectedConnectorIds.length || hasNodeSelection) return;
      e.preventDefault();
      selectedConnectorIds.forEach((id) => dispatch({ type: "DEL_ARR", id }));
      setSelectedConnectorIds([]);
      setSelectedArrow(null);
      notify?.(`Deleted ${selectedConnectorIds.length} connector${selectedConnectorIds.length > 1 ? "s" : ""}`, "info", 1200);
    };
    window.addEventListener("keydown", onDeleteConnectors);
    return () => window.removeEventListener("keydown", onDeleteConnectors);
  }, [
    dispatch,
    hasNodeSelection,
    notify,
    selectedConnectorIds,
    setSelectedArrow,
    setSelectedConnectorIds,
  ]);

  useEffect(() => {
    const onCloseTransientUi = () => {
      setCtxMenu(null);
      setMobileCtxMenu(null);
      setRadialMenu(null);
      setCommentInput(null);
      setSelectedArrow(null);
      setSelectedConnectorIds([]);
      setLasso(null);
      setPortConnect(null);
      setSheetFormulaSession(null);
      setSheetFormulaPick(null);
      mobileInputRef.current?.cancelPress();
      dragRef.current.type = "none";
    };
    window.addEventListener("board:close-transient-ui", onCloseTransientUi);
    return () => window.removeEventListener("board:close-transient-ui", onCloseTransientUi);
  }, [
    dragRef,
    mobileInputRef,
    setCommentInput,
    setCtxMenu,
    setLasso,
    setMobileCtxMenu,
    setPortConnect,
    setRadialMenu,
    setSelectedArrow,
    setSelectedConnectorIds,
    setSheetFormulaPick,
    setSheetFormulaSession,
  ]);
}

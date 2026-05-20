import { useCallback } from "react";

export function useSheetFormulaBridge({
  setSheetFormulaSession,
  setSheetFormulaPick,
}) {
  const onSheetFormulaSessionChange = useCallback((payload) => {
    if (!payload || typeof payload !== "object") return;
    const sessionId = String(payload.sessionId || "").trim();
    if (!sessionId) return;
    if (payload.active) {
      setSheetFormulaSession({
        active: true,
        sessionId,
        sourceSheetId: String(payload.sourceSheetId || ""),
        referencedSheetIds: Array.isArray(payload.referencedSheetIds) ? payload.referencedSheetIds.slice(0, 64) : [],
      });
      return;
    }
    setSheetFormulaSession((prev) => (prev && prev.sessionId === sessionId ? null : prev));
  }, [setSheetFormulaSession]);

  const onSheetFormulaReferencePick = useCallback((payload) => {
    if (!payload || typeof payload !== "object") return;
    const sessionId = String(payload.sessionId || "").trim();
    const token = String(payload.token || "").trim();
    if (!sessionId || !token) return;
    setSheetFormulaPick({
      id: String(payload.id || `sheet_ref_pick_${Date.now()}_${Math.floor(Math.random() * 10000)}`),
      sessionId,
      token,
      targetSheetId: String(payload.targetSheetId || ""),
      targetCell: String(payload.targetCell || ""),
    });
  }, [setSheetFormulaPick]);

  const onConsumeSheetFormulaPick = useCallback((pickId) => {
    setSheetFormulaPick((prev) => (prev && prev.id === pickId ? null : prev));
  }, [setSheetFormulaPick]);

  return {
    onSheetFormulaSessionChange,
    onSheetFormulaReferencePick,
    onConsumeSheetFormulaPick,
  };
}

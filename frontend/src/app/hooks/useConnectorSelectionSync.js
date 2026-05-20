import { useEffect } from "react";

export function useConnectorSelectionSync({
  arrows,
  selectedArrow,
  selectedConnectorIds,
  setSelectedConnectorIds,
}) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("boardai:connector-selection", { detail: { id: selectedArrow || "" } }));
  }, [selectedArrow]);

  useEffect(() => {
    if (!selectedArrow) {
      setSelectedConnectorIds((prev) => (prev.length ? [] : prev));
      return;
    }
    setSelectedConnectorIds((prev) => (prev.includes(selectedArrow) ? prev : [...prev, selectedArrow]));
  }, [selectedArrow, setSelectedConnectorIds]);

  useEffect(() => {
    if (!selectedConnectorIds.length) return;
    const connectorIdSet = new Set(arrows.map((arr) => String(arr?.id || "")));
    setSelectedConnectorIds((prev) => {
      const next = prev.filter((id) => connectorIdSet.has(String(id || "")));
      return next.length === prev.length ? prev : next;
    });
  }, [arrows, selectedConnectorIds.length, setSelectedConnectorIds]);
}

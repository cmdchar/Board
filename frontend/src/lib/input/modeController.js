const ADD_TOOLS = new Set([
  "sticky",
  "text",
  "rect",
  "circle",
  "diamond",
  "triangle",
  "hexagon",
  "parallelogram",
  "cloud",
  "cylinder",
  "laneH",
  "laneV",
  "table",
  "sheet",
  "deck",
  "task",
  "milestone",
  "decision",
  "transform",
  "frame",
  "comment",
  "vote",
  "draw",
  "laser",
  "eraser",
]);

export function toolToMode(tool) {
  const next = String(tool || "pan");
  if (next === "pan") return "navigate";
  if (next === "select") return "select";
  if (next === "arrow") return "connect";
  if (ADD_TOOLS.has(next)) return `add:${next}`;
  return "select";
}

export function modeToTool(mode) {
  const raw = String(mode || "navigate");
  if (raw === "navigate") return "pan";
  if (raw === "select") return "select";
  if (raw === "connect") return "arrow";
  if (raw.startsWith("add:")) {
    const next = raw.slice(4);
    return next || "sticky";
  }
  return "select";
}

export function isAddMode(mode) {
  return String(mode || "").startsWith("add:");
}

export function isConnectMode(mode) {
  return String(mode || "") === "connect";
}

export function nextModeAfterAdd(currentMode, stayInAdd = false) {
  if (stayInAdd && isAddMode(currentMode)) return currentMode;
  return "navigate";
}

export function nextModeAfterConnect() {
  return "select";
}

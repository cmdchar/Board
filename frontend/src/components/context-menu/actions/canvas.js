export function canvasMenuGroups(ctx) {
  const { commands, canPaste, canImportFromUrl } = ctx;
  return [
    {
      id: "add-node",
      label: "Add Node",
      items: [
        {
          id: "add-shape",
          label: "Add shape node",
          icon: "N",
          subMenu: [
            {
              id: "shape-menu",
              items: [
                { id: "shape-rect", label: "Rectangle", icon: "R", onSelect: () => commands.addShape("rect") },
                { id: "shape-circle", label: "Circle", icon: "C", onSelect: () => commands.addShape("circle") },
                { id: "shape-diamond", label: "Diamond", icon: "D", onSelect: () => commands.addShape("diamond") },
                { id: "shape-triangle", label: "Triangle", icon: "T", onSelect: () => commands.addShape("triangle") },
              ],
            },
          ],
        },
        { id: "add-task", label: "Add task node", icon: "TK", shortcut: "Z", onSelect: commands.addTask },
        { id: "add-milestone", label: "Add milestone node", icon: "M", shortcut: "X", onSelect: commands.addMilestone },
        { id: "add-decision", label: "Add decision node", icon: "D", shortcut: "U", onSelect: commands.addDecision },
      ],
    },
    {
      id: "add-container",
      label: "Add Container",
      items: [
        { id: "add-frame", label: "Frame", icon: "F", onSelect: () => commands.addContainer("frame") },
        { id: "add-lane-h", label: "Swimlane H", icon: "H", onSelect: () => commands.addContainer("laneH") },
        { id: "add-lane-v", label: "Swimlane V", icon: "V", onSelect: () => commands.addContainer("laneV") },
      ],
    },
    {
      id: "add-content",
      label: "Add Sticky / Text / Spreadsheet",
      items: [
        { id: "add-sticky", label: "Add sticky", icon: "*", shortcut: "S", onSelect: commands.addSticky },
        { id: "add-text", label: "Add text", icon: "T", shortcut: "T", onSelect: commands.addText },
        { id: "add-sheet", label: "Add spreadsheet", icon: "XLS", shortcut: "N", onSelect: () => commands.addContainer("sheet") },
        { id: "add-chart", label: "Add chart", icon: "CH", enabled: typeof commands.addChart === "function", onSelect: commands.addChart },
      ],
    },
    {
      id: "canvas-ai",
      label: "AI",
      items: [
        { id: "ai-generate-board", label: "Generate board", icon: "AI", enabled: typeof commands.generateBoardAi === "function", onSelect: commands.generateBoardAi },
      ],
    },
    {
      id: "paste-import",
      label: "Paste / Import",
      items: [
        { id: "paste", label: "Paste", icon: "P", shortcut: "Ctrl+V", enabled: canPaste, onSelect: commands.paste },
        { id: "import-url", label: "Import from Jira/GitHub link", icon: "IMP", enabled: canImportFromUrl, onSelect: commands.importFromDetectedUrl },
        { id: "add-image", label: "Add image / upload", icon: "IMG", onSelect: commands.addImageUpload },
        { id: "add-link", label: "Add link / embed", icon: "LINK", onSelect: commands.addLinkEmbed },
      ],
    },
    {
      id: "view",
      label: "View",
      items: [
        { id: "zoom-in", label: "Zoom in", icon: "+", shortcut: "Ctrl+Wheel", onSelect: commands.zoomIn },
        { id: "zoom-out", label: "Zoom out", icon: "-", shortcut: "Ctrl+Wheel", onSelect: commands.zoomOut },
        { id: "fit", label: "Fit to screen", icon: "FIT", shortcut: "Ctrl+Shift+H", onSelect: commands.fitView },
        { id: "grid", label: "Toggle grid / guides", icon: "#", enabled: commands.canToggleGrid, onSelect: commands.toggleGrid },
      ],
    },
    {
      id: "board",
      label: "Board",
      items: [
        { id: "undo", label: "Undo", icon: "U", shortcut: "Ctrl+Z", enabled: commands.canUndo, onSelect: commands.undo },
        { id: "redo", label: "Redo", icon: "R", shortcut: "Ctrl+Y", enabled: commands.canRedo, onSelect: commands.redo },
        { id: "board-settings", label: "Board settings", icon: "SET", onSelect: commands.openBoardSettings },
      ],
    },
  ];
}

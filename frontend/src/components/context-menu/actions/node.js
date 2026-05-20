export function nodeMenuGroups(ctx) {
  const { commands } = ctx;
  return [
    {
      id: "node-edit",
      label: "Edit",
      items: [
        { id: "edit-text", label: "Edit", icon: "E", shortcut: "Enter", onSelect: commands.editSelection },
      ],
    },
    {
      id: "node-duplicate",
      label: "Duplicate",
      items: [
        { id: "duplicate-node", label: "Duplicate", icon: "D", shortcut: "Ctrl+D", onSelect: commands.duplicateSelection },
      ],
    },
    {
      id: "node-delete",
      label: "Delete",
      items: [
        { id: "delete-node", label: "Delete", icon: "X", shortcut: "Del", danger: true, onSelect: commands.deleteSelection },
      ],
    },
    {
      id: "node-convert",
      label: "Convert",
      items: [
        { id: "to-task", label: "Convert to task", icon: "TK", onSelect: () => commands.convertSelection("task") },
        { id: "to-note", label: "Convert to note", icon: "N", onSelect: () => commands.convertSelection("note") },
        { id: "to-text", label: "Convert to text", icon: "T", onSelect: () => commands.convertSelection("text") },
      ],
    },
    {
      id: "node-connect",
      label: "Add Connection",
      items: [
        { id: "connect-node", label: "Add connection", icon: "->", onSelect: commands.startConnectFromSelection },
        { id: "add-link-node", label: "Add link", icon: "L", onSelect: commands.addLinkToSelection },
      ],
    },
  ];
}

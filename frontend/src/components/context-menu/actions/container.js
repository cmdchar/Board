export function containerMenuGroups(ctx){
  const { commands, selectionCount } = ctx;
  return[
    {
      id:"container",
      label:"Container",
      items:[
        {id:"rename-container",label:"Rename",icon:"✎",shortcut:"Enter",onSelect:commands.renameSelection},
        {id:"dup-container",label:"Duplicate",icon:"⧉",shortcut:"Ctrl+D",onSelect:commands.duplicateSelection},
        {id:"lock-container",label:commands.isLockedSelection?"Unlock":"Lock",icon:"🔒",shortcut:"Ctrl+L",onSelect:commands.toggleLockSelection},
        {id:"delete-container",label:`Delete${selectionCount>1?` (${selectionCount})`:""}`,icon:"🗑",shortcut:"Del",danger:true,onSelect:commands.deleteSelection},
      ],
    },
    {
      id:"layout",
      label:"Layout",
      items:[
        {id:"auto-layout",label:"Auto layout",icon:"↹",shortcut:"Ctrl+Shift+L",enabled:selectionCount>1,onSelect:commands.autoLayout},
        {id:"align-contents",label:"Align contents",icon:"╋",subMenu:[
          {id:"align-contents-sub",items:[
            {id:"align-left",label:"Align Left",icon:"⊢",onSelect:()=>commands.align("left")},
            {id:"align-center-x",label:"Center Horizontal",icon:"↔",onSelect:()=>commands.align("cx")},
            {id:"align-right",label:"Align Right",icon:"⊣",onSelect:()=>commands.align("right")},
            {id:"align-top",label:"Align Top",icon:"⊤",onSelect:()=>commands.align("top")},
            {id:"align-center-y",label:"Center Vertical",icon:"↕",onSelect:()=>commands.align("cy")},
            {id:"align-bottom",label:"Align Bottom",icon:"⊥",onSelect:()=>commands.align("bottom")},
          ]},
        ]},
        {id:"distribute",label:"Distribute spacing",icon:"☰",enabled:selectionCount>2,subMenu:[
          {id:"distribute-sub",items:[
            {id:"dist-h",label:"Distribute Horizontal",icon:"⇔",onSelect:()=>commands.align("dh")},
            {id:"dist-v",label:"Distribute Vertical",icon:"⇕",onSelect:()=>commands.align("dv")},
          ]},
        ]},
        {id:"resize-fit",label:"Resize to fit contents",icon:"⤢",enabled:false},
        {id:"fit-contents",label:"Fit contents",icon:"⤡",enabled:false},
      ],
    },
    {
      id:"style",
      label:"Style",
      items:[
        {id:"bg-color",label:"Background color",icon:"🎨",subMenu:[
          {id:"bg-colors",items:[
            {id:"bg-default",label:"Default",icon:"◌",onSelect:()=>commands.setFill(null)},
            {id:"bg-yellow",label:"Amber",icon:"●",onSelect:()=>commands.setFill("#fef3c7")},
            {id:"bg-blue",label:"Blue",icon:"●",onSelect:()=>commands.setFill("#dbeafe")},
            {id:"bg-green",label:"Green",icon:"●",onSelect:()=>commands.setFill("#dcfce7")},
            {id:"bg-rose",label:"Rose",icon:"●",onSelect:()=>commands.setFill("#ffe4e6")},
          ]},
        ]},
        {id:"border-toggle",label:"Border on/off",icon:"▣",onSelect:commands.toggleBorder},
        {id:"corner-radius",label:"Corner radius",icon:"◢",enabled:false},
      ],
    },
    {
      id:"links",
      label:"Links & Connections",
      items:[
        {id:"create-link",label:"Create link from this container",icon:"🔗",onSelect:commands.addLinkToSelection},
        {id:"connect-to",label:"Connect to…",icon:"→",onSelect:commands.startConnectFromSelection},
        {id:"manage-connections",label:"Manage connections",icon:"🧭",onSelect:commands.manageConnections},
      ],
    },
    {
      id:"grouping",
      label:"Grouping",
      items:[
        {id:"group",label:"Group selection",icon:"⊞",shortcut:"Ctrl+G",enabled:selectionCount>1,onSelect:commands.groupSelection},
        {id:"ungroup",label:"Ungroup",icon:"⊠",shortcut:"Ctrl+Shift+G",enabled:commands.hasGroupedSelection,onSelect:commands.ungroupSelection},
      ],
    },
  ];
}

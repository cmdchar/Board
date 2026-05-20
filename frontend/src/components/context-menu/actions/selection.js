export function selectionMenuGroups(ctx){
  const { commands, selectionCount } = ctx;
  return[
    {
      id:"selection",
      label:`Selection (${selectionCount})`,
      items:[
        {id:"dup-selection",label:`Duplicate (${selectionCount})`,icon:"⧉",shortcut:"Ctrl+D",onSelect:commands.duplicateSelection},
        {id:"wrap-frame",label:"Wrap in frame",icon:"⤢",onSelect:commands.wrapInFrame},
        {id:"lock-selection",label:commands.isLockedSelection?"Unlock":"Lock",icon:"🔒",shortcut:"Ctrl+L",onSelect:commands.toggleLockSelection},
        {id:"delete-selection",label:`Delete (${selectionCount})`,icon:"🗑",shortcut:"Del",danger:true,onSelect:commands.deleteSelection},
      ],
    },
    {
      id:"arrange",
      label:"Arrange",
      items:[
        {id:"auto-layout",label:"Auto-layout",icon:"↹",shortcut:"Ctrl+Shift+L",onSelect:commands.autoLayout},
        {id:"align",label:"Align",icon:"╋",subMenu:[
          {id:"align-sub",items:[
            {id:"align-left",label:"Align Left",icon:"⊢",onSelect:()=>commands.align("left")},
            {id:"align-center-x",label:"Center Horizontal",icon:"↔",onSelect:()=>commands.align("cx")},
            {id:"align-right",label:"Align Right",icon:"⊣",onSelect:()=>commands.align("right")},
            {id:"align-top",label:"Align Top",icon:"⊤",onSelect:()=>commands.align("top")},
            {id:"align-center-y",label:"Center Vertical",icon:"↕",onSelect:()=>commands.align("cy")},
            {id:"align-bottom",label:"Align Bottom",icon:"⊥",onSelect:()=>commands.align("bottom")},
          ]},
        ]},
        {id:"distribute",label:"Distribute spacing",icon:"☰",enabled:selectionCount>2,subMenu:[
          {id:"dist-sub",items:[
            {id:"dist-h",label:"Horizontal",icon:"⇔",onSelect:()=>commands.align("dh")},
            {id:"dist-v",label:"Vertical",icon:"⇕",onSelect:()=>commands.align("dv")},
          ]},
        ]},
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
    {
      id:"links",
      label:"Links & Connections",
      items:[
        {id:"connect",label:"Connect from first selected",icon:"→",onSelect:commands.startConnectFromSelection},
        {id:"add-link",label:"Add link",icon:"🔗",onSelect:commands.addLinkToSelection},
      ],
    },
  ];
}

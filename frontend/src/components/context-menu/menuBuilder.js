import { canvasMenuGroups } from "./actions/canvas";
import { containerMenuGroups } from "./actions/container";
import { nodeMenuGroups } from "./actions/node";
import { selectionMenuGroups } from "./actions/selection";

function normalizeItem(item){
  if(!item||!item.id||!item.label)return null;
  const next={
    id:String(item.id),
    label:String(item.label),
    icon:item.icon||"",
    shortcut:item.shortcut||"",
    enabled:item.enabled!==false,
    danger:Boolean(item.danger),
    onSelect:typeof item.onSelect==="function"?item.onSelect:null,
  };
  if(Array.isArray(item.subMenu)&&item.subMenu.length){
    next.subMenu=item.subMenu
      .map(group=>normalizeGroup(group))
      .filter(Boolean);
  }
  return next;
}

function normalizeGroup(group){
  if(!group||!group.id||!Array.isArray(group.items))return null;
  const items=group.items.map(normalizeItem).filter(Boolean);
  if(!items.length)return null;
  return{
    id:String(group.id),
    label:group.label?String(group.label):"",
    items,
  };
}

export function buildContextMenu(ctx){
  if(!ctx)return[];
  let groups=[];
  switch(ctx.target){
    case"selection":
      groups=selectionMenuGroups(ctx);
      break;
    case"container":
      groups=containerMenuGroups(ctx);
      break;
    case"node":
      groups=nodeMenuGroups(ctx);
      break;
    case"canvas":
    default:
      groups=canvasMenuGroups(ctx);
      break;
  }
  return(groups||[]).map(normalizeGroup).filter(Boolean);
}

import { useState, useRef, useCallback, useEffect, createContext, useContext, useReducer } from "react";
import { io } from "socket.io-client";
import { useMemo } from "react";
import RightPanel from "./components/RightPanel";
import RightToolPanel from "./components/RightToolPanel";
import ContextMenu from "./components/context-menu/ContextMenu";
import MobileBottomSheet from "./components/MobileBottomSheet";
import MobileRadialMenu from "./components/MobileRadialMenu";
import ExecutionTimelineOverlay from "./components/ExecutionTimelineOverlay";
import TopBarView from "./app/ui/TopBar";
import ToolbarView from "./app/ui/Toolbar";
import MobileBottomBarView from "./app/ui/MobileBottomBar";
import MobileQuickActionsBarView from "./app/ui/MobileQuickActionsBar";
import LeftToolbar from "./app/ui/LeftToolbar";
import LandingPageView from "./app/ui/LandingPage";
import { PresentBarView, EditorOnboardingOverlayView, EmptyBoardPromptView } from "./app/ui/EditorAuxPanels";
import { useCanvasUiState } from "./app/hooks/useCanvasUiState";
import { useConnectorStyleController } from "./app/hooks/useConnectorStyleController";
import { useSheetFormulaBridge } from "./app/hooks/useSheetFormulaBridge";
import { useCanvasTransientUiHandlers } from "./app/hooks/useCanvasTransientUiHandlers";
import { useConnectorSelectionSync } from "./app/hooks/useConnectorSelectionSync";
import { useCanvasImageIo } from "./app/hooks/useCanvasImageIo";
import { useCanvasWheelPanZoom } from "./app/hooks/useCanvasWheelPanZoom";
import { useCanvasLaserTrail } from "./app/hooks/useCanvasLaserTrail";
import { useTouchPointerCapture } from "./app/hooks/useTouchPointerCapture";
import { useCanvasTouchHelpers } from "./app/hooks/useCanvasTouchHelpers";
import { useCanvasMouseMoveRaf } from "./app/hooks/useCanvasMouseMoveRaf";
import { useCanvasTouchMoveRaf } from "./app/hooks/useCanvasTouchMoveRaf";
import { useTouchGestureUndoRedo } from "./app/hooks/useTouchGestureUndoRedo";
import { useTouchRadialMenuEnd } from "./app/hooks/useTouchRadialMenuEnd";
import { useTouchLongPressEnd } from "./app/hooks/useTouchLongPressEnd";
import { useTouchDoubleTapEnd } from "./app/hooks/useTouchDoubleTapEnd";
import { usePortConnectController } from "./app/hooks/usePortConnectController";
import { useConnectorContextMenu } from "./app/hooks/useConnectorContextMenu";
import { useCanvasContextCommands } from "./app/hooks/useCanvasContextCommands";
import { useCanvasPointerController } from "./app/hooks/useCanvasPointerController";
import { useCanvasContextMenuController } from "./app/hooks/useCanvasContextMenuController";
import { useCanvasContextImageUpload } from "./app/hooks/useCanvasContextImageUpload";
import { useCanvasDoubleClickInsert } from "./app/hooks/useCanvasDoubleClickInsert";
import { useCanvasNodeTransformStart } from "./app/hooks/useCanvasNodeTransformStart";
import { useCanvasNodeTouchStart } from "./app/hooks/useCanvasNodeTouchStart";
import { useCanvasTouchStartTarget } from "./app/hooks/useCanvasTouchStartTarget";
import { useCanvasTouchMoveNonPinch } from "./app/hooks/useCanvasTouchMoveNonPinch";
import { useCanvasTouchEndHandler } from "./app/hooks/useCanvasTouchEndHandler";
import { useCanvasTouchStartTwoFinger } from "./app/hooks/useCanvasTouchStartTwoFinger";
import { useCanvasTouchMovePinch } from "./app/hooks/useCanvasTouchMovePinch";
import { useCanvasTouchStartHandler } from "./app/hooks/useCanvasTouchStartHandler";
import { useCanvasTouchMoveHandler } from "./app/hooks/useCanvasTouchMoveHandler";
import { loadStoredConnectorDefaultStyle, loadStoredRememberLastConnectorStyle, saveStoredConnectorDefaultStyle, saveStoredRememberLastConnectorStyle } from "./app/utils/connectorStyleStorage";
import ConnectorRenderer from "./app/canvas/ConnectorRenderer";
import NodeRenderer from "./app/canvas/NodeRenderer";
import SpreadsheetNodeView from "./app/canvas/SpreadsheetNode";
import SelectionOverlay from "./app/canvas/SelectionOverlay";
import GuidesOverlay from "./app/canvas/GuidesOverlay";
import RemoteCursorsView from "./app/canvas/RemoteCursors";
import CanvasHud from "./app/canvas/CanvasHud";
import ConnectorStylePanels from "./app/canvas/ConnectorStylePanels";
import CanvasView from "./app/canvas/Canvas";
import AlignPanelView from "./app/canvas/AlignPanel";
import MinimapView from "./app/canvas/Minimap";
import SearchPanelView from "./app/panels/SearchPanel";
import ShortcutsPanelView from "./app/panels/ShortcutsPanel";
import ThemePickerView from "./app/panels/ThemePicker";
import TplPanelView from "./app/panels/TplPanel";
import DashboardView from "./app/panels/Dashboard";
import TimerWidget from "./app/ui/TimerWidget";
import { createInputController } from "./lib/input/inputController";
import { isAddMode, isConnectMode, modeToTool, nextModeAfterAdd, nextModeAfterConnect, toolToMode } from "./lib/input/modeController";
import { DEFAULT_PORTS, getPortWorldPosition, getAnchorWorldPosition, normalizeConnectorEndpoints } from "./lib/geometry/connectors/anchors";
import { normalizeConnectorDefaultStyle, normalizeConnectorJumpStyle, normalizeConnectorRouting, normalizeConnectorStyle, reverseConnector } from "./lib/geometry/connectors/model";
import { applyJumpsToPath, buildObstacleIndex, buildObstacleRects, clampCanvasPoint, connectorMidpoint, defaultConnectorPath, queryObstacleIndex, routeOrthoAStar, segmentIntersectsRect, segmentsToIntersections } from "./lib/geometry/connectors/routing";
import { appendFormulaReference, buildSheetReferenceToken, createSpreadsheetEngine, sheetCellKey, sheetColLabel } from "./lib/spreadsheet/engine";
import { createTransformNode, isDataConnector, isDataNodeType, normalizeChartType, normalizeTransformType, wouldCreateDataFlowCycle } from "./lib/dataflow/engine";
import { createBoardState } from "./state/boardState";
import { UI_TOKENS, applyUiTheme, getStoredUiTheme } from "./styles/tokens";
import { deriveExecutionSnapshot } from "./hooks/useExecutionIntelligence";
import { useDataFlowEngine } from "./hooks/useDataFlowEngine";

/* ------------------------------------------------------------
   GLOBAL CSS — Obsidian Studio aesthetic
   Fonts: Instrument Serif (display) + JetBrains Mono + DM Sans
------------------------------------------------------------ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;width:100%;overflow:hidden;}
body{
  font-family:'DM Sans',sans-serif;
  background:var(--ui-color-background,var(--ui-bg0,#050911));
  color:var(--ui-color-text,var(--ui-t0,#f0f6ff));
}
:root{
  --ui-space-4:4px;
  --ui-space-8:8px;
  --ui-space-12:12px;
  --ui-space-16:16px;
  --ui-space-24:24px;
  --ui-space-32:32px;
  --ui-radius-6:6px;
  --ui-radius-10:10px;
  --ui-radius-16:16px;
  --ui-motion-fast:120ms;
  --ui-motion-medium:180ms;
  --ui-motion-slow:260ms;
  --ui-motion-normal:180ms;
  --ui-motion-panel:180ms;
  --ui-ease-out:cubic-bezier(0.22,1,0.36,1);
  --ui-ease-spring:cubic-bezier(0.2,0.9,0.25,1.25);
  --ui-ease-standard:cubic-bezier(0.22,1,0.36,1);
}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-thumb{background:var(--ui-b0,#1c2a3a);border-radius:99px;}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes nodePop{0%{opacity:0;transform:translateY(6px) scale(.97)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes popIn{from{opacity:0;transform:scale(.94);}to{opacity:1;transform:scale(1);}}
@keyframes slideIn{from{opacity:0;transform:translateY(10px) scale(.985);}to{opacity:1;transform:translateY(0) scale(1);}}
@keyframes glow{0%,100%{box-shadow:0 0 12px rgba(250,204,21,.25);}50%{box-shadow:0 0 28px rgba(250,204,21,.5);}}
@keyframes timerPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.04);}}
@keyframes dash{to{stroke-dashoffset:-24;}}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}
@keyframes laserTrail{0%{opacity:.9;r:3;}100%{opacity:0;r:14;}}
@keyframes toastIn{from{transform:translateX(120%);opacity:0;}to{transform:translateX(0);opacity:1;}}
@keyframes toastOut{from{opacity:1;}to{opacity:0;transform:translateY(-8px);}}
@keyframes spotPulse{0%,100%{opacity:.12;}50%{opacity:.2;}}
@keyframes emojiPop{from{transform:scale(0);}to{transform:scale(1);}}
@keyframes shineIn{from{opacity:0;backdrop-filter:blur(0);}to{opacity:1;backdrop-filter:blur(12px);}}
@keyframes connectorSnap{0%{opacity:.8;transform:scale(.5)}100%{opacity:0;transform:scale(2.2)}}
@keyframes guideFlash{0%{opacity:0;}35%{opacity:.9;}100%{opacity:.4;}}
@keyframes successPop{0%{opacity:0;transform:translateY(8px) scale(.7);}55%{opacity:1;transform:translateY(0) scale(1.04);}100%{opacity:0;transform:translateY(-10px) scale(.94);}}
@keyframes sparkleBurst{0%{opacity:0;transform:scale(.8);}30%{opacity:1;transform:scale(1);}100%{opacity:0;transform:scale(1.35);}}
.na{animation:nodePop var(--ui-motion-medium) var(--ui-ease-spring) forwards;}
.pop{animation:popIn var(--ui-motion-fast) var(--ui-ease-out) forwards;}
.slide{animation:slideIn var(--ui-motion-medium) var(--ui-ease-out) forwards;}
button,input,select,textarea{
  transition:
    border-color var(--ui-motion-fast) var(--ui-ease-out),
    background-color var(--ui-motion-fast) var(--ui-ease-out),
    color var(--ui-motion-fast) var(--ui-ease-out),
    box-shadow var(--ui-motion-fast) var(--ui-ease-out),
    transform var(--ui-motion-fast) var(--ui-ease-out);
}
button:enabled:hover{transform:translateY(-1px);}
button:enabled:active{transform:translateY(0) scale(.98);}
button:disabled{opacity:.6;cursor:not-allowed;}
button:focus-visible{outline:2px solid var(--ui-y,#facc15);outline-offset:2px;}
[data-node="1"]{
  transition:
    box-shadow var(--ui-motion-fast) var(--ui-ease-out),
    outline-color var(--ui-motion-fast) var(--ui-ease-out),
    filter var(--ui-motion-fast) var(--ui-ease-out),
    scale var(--ui-motion-fast) var(--ui-ease-spring);
  transform-origin:center center;
}
[data-node="1"]:hover{filter:saturate(1.04);}
[data-node="1"][data-selected="1"]{filter:saturate(1.08);}
.node-drag-active [data-node="1"][data-selected="1"]{scale:1.03;filter:saturate(1.12);}
.align-guide{animation:guideFlash var(--ui-motion-medium) var(--ui-ease-out) both;}
.success-badge{animation:successPop var(--ui-motion-slow) var(--ui-ease-spring) forwards;}
.sparkle-fx{animation:sparkleBurst var(--ui-motion-slow) var(--ui-ease-out) forwards;}
.connector-line{transition:stroke var(--ui-motion-fast) var(--ui-ease-out),stroke-width var(--ui-motion-fast) var(--ui-ease-out),opacity var(--ui-motion-fast) var(--ui-ease-out);}
.connector-line-data{filter:drop-shadow(0 0 10px rgba(34,211,238,.22));}
.onboarding-overlay{
  position:absolute;inset:14px;z-index:222;pointer-events:none;
  display:flex;align-items:flex-end;justify-content:flex-start;
}
.onboarding-card{
  pointer-events:auto;
  width:min(560px,calc(100% - 18px));
  background:linear-gradient(155deg,var(--ui-bg1,#0a1020),var(--ui-bg2,#0f1929));
  border:1px solid var(--ui-b1,#223146);
  border-radius:var(--ui-radius-16);
  box-shadow:var(--ui-shadow-lg,0 22px 58px rgba(0,0,0,.34));
  padding:var(--ui-space-16);
}
.onboarding-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ui-space-8);}
.ui-btn{min-height:40px;border-radius:var(--ui-radius-10);border:1px solid var(--ui-b1,#223146);background:var(--ui-bg2,#0f1929);color:var(--ui-t0,#f0f6ff);padding:0 var(--ui-space-12);font-size:12px;cursor:pointer;}
.ui-btn-primary{background:var(--ui-primaryBg,rgba(59,130,246,.14));border-color:var(--ui-primaryDim,#1d4ed8);color:var(--ui-primary,#3b82f6);font-weight:700;}
.ui-btn-accent{background:var(--ui-yBg,rgba(250,204,21,.09));border-color:var(--ui-yDim,#713f12);color:var(--ui-y,#facc15);font-weight:700;}
.ui-muted{font-size:11px;color:var(--ui-t2,#4a6278);}
.ui-title{font-family:'Instrument Serif',serif;letter-spacing:-.03em;color:var(--ui-t0,#f0f6ff);}
.canvas-empty{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  z-index:180;pointer-events:auto;width:min(620px,92vw);
  border-radius:var(--ui-radius-16);border:1px solid var(--ui-b1,#223146);
  background:linear-gradient(140deg,rgba(5,9,17,.92),rgba(10,16,32,.9));
  box-shadow:var(--ui-shadow-md,0 14px 36px rgba(0,0,0,.24));
  padding:var(--ui-space-16);backdrop-filter:blur(12px);
}
.canvas-empty-actions{display:flex;gap:var(--ui-space-8);flex-wrap:wrap;margin-top:var(--ui-space-12);}
.snap-pulse{
  position:absolute;width:20px;height:20px;border-radius:999px;
  border:2px solid var(--ui-y,#facc15);background:rgba(250,204,21,.18);
  animation:connectorSnap var(--ui-motion-medium) var(--ui-ease-out) forwards;
}
input[type=range]{accent-color:var(--ui-y,#facc15);}
input[type=checkbox]{accent-color:var(--ui-y,#facc15);width:13px;height:13px;}
input[type=color]{-webkit-appearance:none;appearance:none;width:24px;height:24px;border:none;border-radius:50%;cursor:pointer;padding:0;background:none;}
input[type=color]::-webkit-color-swatch-wrapper{padding:0;border-radius:50%;}
input[type=color]::-webkit-color-swatch{border:none;border-radius:50%;}
@media (max-width:920px){
  .onboarding-overlay{inset:auto 10px 90px 10px;justify-content:center;}
  .onboarding-grid{grid-template-columns:1fr;}
}
`;

/* ------------------------------------------------------------
   DESIGN TOKENS
------------------------------------------------------------ */
const T = UI_TOKENS;
const MOBILE_SMART_GAP = 180;
const MOBILE_RADIAL_OPTIONS = [
  { id: "addText", label: "Text", icon: "T", position: "top" },
  { id: "addNode", label: "Node", icon: "N", position: "right" },
  { id: "addContainer", label: "Container", icon: "[]", position: "bottom" },
  { id: "addConnector", label: "Connect", icon: "->", position: "left" },
  { id: "addImage", label: "Image", icon: "IMG", position: "topRight" },
  { id: "addSticky", label: "Sticky", icon: "STK", position: "topLeft" },
];
const MOBILE_RADIAL_VECTORS = {
  top: { x: 0, y: -78 },
  right: { x: 78, y: 0 },
  bottom: { x: 0, y: 78 },
  left: { x: -78, y: 0 },
  topRight: { x: 56, y: -56 },
  topLeft: { x: -56, y: -56 },
};

const SC=[
  {bg:"#fef9c3",t:"#713f12"},{bg:"#dcfce7",t:"#14532d"},{bg:"#dbeafe",t:"#1e3a8a"},
  {bg:"#fce7f3",t:"#831843"},{bg:"#ede9fe",t:"#4c1d95"},{bg:"#ccfbf1",t:"#134e4a"},
  {bg:"#ffedd5",t:"#7c2d12"},{bg:"#ecfdf5",t:"#065f46"},
];
/* Canvas theme presets */
const CANVAS_THEMES=[
  {id:"obsidian",name:"Obsidian",bg:"#050911",grid:"#1a2a3c",gridSnap:"#2a3d54",dot:.65,label:"Default dark"},
  {id:"midnight",name:"Midnight",bg:"#0a1628",grid:"#1e3050",gridSnap:"#2e4060",dot:.7,label:"Deep blue"},
  {id:"blueprint",name:"Blueprint",bg:"#0d2137",grid:"#1e4060",gridSnap:"#2e6080",dot:.8,label:"Engineering"},
  {id:"charcoal",name:"Charcoal",bg:"#1a1a2e",grid:"#2a2a4e",gridSnap:"#3a3a5e",dot:.7,label:"Purple tint"},
  {id:"forest",name:"Forest",bg:"#0a1810",grid:"#1a3020",gridSnap:"#2a4030",dot:.65,label:"Dark green"},
  {id:"warm",name:"Warm",bg:"#1a1008",grid:"#2a2018",gridSnap:"#3a3028",dot:.65,label:"Amber tones"},
  {id:"light",name:"Light",bg:"#f8f8f5",grid:"#d8d8d0",gridSnap:"#b8b8b0",dot:.45,label:"Classic white"},
  {id:"paper",name:"Paper",bg:"#faf5e8",grid:"#e0d8c4",gridSnap:"#c8c0a8",dot:.5,label:"Warm paper"},
  {id:"nord",name:"Nord",bg:"#2e3440",grid:"#3b4252",gridSnap:"#4c566a",dot:.6,label:"Arctic dark"},
  {id:"rose",name:"Rosé",bg:"#1a0f14",grid:"#2a1a24",gridSnap:"#3a2a34",dot:.6,label:"Dark pink"},
];

/* Emoji reactions */
const REACTIONS=["+1","OK","WOW","IDEA","UP","LOVE","STAR","FIRE","DONE","THX"];

/* Toast system */
let _toastId=0;
const _toastListeners=new Set();
const toasts={_items:[],push(msg,type="info",ms=2800){const t={id:++_toastId,msg,type,ms};toasts._items=[...toasts._items,t];_toastListeners.forEach(fn=>fn(toasts._items));setTimeout(()=>{toasts._items=toasts._items.filter(x=>x.id!==t.id);_toastListeners.forEach(fn=>fn(toasts._items));},ms);},};
function useToasts(){const[items,setItems]=useState(toasts._items);useEffect(()=>{_toastListeners.add(setItems);return()=>_toastListeners.delete(setItems);},[]);return items;}
function useIsMobile(bp=920){
  const[isMobile,setIsMobile]=useState(()=>typeof window!=="undefined"?window.innerWidth<=bp:false);
  useEffect(()=>{
    const onResize=()=>setIsMobile(window.innerWidth<=bp);
    window.addEventListener("resize",onResize);
    return()=>window.removeEventListener("resize",onResize);
  },[bp]);
  return isMobile;
}

let _si=0;
let _uid=Date.now();
const uid=()=>`e${_uid++}`;
const DEFAULT_CANVAS_BG="#050911";
const HEX3_RE=/^#([0-9a-f]{3})$/i;
const HEX6_RE=/^#([0-9a-f]{6})$/i;
const RGB_RE=/^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})/i;
const clampColor=n=>Math.max(0,Math.min(255,Number(n)||0));
const toHex2=n=>clampColor(n).toString(16).padStart(2,"0");
function normalizeColorInputValue(value,fallback=DEFAULT_CANVAS_BG){
  const raw=String(value||"").trim();
  if(HEX6_RE.test(raw))return raw.toLowerCase();
  const hex3=raw.match(HEX3_RE);
  if(hex3){
    const[r,g,b]=hex3[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const rgb=raw.match(RGB_RE);
  if(rgb)return`#${toHex2(rgb[1])}${toHex2(rgb[2])}${toHex2(rgb[3])}`;
  return fallback;
}
function getThemeColorHex(varName,fallback=DEFAULT_CANVAS_BG){
  if(typeof document==="undefined")return fallback;
  const raw=getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return normalizeColorInputValue(raw,fallback);
}

const EXEC_STATUS_OPTIONS=["Todo","In Progress","Blocked","Done"];
const EXEC_PRIORITY_OPTIONS=["P0","P1","P2","P3"];

function normExecStatus(value){
  const txt=String(value||"").trim().toLowerCase();
  if(/progress|in_progress|doing/.test(txt))return"In Progress";
  if(/block/.test(txt))return"Blocked";
  if(/done|closed|complete/.test(txt))return"Done";
  return"Todo";
}

function normExecPriority(value){
  const txt=String(value||"").trim().toUpperCase();
  if(EXEC_PRIORITY_OPTIONS.includes(txt))return txt;
  if(/critical|urgent/.test(txt))return"P0";
  if(/high/.test(txt))return"P1";
  if(/low/.test(txt))return"P3";
  return"P2";
}

function normExecDueDate(value){
  const txt=String(value||"").trim();
  if(!txt)return"TBD";
  const iso=txt.match(/\d{4}-\d{2}-\d{2}/);
  return iso?iso[0]:"TBD";
}

function parseExecTags(value){
  if(Array.isArray(value))return value.map(v=>String(v||"").trim()).filter(Boolean).slice(0,8);
  const txt=String(value||"").trim();
  if(!txt)return[];
  return txt.split(/[;,|]/).map(v=>v.trim()).filter(Boolean).slice(0,8);
}

const PRESENCE_STATES=["active","idle","presenting"];
function normalizePresenceState(value){
  const raw=String(value||"").trim().toLowerCase();
  return PRESENCE_STATES.includes(raw)?raw:"active";
}

function normalizeDependencyType(value){
  const txt=String(value||"").trim().toLowerCase();
  if(txt==="blocks"||txt.includes("block"))return"blocks";
  if(txt==="related"||txt.includes("related"))return"related";
  if(txt==="depends_on"||txt.includes("depend"))return"depends_on";
  return"depends_on";
}

function inferDependencyType(value){
  const txt=String(value||"").trim().toLowerCase();
  if(!txt)return"";
  if(txt==="blocks"||txt.includes("block"))return"blocks";
  if(txt==="related"||txt.includes("related"))return"related";
  if(txt==="depends_on"||txt.includes("depend"))return"depends_on";
  return"";
}

function dependencyTypeLabel(type){
  if(type==="blocks")return"blocks";
  if(type==="related")return"related";
  return"depends on";
}

function getConnectorDependencyType(connector){
  if(!connector)return"";
  const explicit=inferDependencyType(connector.depType);
  if(explicit)return explicit;
  return inferDependencyType(connector.label);
}

function composeTaskNodeText(task){
  const tags=(Array.isArray(task.tags)&&task.tags.length)?task.tags.join(", "):"none";
  const links=[task.githubUrl?`GH:${task.githubUrl}`:"",task.jiraUrl?`JIRA:${task.jiraUrl}`:""].filter(Boolean).join(" | ");
  return[
    task.title||"Task",
    task.description||"",
    `Status: ${task.status} | Priority: ${task.priority}`,
    `Owner: ${task.owner||"TBD"}`,
    `Due: ${task.dueDate||"TBD"}`,
    `Tags: ${tags}`,
    links,
  ].filter(Boolean).join("\n");
}

function composeMilestoneNodeText(entry){
  return[
    entry.title||"Milestone",
    `Deadline: ${entry.dueDate||"TBD"}`,
    `Progress: ${entry.progressDone||0}/${entry.progressTotal||0}`,
  ].join("\n");
}

function composeDecisionNodeText(entry){
  return[
    entry.decision||"Decision",
    `Date: ${entry.date||"TBD"}`,
    `Owner: ${entry.owner||"TBD"}`,
    entry.context?`Context: ${entry.context}`:"",
    entry.outcome?`Outcome: ${entry.outcome}`:"",
  ].filter(Boolean).join("\n");
}

function isKpiNodeLike(node){
  if(!node||typeof node!=="object")return false;
  if(node.type==="kpi")return true;
  return Boolean(node.kpiBinding&&typeof node.kpiBinding==="object");
}

function formatNumber(value){
  const n=Number(value);
  if(!Number.isFinite(n))return"0";
  const abs=Math.abs(n);
  if(abs>=1e9||(abs>0&&abs<1e-6))return n.toExponential(4);
  return `${Math.round((n+Number.EPSILON)*1000)/1000}`;
}

function chartSeriesPath(points){
  if(!Array.isArray(points)||points.length<2)return"";
  return points.reduce((acc,pt,idx)=>{
    if(idx===0)return`M${pt.x},${pt.y}`;
    return`${acc} L${pt.x},${pt.y}`;
  },"");
}

const EDITOR_ONBOARDING_STORAGE_KEY="boardai_editor_onboarding_v2";
const QUICK_START_PRESETS=[
  {id:"brainstorm",label:"Brainstorm"},
  {id:"roadmap",label:"Product roadmap"},
  {id:"startup",label:"Startup planning"},
  {id:"meeting",label:"Meeting notes"},
];

function buildQuickStartGraph(presetId,theme){
  const preset=String(presetId||"brainstorm").toLowerCase();
  if(preset==="roadmap"){
    const mileY=-180;
    const taskY=40;
    const m1={id:"m1",type:"milestone",x:-360,y:mileY,w:280,h:148,text:"Discover\nDeadline: TBD",color:"#111827",textColor:"#e2e8f0",borderColor:"#6366f1"};
    const m2={id:"m2",type:"milestone",x:-40,y:mileY,w:280,h:148,text:"Build\nDeadline: TBD",color:"#111827",textColor:"#e2e8f0",borderColor:"#6366f1"};
    const m3={id:"m3",type:"milestone",x:280,y:mileY,w:280,h:148,text:"Launch\nDeadline: TBD",color:"#111827",textColor:"#e2e8f0",borderColor:"#6366f1"};
    const t1={id:"t1",type:"task",x:-360, y:taskY,w:250,h:146,text:"Research problem\nStatus: Todo\nOwner: TBD\nDue: TBD",color:"#0f172a",textColor:"#e2e8f0",borderColor:"#334155"};
    const t2={id:"t2",type:"task",x:-80, y:taskY,w:250,h:146,text:"Build MVP\nStatus: Todo\nOwner: TBD\nDue: TBD",color:"#0f172a",textColor:"#e2e8f0",borderColor:"#334155"};
    const t3={id:"t3",type:"task",x:200, y:taskY,w:250,h:146,text:"Beta rollout\nStatus: Todo\nOwner: TBD\nDue: TBD",color:"#0f172a",textColor:"#e2e8f0",borderColor:"#334155"};
    const t4={id:"t4",type:"task",x:480, y:taskY,w:250,h:146,text:"Launch checklist\nStatus: Todo\nOwner: TBD\nDue: TBD",color:"#0f172a",textColor:"#e2e8f0",borderColor:"#334155"};
    return{
      nodes:[m1,m2,m3,t1,t2,t3,t4],
      arrows:[
        {id:"a1",fromId:"m1",toId:"t1",label:"related"},
        {id:"a2",fromId:"m2",toId:"t2",label:"related"},
        {id:"a3",fromId:"m2",toId:"t3",label:"related"},
        {id:"a4",fromId:"m3",toId:"t4",label:"related"},
        {id:"a5",fromId:"t1",toId:"t2",label:"depends on"},
        {id:"a6",fromId:"t2",toId:"t3",label:"depends on"},
        {id:"a7",fromId:"t3",toId:"t4",label:"depends on"},
      ],
    };
  }
  if(preset==="startup"){
    return{
      nodes:[
        {id:"s0",type:"shape",shapeType:"rect",x:-140,y:-220,w:280,h:88,text:"Startup Planning Hub",color:theme.bg3,textColor:theme.t0,borderColor:theme.primaryDim,fontSize:14,fontWeight:"700"},
        {id:"s1",type:"sticky",x:-380,y:-40,w:170,h:130,text:"Problem\nWho has this pain?",color:"#fef9c3",textColor:"#713f12"},
        {id:"s2",type:"sticky",x:-180,y:-40,w:170,h:130,text:"Solution\nWhy now?",color:"#dbeafe",textColor:"#1e3a8a"},
        {id:"s3",type:"sticky",x:20,y:-40,w:170,h:130,text:"Business model\nHow do we make money?",color:"#dcfce7",textColor:"#14532d"},
        {id:"s4",type:"sticky",x:220,y:-40,w:170,h:130,text:"Go-to-market\nChannel + message",color:"#fce7f3",textColor:"#831843"},
        {id:"s5",type:"sticky",x:-280,y:120,w:170,h:130,text:"Risks\nTop unknowns",color:"#ffedd5",textColor:"#7c2d12"},
        {id:"s6",type:"sticky",x:-80,y:120,w:170,h:130,text:"KPIs\nActivation / retention",color:"#ccfbf1",textColor:"#134e4a"},
        {id:"s7",type:"sticky",x:120,y:120,w:170,h:130,text:"Next 30 days\nOwner + deadline",color:"#ede9fe",textColor:"#4c1d95"},
      ],
      arrows:[
        {id:"sA1",fromId:"s0",toId:"s1",label:""},
        {id:"sA2",fromId:"s0",toId:"s2",label:""},
        {id:"sA3",fromId:"s0",toId:"s3",label:""},
        {id:"sA4",fromId:"s0",toId:"s4",label:""},
        {id:"sA5",fromId:"s2",toId:"s7",label:"next"},
      ],
    };
  }
  if(preset==="meeting"){
    return{
      nodes:[
        {id:"m0",type:"shape",shapeType:"rect",x:-200,y:-230,w:360,h:88,text:"Meeting Notes",color:theme.bg3,textColor:theme.t0,borderColor:theme.primaryDim,fontSize:15,fontWeight:"700"},
        {id:"m1",type:"lane",orientation:"v",x:-420,y:-110,w:260,h:430,text:"Agenda",color:"rgba(14,165,233,.06)"},
        {id:"m2",type:"lane",orientation:"v",x:-140,y:-110,w:260,h:430,text:"Decisions",color:"rgba(250,204,21,.06)"},
        {id:"m3",type:"lane",orientation:"v",x:140,y:-110,w:260,h:430,text:"Actions",color:"rgba(34,197,94,.08)"},
        {id:"m4",type:"sticky",x:-390,y:-50,w:200,h:120,text:"Topic 1",color:"#fef9c3",textColor:"#713f12"},
        {id:"m5",type:"decision",x:-100,y:-40,w:220,h:150,text:"Decision",color:"#1f2937",textColor:"#e5e7eb",borderColor:"#f59e0b"},
        {id:"m6",type:"task",x:170,y:-40,w:220,h:150,text:"Action item",color:"#0f172a",textColor:"#e2e8f0",borderColor:"#334155"},
      ],
      arrows:[
        {id:"mA1",fromId:"m4",toId:"m5",label:"decision"},
        {id:"mA2",fromId:"m5",toId:"m6",label:"action"},
      ],
    };
  }
  return{
    nodes:[
      {id:"b0",type:"shape",shapeType:"rect",x:-120,y:-230,w:240,h:88,text:"Brainstorm Topic",color:theme.bg3,textColor:theme.t0,borderColor:theme.primaryDim,fontSize:14,fontWeight:"700"},
      {id:"b1",type:"sticky",x:-340,y:-40,w:170,h:130,text:"Idea 1",color:"#fef9c3",textColor:"#713f12"},
      {id:"b2",type:"sticky",x:-130,y:-40,w:170,h:130,text:"Idea 2",color:"#dbeafe",textColor:"#1e3a8a"},
      {id:"b3",type:"sticky",x:80,y:-40,w:170,h:130,text:"Idea 3",color:"#dcfce7",textColor:"#14532d"},
      {id:"b4",type:"sticky",x:290,y:-40,w:170,h:130,text:"Idea 4",color:"#fce7f3",textColor:"#831843"},
      {id:"b5",type:"sticky",x:-130,y:130,w:170,h:130,text:"Next step",color:"#ffedd5",textColor:"#7c2d12"},
    ],
    arrows:[
      {id:"bA1",fromId:"b0",toId:"b1",label:""},
      {id:"bA2",fromId:"b0",toId:"b2",label:""},
      {id:"bA3",fromId:"b0",toId:"b3",label:""},
      {id:"bA4",fromId:"b0",toId:"b4",label:""},
      {id:"bA5",fromId:"b2",toId:"b5",label:"next"},
    ],
  };
}

function parseJsonObjectLoose(raw){
  if(raw&&typeof raw==="object")return raw;
  const text=String(raw||"").trim();
  if(!text)return null;
  const cleaned=text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
  try{
    return JSON.parse(cleaned);
  }catch{
    const i=cleaned.indexOf("{");
    const j=cleaned.lastIndexOf("}");
    if(i!==-1&&j>i){
      try{return JSON.parse(cleaned.slice(i,j+1));}catch{return null;}
    }
    return null;
  }
}

const {
  GRID,
  snap,
  SHAPE_DEFAULTS,
  SHAPE_TYPES,
  TABLE_DEFAULT_COL_WIDTH,
  TABLE_DEFAULT_ROW_HEIGHT,
  TABLE_DEFAULT_HEAD_HEIGHT,
  TABLE_MIN_COLS,
  TABLE_MAX_COLS,
  TABLE_MIN_ROWS,
  TABLE_MAX_ROWS,
  TABLE_MIN_COL_WIDTH,
  TABLE_MAX_COL_WIDTH,
  TIDY_GAP_X,
  TIDY_GAP_Y,
  MINDMAP_CHILD_GAP_X,
  MINDMAP_CHILD_GAP_Y,
  makeShapeNode,
  makeSheetNode,
  makeDeckNode,
  getTableInfo,
  getTableColumnStart,
  collectDependency,
  reducer,
  INIT,
} = createBoardState({ T, SC, CANVAS_THEMES, uid });

/* ------------------------------------------------------------
   STATE CONTEXT
------------------------------------------------------------ */
const Ctx=createContext(null);
function normalizeBoardId(raw){
  const v=String(raw??"").trim();
  if(!v)return null;
  const low=v.toLowerCase();
  if(low==="undefined"||low==="null"||low==="nan")return null;
  return v;
}
const api={
  _tok:()=>localStorage.getItem("boardai_token")||"",
  _ah(){const t=api._tok();return{"Content-Type":"application/json",...(t?{Authorization:`Bearer ${t}`}:{})};},
  _json:async(r)=>{let p={};try{p=await r.json();}catch{}if(!r.ok)throw new Error(p?.error||`Request failed (${r.status})`);return p;},
  me:()=>fetch("/api/auth/me",{headers:api._ah()}).then(r=>api._json(r)),
  boards:()=>fetch("/api/boards",{headers:api._ah()}).then(r=>r.json()),
  board:(id)=>fetch(`/api/boards/${id}`,{headers:api._ah()}).then(r=>r.json()),
  create:(name)=>fetch("/api/boards",{method:"POST",headers:api._ah(),body:JSON.stringify({name})}).then(r=>r.json()),
  save:(id,data,name,revision)=>fetch(`/api/boards/${id}`,{
    method:"PUT",
    headers:api._ah(),
    body:JSON.stringify({
      data,
      ...(name!==undefined?{name}:{}),
      ...(Number.isFinite(Number(revision))?{revision:Number(revision)}:{}),
    }),
  }).then(r=>api._json(r)),
  rename:(id,name)=>fetch(`/api/boards/${id}`,{method:"PUT",headers:api._ah(),body:JSON.stringify({name})}),
  del:(id)=>fetch(`/api/boards/${id}`,{method:"DELETE",headers:api._ah()}),
  historyList:(id)=>fetch(`/api/boards/${id}/history`,{headers:api._ah()}).then(r=>api._json(r)),
  historyGet:(id,versionId)=>fetch(`/api/boards/${id}/history/${versionId}`,{headers:api._ah()}).then(r=>api._json(r)),
  historyRestore:(id,versionId)=>fetch(`/api/boards/${id}/history/${versionId}/restore`,{method:"POST",headers:api._ah()}).then(r=>api._json(r)),
  auditList:(id,opts={})=>{
    const q=new URLSearchParams();
    if(opts.limit)q.set("limit",String(opts.limit));
    if(opts.action)q.set("action",String(opts.action));
    if(opts.actorId)q.set("actorId",String(opts.actorId));
    if(opts.minTs)q.set("min_ts",String(opts.minTs));
    const qs=q.toString();
    return fetch(`/api/boards/${id}/audit${qs?`?${qs}`:""}`,{headers:api._ah()}).then(r=>api._json(r));
  },
  members:(id)=>fetch(`/api/boards/${id}/members`,{headers:api._ah()}).then(r=>api._json(r)),
  setMember:(id,email,role)=>fetch(`/api/boards/${id}/members`,{method:"PUT",headers:api._ah(),body:JSON.stringify({email,role})}).then(r=>api._json(r)),
  removeMember:(id,userId)=>fetch(`/api/boards/${id}/members/${userId}`,{method:"DELETE",headers:api._ah()}).then(r=>api._json(r)),
  githubImport:(id,payload)=>{
    const body=payload||{};
    const headers=api._ah();
    const idempotencyKey=String(body?.idempotencyKey||"").trim();
    if(idempotencyKey)headers["Idempotency-Key"]=idempotencyKey;
    return fetch(`/api/boards/${id}/integrations/github/import`,{method:"POST",headers,body:JSON.stringify(body)}).then(r=>api._json(r));
  },
  githubPush:(id,payload)=>{
    const body=payload||{};
    const headers=api._ah();
    const idempotencyKey=String(body?.idempotencyKey||"").trim();
    if(idempotencyKey)headers["Idempotency-Key"]=idempotencyKey;
    return fetch(`/api/boards/${id}/integrations/github/push`,{method:"POST",headers,body:JSON.stringify(body)}).then(r=>api._json(r));
  },
  jiraImport:(id,payload)=>fetch(`/api/boards/${id}/integrations/jira/import`,{method:"POST",headers:api._ah(),body:JSON.stringify(payload||{})}).then(r=>api._json(r)),
  semantic:(id,opts={})=>{
    const q=new URLSearchParams();
    if(opts.entityLimit)q.set("entityLimit",String(opts.entityLimit));
    if(opts.relationLimit)q.set("relationLimit",String(opts.relationLimit));
    if(opts.issueLimit)q.set("issueLimit",String(opts.issueLimit));
    if(opts.entityOffset)q.set("entityOffset",String(opts.entityOffset));
    if(opts.relationOffset)q.set("relationOffset",String(opts.relationOffset));
    const qs=q.toString();
    return fetch(`/api/boards/${id}/semantic${qs?`?${qs}`:""}`,{headers:api._ah()}).then(r=>api._json(r));
  },
  semanticRebuild:(id)=>fetch(`/api/boards/${id}/semantic/rebuild`,{method:"POST",headers:api._ah()}).then(r=>api._json(r)),
  templateCategories:()=>fetch("/api/templates/categories",{headers:api._ah()}).then(r=>api._json(r)),
  templatesList:(opts={})=>{
    const q=new URLSearchParams();
    if(opts.page)q.set("page",String(opts.page));
    if(opts.pageSize)q.set("pageSize",String(opts.pageSize));
    if(opts.q)q.set("q",String(opts.q));
    if(opts.category)q.set("category",String(opts.category));
    if(opts.scope)q.set("scope",String(opts.scope));
    if(opts.sort)q.set("sort",String(opts.sort));
    const qs=q.toString();
    return fetch(`/api/templates${qs?`?${qs}`:""}`,{headers:api._ah()}).then(r=>api._json(r));
  },
  templateDetail:(id)=>fetch(`/api/templates/${id}`,{headers:api._ah()}).then(r=>api._json(r)),
  templatePreview:(id,opts={})=>{
    const q=new URLSearchParams();
    if(opts.version!==undefined&&opts.version!==null&&opts.version!=="")q.set("version",String(opts.version));
    const qs=q.toString();
    return fetch(`/api/templates/${id}/preview${qs?`?${qs}`:""}`,{headers:api._ah()}).then(r=>api._json(r));
  },
  templateCreate:(payload)=>fetch("/api/templates",{method:"POST",headers:api._ah(),body:JSON.stringify(payload||{})}).then(r=>api._json(r)),
  templatePublish:(id,visibility)=>fetch(`/api/templates/${id}/publish`,{method:"PUT",headers:api._ah(),body:JSON.stringify({visibility})}).then(r=>api._json(r)),
  templateAddVersion:(id,payload)=>fetch(`/api/templates/${id}/version`,{method:"POST",headers:api._ah(),body:JSON.stringify(payload||{})}).then(r=>api._json(r)),
  templateBookmark:(id,bookmarked)=>fetch(`/api/templates/${id}/bookmark`,{method:"POST",headers:api._ah(),body:JSON.stringify({bookmarked})}).then(r=>api._json(r)),
  templateRate:(id,value)=>fetch(`/api/templates/${id}/rate`,{method:"POST",headers:api._ah(),body:JSON.stringify({value})}).then(r=>api._json(r)),
  templateUse:(id,payload)=>fetch(`/api/templates/${id}/use`,{method:"POST",headers:api._ah(),body:JSON.stringify(payload||{})}).then(r=>api._json(r)),
  githubOAuthStatus:()=>fetch("/api/integrations/github/oauth/status",{headers:api._ah()}).then(r=>api._json(r)),
  githubOAuthStart:(opts={})=>{
    const q=new URLSearchParams();
    if(opts.returnTo)q.set("returnTo",String(opts.returnTo));
    if(opts.boardId)q.set("boardId",String(opts.boardId));
    const qs=q.toString();
    return fetch(`/api/integrations/github/oauth/start${qs?`?${qs}`:""}`,{headers:api._ah()}).then(r=>api._json(r));
  },
  githubOAuthDisconnect:()=>fetch("/api/integrations/github/oauth/status",{method:"DELETE",headers:api._ah()}).then(r=>api._json(r)),
  login:(email,password)=>fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})}).then(r=>r.json()),
  register:(email,name,password)=>fetch("/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,name,password})}).then(r=>r.json()),
};

/* ------------------------------------------------------------
   USER IDENTITY (persisted in localStorage)
------------------------------------------------------------ */
const UCOLS=["#ef4444","#3b82f6","#22c55e","#f59e0b","#8b5cf6","#06b6d4","#f97316","#ec4899","#a78bfa","#2dd4bf"];
function getMe(){
  let u=null;try{u=JSON.parse(localStorage.getItem("boardai_me"));}catch{}
  if(!u||!u.name){u={name:`User${Math.floor(Math.random()*900+100)}`,color:UCOLS[Math.floor(Math.random()*UCOLS.length)]};localStorage.setItem("boardai_me",JSON.stringify(u));}
  return u;
}
const ME=getMe();

/* ------------------------------------------------------------
   SOCKET (singleton, connects when board is joined)
------------------------------------------------------------ */
const socket=io({autoConnect:false,reconnection:true,reconnectionDelay:1000});

function WBP({children,boardId,boardName}){
  const[s,baseDispatch]=useReducer(reducer,INIT);
  const[ready,setReady]=useState(false);
  const isRemote=useRef(false);
  const boardRevisionRef=useRef(1);
  const syncEmitTimerRef=useRef(null);
  const ACTIVITY_TYPES={
    ADD:"node.created",
    UPD:"node.updated",
    UPD_MULTI:"node.updated",
    ADD_ARR:"connector.created",
    UPD_ARR:"connector.updated",
    ADD_COMMENT:"comment.created",
    UPDATE_COMMENT:"comment.updated",
    DEL_COMMENT:"comment.deleted",
    ADD_VOTE:"vote.added",
    DEP_MODE:"execution.dep_mode",
  };

  const emitActivity=useCallback((event)=>{
    if(!boardId||!socket.connected||!event?.type)return;
    socket.emit("board:activity",{
      boardId,
      event:{
        type:String(event.type||"activity"),
        entity:String(event.entity||"board"),
        message:String(event.message||event.type||""),
        payload:event.payload&&typeof event.payload==="object"?event.payload:{},
        ts:Date.now(),
      },
    });
  },[boardId]);

  const d=useCallback((action)=>{
    baseDispatch(action);
    const evtType=ACTIVITY_TYPES[action?.type];
    if(!evtType)return;
    emitActivity({
      type:evtType,
      entity:String(action?.type||"board"),
      message:evtType.replaceAll("."," "),
      payload:{
        id:action?.id||null,
        ids:Array.isArray(action?.ids)?action.ids.slice(0,8):undefined,
      },
    });
  },[emitActivity]);

  // LOAD board from API (or localStorage fallback)
  useEffect(()=>{
    if(!boardId){
      // No board selected — try localStorage fallback
      try{const sv=localStorage.getItem("boardai_v7");if(sv){const p=JSON.parse(sv);if(p.nodes?.length)d({type:"APPLY",nodes:p.nodes,arrows:p.arrows||[],replace:true});}}catch{}
      setReady(true);return;
    }
    setReady(false);
    api.board(boardId).then(b=>{
      boardRevisionRef.current=Math.max(1,Number(b?.revision)||1);
      if(b.data?.nodes?.length){
        isRemote.current=true;
        d({type:"LOAD",state:{...INIT,...b.data}});
      }
      setReady(true);
    }).catch(()=>setReady(true));

    // Join Socket.IO room
    const tok=localStorage.getItem("boardai_token")||"";
    socket.auth=tok?{token:tok}:{};
    if(!socket.connected)socket.connect();
    socket.emit("board:join",{boardId,name:ME.name,color:ME.color,token:tok});

    // Receive real-time updates from other clients
    const onUpdate=payload=>{
      const state=payload?.state&&typeof payload.state==="object"?payload.state:payload;
      const revision=Number(payload?.revision);
      if(Number.isFinite(revision)&&revision>=1)boardRevisionRef.current=Math.floor(revision);
      isRemote.current=true;
      d({type:"LOAD",state:{...INIT,...state}});
    };
    const onJoinErr=ev=>{toasts.push(ev?.error||"Cannot join board","error");};
    const onSyncErr=ev=>{toasts.push(ev?.error||"Sync denied","error");};
    socket.on("board:update",onUpdate);
    socket.on("board:join:error",onJoinErr);
    socket.on("board:sync:error",onSyncErr);
    return()=>{
      socket.off("board:update",onUpdate);
      socket.off("board:join:error",onJoinErr);
      socket.off("board:sync:error",onSyncErr);
      socket.emit("board:leave",boardId);
    };
  },[boardId,d]);

  // AUTOSAVE to API + sync via socket
  useEffect(()=>{
    if(!ready)return;
    const data={nodes:s.nodes,arrows:s.arrows,comments:s.comments,votes:s.votes};
    // Always keep localStorage backup
    try{localStorage.setItem("boardai_v7",JSON.stringify(data));}catch{}
    if(!boardId)return;
    const remote=isRemote.current;
    isRemote.current=false;
    // Broadcast to other clients only for local changes
    if(!remote){
      if(syncEmitTimerRef.current)clearTimeout(syncEmitTimerRef.current);
      syncEmitTimerRef.current=setTimeout(()=>{
        socket.emit("board:sync",{boardId,state:data});
      },120);
    }
    // Debounced API save (skip remote-applied state to avoid echo/resave loops)
    const t=remote?null:setTimeout(()=>{
      (async()=>{
        try{
          const out=await api.save(boardId,data,undefined,boardRevisionRef.current);
          const nextRevision=Number(out?.revision);
          if(Number.isFinite(nextRevision)&&nextRevision>=1){
            boardRevisionRef.current=Math.floor(nextRevision);
          }
        }catch(err){
          const msg=String(err?.message||"");
          if(/Board revision conflict/i.test(msg)){
            try{
              const latest=await api.board(boardId);
              boardRevisionRef.current=Math.max(1,Number(latest?.revision)||1);
              isRemote.current=true;
              d({type:"LOAD",state:{...INIT,...(latest?.data||{})}});
              toasts.push("Board changed in another session. Loaded latest revision.","warn");
            }catch{
              toasts.push("Board revision conflict. Reload board.","error");
            }
            return;
          }
          toasts.push(msg||"Save failed","error");
        }
      })();
    },1200);
    return()=>{
      if(t)clearTimeout(t);
      if(syncEmitTimerRef.current){
        clearTimeout(syncEmitTimerRef.current);
        syncEmitTimerRef.current=null;
      }
    };
  },[s.nodes,s.arrows,s.comments,s.votes,ready,boardId]);

  return<Ctx.Provider value={{s,d,boardId,emitActivity}}>{children}</Ctx.Provider>;
}
const useWB=()=>useContext(Ctx);

/* ------------------------------------------------------------
   EDITABLE TEXT
------------------------------------------------------------ */
function ET({value,onChange,style}){
  const[ed,setEd]=useState(false);
  const[draft,setDraft]=useState(String(value??""));
  const cancelRef=useRef(false);
  const r=useRef(null);
  useEffect(()=>{if(ed&&r.current){r.current.focus();r.current.select?.();}},[ed]);
  useEffect(()=>{if(!ed)setDraft(String(value??""));},[ed,value]);
  const commit=()=>{
    if(cancelRef.current){
      cancelRef.current=false;
      return;
    }
    onChange(draft);
  };
  if(ed)return<textarea ref={r} value={draft}
    onChange={e=>setDraft(e.target.value)}
    onBlur={()=>{commit();setEd(false);}}
    onKeyDown={e=>{
      if(e.key==="Escape"){
        e.preventDefault();
        cancelRef.current=true;
        setDraft(String(value??""));
        setEd(false);
        return;
      }
      if(e.key==="Enter"&&!e.shiftKey){
        e.preventDefault();
        commit();
        setEd(false);
      }
    }}
    style={{...style,background:"transparent",border:"none",outline:"none",resize:"none",width:"100%",height:"100%",fontFamily:"inherit",padding:0,caretColor:T.y}}/>;
  return<div onDoubleClick={()=>{setDraft(String(value??""));setEd(true);}} style={{...style,width:"100%",height:"100%",wordBreak:"break-word",whiteSpace:"pre-wrap",minHeight:14}}>
    {value||<span style={{opacity:.2,fontSize:".85em",fontStyle:"italic"}}>dbl-click…</span>}
  </div>;
}

/* ------------------------------------------------------------
   RESIZE HANDLES
------------------------------------------------------------ */
const RDS=[{d:"se",s:{bottom:-5,right:-5,cursor:"se-resize"}},{d:"sw",s:{bottom:-5,left:-5,cursor:"sw-resize"}},{d:"ne",s:{top:-5,right:-5,cursor:"ne-resize"}},{d:"nw",s:{top:-5,left:-5,cursor:"nw-resize"}},{d:"e",s:{top:"50%",right:-5,transform:"translateY(-50%)",cursor:"e-resize"}},{d:"w",s:{top:"50%",left:-5,transform:"translateY(-50%)",cursor:"w-resize"}},{d:"s",s:{bottom:-5,left:"50%",transform:"translateX(-50%)",cursor:"s-resize"}},{d:"n",s:{top:-5,left:"50%",transform:"translateX(-50%)",cursor:"n-resize"}}];
function RH({nodeId,onStart}){
  return RDS.map(({d,s})=><div key={d}
    onMouseDown={e=>{e.stopPropagation();onStart(e,nodeId,d);}}
    onTouchStart={e=>{const t=e.touches?.[0];if(!t)return;e.stopPropagation();e.preventDefault();onStart({clientX:t.clientX,clientY:t.clientY,stopPropagation:()=>{}},nodeId,d);}}
    style={{...s,position:"absolute",width:9,height:9,background:T.bg2,border:`1.5px solid ${T.y}`,borderRadius:2,zIndex:30}}/>);
}

/* rotation handle */
function RotH({nodeId,onStart}){
  return<>
    <div style={{position:"absolute",top:-26,left:"50%",width:1,height:22,background:"rgba(250,204,21,.3)",transform:"translateX(-50%)",pointerEvents:"none",zIndex:29}}/>
    <div onMouseDown={e=>{e.stopPropagation();onStart(e,nodeId);}}
      onTouchStart={e=>{const t=e.touches?.[0];if(!t)return;e.stopPropagation();e.preventDefault();onStart({clientX:t.clientX,clientY:t.clientY,stopPropagation:()=>{}},nodeId);}}
      style={{position:"absolute",top:-40,left:"50%",transform:"translateX(-50%)",width:16,height:16,borderRadius:"50%",background:T.bg2,border:`1.5px solid ${T.y}`,cursor:"crosshair",zIndex:35,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:T.y,userSelect:"none"}}>R</div>
  </>;
}

/* ------------------------------------------------------------
   VOTE BADGE
------------------------------------------------------------ */
function VoteBadge({count,onClick}){
  return<div onClick={e=>{e.stopPropagation();onClick();}} style={{position:"absolute",top:-10,right:-10,background:T.y,color:"#0c1829",borderRadius:99,minWidth:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,cursor:"pointer",padding:"0 6px",zIndex:20,fontFamily:"'JetBrains Mono',monospace",boxShadow:`0 2px 8px rgba(250,204,21,.4)`}}>
    {count?`${count} V`:"+V"}
  </div>;
}

/* ------------------------------------------------------------
   NODE COMPONENTS
------------------------------------------------------------ */
const TAG_COLORS=["#ef4444","#f97316","#f59e0b","#22c55e","#3b82f6","#8b5cf6","#ec4899","#06b6d4"];
function Sticky({node,sel,onSel,onTouchSel,onUpd,onRSt,onRotSt,votes,onVote,voteMode,depFade=1}){
  const glow=sel?`0 0 0 2px ${T.y},0 8px 28px rgba(250,204,21,.18)`:"0 4px 20px rgba(0,0,0,.4)";
  const hasTag=!!node.tag;
  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{
    e.stopPropagation();
    if(e.ctrlKey&&node.url){window.open(node.url,"_blank","noopener");return;}
    onSel(node.id,e.shiftKey,e.altKey);
  }} onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,zIndex:node.zIndex||0,background:node.color,opacity:(node.opacity??1)*depFade,borderRadius:6,padding:hasTag?"10px 14px 18px 14px":"12px 14px 12px 14px",boxShadow:node.locked?`0 0 0 2px #475569`+",0 4px 20px rgba(0,0,0,.4)":glow,cursor:node.locked?"default":"move",userSelect:"none",transition:"box-shadow .15s",outline:node.groupId&&sel?`2px dashed ${T.purple}`:"none",transform:node.rotation?`rotate(${node.rotation}deg)`:undefined}}>
    <ET value={node.text} onChange={t=>!node.locked&&onUpd(node.id,{text:t})} style={{fontSize:node.fontSize||13,color:node.textColor||"#1e293b",fontWeight:node.fontWeight||"normal",fontStyle:node.fontStyle||"normal",lineHeight:1.5,textAlign:node.textAlign||"left"}}/>
    {/* Tag band */}
    {hasTag&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:7,background:node.tag,borderRadius:"0 0 6px 6px"}}/>}
    {/* URL indicator */}
    {node.url&&<div title={`Ctrl+click -> ${node.url}`} style={{position:"absolute",top:4,left:5,fontSize:9,opacity:.5,cursor:"pointer"}}>LNK</div>}
    {node.locked&&<div style={{position:"absolute",top:4,right:6,fontSize:10,opacity:.5}}>LOCK</div>}
    {sel&&!node.locked&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
    {voteMode&&<VoteBadge count={votes||0} onClick={()=>onVote(node.id)}/>}
    {/* Emoji reactions display */}
    {node.reactions&&Object.keys(node.reactions).length>0&&<div style={{position:"absolute",bottom:-22,left:4,display:"flex",gap:2,zIndex:35,pointerEvents:"auto"}} onMouseDown={e=>e.stopPropagation()}>
      {Object.entries(node.reactions).map(([emoji,count])=><div key={emoji} onClick={e=>{e.stopPropagation();onUpd(node.id,{reactions:{...node.reactions,[emoji]:(node.reactions[emoji]||0)+1}});}} style={{background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:99,padding:"1px 5px",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:2,animation:"emojiPop .2s ease"}}><span>{emoji}</span><span style={{fontSize:8,color:T.t1,fontFamily:"'JetBrains Mono',monospace"}}>{count}</span></div>)}
    </div>}
    {sel&&!node.locked&&<div style={{position:"absolute",bottom:node.reactions&&Object.keys(node.reactions).length>0?-78:-54,left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",gap:3,background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:10,padding:"4px 5px",zIndex:40,pointerEvents:"auto"}} onMouseDown={e=>e.stopPropagation()}>
      <div style={{display:"flex",gap:3}}>
        {SC.map(c=><div key={c.bg} onClick={e=>{e.stopPropagation();onUpd(node.id,{color:c.bg,textColor:c.t});}} style={{width:13,height:13,borderRadius:"50%",background:c.bg,border:`1.5px solid ${c.bg===node.color?T.y:"transparent"}`,cursor:"pointer",flexShrink:0}}/>)}
      </div>
      <div style={{display:"flex",gap:2,alignItems:"center"}}>
        <span style={{fontSize:8,color:T.t2,fontFamily:"'JetBrains Mono',monospace",marginRight:1}}>tag:</span>
        {TAG_COLORS.map(c=><div key={c} onClick={e=>{e.stopPropagation();onUpd(node.id,{tag:node.tag===c?null:c});}} style={{width:10,height:10,borderRadius:"50%",background:c,border:`1.5px solid ${node.tag===c?T.y:"transparent"}`,cursor:"pointer",flexShrink:0}}/>)}
        {node.tag&&<div onClick={e=>{e.stopPropagation();onUpd(node.id,{tag:null});}} style={{fontSize:8,color:T.t2,cursor:"pointer",marginLeft:2}}>x</div>}
      </div>
      <div style={{display:"flex",gap:2,alignItems:"center"}}>
        <span style={{fontSize:8,color:T.t2,fontFamily:"'JetBrains Mono',monospace",marginRight:1}}>sz:</span>
        {[["S",{w:120,h:90}],["M",{w:170,h:130}],["L",{w:240,h:180}],["XL",{w:320,h:240}]].map(([label,sz])=><div key={label} onClick={e=>{e.stopPropagation();onUpd(node.id,sz);}} style={{fontSize:8,color:node.w===sz.w?T.y:T.t2,background:node.w===sz.w?T.yBg:T.bg3,border:`1px solid ${node.w===sz.w?T.yDim:T.b0}`,borderRadius:3,padding:"1px 4px",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{label}</div>)}
      </div>
      <div style={{display:"flex",gap:2,flexWrap:"wrap"}}>
        {REACTIONS.slice(0,8).map(emoji=><div key={emoji} onClick={e=>{e.stopPropagation();const rx={...(node.reactions||{})};rx[emoji]=(rx[emoji]||0)+1;onUpd(node.id,{reactions:rx});}} style={{fontSize:10,cursor:"pointer",padding:"0 1px",borderRadius:3,transition:"transform .1s"}} onMouseEnter={e=>e.target.style.transform="scale(1.4)"} onMouseLeave={e=>e.target.style.transform="scale(1)"}>{emoji}</div>)}
      </div>
    </div>}
  </div>;
}

function Shape({node,sel,onSel,onTouchSel,onUpd,onRSt,onRotSt,votes,onVote,voteMode,depFade=1}){
  const st=node.shapeType||"rect";
  const isDia=st==="diamond";
  const isCloud=st==="cloud";
  const isCylinder=st==="cylinder";
  const br=st==="circle"?"50%":isCloud?"42% 38% 45% 40% / 45% 44% 40% 41%":isDia?0:8;
  const clipMap={
    triangle:"polygon(50% 0%, 100% 100%, 0% 100%)",
    hexagon:"polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
    parallelogram:"polygon(16% 0%, 100% 0%, 84% 100%, 0% 100%)",
  };
  const clipPath=clipMap[st];
  const stroke=node.borderColor||"rgba(255,255,255,.08)";
  const strokeW=node.borderWidth||1.5;
  const glow=[sel?`0 0 0 2px ${T.y},0 8px 24px rgba(250,204,21,.15)`:"",node.locked?"0 0 0 2px #475569":"",node.glowColor?`0 0 20px ${node.glowColor}55`:""].filter(Boolean).join(",")||"0 4px 20px rgba(0,0,0,.45)";
  const rotDeg=node.rotation||0;
  const outerTransform=isDia?`rotate(${45+rotDeg}deg)`:rotDeg?`rotate(${rotDeg}deg)`:undefined;
  const innerTransform=isDia?`rotate(${-45-rotDeg}deg)`:undefined;
  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{e.stopPropagation();if(e.ctrlKey&&node.url){window.open(node.url,"_blank","noopener");return;}onSel(node.id,e.shiftKey,e.altKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,zIndex:node.zIndex||0,background:isCloud||isCylinder?"transparent":node.color,opacity:(node.opacity??1)*depFade,borderRadius:br,border:isCloud||isCylinder?"none":`${strokeW}px solid ${stroke}`,clipPath,transform:outerTransform,boxShadow:glow,cursor:node.locked?"default":"move",userSelect:"none",display:"flex",alignItems:"center",justifyContent:"center",transition:"box-shadow .15s",outline:node.groupId&&sel?`2px dashed ${T.purple}`:"none",overflow:"hidden"}}>
    {isCloud&&<svg viewBox="0 0 100 60" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0}}>
      <path d="M18 50 C8 50 4 40 10 34 C5 24 12 14 24 16 C28 8 38 4 48 10 C56 4 68 6 73 16 C84 14 94 22 91 33 C97 41 91 50 80 50 Z" fill={node.color||T.bg3} stroke={stroke} strokeWidth={Math.max(.9,strokeW*.6)}/>
    </svg>}
    {isCylinder&&<svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0}}>
      <ellipse cx="50" cy="14" rx="45" ry="10" fill={node.color||T.bg3} stroke={stroke} strokeWidth={Math.max(.9,strokeW*.6)}/>
      <path d="M5 14 L5 84 C5 90 95 90 95 84 L95 14" fill={node.color||T.bg3} stroke={stroke} strokeWidth={Math.max(.9,strokeW*.6)}/>
      <ellipse cx="50" cy="84" rx="45" ry="10" fill={node.color||T.bg3} stroke={stroke} strokeWidth={Math.max(.9,strokeW*.6)}/>
      <ellipse cx="50" cy="14" rx="45" ry="10" fill="none" stroke={stroke} strokeWidth={Math.max(1,strokeW*.8)}/>
    </svg>}
    <div style={{position:"relative",zIndex:2,transform:innerTransform,width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:st==="triangle"?"18px 14px 10px":10}}>
      <ET value={node.text} onChange={t=>!node.locked&&onUpd(node.id,{text:t})} style={{fontSize:node.fontSize||13,color:node.textColor||"#fff",fontWeight:node.fontWeight||"600",fontStyle:node.fontStyle||"normal",textAlign:node.textAlign||"center",lineHeight:1.3}}/>
    </div>
    {node.url&&<div title={`Ctrl+click -> ${node.url}`} style={{position:"absolute",top:3,left:4,fontSize:9,opacity:.45,pointerEvents:"none"}}>LNK</div>}
    {node.locked&&<div style={{position:"absolute",top:4,right:6,fontSize:10,opacity:.5}}>LOCK</div>}
    {sel&&!node.locked&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
    {voteMode&&<VoteBadge count={votes||0} onClick={()=>onVote(node.id)}/>}
  </div>;
}

function TxtNode({node,sel,onSel,onTouchSel,onUpd,onRSt,onRotSt,depFade=1}){
  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey,e.altKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,minHeight:node.h,zIndex:node.zIndex||0,opacity:(node.opacity??1)*depFade,cursor:node.locked?"default":"move",userSelect:"none",outline:sel?`2px solid ${node.locked?"#475569":T.y}`:"none",outlineOffset:4,borderRadius:4,transform:node.rotation?`rotate(${node.rotation}deg)`:undefined}}>
    <ET value={node.text} onChange={t=>!node.locked&&onUpd(node.id,{text:t})} style={{fontSize:node.fontSize||22,color:node.textColor||node.color||T.t0,fontWeight:node.fontWeight||"700",fontStyle:node.fontStyle||"normal",textAlign:node.textAlign||"left",lineHeight:1.2,letterSpacing:"-.02em"}}/>
    {node.locked&&<div style={{position:"absolute",top:0,right:0,fontSize:10,opacity:.4}}>LOCK</div>}
    {sel&&!node.locked&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
  </div>;
}

function FrameNode({node,sel,onSel,onTouchSel,onUpd,onRSt,depFade=1}){
  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,background:"rgba(255,255,255,.015)",border:`2px solid ${sel?T.y:T.b1}`,borderRadius:10,cursor:"move",pointerEvents:"none",opacity:depFade}}>
    <div style={{position:"absolute",top:-26,left:0,background:sel?T.y:T.b1,color:sel?"#0c1829":T.t1,padding:"3px 12px",borderRadius:"6px 6px 0 0",fontSize:11,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",pointerEvents:"auto",cursor:"move",whiteSpace:"nowrap"}}
      onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey);}}
      onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false);}}>
      <ET value={node.text||"Frame"} onChange={t=>onUpd(node.id,{text:t})} style={{display:"inline",fontSize:11,color:"inherit",fontWeight:600}}/>
    </div>
    {sel&&<RH nodeId={node.id} onStart={onRSt}/>}
  </div>;
}

function ImgNode({node,sel,onSel,onTouchSel,onRSt,onRotSt,depFade=1}){
  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey,e.altKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,opacity:(node.opacity??1)*depFade,border:`2px solid ${sel?T.y:"transparent"}`,cursor:"move",transform:node.rotation?`rotate(${node.rotation}deg)`:undefined}}>
    <div style={{width:"100%",height:"100%",borderRadius:8,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,.5)"}}>
      <img src={node.src} alt="" style={{width:"100%",height:"100%",objectFit:"cover",pointerEvents:"none"}}/>
    </div>
    {sel&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
  </div>;
}

function LaneNode({node,sel,onSel,onTouchSel,onUpd,onRSt,onRotSt,depFade=1}){
  const v=node.orientation==="v";
  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey,e.altKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,zIndex:node.zIndex||0,opacity:(node.opacity??1)*depFade,background:v?"rgba(14,165,233,.06)":"rgba(250,204,21,.06)",border:`2px dashed ${sel?T.y:"rgba(148,163,184,.35)"}`,borderRadius:10,cursor:node.locked?"default":"move",userSelect:"none",outline:node.groupId&&sel?`2px dashed ${T.purple}`:"none",transform:node.rotation?`rotate(${node.rotation}deg)`:undefined}}>
    <div style={{position:"absolute",top:6,left:8,right:8,display:"flex",alignItems:"center",gap:6,pointerEvents:"auto"}}>
      <span style={{fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{v?"V lane":"H lane"}</span>
      <div style={{flex:1,height:1,background:"rgba(148,163,184,.25)"}}/>
    </div>
    <div style={{position:"absolute",top:20,left:8,right:8,bottom:8}}>
      <ET value={node.text||"Lane"} onChange={t=>!node.locked&&onUpd(node.id,{text:t})} style={{fontSize:12,color:T.t0,fontWeight:"600",lineHeight:1.3}}/>
    </div>
    {sel&&!node.locked&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
  </div>;
}

function TaskNode({node,sel,onSel,onTouchSel,onUpd,onRSt,onRotSt,votes,onVote,voteMode,depFade=1,blockedByDeps=false}){
  const status=normExecStatus(node.executionStatus||node.status);
  const owner=String(node.executionOwner||"TBD");
  const priority=normExecPriority(node.executionPriority||node.priority);
  const due=normExecDueDate(node.executionDueDate||node.dueDate);
  const tags=parseExecTags(node.executionTags||node.tags);
  const title=String(node.executionTitle||String(node.text||"").split("\n")[0]||"Task");
  const desc=String(node.executionDescription||"");
  const stTone=status==="Done"?{bg:"#dcfce7",fg:"#14532d"}:status==="Blocked"?{bg:"#fee2e2",fg:"#991b1b"}:status==="In Progress"?{bg:"#dbeafe",fg:"#1e3a8a"}:{bg:"#fef3c7",fg:"#92400e"};
  const border=status==="Blocked"||blockedByDeps?"#f97316":(node.borderColor||"#334155");
  const initials=owner&&owner!=="TBD"?owner.split(/\s+/).map(v=>v[0]).join("").slice(0,2).toUpperCase():"?";
  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey,e.altKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,zIndex:node.zIndex||0,opacity:(node.opacity??1)*depFade,background:node.color||"#0f172a",border:`2px solid ${sel?T.y:border}`,borderRadius:11,boxShadow:sel?`0 0 0 2px ${T.y},0 8px 22px rgba(0,0,0,.35)`:"0 8px 20px rgba(0,0,0,.3)",cursor:node.locked?"default":"move",userSelect:"none",display:"flex",flexDirection:"column",overflow:"hidden",transform:node.rotation?`rotate(${node.rotation}deg)`:undefined}}>
    <div style={{height:30,display:"flex",alignItems:"center",gap:6,padding:"0 8px",background:"rgba(15,23,42,.55)",borderBottom:`1px solid ${T.b1}`}}>
      <span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:node.textColor||"#e2e8f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{priority}</span>
      <span style={{marginLeft:"auto",background:stTone.bg,color:stTone.fg,borderRadius:999,padding:"2px 8px",fontSize:9.5,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{status}</span>
    </div>
    <div style={{padding:"8px 9px 6px",display:"grid",gap:6,flex:1,minHeight:0}}>
      <ET value={title} onChange={t=>!node.locked&&onUpd(node.id,{executionTitle:t,text:composeTaskNodeText({
        title:t,description:desc,status,owner,priority,dueDate:due,tags,githubUrl:String(node.executionGithubUrl||node.executionIssueUrl||""),jiraUrl:String(node.executionJiraUrl||"")
      })})} style={{fontSize:12,color:node.textColor||"#e2e8f0",fontWeight:"700",lineHeight:1.3}}/>
      <ET value={desc} onChange={t=>!node.locked&&onUpd(node.id,{executionDescription:t,text:composeTaskNodeText({
        title,description:t,status,owner,priority,dueDate:due,tags,githubUrl:String(node.executionGithubUrl||node.executionIssueUrl||""),jiraUrl:String(node.executionJiraUrl||"")
      })})} style={{fontSize:10.5,color:"rgba(226,232,240,.9)",lineHeight:1.35,maxHeight:42,overflow:"hidden"}}/>
      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:"auto"}}>
        <div title={owner} style={{width:20,height:20,borderRadius:"50%",background:"rgba(148,163,184,.24)",border:`1px solid ${T.b1}`,display:"grid",placeItems:"center",fontSize:9,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:"#e2e8f0"}}>{initials}</div>
        <span style={{fontSize:10,color:"#cbd5e1",fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:90}}>{owner}</span>
        <span style={{marginLeft:"auto",fontSize:10,color:due==="TBD"?"#fca5a5":"#93c5fd",fontFamily:"'JetBrains Mono',monospace"}}>{due}</span>
      </div>
      {tags.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {tags.slice(0,3).map(tag=><span key={tag} style={{fontSize:9,color:"#cbd5e1",border:`1px solid ${T.b1}`,padding:"1px 5px",borderRadius:999,background:"rgba(15,23,42,.5)"}}>{tag}</span>)}
      </div>}
      {blockedByDeps&&status!=="Blocked"&&<div style={{fontSize:9.5,color:"#fca5a5",fontFamily:"'JetBrains Mono',monospace"}}>Blocked by dependency</div>}
    </div>
    {sel&&!node.locked&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
    {voteMode&&<VoteBadge count={votes||0} onClick={()=>onVote(node.id)}/>}
  </div>;
}

function MilestoneNode({node,sel,onSel,onTouchSel,onUpd,onRSt,onRotSt,depFade=1,milestoneStats=null}){
  const title=String(node.executionMilestone||String(node.text||"").split("\n")[0]||"Milestone");
  const due=normExecDueDate(node.executionDueDate||node.executionMilestoneDate);
  const done=Number(milestoneStats?.done??0);
  const total=Number(milestoneStats?.total??0);
  const pct=total?Math.round((done/total)*100):0;
  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey,e.altKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,zIndex:node.zIndex||0,opacity:(node.opacity??1)*depFade,background:node.color||"#111827",border:`2px solid ${sel?T.y:(node.borderColor||"#6366f1")}`,borderRadius:12,boxShadow:sel?`0 0 0 2px ${T.y},0 10px 24px rgba(0,0,0,.35)`:"0 10px 20px rgba(0,0,0,.28)",cursor:node.locked?"default":"move",userSelect:"none",display:"flex",flexDirection:"column",overflow:"hidden",transform:node.rotation?`rotate(${node.rotation}deg)`:undefined}}>
    <div style={{height:32,display:"flex",alignItems:"center",gap:6,padding:"0 10px",background:"rgba(99,102,241,.16)",borderBottom:`1px solid ${T.b1}`}}>
      <span style={{fontSize:10,color:"#c7d2fe",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,letterSpacing:".05em"}}>MILESTONE</span>
      <span style={{marginLeft:"auto",fontSize:10,color:due==="TBD"?"#fca5a5":"#cbd5e1",fontFamily:"'JetBrains Mono',monospace"}}>{due}</span>
    </div>
    <div style={{padding:"10px 10px 8px",display:"grid",gap:7,flex:1}}>
      <ET value={title} onChange={t=>!node.locked&&onUpd(node.id,{executionMilestone:t,text:composeMilestoneNodeText({title:t,dueDate:due,progressDone:done,progressTotal:total})})} style={{fontSize:14,color:"#e2e8f0",fontWeight:"700",lineHeight:1.25}}/>
      <div style={{height:8,borderRadius:999,background:"rgba(15,23,42,.7)",border:`1px solid ${T.b0}`,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:pct>=70?"#22c55e":pct>=40?T.y:"#f97316"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#cbd5e1",fontFamily:"'JetBrains Mono',monospace"}}>
        <span>{done}/{total} done</span>
        <span>{pct}%</span>
      </div>
    </div>
    {sel&&!node.locked&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
  </div>;
}

function DecisionNode({node,sel,onSel,onTouchSel,onUpd,onRSt,onRotSt,depFade=1}){
  const decision=String(node.executionDecision||String(node.text||"").split("\n")[0]||"Decision");
  const date=normExecDueDate(node.executionDecisionDate||node.executionDate);
  const owner=String(node.executionOwner||"TBD");
  const context=String(node.executionContext||"");
  const outcome=String(node.executionOutcome||"");
  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey,e.altKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,zIndex:node.zIndex||0,opacity:(node.opacity??1)*depFade,background:node.color||"#1f2937",border:`2px solid ${sel?T.y:(node.borderColor||"#f59e0b")}`,borderRadius:12,boxShadow:sel?`0 0 0 2px ${T.y},0 8px 20px rgba(0,0,0,.35)`:"0 8px 18px rgba(0,0,0,.28)",cursor:node.locked?"default":"move",userSelect:"none",display:"flex",flexDirection:"column",overflow:"hidden",transform:node.rotation?`rotate(${node.rotation}deg)`:undefined}}>
    <div style={{height:30,display:"flex",alignItems:"center",padding:"0 10px",background:"rgba(245,158,11,.14)",borderBottom:`1px solid ${T.b1}`}}>
      <span style={{fontSize:10,color:"#fcd34d",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,letterSpacing:".05em"}}>DECISION MEMORY</span>
    </div>
    <div style={{padding:"8px 10px 8px",display:"grid",gap:6,flex:1}}>
      <ET value={decision} onChange={t=>!node.locked&&onUpd(node.id,{executionDecision:t,text:composeDecisionNodeText({decision:t,date,owner,context,outcome})})} style={{fontSize:12.5,color:"#fef3c7",fontWeight:"700",lineHeight:1.3}}/>
      <div style={{fontSize:10,color:"#cbd5e1",fontFamily:"'JetBrains Mono',monospace"}}>{date} · {owner}</div>
      <ET value={context||"Context..."} onChange={t=>!node.locked&&onUpd(node.id,{executionContext:t,text:composeDecisionNodeText({decision,date,owner,context:t,outcome})})} style={{fontSize:10.5,color:"#e5e7eb",lineHeight:1.3,maxHeight:42,overflow:"hidden"}}/>
      <ET value={outcome||"Outcome..."} onChange={t=>!node.locked&&onUpd(node.id,{executionOutcome:t,text:composeDecisionNodeText({decision,date,owner,context,outcome:t})})} style={{fontSize:10.5,color:"#e5e7eb",lineHeight:1.3,maxHeight:42,overflow:"hidden"}}/>
    </div>
    {sel&&!node.locked&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
  </div>;
}

function TransformNode({node,sel,onSel,onTouchSel,onUpd,onRSt,onRotSt,depFade=1}){
  const op=normalizeTransformType(node.transformType);
  const summary=String(node.transformOutput?.summary||"no output");
  const err=String(node.dataFlowError||"").trim();
  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey,e.altKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,zIndex:node.zIndex||0,opacity:(node.opacity??1)*depFade,background:node.color||"#0b1220",border:`2px solid ${sel?T.y:(err?T.red:(node.borderColor||"#38bdf8"))}`,borderRadius:12,boxShadow:sel?`0 0 0 2px ${T.y},0 8px 22px rgba(0,0,0,.35)`:"0 8px 20px rgba(0,0,0,.28)",cursor:node.locked?"default":"move",userSelect:"none",display:"flex",flexDirection:"column",overflow:"hidden",transform:node.rotation?`rotate(${node.rotation}deg)`:undefined}}>
    <div data-transform-ui="1" onMouseDown={e=>e.stopPropagation()} style={{height:30,display:"flex",alignItems:"center",gap:6,padding:"0 10px",background:"rgba(34,211,238,.14)",borderBottom:`1px solid ${T.b1}`}}>
      <span style={{fontSize:10,color:"#67e8f9",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,letterSpacing:".05em"}}>TRANSFORM</span>
      <span style={{marginLeft:"auto",fontSize:10,color:T.t1,fontFamily:"'JetBrains Mono',monospace"}}>{op}</span>
    </div>
    <div data-transform-ui="1" onMouseDown={e=>e.stopPropagation()} style={{padding:"8px 10px",display:"grid",gap:6,flex:1,minHeight:0}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:4}}>
        {["sum","average","filter","group"].map(kind=><button key={kind} disabled={node.locked} onClick={e=>{e.stopPropagation();onUpd(node.id,{transformType:kind});}}
          style={{height:22,borderRadius:5,border:`1px solid ${op===kind?T.yDim:T.b1}`,background:op===kind?T.yBg:T.bg2,color:op===kind?T.y:T.t1,cursor:node.locked?"not-allowed":"pointer",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{kind==="average"?"avg":kind}</button>)}
      </div>
      <ET value={node.text||`${op.toUpperCase()}\n${summary}`} onChange={t=>!node.locked&&onUpd(node.id,{text:t})} style={{fontSize:11,color:node.textColor||"#dbeafe",fontWeight:"600",lineHeight:1.35,maxHeight:56,overflow:"hidden"}}/>
      <div style={{fontSize:10,color:err?T.red:T.t2,fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{err||summary}</div>
    </div>
    {sel&&!node.locked&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
  </div>;
}

function KpiNode({node,sel,onSel,onTouchSel,onUpd,onRSt,onRotSt,depFade=1}){
  const metric=String(node.kpiMetric||node.kpiBinding?.metric||"sum").toUpperCase();
  const title=String(node.kpiLabel||node.kpiBinding?.title||"KPI");
  const value=Number.isFinite(Number(node.kpiValue))?Number(node.kpiValue):0;
  const valueText=formatNumber(value);
  const err=String(node.dataFlowError||"").trim();
  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey,e.altKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,zIndex:node.zIndex||0,opacity:(node.opacity??1)*depFade,background:node.color||"#0b1220",border:`2px solid ${sel?T.y:(err?T.red:(node.borderColor||"#f59e0b"))}`,borderRadius:12,boxShadow:sel?`0 0 0 2px ${T.y},0 8px 22px rgba(0,0,0,.35)`:"0 8px 20px rgba(0,0,0,.28)",cursor:node.locked?"default":"move",userSelect:"none",display:"flex",flexDirection:"column",overflow:"hidden",transform:node.rotation?`rotate(${node.rotation}deg)`:undefined}}>
    <div data-kpi-ui="1" onMouseDown={e=>e.stopPropagation()} style={{height:28,display:"flex",alignItems:"center",gap:6,padding:"0 10px",background:"rgba(245,158,11,.12)",borderBottom:`1px solid ${T.b1}`}}>
      <span style={{fontSize:10,color:"#fcd34d",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,letterSpacing:".05em"}}>{metric}</span>
      <span style={{marginLeft:"auto",fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>LIVE</span>
    </div>
    <div data-kpi-ui="1" onMouseDown={e=>e.stopPropagation()} style={{padding:"8px 10px",display:"grid",gap:5,flex:1}}>
      <ET value={title} onChange={t=>!node.locked&&onUpd(node.id,{kpiLabel:t})} style={{fontSize:12,color:node.textColor||T.t0,fontWeight:"700",lineHeight:1.3,maxHeight:34,overflow:"hidden"}}/>
      <div style={{fontSize:24,color:"#fef3c7",fontWeight:800,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{valueText}</div>
      <div style={{fontSize:10,color:err?T.red:T.t2,fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{err||String(node.kpiBinding?.columnHeader||"Value")}</div>
    </div>
    {sel&&!node.locked&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
  </div>;
}

function ChartNode({node,sel,onSel,onTouchSel,onUpd,onRSt,onRotSt,depFade=1}){
  const chartType=normalizeChartType(node.chartType);
  const rows=Array.isArray(node.chartData)?node.chartData.filter(r=>Number.isFinite(Number(r?.value))).slice(0,24):[];
  const summary=String(node.chartSummary||`${rows.length} points`);
  const err=String(node.dataFlowError||"").trim();
  const max=Math.max(1,...rows.map(r=>Math.abs(Number(r.value)||0)));
  const linePoints=rows.map((row,idx)=>{
    const x=18+idx*(rows.length>1?((node.w-56)/(rows.length-1)):0);
    const y=92-Math.round((Math.abs(Number(row.value)||0)/max)*64);
    return{x,y,label:String(row.label||`#${idx+1}`),value:Number(row.value)||0};
  });
  const linePath=chartSeriesPath(linePoints);
  const pieSum=rows.reduce((acc,row)=>acc+Math.abs(Number(row.value)||0),0)||1;
  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey,e.altKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,zIndex:node.zIndex||0,opacity:(node.opacity??1)*depFade,background:node.color||"#0b1220",border:`2px solid ${sel?T.y:(err?T.red:(node.borderColor||"#22d3ee"))}`,borderRadius:12,boxShadow:sel?`0 0 0 2px ${T.y},0 8px 22px rgba(0,0,0,.35)`:"0 8px 20px rgba(0,0,0,.28)",cursor:node.locked?"default":"move",userSelect:"none",display:"flex",flexDirection:"column",overflow:"hidden",transform:node.rotation?`rotate(${node.rotation}deg)`:undefined}}>
    <div data-chart-ui="1" onMouseDown={e=>e.stopPropagation()} style={{height:32,display:"flex",alignItems:"center",gap:6,padding:"0 10px",background:"rgba(34,211,238,.12)",borderBottom:`1px solid ${T.b1}`}}>
      <ET value={node.text||`${chartType.toUpperCase()} Chart`} onChange={t=>!node.locked&&onUpd(node.id,{text:t})} style={{fontSize:12,color:node.textColor||T.t0,fontWeight:"700",lineHeight:1.2,maxHeight:18,overflow:"hidden"}}/>
      <div style={{display:"flex",gap:4,marginLeft:"auto"}}>
        {["bar","line","pie"].map(kind=><button key={kind} disabled={node.locked} onClick={e=>{e.stopPropagation();onUpd(node.id,{chartType:kind});}}
          style={{height:20,padding:"0 6px",borderRadius:4,border:`1px solid ${chartType===kind?T.yDim:T.b1}`,background:chartType===kind?T.yBg:T.bg2,color:chartType===kind?T.y:T.t2,cursor:node.locked?"not-allowed":"pointer",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{kind[0]}</button>)}
      </div>
    </div>
    <div data-chart-ui="1" onMouseDown={e=>e.stopPropagation()} style={{padding:"8px 10px",display:"grid",gap:6,flex:1,minHeight:0}}>
      {chartType==="bar"&&<div style={{display:"grid",gap:4}}>
        {rows.slice(0,6).map((row,idx)=>{
          const barW=Math.max(12,Math.round((Math.abs(Number(row.value)||0)/max)*Math.max(56,node.w-162)));
          return<div key={`bar_${idx}`} style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:70,fontSize:10,color:T.t2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{String(row.label||`#${idx+1}`)}</span>
            <div style={{height:10,width:barW,borderRadius:999,background:["#60a5fa","#34d399","#f59e0b","#f472b6","#a78bfa","#22d3ee"][idx%6]}}/>
            <span style={{fontSize:10,color:T.t1,fontFamily:"'JetBrains Mono',monospace"}}>{formatNumber(row.value)}</span>
          </div>;
        })}
      </div>}
      {chartType==="line"&&<svg viewBox={`0 0 ${Math.max(220,node.w-26)} 102`} style={{width:"100%",height:102,border:`1px solid ${T.b1}`,borderRadius:8,background:T.bg1}}>
        <path d={linePath} fill="none" stroke="#60a5fa" strokeWidth="2"/>
        {linePoints.map((pt,idx)=><g key={`pt_${idx}`}>
          <circle cx={pt.x} cy={pt.y} r="2.8" fill="#22d3ee"/>
          <text x={pt.x} y={100} textAnchor="middle" fontSize="8" fill={T.t2}>{pt.label.slice(0,4)}</text>
        </g>)}
      </svg>}
      {chartType==="pie"&&<div style={{display:"grid",gridTemplateColumns:"78px 1fr",gap:8,alignItems:"center"}}>
        <div style={{width:78,height:78,borderRadius:"50%",border:`1px solid ${T.b1}`,background:T.bg1,display:"grid",placeItems:"center",fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>PIE</div>
        <div style={{display:"grid",gap:4}}>
          {rows.slice(0,5).map((row,idx)=>{
            const pct=Math.round((Math.abs(Number(row.value)||0)/pieSum)*100);
            return<div key={`pie_${idx}`} style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:T.t1}}>
              <span style={{width:8,height:8,borderRadius:99,background:["#60a5fa","#34d399","#f59e0b","#f472b6","#a78bfa"][idx%5]}}/>
              <span style={{flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{String(row.label||`#${idx+1}`)}</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace"}}>{pct}%</span>
            </div>;
          })}
        </div>
      </div>}
      <div style={{fontSize:10,color:err?T.red:T.t2,fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{err||summary}</div>
    </div>
    {sel&&!node.locked&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
  </div>;
}

/* ------------------------------------------------------------
   ARROW LABEL (editable)
------------------------------------------------------------ */
function SpreadsheetNode({
  node,
  sel,
  onSel,
  onTouchSel,
  onUpd,
  onRSt,
  onRotSt,
  depFade=1,
  spreadsheetEngine=null,
  formulaSession=null,
  formulaPick=null,
  onFormulaSessionChange=null,
  onFormulaReferencePick=null,
  onConsumeFormulaPick=null,
  formulaHighlight=false,
  formulaSource=false,
  anomalyMap=null,
}){
  return <SpreadsheetNodeView
    node={node}
    sel={sel}
    onSel={onSel}
    onTouchSel={onTouchSel}
    onUpd={onUpd}
    onRSt={onRSt}
    onRotSt={onRotSt}
    depFade={depFade}
    spreadsheetEngine={spreadsheetEngine}
    formulaSession={formulaSession}
    formulaPick={formulaPick}
    onFormulaSessionChange={onFormulaSessionChange}
    onFormulaReferencePick={onFormulaReferencePick}
    onConsumeFormulaPick={onConsumeFormulaPick}
    formulaHighlight={formulaHighlight}
    formulaSource={formulaSource}
    anomalyMap={anomalyMap}
    T={T}
    RH={RH}
    RotH={RotH}
    sheetCellKey={sheetCellKey}
    createSpreadsheetEngine={createSpreadsheetEngine}
    appendFormulaReference={appendFormulaReference}
    sheetColLabel={sheetColLabel}
    buildSheetReferenceToken={buildSheetReferenceToken}
  />;
}

function DeckNode({node,sel,onSel,onTouchSel,onUpd,onRSt,onRotSt,depFade=1}){
  const slides=Array.isArray(node.deckSlides)&&node.deckSlides.length?node.deckSlides:[{id:"fallback",title:"Slide 1",body:""}];
  const idx=Math.max(0,Math.min(slides.length-1,Number(node.deckIndex)||0));
  const slide=slides[idx];
  const accent=node.deckAccent||T.y;
  const inputTarget=node.deckInputTarget==="title"?"title":"body";
  const patchDeck=(nextSlides,nextIdx=idx)=>{
    if(node.locked)return;
    const safeSlides=nextSlides.length?nextSlides:[{id:`sl_${Date.now()}`,title:"Slide 1",body:""}];
    const safeIdx=Math.max(0,Math.min(safeSlides.length-1,nextIdx));
    onUpd(node.id,{deckSlides:safeSlides,deckIndex:safeIdx});
  };
  const updateSlide=patch=>{
    const next=slides.map((s,i)=>i===idx?{...s,...patch}:s);
    patchDeck(next,idx);
  };
  const addSlide=()=>{
    const next=[...slides,{id:`sl_${Date.now()}_${Math.floor(Math.random()*9999)}`,title:`Slide ${slides.length+1}`,body:""}];
    patchDeck(next,next.length-1);
  };
  const delSlide=()=>{
    if(slides.length<=1||node.locked)return;
    const next=slides.filter((_,i)=>i!==idx);
    patchDeck(next,Math.max(0,idx-1));
  };
  const setInputTarget=target=>{
    if(node.locked)return;
    if(target!=="title"&&target!=="body")return;
    onUpd(node.id,{deckInputTarget:target});
  };

  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey,e.altKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,zIndex:node.zIndex||0,opacity:(node.opacity??1)*depFade,background:node.color||T.bg2,border:`2px solid ${sel?accent:(node.borderColor||T.b1)}`,borderRadius:12,boxShadow:sel?`0 0 0 2px ${accent},0 10px 26px rgba(0,0,0,.35)`:"0 10px 24px rgba(0,0,0,.3)",cursor:node.locked?"default":"move",display:"flex",flexDirection:"column",overflow:"hidden",transform:node.rotation?`rotate(${node.rotation}deg)`:undefined}}>
    <div data-deck-ui="1" onMouseDown={e=>e.stopPropagation()} style={{height:38,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px",borderBottom:`1px solid ${T.b1}`,background:T.bg3,gap:8}}>
      <ET value={node.text||"Presentation"} onChange={t=>!node.locked&&onUpd(node.id,{text:t})} style={{fontSize:12,color:node.textColor||T.t0,fontWeight:"700",lineHeight:1.2}}/>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <div style={{display:"flex",alignItems:"center",gap:2,padding:2,border:`1px solid ${T.b1}`,borderRadius:6,background:T.bg2}}>
          <button onClick={e=>{e.stopPropagation();setInputTarget("title");}} disabled={node.locked}
            style={{height:20,padding:"0 7px",border:`1px solid ${inputTarget==="title"?`${accent}aa`:"transparent"}`,background:inputTarget==="title"?`${accent}22`:"transparent",color:inputTarget==="title"?T.t0:T.t1,borderRadius:4,cursor:"pointer",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>Title</button>
          <button onClick={e=>{e.stopPropagation();setInputTarget("body");}} disabled={node.locked}
            style={{height:20,padding:"0 7px",border:`1px solid ${inputTarget==="body"?`${accent}aa`:"transparent"}`,background:inputTarget==="body"?`${accent}22`:"transparent",color:inputTarget==="body"?T.t0:T.t1,borderRadius:4,cursor:"pointer",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>Body</button>
        </div>
        <button onClick={e=>{e.stopPropagation();if(node.locked)return;onUpd(node.id,{deckIndex:Math.max(0,idx-1)});}} disabled={node.locked||idx<=0} style={{height:24,width:24,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,borderRadius:5,cursor:"pointer"}}>{"<"}</button>
        <span style={{fontSize:10,color:T.t1,fontFamily:"'JetBrains Mono',monospace",minWidth:52,textAlign:"center"}}>{`${idx+1}/${slides.length}`}</span>
        <button onClick={e=>{e.stopPropagation();if(node.locked)return;onUpd(node.id,{deckIndex:Math.min(slides.length-1,idx+1)});}} disabled={node.locked||idx>=slides.length-1} style={{height:24,width:24,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,borderRadius:5,cursor:"pointer"}}>{">"}</button>
        <button onClick={e=>{e.stopPropagation();addSlide();}} disabled={node.locked} style={{height:24,padding:"0 7px",border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,borderRadius:5,cursor:"pointer",fontSize:11}}>+Slide</button>
        <button onClick={e=>{e.stopPropagation();delSlide();}} disabled={node.locked||slides.length<=1} style={{height:24,padding:"0 7px",border:"1px solid rgba(239,68,68,.45)",background:T.bg2,color:"#fca5a5",borderRadius:5,cursor:"pointer",fontSize:11}}>Del</button>
      </div>
    </div>
    <div data-deck-ui="1" onMouseDown={e=>e.stopPropagation()} style={{flex:1,padding:"10px 12px 8px",display:"flex",flexDirection:"column",gap:8}}>
      <div style={{flex:1,background:T.bg1,borderRadius:10,border:`2px solid ${accent}55`,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10,overflow:"auto"}}>
        <div onMouseDown={e=>{e.stopPropagation();setInputTarget("title");}} style={{borderRadius:6,outline:inputTarget==="title"?`2px solid ${accent}55`:"none",outlineOffset:2}}>
          <ET value={slide.title||""} onChange={t=>updateSlide({title:t})} style={{fontSize:24,color:T.t0,fontWeight:"700",lineHeight:1.15,textAlign:"left"}}/>
        </div>
        <div onMouseDown={e=>{e.stopPropagation();setInputTarget("body");}} style={{borderRadius:6,outline:inputTarget==="body"?`2px solid ${accent}55`:"none",outlineOffset:2}}>
          <ET value={slide.body||""} onChange={t=>updateSlide({body:t})} style={{fontSize:14,color:T.t1,fontWeight:"500",lineHeight:1.5,textAlign:"left"}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
        {slides.map((sli,i)=><button key={sli.id||`sl-${i}`} onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();if(node.locked)return;onUpd(node.id,{deckIndex:i});}}
          style={{minWidth:90,maxWidth:140,height:44,background:i===idx?T.bg3:T.bg2,border:`1px solid ${i===idx?accent:T.b1}`,borderRadius:7,color:T.t0,fontSize:10,padding:"4px 6px",textAlign:"left",cursor:"pointer"}}>
          <div style={{fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sli.title||`Slide ${i+1}`}</div>
          <div style={{opacity:.7,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{(sli.body||"").slice(0,26)}</div>
        </button>)}
      </div>
    </div>
    {sel&&!node.locked&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
  </div>;
}
function ArrowLabel({label,mx,my,onUpdate,onDelete}){
  const[ed,setEd]=useState(false);
  const r=useRef(null);
  useEffect(()=>{if(ed&&r.current)r.current.focus();},[ed]);
  return<div style={{position:"absolute",left:mx-40,top:my-14,width:80,textAlign:"center",pointerEvents:"auto",zIndex:15}}>
    {ed?<input ref={r} defaultValue={label||""} onBlur={e=>{onUpdate(e.target.value);setEd(false);}} onKeyDown={e=>{if(e.key==="Escape"||e.key==="Enter"){onUpdate(e.target.value);setEd(false);}}} style={{background:T.bg2,border:`1px solid ${T.b2}`,color:T.t0,borderRadius:4,padding:"2px 6px",fontSize:10,width:"100%",fontFamily:"'JetBrains Mono',monospace",outline:"none",textAlign:"center"}}/>
    :<span onDoubleClick={()=>setEd(true)} onContextMenu={e=>{e.stopPropagation();e.preventDefault();onDelete();}} style={{background:label?T.bg2:"transparent",color:label?T.t1:"transparent",padding:"2px 7px",borderRadius:4,fontSize:10,cursor:"text",fontFamily:"'JetBrains Mono',monospace",border:label?`1px solid ${T.b0}`:"none",userSelect:"none"}}>{label||"…"}</span>}
  </div>;
}

/* ------------------------------------------------------------
   COMMENT DOT
------------------------------------------------------------ */
function CommentDot({c,onDel,onUpdate,isMobile=false}){
  const[open,setOpen]=useState(false);
  const[reply,setReply]=useState("");
  const stamp=Number(c?.ts||0);
  const at=Number.isFinite(stamp)&&stamp>0?new Date(stamp).toLocaleString("ro-RO",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"now";
  const replies=Array.isArray(c?.replies)?c.replies:[];
  const addReply=()=>{
    const text=String(reply||"").trim();
    if(!text)return;
    onUpdate?.(c.id,{replies:[...replies,{id:uid(),text,author:ME.name,ts:Date.now()}]});
    setReply("");
  };
  const thread=<div className="pop" style={{position:isMobile?"static":"absolute",left:isMobile?0:26,top:isMobile?0:-6,background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:10,padding:"10px 12px",minWidth:180,maxWidth:isMobile?"100%":260,boxShadow:isMobile?"none":"0 4px 20px rgba(0,0,0,.6)",zIndex:90,display:"grid",gap:8}}>
    <p style={{fontSize:12,color:T.t0,lineHeight:1.5}}>{c.text}</p>
    <div style={{fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{c.author||"User"} • {at}</div>
    {replies.length>0&&<div style={{display:"grid",gap:6,maxHeight:isMobile?220:140,overflowY:"auto"}}>
      {replies.map(rep=>{
        const repTs=Number(rep?.ts||0);
        const repAt=Number.isFinite(repTs)&&repTs>0?new Date(repTs).toLocaleTimeString("ro-RO",{hour:"2-digit",minute:"2-digit"}):"now";
        return<div key={rep.id} style={{border:`1px solid ${T.b0}`,borderRadius:8,padding:"5px 7px",background:T.bg1}}>
          <div style={{fontSize:11,color:T.t0,lineHeight:1.4}}>{rep.text}</div>
          <div style={{fontSize:9.5,color:T.t3}}>{rep.author||"User"} • {repAt}</div>
        </div>;
      })}
    </div>}
    <div style={{display:"flex",gap:6}}>
      <input value={reply} onChange={e=>setReply(e.target.value)} placeholder="Reply..." onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addReply();}}} style={{flex:1,minHeight:30,borderRadius:7,border:`1px solid ${T.b1}`,background:T.bg1,color:T.t0,padding:"0 8px",fontSize:11,outline:"none"}}/>
      <button onClick={addReply} style={{minWidth:54,borderRadius:7,border:`1px solid ${T.b1}`,background:T.bg3,color:T.t0,fontSize:11,cursor:"pointer"}}>Reply</button>
      <button onClick={()=>onDel(c.id)} style={{minWidth:42,borderRadius:7,border:`1px solid ${T.red}`,background:"transparent",color:T.red,fontSize:11,cursor:"pointer"}}>Del</button>
    </div>
  </div>;
  return<div style={{position:"absolute",left:c.x,top:c.y,zIndex:80}}>
    <div onClick={()=>setOpen(o=>!o)} style={{width:22,height:22,borderRadius:"50% 50% 50% 0",background:T.y,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:10,fontWeight:700,color:"#0c1829",boxShadow:`0 2px 8px rgba(250,204,21,.4)`,animation:"float 3s ease-in-out infinite"}}>!</div>
    {open&&!isMobile&&thread}
    {open&&isMobile&&<MobileBottomSheet open title="Comment thread" subtitle={c.author||"User"} onClose={()=>setOpen(false)} T={T} zIndex={365} snapPoints={[0.28,0.56,0.9]}>{thread}</MobileBottomSheet>}
  </div>;
}

/* ------------------------------------------------------------
   CANVAS
------------------------------------------------------------ */
const CANVAS_DEPS={
  T,SC,ME,toasts,uid,GRID,snap,CANVAS_THEMES,MOBILE_SMART_GAP,MOBILE_RADIAL_OPTIONS,MOBILE_RADIAL_VECTORS,DEFAULT_CANVAS_BG,
  getNextStickySwatch:()=>SC[_si++%8],
  loadStoredConnectorDefaultStyle,loadStoredRememberLastConnectorStyle,saveStoredConnectorDefaultStyle,saveStoredRememberLastConnectorStyle,
  createInputController,
  isAddMode,isConnectMode,modeToTool,nextModeAfterAdd,nextModeAfterConnect,toolToMode,
  DEFAULT_PORTS,getPortWorldPosition,getAnchorWorldPosition,normalizeConnectorEndpoints,
  normalizeConnectorDefaultStyle,normalizeConnectorJumpStyle,normalizeConnectorRouting,normalizeConnectorStyle,reverseConnector,
  applyJumpsToPath,buildObstacleIndex,buildObstacleRects,clampCanvasPoint,connectorMidpoint,defaultConnectorPath,queryObstacleIndex,routeOrthoAStar,segmentIntersectsRect,segmentsToIntersections,
  appendFormulaReference,buildSheetReferenceToken,createSpreadsheetEngine,sheetCellKey,sheetColLabel,
  createTransformNode,isDataConnector,isDataNodeType,normalizeChartType,normalizeTransformType,wouldCreateDataFlowCycle,
  useCanvasUiState,useConnectorStyleController,useSheetFormulaBridge,useCanvasTransientUiHandlers,useConnectorSelectionSync,useCanvasImageIo,useCanvasWheelPanZoom,useCanvasLaserTrail,useTouchPointerCapture,useCanvasTouchHelpers,useCanvasMouseMoveRaf,useCanvasTouchMoveRaf,useTouchGestureUndoRedo,useTouchRadialMenuEnd,useTouchLongPressEnd,useTouchDoubleTapEnd,usePortConnectController,useConnectorContextMenu,useCanvasContextCommands,useCanvasPointerController,useCanvasContextMenuController,useCanvasContextImageUpload,useCanvasDoubleClickInsert,useCanvasNodeTransformStart,useCanvasNodeTouchStart,useCanvasTouchStartTarget,useCanvasTouchMoveNonPinch,useCanvasTouchEndHandler,useCanvasTouchStartTwoFinger,useCanvasTouchMovePinch,useCanvasTouchStartHandler,useCanvasTouchMoveHandler,
  ContextMenu,MobileBottomSheet,MobileRadialMenu,ConnectorRenderer,NodeRenderer,SelectionOverlay,GuidesOverlay,RemoteCursorsView,CanvasHud,ConnectorStylePanels,
  normalizeColorInputValue,getThemeColorHex,normExecStatus,normExecPriority,normExecDueDate,parseExecTags,normalizePresenceState,normalizeDependencyType,inferDependencyType,dependencyTypeLabel,getConnectorDependencyType,composeTaskNodeText,composeMilestoneNodeText,composeDecisionNodeText,isKpiNodeLike,formatNumber,chartSeriesPath,
  Sticky,TaskNode,MilestoneNode,DecisionNode,TransformNode,ChartNode,KpiNode,Shape,TxtNode,ImgNode,FrameNode,LaneNode,SpreadsheetNode,DeckNode,ArrowLabel,CommentDot,RH,RotH,
  socket,
};

function Canvas(props){
  const wb=useWB();
  return <CanvasView {...props} wb={wb} deps={CANVAS_DEPS}/>;
}
/* ------------------------------------------------------------
   ALIGN PANEL (floating above multi-selection, Miro-style)
------------------------------------------------------------ */
function AlignPanel(){
  const { s, d } = useWB();
  return <AlignPanelView s={s} d={d} T={T} />;
}

/* ------------------------------------------------------------
   MINIMAP
------------------------------------------------------------ */
function Minimap({onClose,rightInset=300}){
  const { s, d } = useWB();
  return <MinimapView s={s} d={d} onClose={onClose} rightInset={rightInset} T={T} />;
}

/* ------------------------------------------------------------
   TIMER
------------------------------------------------------------ */
function Timer(){
  return <TimerWidget T={T} />;
}

/* ------------------------------------------------------------
   FLOATING TOOLBAR
------------------------------------------------------------ */
function Toolbar({isMobile=false,hidden=false}){
  return <ToolbarView
    isMobile={isMobile}
    hidden={hidden}
    useWBHook={useWB}
    T={T}
    uid={uid}
    toasts={toasts}
    normalizeConnectorDefaultStyle={normalizeConnectorDefaultStyle}
    loadStoredConnectorDefaultStyle={loadStoredConnectorDefaultStyle}
    normalizeConnectorStyle={normalizeConnectorStyle}
    isDataNodeType={isDataNodeType}
    wouldCreateDataFlowCycle={wouldCreateDataFlowCycle}
    normalizeConnectorRouting={normalizeConnectorRouting}
    normalizeConnectorJumpStyle={normalizeConnectorJumpStyle}
    normalizeConnectorEndpoints={normalizeConnectorEndpoints}
    getNextStickySwatch={()=>SC[_si++%8]}
    MINDMAP_CHILD_GAP_X={MINDMAP_CHILD_GAP_X}
    MINDMAP_CHILD_GAP_Y={MINDMAP_CHILD_GAP_Y}
  />;
}

function MobileBottomBar({
  tool,
  canUndo,
  onToggleMode,
  onOpenInsert,
  onToggleConnect,
  onUndo,
  onOpenPanel,
  onOpenMore,
  onExitMode,
}) {
  return<MobileBottomBarView
    tool={tool}
    canUndo={canUndo}
    onToggleMode={onToggleMode}
    onOpenInsert={onOpenInsert}
    onToggleConnect={onToggleConnect}
    onUndo={onUndo}
    onOpenPanel={onOpenPanel}
    onOpenMore={onOpenMore}
    onExitMode={onExitMode}
    T={T}
  />;
}

function MobileQuickActionsBar({
  visible=false,
  onDuplicate,
  onStyle,
  onConnect,
  onDelete,
  onArrange,
  canArrange=false,
}){
  return<MobileQuickActionsBarView
    visible={visible}
    onDuplicate={onDuplicate}
    onStyle={onStyle}
    onConnect={onConnect}
    onDelete={onDelete}
    onArrange={onArrange}
    canArrange={canArrange}
    T={T}
  />;
}

/* ------------------------------------------------------------
   SEARCH PANEL
------------------------------------------------------------ */
function SearchPanel({onClose}){
  const { s, d } = useWB();
  const isMobile = useIsMobile(760);
  return <SearchPanelView onClose={onClose} s={s} d={d} isMobile={isMobile} T={T} />;
}

/* ------------------------------------------------------------
   KEYBOARD SHORTCUTS PANEL
------------------------------------------------------------ */
function ShortcutsPanel({onClose}){
  const isMobile = useIsMobile(760);
  return <ShortcutsPanelView onClose={onClose} isMobile={isMobile} T={T} />;
}

/* ------------------------------------------------------------
   TOAST CONTAINER
------------------------------------------------------------ */
function ToastContainer(){
  const items=useToasts();
  if(!items.length)return null;
  const colors={info:{bg:T.bg2,border:T.b2,color:T.t0},success:{bg:"rgba(34,197,94,.1)",border:"rgba(34,197,94,.3)",color:"#86efac"},error:{bg:"rgba(239,68,68,.1)",border:"rgba(239,68,68,.3)",color:"#fca5a5"},warn:{bg:"rgba(250,204,21,.1)",border:"rgba(250,204,21,.3)",color:T.y}};
  return<div style={{position:"fixed",bottom:24,right:24,display:"flex",flexDirection:"column",gap:8,zIndex:9000,pointerEvents:"none"}}>
    {items.map(t=>{const c=colors[t.type]||colors.info;return<div key={t.id} style={{background:c.bg,border:`1px solid ${c.border}`,color:c.color,padding:"10px 16px",borderRadius:10,fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:500,boxShadow:"0 8px 24px rgba(0,0,0,.5)",animation:"toastIn .25s ease",maxWidth:320,pointerEvents:"auto",display:"flex",alignItems:"center",gap:8}}>
      <span>{t.type==="success"?"OK":t.type==="error"?"ERR":t.type==="warn"?"WARN":"INFO"}</span>{t.msg}
    </div>;})}
  </div>;
}

/* ------------------------------------------------------------
   CANVAS THEME PICKER
------------------------------------------------------------ */
function ThemePicker({onClose}){
  const { s, d } = useWB();
  return <ThemePickerView onClose={onClose} s={s} d={d} T={T} themes={CANVAS_THEMES} notify={(msg,type)=>toasts.push(msg,type)} />;
}

/* ------------------------------------------------------------
   TEMPLATES PANEL
------------------------------------------------------------ */
function TplPanel({onClose,isMobile=false,currentUser,onOpenBoard}){
  const { s, d, boardId } = useWB();
  return <TplPanelView
    onClose={onClose}
    isMobile={isMobile}
    currentUser={currentUser}
    onOpenBoard={onOpenBoard}
    s={s}
    d={d}
    boardId={boardId}
    api={api}
    T={T}
    uid={uid}
    notify={(msg,type)=>toasts.push(msg,type)}
  />;
}

function TopBar({
  onTpl,
  onSearch,
  onPresent,
  isSaved,
  boardName,
  onRename,
  onBoards,
  isMobile = false,
  onToggleRight,
  rightOpen = false,
  onToggleTools,
  toolsOpen = false,
  onToggleMore,
  moreOpen = false,
  themeMode = "dark",
  onToggleTheme,
  showMinimap = false,
  onToggleMinimap,
  showTimeline = false,
  onToggleTimeline,
}){
  const { s, d } = useWB();
  return<TopBarView
    onTpl={onTpl}
    onSearch={onSearch}
    onPresent={onPresent}
    isSaved={isSaved}
    boardName={boardName}
    onRename={onRename}
    onBoards={onBoards}
    isMobile={isMobile}
    onToggleRight={onToggleRight}
    rightOpen={rightOpen}
    onToggleTools={onToggleTools}
    toolsOpen={toolsOpen}
    onToggleMore={onToggleMore}
    moreOpen={moreOpen}
    themeMode={themeMode}
    onToggleTheme={onToggleTheme}
    showMinimap={showMinimap}
    onToggleMinimap={onToggleMinimap}
    showTimeline={showTimeline}
    onToggleTimeline={onToggleTimeline}
    s={s}
    d={d}
    T={T}
    ME={ME}
    notify={(msg,type)=>toasts.push(msg,type)}
  />;
}

/* ------------------------------------------------------------
   APP ROOT
------------------------------------------------------------ */
export default function App(){
  const[themeMode,setThemeMode]=useState(()=>{
    const mode=getStoredUiTheme();
    applyUiTheme(mode);
    return mode;
  });
  const[user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem("boardai_user")||"null");}catch{return null;}});
  const[authReady,setAuthReady]=useState(()=>!Boolean(user));
  const[boardId,setBoardId]=useState(()=>normalizeBoardId(new URLSearchParams(window.location.search).get("board")));
  const[boardName,setBoardName]=useState("Untitled Board");
  const authCheckedTokenRef=useRef("");

  useEffect(()=>{applyUiTheme(themeMode);},[themeMode]);
  useEffect(()=>{
    const u=new URL(window.location.href);
    const fromUrl=u.searchParams.get("board");
    const normalized=normalizeBoardId(fromUrl);
    if(fromUrl&&!normalized){
      u.searchParams.delete("board");
      u.searchParams.delete("focus");
      window.history.replaceState({},"",u);
    }
  },[]);
  useEffect(()=>{
    if(!user){
      authCheckedTokenRef.current="";
      setAuthReady(true);
      return;
    }
    const token=localStorage.getItem("boardai_token")||"";
    if(!token){
      localStorage.removeItem("boardai_user");
      setUser(null);
      setAuthReady(true);
      setBoardId(null);
      const u=new URL(window.location.href);
      u.searchParams.delete("board");
      u.searchParams.delete("focus");
      window.history.replaceState({},"",u);
      if(socket.connected){socket.disconnect();}
      return;
    }
    if(authCheckedTokenRef.current===token)return;
    authCheckedTokenRef.current=token;
    setAuthReady(false);
    let cancelled=false;
    api.me().then(me=>{
      if(cancelled)return;
      const next={id:me?.id,email:me?.email,name:me?.name,color:me?.color};
      if(!next.id)throw new Error("Invalid session");
      setUser(prev=>{
        if(prev&&prev.id===next.id&&prev.email===next.email&&prev.name===next.name&&prev.color===next.color)return prev;
        return next;
      });
      try{localStorage.setItem("boardai_user",JSON.stringify(next));}catch{}
      setAuthReady(true);
    }).catch(()=>{
      if(cancelled)return;
      localStorage.removeItem("boardai_token");
      localStorage.removeItem("boardai_user");
      setUser(null);
      setAuthReady(true);
      setBoardId(null);
      const u=new URL(window.location.href);
      u.searchParams.delete("board");
      u.searchParams.delete("focus");
      window.history.replaceState({},"",u);
      if(socket.connected){socket.disconnect();}
    });
    return()=>{cancelled=true;};
  },[user]);

  function openBoard(id,name,opts={}){
    const safeId=normalizeBoardId(id);
    if(!safeId)return;
    setBoardId(safeId);setBoardName(name||"Untitled Board");
    const u=new URL(window.location.href);
    u.searchParams.set("board",safeId);
    if(opts?.focusNodeId)u.searchParams.set("focus",String(opts.focusNodeId));
    else u.searchParams.delete("focus");
    window.history.pushState({},"",u);
  }
  function goBoards(){
    setBoardId(null);
    const u=new URL(window.location.href);u.searchParams.delete("board");window.history.pushState({},"",u);
    if(socket.connected){socket.disconnect();}
  }
  function handleLogin(u){setUser(u);}
  function handleLogout(){
    localStorage.removeItem("boardai_token");
    localStorage.removeItem("boardai_user");
    setUser(null);
    setBoardId(null);
    const u=new URL(window.location.href);u.searchParams.delete("board");window.history.pushState({},"",u);
    if(socket.connected){socket.disconnect();}
  }

  function toggleTheme(){
    setThemeMode(prev=>prev==="dark"?"light":"dark");
  }

  if(!user)return<LandingPageView onLogin={handleLogin} themeMode={themeMode} onToggleTheme={toggleTheme} T={T} CSS={CSS} useIsMobileHook={useIsMobile} api={api}/>;
  if(!authReady)return<div style={{height:"100vh",display:"grid",placeItems:"center",background:T.bg0,color:T.t1,fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>Validating session...</div>;
  if(!boardId)return<DashboardView user={user} onSelect={openBoard} onLogout={handleLogout} themeMode={themeMode} onToggleTheme={toggleTheme} T={T} CSS={CSS} useIsMobileHook={useIsMobile} api={api}/>;

  return<WBP boardId={boardId} boardName={boardName}>
    <InnerApp boardId={boardId} boardName={boardName} setBoardName={setBoardName} onBoards={goBoards} user={user} themeMode={themeMode} onToggleTheme={toggleTheme}/>
  </WBP>;
}

function InnerApp({boardId,boardName,setBoardName,onBoards,user,themeMode,onToggleTheme}){
  const{s,d,emitActivity}=useWB();
  const isMobile=useIsMobile(920);
  const[showTpl,setShowTpl]=useState(false);
  const[showSearch,setShowSearch]=useState(false);
  const[showMinimap,setShowMinimap]=useState(false);
  const[presentMode,setPresentMode]=useState(false);
  const[presentIdx,setPresentIdx]=useState(0);
  const[isSaved,setIsSaved]=useState(true);
  const[mobileSheet,setMobileSheet]=useState("");
  const[mobileStayInAdd,setMobileStayInAdd]=useState(false);
  const[canvasOverlayOpen,setCanvasOverlayOpen]=useState(false);
  const[mobileArrangeOpen,setMobileArrangeOpen]=useState(false);
  const[mobileAiPrompt,setMobileAiPrompt]=useState("");
  const[mobileAiBusy,setMobileAiBusy]=useState(false);
  const[quickAiPrompt,setQuickAiPrompt]=useState("");
  const[quickAiBusy,setQuickAiBusy]=useState(false);
  const[sparkleFx,setSparkleFx]=useState(null);
  const[onboardingOpen,setOnboardingOpen]=useState(()=>{
    try{return localStorage.getItem(EDITOR_ONBOARDING_STORAGE_KEY)!=="done";}
    catch{return true;}
  });
  const[rightPanelOpen,setRightPanelOpen]=useState(true);
  const[selectedConnectorId,setSelectedConnectorId]=useState("");
  const[timelineOpen,setTimelineOpen]=useState(false);
  const[myPresence,setMyPresence]=useState("active");
  const[collabUsersBySocket,setCollabUsersBySocket]=useState({});
  const[collabActivity,setCollabActivity]=useState([]);
  const[meetingNotes,setMeetingNotes]=useState("");
  const[meetingBusy,setMeetingBusy]=useState(false);
  const[meetingSuggestions,setMeetingSuggestions]=useState(null);
  const[sheetAiAnomalyMapBySheet,setSheetAiAnomalyMapBySheet]=useState({});
  const onboardingDismissedRef=useRef(false);
  const presenceLastInteractRef=useRef(Date.now());
  const presenceIdleTimerRef=useRef(null);
  const presenceMoveThrottleRef=useRef(0);
  const localActivitySeqRef=useRef(0);
  const sparkleTimerRef=useRef(null);
  const appendActivity=useCallback(event=>{
    if(!event||typeof event!=="object")return;
    const now=Date.now();
    const id=String(event.id||`${now}_${++localActivitySeqRef.current}`);
    const type=String(event.type||"activity");
    const item={
      id,
      type,
      message:String(event.message||type.replaceAll("."," ")),
      entity:String(event.entity||"board"),
      payload:event.payload&&typeof event.payload==="object"?event.payload:{},
      actor:event.actor&&typeof event.actor==="object"?event.actor:{name:user?.name||ME.name,color:user?.color||ME.color},
      ts:Number(event.ts||now),
    };
    setCollabActivity(prev=>[item,...prev].slice(0,320));
  },[user?.name,user?.color]);
  const upsertCollabUser=useCallback((socketId,patch)=>{
    const key=String(socketId||"").trim();
    if(!key)return;
    setCollabUsersBySocket(prev=>({
      ...prev,
      [key]:{
        ...(prev[key]||{}),
        socketId:key,
        ...patch,
      },
    }));
  },[]);
  const removeCollabUser=useCallback((socketId)=>{
    const key=String(socketId||"").trim();
    if(!key)return;
    setCollabUsersBySocket(prev=>{
      if(!prev[key])return prev;
      const next={...prev};
      delete next[key];
      return next;
    });
  },[]);
  const setPresence=useCallback((nextState,options={})=>{
    const normalized=normalizePresenceState(nextState);
    const quiet=Boolean(options?.quiet);
    setMyPresence(normalized);
    if(boardId&&socket.connected){
      socket.emit("presence:update",{boardId,state:normalized});
    }
    if(!quiet){
      emitActivity?.({
        type:"presence.updated",
        entity:"presence",
        message:`Presence set to ${normalized}`,
        payload:{state:normalized},
      });
    }
  },[boardId,emitActivity]);
  const historyApi=useMemo(()=>({
    list:()=>api.historyList(boardId),
    detail:(versionId)=>api.historyGet(boardId,versionId),
    restore:(versionId)=>api.historyRestore(boardId,versionId),
  }),[boardId]);
  const accessApi=useMemo(()=>({
    list:()=>api.members(boardId),
    add:(email,role)=>api.setMember(boardId,email,role),
    remove:(userId)=>api.removeMember(boardId,userId),
  }),[boardId]);
  const auditApi=useMemo(()=>( {
    list:(opts)=>api.auditList(boardId,opts||{}),
  }),[boardId]);
  const githubApi=useMemo(()=>( {
    import:(payload)=>api.githubImport(boardId,payload||{}),
    push:(payload)=>api.githubPush(boardId,payload||{}),
    oauthStatus:()=>api.githubOAuthStatus(),
    oauthStart:(opts)=>api.githubOAuthStart({...(opts||{}),boardId}),
    oauthDisconnect:()=>api.githubOAuthDisconnect(),
  }),[boardId]);
  const jiraApi=useMemo(()=>( {
    import:(payload)=>api.jiraImport(boardId,payload||{}),
  }),[boardId]);
  useEffect(()=>{
    setCollabUsersBySocket({});
    setCollabActivity([]);
    setMyPresence("active");
    presenceLastInteractRef.current=Date.now();
    setMeetingSuggestions(null);
    setSheetAiAnomalyMapBySheet({});
    setSelectedConnectorId("");
  },[boardId]);
  useEffect(()=>{
    const onConnectorSelection=e=>{
      const nextId=String(e?.detail?.id||"").trim();
      setSelectedConnectorId(nextId);
    };
    window.addEventListener("boardai:connector-selection",onConnectorSelection);
    return()=>window.removeEventListener("boardai:connector-selection",onConnectorSelection);
  },[]);
  useEffect(()=>{
    if(!selectedConnectorId)return;
    const exists=(s.arrows||[]).some(arr=>String(arr?.id||"")===selectedConnectorId);
    if(!exists)setSelectedConnectorId("");
  },[s.arrows,selectedConnectorId]);
  const applyRestoredState=useCallback((nextData)=>{
    if(!nextData||typeof nextData!=="object")return;
    d({type:"LOAD",state:{...INIT,...nextData}});
  },[d]);
  const executionSnapshot=useMemo(()=>deriveExecutionSnapshot(s),[s]);
  const dataFlowRuntime=useDataFlowEngine({nodes:s.nodes||[],arrows:s.arrows||[],dispatch:d});
  const selectedConnector=useMemo(()=>{
    if(!selectedConnectorId)return null;
    const source=(s.arrows||[]).find(arr=>String(arr?.id||"")===selectedConnectorId);
    if(!source)return null;
    return{
      id:source.id,
      label:String(source.label||""),
      routing:normalizeConnectorRouting(source.routing),
      style:normalizeConnectorStyle(source),
    };
  },[s.arrows,selectedConnectorId]);
  const updateSheetAiAnomalyMap=useCallback((sheetId,anomalyMap={})=>{
    const id=String(sheetId||"").trim();
    if(!id){
      setSheetAiAnomalyMapBySheet({});
      return;
    }
    setSheetAiAnomalyMapBySheet(prev=>({
      ...prev,
      [id]:anomalyMap&&typeof anomalyMap==="object"?anomalyMap:{},
    }));
  },[]);
  const hasContentNodes=useMemo(()=>Array.isArray(s.nodes)&&s.nodes.some(n=>!n?.hidden),[s.nodes]);
  const showEmptyBoardPrompt=!presentMode&&!canvasOverlayOpen&&!hasContentNodes&&!isMobile&&!onboardingOpen;
  const showOnboardingOverlay=!presentMode&&!canvasOverlayOpen&&!hasContentNodes&&onboardingOpen;
  const markOnboardingDone=useCallback(()=>{
    setOnboardingOpen(false);
    onboardingDismissedRef.current=true;
    try{localStorage.setItem(EDITOR_ONBOARDING_STORAGE_KEY,"done");}catch{/* noop */}
  },[]);
  const triggerSparkleFx=useCallback((label="AI READY")=>{
    setSparkleFx({id:Date.now(),label:String(label||"AI READY")});
    if(sparkleTimerRef.current)clearTimeout(sparkleTimerRef.current);
    sparkleTimerRef.current=setTimeout(()=>{
      setSparkleFx(null);
      sparkleTimerRef.current=null;
    },720);
  },[]);
  useEffect(()=>{
    if(hasContentNodes&&onboardingOpen&&!onboardingDismissedRef.current){
      markOnboardingDone();
    }
  },[hasContentNodes,markOnboardingDone,onboardingOpen]);
  const insertGraphCentered=useCallback((graph,{tidy=true}={})=>{
    const nodes=Array.isArray(graph?.nodes)?graph.nodes:[];
    const arrows=Array.isArray(graph?.arrows)?graph.arrows:[];
    if(!nodes.length)return false;
    const minX=Math.min(...nodes.map(n=>Number(n?.x)||0));
    const minY=Math.min(...nodes.map(n=>Number(n?.y)||0));
    const maxX=Math.max(...nodes.map(n=>(Number(n?.x)||0)+(Number(n?.w)||120)));
    const maxY=Math.max(...nodes.map(n=>(Number(n?.y)||0)+(Number(n?.h)||80)));
    const cx=((minX+maxX)*0.5);
    const cy=((minY+maxY)*0.5);
    const worldX=(-s.px+s.zoom*(window.innerWidth*0.5))/s.zoom;
    const worldY=(-s.py+s.zoom*(window.innerHeight*0.42))/s.zoom;
    const dx=Math.round(worldX-cx);
    const dy=Math.round(worldY-cy);
    const idMap=new Map();
    const created=[];
    nodes.forEach(node=>{
      const id=uid();
      idMap.set(String(node?.id||id),id);
      const next={
        ...(node||{}),
        id,
        x:Math.round((Number(node?.x)||0)+dx),
        y:Math.round((Number(node?.y)||0)+dy),
      };
      created.push(next);
      d({type:"ADD",node:next});
    });
    arrows.forEach(arr=>{
      const fromId=idMap.get(String(arr?.fromId||arr?.from||""))||"";
      const toId=idMap.get(String(arr?.toId||arr?.to||""))||"";
      if(!fromId||!toId||fromId===toId)return;
      d({type:"ADD_ARR",arr:{id:uid(),fromId,toId,label:String(arr?.label||"")}});
    });
    const ids=created.map(n=>n.id);
    if(ids.length)d({type:"SEL",v:ids.slice(0,20)});
    if(tidy&&ids.length>1)d({type:"TIDY",ids});
    return true;
  },[d,s.px,s.py,s.zoom]);
  const applyQuickStartPreset=useCallback((presetId)=>{
    const graph=buildQuickStartGraph(presetId,T);
    const ok=insertGraphCentered(graph,{tidy:true});
    if(ok){
      toasts.push(`Inserted ${String(presetId||"quick-start")} template`,"success");
      markOnboardingDone();
    }
  },[insertGraphCentered,markOnboardingDone]);
  const startBrainstormNow=useCallback(()=>{
    const worldX=(-s.px+s.zoom*(window.innerWidth*0.5))/s.zoom;
    const worldY=(-s.py+s.zoom*(window.innerHeight*0.42))/s.zoom;
    const sticky={id:uid(),type:"sticky",x:Math.round(worldX-85),y:Math.round(worldY-65),w:170,h:130,text:"What should we solve first?",color:"#fef9c3",textColor:"#713f12"};
    d({type:"ADD",node:sticky});
    d({type:"SEL",v:[sticky.id]});
    toasts.push("Brainstorm started","success");
    markOnboardingDone();
  },[d,markOnboardingDone,s.px,s.py,s.zoom]);
  const runQuickAiBoard=useCallback(async(rawPrompt)=>{
    const prompt=String(rawPrompt||"").trim();
    if(!prompt||quickAiBusy)return;
    setQuickAiBusy(true);
    try{
      const systemPrompt=[
        "You generate whiteboard starter boards.",
        "Return strict JSON object with keys nodes[] and arrows[].",
        "nodes item: {id,type,text,x,y,w,h,shapeType,color,textColor,borderColor}.",
        "Allowed type: shape|sticky|text|frame|task|milestone|decision.",
        "arrows item: {fromId,toId,label}.",
        "Max 18 nodes, max 32 arrows.",
      ].join(" ");
      const response=await fetch("/api/ai/complete",{
        method:"POST",
        headers:{...api._ah(),"Content-Type":"application/json"},
        body:JSON.stringify({systemPrompt,userPrompt:prompt,maxTokens:900}),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload?.error||`AI request failed (${response.status})`);
      const parsed=parseJsonObjectLoose(payload?.json||payload?.text);
      const inNodes=Array.isArray(parsed?.nodes)?parsed.nodes:[];
      const inArrows=Array.isArray(parsed?.arrows)?parsed.arrows:[];
      if(!inNodes.length)throw new Error("AI returned no nodes");
      const graph={
        nodes:inNodes.slice(0,24).map((n,idx)=>{
          const type=String(n?.type||"shape").toLowerCase();
          const safeType=["shape","sticky","text","frame","task","milestone","decision"].includes(type)?type:"shape";
          const col=idx%4;
          const row=Math.floor(idx/4);
          return{
            id:String(n?.id||`n${idx+1}`),
            type:safeType,
            shapeType:String(n?.shapeType||"rect"),
            x:Number.isFinite(Number(n?.x))?Math.round(Number(n.x)):(-360+col*220),
            y:Number.isFinite(Number(n?.y))?Math.round(Number(n.y)):(-220+row*140),
            w:Number.isFinite(Number(n?.w))?Math.round(Number(n.w)):(safeType==="text"?260:190),
            h:Number.isFinite(Number(n?.h))?Math.round(Number(n.h)):(safeType==="sticky"?124:96),
            text:String(n?.text||n?.title||"Node").slice(0,420),
            color:String(n?.color||(safeType==="sticky"?"#fef9c3":T.bg3)),
            textColor:String(n?.textColor||(safeType==="sticky"?"#713f12":T.t0)),
            borderColor:String(n?.borderColor||T.b1),
            fontSize:Number.isFinite(Number(n?.fontSize))?Math.round(Number(n.fontSize)):undefined,
            fontWeight:String(n?.fontWeight||"600"),
          };
        }),
        arrows:inArrows.slice(0,40).map((a,idx)=>({
          id:String(a?.id||`a${idx+1}`),
          fromId:String(a?.fromId||a?.from||""),
          toId:String(a?.toId||a?.to||""),
          label:String(a?.label||""),
        })),
      };
      if(!insertGraphCentered(graph,{tidy:true}))throw new Error("Could not insert generated graph");
      toasts.push("AI board generated","success");
      triggerSparkleFx("AI BOARD READY");
      markOnboardingDone();
    }catch(err){
      toasts.push(`AI generation failed: ${err?.message||"unknown error"}`,"error");
    }finally{
      setQuickAiBusy(false);
    }
  },[insertGraphCentered,markOnboardingDone,quickAiBusy,triggerSparkleFx]);
  useEffect(()=>{
    const onGenerate=e=>{
      const prompt=String(e?.detail?.prompt||"").trim();
      if(prompt)runQuickAiBoard(prompt);
    };
    window.addEventListener("boardai:generate-board",onGenerate);
    return()=>window.removeEventListener("boardai:generate-board",onGenerate);
  },[runQuickAiBoard]);
  const updateTimelineTaskDueDate=useCallback((nodeId,dueDate)=>{
    const node=s.nodes.find(n=>n.id===nodeId);
    if(!node)return;
    const nextDue=normExecDueDate(dueDate);
    const task={
      id:String(node.executionTaskId||node.id),
      title:String(node.executionTitle||String(node.text||"").split("\n")[0]||"Task"),
      description:String(node.executionDescription||""),
      status:normExecStatus(node.executionStatus||node.status),
      owner:String(node.executionOwner||"TBD"),
      priority:normExecPriority(node.executionPriority||node.priority),
      dueDate:nextDue,
      tags:parseExecTags(node.executionTags||node.tags),
      githubUrl:String(node.executionGithubUrl||node.executionIssueUrl||""),
      jiraUrl:String(node.executionJiraUrl||""),
    };
    d({type:"UPD",id:nodeId,p:{
      executionDueDate:nextDue,
      dueDate:nextDue,
      text:composeTaskNodeText(task),
    }});
  },[d,s.nodes]);
  const focusTimelineTask=useCallback((nodeId)=>{
    if(!nodeId)return;
    d({type:"SEL",v:[nodeId]});
    const node=s.nodes.find(n=>n.id===nodeId);
    if(!node)return;
    const cx=(node.x||0)+(node.w||120)/2;
    const cy=(node.y||0)+(node.h||80)/2;
    const tx=window.innerWidth*0.5-cx*s.zoom;
    const ty=window.innerHeight*0.42-cy*s.zoom;
    d({type:"PAN",x:tx,y:ty});
  },[d,s.nodes,s.zoom]);
  const toggleTimeline=useCallback(()=>setTimelineOpen(v=>!v),[]);
  const frames=s.nodes.filter(n=>n.type==="frame");
  const presentFrame=presentMode&&frames.length>0?frames[presentIdx]?.id:null;
  const mobileModeInitRef=useRef(false);
  const mobileBackGuardRef=useRef(false);
  const mobileMode=toolToMode(s.tool);
  const setMobileMode=useCallback((mode)=>{
    const nextTool=modeToTool(mode);
    if(nextTool==="select"){
      d({type:"EXIT_ADD_MODE"});
      return;
    }
    d({type:"TOOL",v:nextTool});
  },[d]);
  const exitMobileMode=useCallback(()=>{
    setMobileMode("navigate");
  },[setMobileMode]);
  const collabUsers=useMemo(()=>{
    const others=Object.values(collabUsersBySocket||{});
    const meSocketId=socket.id||"self";
    return[
      {
        socketId:meSocketId,
        userId:user?.id||null,
        role:"owner",
        isSelf:true,
        name:user?.name||ME.name,
        color:user?.color||ME.color,
        state:myPresence,
        lastActiveAt:Date.now(),
      },
      ...others.filter(entry=>entry&&entry.socketId&&entry.socketId!==meSocketId),
    ];
  },[collabUsersBySocket,myPresence,user?.id,user?.name,user?.color]);
  const collabCursorUsers=useMemo(()=>{
    const meSocketId=socket.id||"self";
    return Object.values(collabUsersBySocket||{}).filter(entry=>{
      if(!entry||entry.socketId===meSocketId)return false;
      return Number.isFinite(Number(entry.x))&&Number.isFinite(Number(entry.y));
    });
  },[collabUsersBySocket]);
  const focusComment=useCallback(comment=>{
    if(!comment)return;
    const nodeId=String(comment.nodeId||"").trim();
    if(!nodeId)return;
    const node=s.nodes.find(n=>n.id===nodeId);
    if(!node)return;
    d({type:"SEL",v:[nodeId]});
    const cx=(node.x||0)+(node.w||120)/2;
    const cy=(node.y||0)+(node.h||80)/2;
    const tx=window.innerWidth*0.5-cx*s.zoom;
    const ty=window.innerHeight*0.42-cy*s.zoom;
    d({type:"PAN",x:tx,y:ty});
  },[d,s.nodes,s.zoom]);
  const deleteComment=useCallback(commentId=>{
    if(!commentId)return;
    d({type:"DEL_COMMENT",id:commentId});
  },[d]);
  const replyComment=useCallback((commentId,text)=>{
    const msg=String(text||"").trim();
    if(!commentId||!msg)return;
    const current=s.comments.find(c=>c.id===commentId);
    if(!current)return;
    const replies=Array.isArray(current.replies)?current.replies:[];
    d({type:"UPDATE_COMMENT",id:commentId,patch:{
      replies:[...replies,{
        id:uid(),
        text:msg,
        author:user?.name||ME.name,
        ts:Date.now(),
      }],
    }});
  },[d,s.comments,user?.name]);
  const handleEmitActivity=useCallback(event=>{
    if(!event||!event.type)return;
    emitActivity?.(event);
  },[emitActivity]);

  useEffect(()=>{
    if(!isMobile){
      setMobileSheet("");
      setMobileArrangeOpen(false);
    }else{
      setShowMinimap(false);
    }
  },[isMobile]);
  useEffect(()=>{if(isMobile)setRightPanelOpen(false);else setRightPanelOpen(true);},[isMobile]);
  useEffect(()=>{if(presentMode)setTimelineOpen(false);},[presentMode]);
  useEffect(()=>{
    if(presentMode){
      setPresence("presenting",{quiet:true});
    }else if(myPresence==="presenting"){
      setPresence("active",{quiet:true});
    }
  },[myPresence,presentMode,setPresence]);
  useEffect(()=>{
    if(isMobile){
      if(!mobileModeInitRef.current){
        mobileModeInitRef.current=true;
        if(toolToMode(s.tool)!=="navigate"){
          d({type:"TOOL",v:"pan"});
        }
      }
      return;
    }
    mobileModeInitRef.current=false;
  },[isMobile,s.tool,d]);

  useEffect(()=>{
    if(!boardId)return undefined;
    const normalizeUserEntry=(socketId,raw={})=>({
      socketId:String(socketId||raw.socketId||""),
      name:String(raw.name||"User"),
      color:String(raw.color||"#94a3b8"),
      userId:raw.userId||null,
      role:String(raw.role||"viewer"),
      state:normalizePresenceState(raw.state||"active"),
      lastActiveAt:Number(raw.lastActiveAt||Date.now()),
      x:Number.isFinite(Number(raw.x))?Number(raw.x):undefined,
      y:Number.isFinite(Number(raw.y))?Number(raw.y):undefined,
      ts:Number(raw.ts||0)||undefined,
    });
    const onUsersInit=list=>{
      const next={};
      (Array.isArray(list)?list:[]).forEach(entry=>{
        const socketId=String(entry?.socketId||"").trim();
        if(!socketId)return;
        next[socketId]=normalizeUserEntry(socketId,entry||{});
      });
      setCollabUsersBySocket(next);
    };
    const onUserJoined=entry=>{
      const socketId=String(entry?.socketId||"").trim();
      if(!socketId)return;
      upsertCollabUser(socketId,normalizeUserEntry(socketId,entry||{}));
      appendActivity({
        id:`join_${socketId}_${Date.now()}`,
        type:"presence.joined",
        entity:"presence",
        message:`${entry?.name||"User"} joined board`,
        actor:{name:String(entry?.name||"User"),color:String(entry?.color||"#94a3b8")},
        ts:Date.now(),
      });
    };
    const onUserLeft=entry=>{
      const socketId=String(entry?.socketId||"").trim();
      const userId=entry?.userId?String(entry.userId):"";
      if(socketId)removeCollabUser(socketId);
      if(!socketId&&userId){
        setCollabUsersBySocket(prev=>{
          const next={...prev};
          for(const key of Object.keys(next)){
            if(String(next[key]?.userId||"")===userId)delete next[key];
          }
          return next;
        });
      }
      appendActivity({
        id:`left_${socketId||userId||Date.now()}_${Date.now()}`,
        type:"presence.left",
        entity:"presence",
        message:"A collaborator left the board",
        ts:Date.now(),
      });
    };
    const onCursorUpdate=entry=>{
      const socketId=String(entry?.socketId||"").trim();
      if(!socketId)return;
      upsertCollabUser(socketId,{
        x:Number(entry?.x||0),
        y:Number(entry?.y||0),
        ts:Date.now(),
        state:"active",
        lastActiveAt:Date.now(),
      });
    };
    const onCursorLeave=entry=>{
      const socketId=String(entry?.socketId||"").trim();
      if(!socketId)return;
      setCollabUsersBySocket(prev=>{
        const cur=prev[socketId];
        if(!cur)return prev;
        const next={...prev};
        next[socketId]={...cur};
        delete next[socketId].x;
        delete next[socketId].y;
        delete next[socketId].ts;
        return next;
      });
    };
    const onUserPresence=entry=>{
      const socketId=String(entry?.socketId||"").trim();
      if(!socketId)return;
      upsertCollabUser(socketId,{
        state:normalizePresenceState(entry?.state),
        lastActiveAt:Number(entry?.lastActiveAt||Date.now()),
      });
    };
    const onBoardActivity=entry=>appendActivity(entry||{});

    socket.on("users:init",onUsersInit);
    socket.on("user:joined",onUserJoined);
    socket.on("user:left",onUserLeft);
    socket.on("cursor:update",onCursorUpdate);
    socket.on("cursor:leave",onCursorLeave);
    socket.on("user:presence",onUserPresence);
    socket.on("board:activity",onBoardActivity);
    return()=>{
      socket.off("users:init",onUsersInit);
      socket.off("user:joined",onUserJoined);
      socket.off("user:left",onUserLeft);
      socket.off("cursor:update",onCursorUpdate);
      socket.off("cursor:leave",onCursorLeave);
      socket.off("user:presence",onUserPresence);
      socket.off("board:activity",onBoardActivity);
    };
  },[appendActivity,boardId,removeCollabUser,upsertCollabUser]);

  useEffect(()=>{
    if(!boardId||presentMode)return undefined;
    const markActive=()=>{
      const now=Date.now();
      presenceLastInteractRef.current=now;
      if(myPresence==="idle"){
        setPresence("active",{quiet:true});
      }
    };
    const onMove=()=>{
      const now=Date.now();
      if(now-presenceMoveThrottleRef.current<1200)return;
      presenceMoveThrottleRef.current=now;
      markActive();
    };
    const onKey=()=>markActive();
    window.addEventListener("pointerdown",markActive,{passive:true});
    window.addEventListener("pointermove",onMove,{passive:true});
    window.addEventListener("keydown",onKey,{passive:true});
    window.addEventListener("touchstart",markActive,{passive:true});
    if(presenceIdleTimerRef.current)clearInterval(presenceIdleTimerRef.current);
    presenceIdleTimerRef.current=setInterval(()=>{
      if(myPresence==="presenting")return;
      const now=Date.now();
      if(now-presenceLastInteractRef.current>45000&&myPresence==="active"){
        setPresence("idle",{quiet:true});
      }
    },7000);
    return()=>{
      window.removeEventListener("pointerdown",markActive);
      window.removeEventListener("pointermove",onMove);
      window.removeEventListener("keydown",onKey);
      window.removeEventListener("touchstart",markActive);
      if(presenceIdleTimerRef.current){
        clearInterval(presenceIdleTimerRef.current);
        presenceIdleTimerRef.current=null;
      }
    };
  },[boardId,myPresence,presentMode,setPresence]);

  // Ctrl+K / Escape
  useEffect(()=>{
    const h=e=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="k"){e.preventDefault();setShowSearch(p=>!p);}
      if(e.key==="Escape"){setShowSearch(false);setShowTpl(false);setMobileSheet("");d({type:"EXIT_ADD_MODE"});}
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[d]);

  useEffect(()=>{
    if(!isMobile||presentMode){
      mobileBackGuardRef.current=false;
      return undefined;
    }
    if(!mobileBackGuardRef.current){
      window.history.pushState({mobileBoardGuard:true,boardId,ts:Date.now()},"",window.location.href);
      mobileBackGuardRef.current=true;
    }
    const onPopState=()=>{
      let handled=false;
      if(mobileArrangeOpen){
        setMobileArrangeOpen(false);
        handled=true;
      }else if(mobileSheet){
        setMobileSheet("");
        handled=true;
      }else if(showSearch||showTpl){
        setShowSearch(false);
        setShowTpl(false);
        handled=true;
      }else if(canvasOverlayOpen){
        window.dispatchEvent(new Event("board:close-transient-ui"));
        handled=true;
      }else if(isAddMode(mobileMode)||isConnectMode(mobileMode)){
        exitMobileMode();
        handled=true;
      }else if(mobileMode==="select"){
        setMobileMode("navigate");
        handled=true;
      }
      if(handled){
        window.history.pushState({mobileBoardGuard:true,boardId,ts:Date.now()},"",window.location.href);
      }else{
        mobileBackGuardRef.current=false;
      }
    };
    window.addEventListener("popstate",onPopState);
    return()=>window.removeEventListener("popstate",onPopState);
  },[isMobile,presentMode,mobileArrangeOpen,mobileSheet,showSearch,showTpl,canvasOverlayOpen,mobileMode,boardId,exitMobileMode,setMobileMode]);

  const focusedFromHealthRef=useRef("");
  useEffect(()=>{
    const url=new URL(window.location.href);
    const focusNodeId=String(url.searchParams.get("focus")||"").trim();
    if(!focusNodeId)return;
    if(focusedFromHealthRef.current===focusNodeId)return;
    const node=s.nodes.find(n=>n.id===focusNodeId);
    if(!node)return;
    focusedFromHealthRef.current=focusNodeId;
    d({type:"SEL",v:[focusNodeId]});
    const cx=(node.x||0)+(node.w||120)/2;
    const cy=(node.y||0)+(node.h||80)/2;
    const tx=window.innerWidth*0.5-cx*s.zoom;
    const ty=window.innerHeight*0.42-cy*s.zoom;
    d({type:"PAN",x:tx,y:ty});
    url.searchParams.delete("focus");
    window.history.replaceState({}, "", url);
    toasts.push("Focused node from execution health","info");
  },[s.nodes,s.zoom,d]);

  function toggleMobileSheetKind(kind){
    setMobileSheet(v=>v===kind?"":kind);
  }

  const applyMobileArrange=useCallback((layout)=>{
    const ids=(Array.isArray(s.sel)?s.sel:[]).filter(Boolean);
    const nodes=s.nodes.filter(n=>ids.includes(n.id)&&!n.locked);
    if(nodes.length<2)return;
    if(layout==="grid"){
      d({type:"TIDY",ids});
      return;
    }
    const gap=56;
    const deltas={};
    if(layout==="horizontal"){
      const sorted=[...nodes].sort((a,b)=>a.x-b.x);
      const baseX=Math.min(...sorted.map(n=>n.x));
      const midY=sorted.reduce((sum,n)=>sum+n.y+(Number(n.h)||80)*0.5,0)/sorted.length;
      let cursor=baseX;
      for(const n of sorted){
        const w=Number(n.w)||120;
        const h=Number(n.h)||80;
        deltas[n.id]={x:cursor,y:Math.round(midY-h*0.5)};
        cursor+=w+gap;
      }
    }else{
      const sorted=[...nodes].sort((a,b)=>a.y-b.y);
      const baseY=Math.min(...sorted.map(n=>n.y));
      const midX=sorted.reduce((sum,n)=>sum+n.x+(Number(n.w)||120)*0.5,0)/sorted.length;
      let cursor=baseY;
      for(const n of sorted){
        const w=Number(n.w)||120;
        const h=Number(n.h)||80;
        deltas[n.id]={x:Math.round(midX-w*0.5),y:cursor};
        cursor+=h+gap;
      }
    }
    d({type:"UPD_MULTI",deltas});
  },[d,s.nodes,s.sel]);
  const runMeetingAssistant=useCallback(async()=>{
    const notes=String(meetingNotes||"").trim();
    if(!notes||meetingBusy)return;
    setMeetingBusy(true);
    try{
      const systemPrompt=[
        "You are a collaborative meeting assistant for an execution board.",
        "Return STRICT JSON object with keys:",
        "summary:string,",
        "tasks:[{title,description,status,owner,priority,dueDate,milestoneId}],",
        "milestones:[{id,title,dueDate}],",
        "decisions:[{decision,date,owner,context,outcome}]",
      ].join(" ");
      const response=await fetch("/api/ai/complete",{
        method:"POST",
        headers:{...api._ah(),"Content-Type":"application/json"},
        body:JSON.stringify({
          systemPrompt,
          userPrompt:notes,
          maxTokens:1200,
        }),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload?.error||`Meeting assistant failed (${response.status})`);
      let parsed=(payload?.json&&typeof payload.json==="object")?payload.json:null;
      if(!parsed){
        const raw=String(payload?.text||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
        const i=raw.indexOf("{");
        const j=raw.lastIndexOf("}");
        parsed=JSON.parse(i!==-1&&j>i?raw.slice(i,j+1):raw);
      }
      const milestones=Array.isArray(parsed?.milestones)?parsed.milestones.slice(0,10):[];
      const tasks=Array.isArray(parsed?.tasks)?parsed.tasks.slice(0,48):[];
      const decisions=Array.isArray(parsed?.decisions)?parsed.decisions.slice(0,16):[];
      setMeetingSuggestions({
        summary:String(parsed?.summary||`Prepared ${tasks.length} tasks, ${milestones.length} milestones and ${decisions.length} decisions.`),
        milestones,
        tasks,
        decisions,
      });
      emitActivity?.({
        type:"meeting.suggestions",
        entity:"meeting",
        message:"Meeting assistant prepared suggestions",
        payload:{tasks:tasks.length,milestones:milestones.length,decisions:decisions.length},
      });
      toasts.push("Meeting suggestions ready","success");
    }catch(err){
      toasts.push(`Meeting assistant failed: ${err?.message||"unknown error"}`,"error");
    }finally{
      setMeetingBusy(false);
    }
  },[emitActivity,meetingBusy,meetingNotes]);
  const applyMeetingSuggestions=useCallback(()=>{
    if(!meetingSuggestions)return;
    const suggestions={
      tasks:Array.isArray(meetingSuggestions.tasks)?meetingSuggestions.tasks.slice(0,48):[],
      milestones:Array.isArray(meetingSuggestions.milestones)?meetingSuggestions.milestones.slice(0,10):[],
      decisions:Array.isArray(meetingSuggestions.decisions)?meetingSuggestions.decisions.slice(0,16):[],
    };
    const centerX=(-s.px+s.zoom*(window.innerWidth*0.5))/s.zoom;
    const centerY=(-s.py+s.zoom*(window.innerHeight*0.42))/s.zoom;
    const milestoneNodes=[];
    const taskNodes=[];
    const decisionNodes=[];
    const arrowsToAdd=[];
    const milestoneById=new Map();
    const mileGapX=320;
    const startMilestoneX=Math.round(centerX-Math.max(0,(suggestions.milestones.length-1))*mileGapX*0.5);
    suggestions.milestones.forEach((entry,idx)=>{
      const milestoneId=String(entry?.id||entry?.title||`m-${idx+1}`);
      const node={
        id:uid(),
        type:"milestone",
        x:startMilestoneX+idx*mileGapX,
        y:Math.round(centerY-280),
        w:300,
        h:156,
        color:"#111827",
        textColor:"#e5e7eb",
        borderColor:"#6366f1",
        fontSize:12,
        fontWeight:"700",
        executionMilestoneId:milestoneId,
        executionMilestone:String(entry?.title||`Milestone ${idx+1}`),
        executionDueDate:normExecDueDate(entry?.dueDate),
      };
      node.text=composeMilestoneNodeText({
        title:node.executionMilestone,
        dueDate:node.executionDueDate,
        progressDone:0,
        progressTotal:0,
      });
      milestoneById.set(milestoneId,node);
      milestoneNodes.push(node);
    });
    const laneCounter={};
    suggestions.tasks.forEach((entry,idx)=>{
      const targetMilestoneId=String(entry?.milestoneId||"").trim();
      const milestoneNode=targetMilestoneId?milestoneById.get(targetMilestoneId):null;
      const column=milestoneNode?milestoneNodes.indexOf(milestoneNode):Math.min(2,Math.floor(idx/6));
      const laneKey=milestoneNode?.id||`free-${column}`;
      laneCounter[laneKey]=(laneCounter[laneKey]||0)+1;
      const row=laneCounter[laneKey]-1;
      const nodeX=Math.round((milestoneNode?milestoneNode.x:startMilestoneX+column*mileGapX));
      const nodeY=Math.round((milestoneNode?milestoneNode.y+190:centerY-40)+row*168);
      const task={
        id:String(entry?.id||uid()),
        title:String(entry?.title||`Task ${idx+1}`),
        description:String(entry?.description||""),
        status:normExecStatus(entry?.status),
        owner:String(entry?.owner||"TBD"),
        priority:normExecPriority(entry?.priority),
        dueDate:normExecDueDate(entry?.dueDate),
        tags:parseExecTags(entry?.tags),
        githubUrl:String(entry?.githubUrl||""),
        jiraUrl:String(entry?.jiraUrl||""),
      };
      const node={
        id:uid(),
        type:"task",
        x:nodeX,
        y:nodeY,
        w:250,
        h:150,
        color:"#0f172a",
        textColor:"#e2e8f0",
        borderColor:task.status==="Blocked"?"#f97316":"#334155",
        fontSize:11,
        fontWeight:"500",
        executionTaskId:task.id,
        executionTitle:task.title,
        executionDescription:task.description,
        executionStatus:task.status,
        executionOwner:task.owner,
        executionPriority:task.priority,
        executionDueDate:task.dueDate,
        executionMilestoneId:milestoneNode?.executionMilestoneId||null,
        executionMilestone:milestoneNode?.executionMilestone||"",
        executionGithubUrl:task.githubUrl,
        executionJiraUrl:task.jiraUrl,
        executionTags:task.tags,
      };
      node.text=composeTaskNodeText(task);
      taskNodes.push(node);
      if(milestoneNode){
        arrowsToAdd.push({
          id:uid(),
          fromId:milestoneNode.id,
          toId:node.id,
          depType:"related",
          label:"related",
        });
      }
    });
    const decisionX=Math.round(startMilestoneX+Math.max(1,milestoneNodes.length)*mileGapX+60);
    suggestions.decisions.forEach((entry,idx)=>{
      const decision={
        id:String(entry?.id||uid()),
        decision:String(entry?.decision||`Decision ${idx+1}`),
        date:normExecDueDate(entry?.date),
        owner:String(entry?.owner||"TBD"),
        context:String(entry?.context||""),
        outcome:String(entry?.outcome||""),
      };
      const node={
        id:uid(),
        type:"decision",
        x:decisionX,
        y:Math.round(centerY-220+idx*172),
        w:280,
        h:152,
        color:"#0f172a",
        textColor:"#e2e8f0",
        borderColor:"#38bdf8",
        fontSize:11,
        fontWeight:"500",
        executionDecisionId:decision.id,
        executionDecision:decision.decision,
        executionDecisionDate:decision.date,
        executionOwner:decision.owner,
        executionContext:decision.context,
        executionOutcome:decision.outcome,
      };
      node.text=composeDecisionNodeText(decision);
      decisionNodes.push(node);
    });
    const all=[...milestoneNodes,...taskNodes,...decisionNodes];
    if(!all.length){
      toasts.push("No meeting suggestions to apply","info");
      return;
    }
    all.forEach(node=>d({type:"ADD",node}));
    arrowsToAdd.forEach(arr=>d({type:"ADD_ARR",arr}));
    const ids=all.map(node=>node.id);
    if(ids.length>1)d({type:"TIDY",ids});
    d({type:"SEL",v:ids.slice(0,12)});
    setMeetingSuggestions(null);
    emitActivity?.({
      type:"meeting.applied",
      entity:"meeting",
      message:`Applied meeting suggestions (${all.length} nodes)`,
      payload:{nodes:all.length,arrows:arrowsToAdd.length},
    });
    toasts.push("Meeting suggestions applied","success");
  },[d,emitActivity,meetingSuggestions,s.px,s.py,s.zoom]);
  const collabModel=useMemo(()=>({
    users:collabUsers,
    presence:myPresence,
    setPresence,
    activity:collabActivity,
    comments:s.comments,
    focusComment,
    deleteComment,
    replyComment,
    meetingNotes,
    setMeetingNotes,
    runMeetingAssistant,
    meetingBusy,
    meetingSuggestions,
    applyMeetingSuggestions,
  }),[applyMeetingSuggestions,collabActivity,collabUsers,deleteComment,focusComment,meetingBusy,meetingNotes,meetingSuggestions,myPresence,replyComment,runMeetingAssistant,s.comments,setPresence]);

  const runMobileAiInsert=useCallback(async()=>{
    const prompt=String(mobileAiPrompt||"").trim();
    if(!prompt||mobileAiBusy)return;
    setMobileAiBusy(true);
    try{
      const systemPrompt=[
        "You are a mobile flow generator.",
        "Return strict JSON object with keys: nodes[], arrows[].",
        "nodes item: { id, type:'node'|'text'|'sticky'|'container', text }.",
        "arrows item: { from, to, label } where from/to reference node ids.",
        "Keep max 14 nodes.",
      ].join(" ");
      const response=await fetch("/api/ai/complete",{
        method:"POST",
        headers:{...api._ah(),"Content-Type":"application/json"},
        body:JSON.stringify({systemPrompt,userPrompt:prompt,maxTokens:900}),
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload?.error||`AI failed (${response.status})`);
      let parsed=(payload?.json&&typeof payload.json==="object")?payload.json:null;
      if(!parsed){
        const text=String(payload?.text||"").trim();
        const raw=text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
        const i=raw.indexOf("{");
        const j=raw.lastIndexOf("}");
        parsed=JSON.parse(i!==-1&&j>i?raw.slice(i,j+1):raw);
      }
      const aiNodes=Array.isArray(parsed?.nodes)?parsed.nodes:[];
      if(!aiNodes.length)throw new Error("AI returned no nodes");
      const centerX=(-s.px+s.zoom*(window.innerWidth*0.5))/s.zoom;
      const centerY=(-s.py+s.zoom*(window.innerHeight*0.42))/s.zoom;
      const idMap={};
      const created=[];
      aiNodes.slice(0,18).forEach((n,idx)=>{
        const localId=uid();
        const type=String(n?.type||"node").toLowerCase();
        const col=idx%4;
        const row=Math.floor(idx/4);
        const x=Math.round(centerX-360+col*220);
        const y=Math.round(centerY-180+row*140);
        let node;
        if(type==="text"){
          node={id:localId,type:"text",x,y,w:200,h:44,text:String(n?.text||"Text"),color:T.t0,textColor:T.t0,fontSize:22,fontWeight:"700"};
        }else if(type==="sticky"){
          const sc=SC[idx%SC.length];
          node={id:localId,type:"sticky",x,y,w:170,h:130,text:String(n?.text||""),color:sc.bg,textColor:sc.t};
        }else if(type==="container"){
          node={id:localId,type:"frame",x,y,w:420,h:280,text:String(n?.text||"Container"),color:"transparent",borderColor:T.b1};
        }else{
          node={id:localId,type:"shape",shapeType:"rect",x,y,w:170,h:88,text:String(n?.text||"Node"),color:T.bg3,textColor:T.t0,borderColor:T.b1,fontSize:13,fontWeight:"600"};
        }
        idMap[String(n?.id||localId)]=localId;
        created.push(node);
      });
      created.forEach(node=>d({type:"ADD",node}));
      const aiArrows=Array.isArray(parsed?.arrows)?parsed.arrows:[];
      aiArrows.slice(0,32).forEach((a,idx)=>{
        const fromId=idMap[String(a?.from||"")]||"";
        const toId=idMap[String(a?.to||"")]||"";
        if(!fromId||!toId||fromId===toId)return;
        d({type:"ADD_ARR",arr:{id:uid(),fromId,toId,label:String(a?.label||"")}});
      });
      const createdIds=created.map(n=>n.id);
      if(createdIds.length>1)d({type:"TIDY",ids:createdIds});
      d({type:"SEL",v:createdIds});
      setMobileAiPrompt("");
      toasts.push("AI flow inserted","success");
      triggerSparkleFx("AI FLOW READY");
    }catch(err){
      toasts.push(`AI insert failed: ${err?.message||"unknown error"}`,"error");
    }finally{
      setMobileAiBusy(false);
    }
  },[d,mobileAiBusy,mobileAiPrompt,s.px,s.py,s.zoom,triggerSparkleFx]);

  useEffect(()=>()=>{
    if(sparkleTimerRef.current){
      clearTimeout(sparkleTimerRef.current);
      sparkleTimerRef.current=null;
    }
  },[]);

  // Saved indicator
  useEffect(()=>{setIsSaved(false);const t=setTimeout(()=>setIsSaved(true),1800);return()=>clearTimeout(t);},[s.nodes,s.arrows]);

  function handleRename(name){
    setBoardName(name);
    api.rename(boardId,name);
    document.title=`${name} · BoardAI`;
  }

  useEffect(()=>{document.title=`${boardName} · BoardAI`;},[boardName]);

  return<>
    <style>{CSS}</style>
    <div style={{display:"flex",flexDirection:"column",height:"100vh",width:"100vw",background:T.bg0}}>
        {!presentMode&&<TopBar onTpl={()=>setShowTpl(o=>!o)} onSearch={()=>setShowSearch(o=>!o)} onPresent={()=>{setPresentMode(true);setPresentIdx(0);}} isSaved={isSaved} boardName={boardName} onRename={handleRename} onBoards={onBoards} isMobile={isMobile} onToggleRight={()=>{if(isMobile)toggleMobileSheetKind("panel");else setRightPanelOpen(v=>!v);}} rightOpen={isMobile?mobileSheet==="panel":rightPanelOpen} onToggleTools={()=>toggleMobileSheetKind("insert")} toolsOpen={mobileSheet==="insert"} onToggleMore={()=>toggleMobileSheetKind("more")} moreOpen={mobileSheet==="more"} themeMode={themeMode} onToggleTheme={onToggleTheme} showMinimap={showMinimap} onToggleMinimap={()=>setShowMinimap(v=>!v)} showTimeline={timelineOpen} onToggleTimeline={toggleTimeline}/>}
      <div style={{display:"flex",flex:1,overflow:"hidden",position:"relative"}}>
        <Canvas
          presentMode={presentMode}
          presentFrame={presentFrame}
          isMobile={isMobile}
          mobileStayInAdd={mobileStayInAdd}
          onOverlayStateChange={setCanvasOverlayOpen}
          collabUsers={collabCursorUsers}
          sheetAiAnomalyMapBySheet={sheetAiAnomalyMapBySheet}
          dataFlowRuntime={dataFlowRuntime}
        />
        {sparkleFx&&<div className="sparkle-fx" style={{position:"absolute",top:84,left:"50%",transform:"translateX(-50%)",zIndex:390,padding:"8px 14px",borderRadius:999,border:"1px solid rgba(250,204,21,.5)",background:"rgba(250,204,21,.12)",color:T.y,fontFamily:"'JetBrains Mono',monospace",fontSize:10.5,fontWeight:700,letterSpacing:".05em",pointerEvents:"none"}}>{sparkleFx.label}</div>}
        {showEmptyBoardPrompt&&<EmptyBoardPromptView
          onGenerateAi={runQuickAiBoard}
          onOpenTemplates={()=>setShowTpl(true)}
          onBrainstorm={startBrainstormNow}
          aiPrompt={quickAiPrompt}
          setAiPrompt={setQuickAiPrompt}
          aiBusy={quickAiBusy}
          T={T}
        />}
        {showOnboardingOverlay&&<EditorOnboardingOverlayView
          isMobile={isMobile}
          onClose={markOnboardingDone}
          onUsePreset={applyQuickStartPreset}
          onOpenTemplates={()=>setShowTpl(true)}
          onGenerateAi={runQuickAiBoard}
          aiPrompt={quickAiPrompt}
          setAiPrompt={setQuickAiPrompt}
          aiBusy={quickAiBusy}
          quickStartPresets={QUICK_START_PRESETS}
          T={T}
        />}
        {!presentMode&&timelineOpen&&<ExecutionTimelineOverlay
          open={timelineOpen}
          onClose={()=>setTimelineOpen(false)}
          T={T}
          tasks={executionSnapshot.tasks}
          milestones={executionSnapshot.milestones}
          onUpdateDueDate={updateTimelineTaskDueDate}
          onFocusTask={focusTimelineTask}
        />}
        {!presentMode&&<Toolbar isMobile={false} hidden={isMobile}/>}
        {!presentMode&&!isMobile&&<LeftToolbar s={s} d={d} uid={uid} onOpenTemplates={()=>setShowTpl(true)} notify={(msg,type)=>toasts.push(msg,type)}/>}
        {!presentMode&&!isMobile&&showMinimap&&<Minimap onClose={()=>setShowMinimap(false)} rightInset={rightPanelOpen?344:12}/>}
        {!presentMode&&!isMobile&&<AlignPanel/>}
        {!isMobile&&<Timer/>}
        {showTpl&&!presentMode&&<TplPanel
          onClose={()=>setShowTpl(false)}
          isMobile={isMobile}
          currentUser={user}
          onOpenBoard={(board)=>{
            if(!board?.id)return;
            const u=new URL(window.location.href);
            u.searchParams.set("board",String(board.id));
            u.searchParams.delete("focus");
            window.location.assign(u.toString());
          }}
        />}
        {showSearch&&!presentMode&&<SearchPanel onClose={()=>setShowSearch(false)}/>}
        {presentMode&&<PresentBarView onExit={()=>setPresentMode(false)} frames={frames} curIdx={presentIdx} setCurIdx={setPresentIdx} T={T}/>}
        {!presentMode&&!isMobile&&rightPanelOpen&&<RightPanel s={s} d={d} T={T} SC={SC} uid={uid} SHAPE_TYPES={SHAPE_TYPES} SHAPE_DEFAULTS={SHAPE_DEFAULTS} getTableInfo={getTableInfo} TABLE_DEFAULT_COL_WIDTH={TABLE_DEFAULT_COL_WIDTH} TABLE_MIN_COLS={TABLE_MIN_COLS} TABLE_MIN_ROWS={TABLE_MIN_ROWS} TABLE_MIN_COL_WIDTH={TABLE_MIN_COL_WIDTH} TABLE_MAX_COL_WIDTH={TABLE_MAX_COL_WIDTH} boardId={boardId} historyApi={historyApi} accessApi={accessApi} auditApi={auditApi} githubApi={githubApi} jiraApi={jiraApi} currentUser={user} onRestoreVersion={applyRestoredState} notify={(msg,type)=>toasts.push(msg,type)} onToggleTimeline={toggleTimeline} timelineOpen={timelineOpen} collab={collabModel} onEmitActivity={handleEmitActivity} panelWidth={324} topOffset={56} rightInset={12} onRequestClose={()=>setRightPanelOpen(false)} onSpreadsheetAnomalyMapChange={updateSheetAiAnomalyMap} selectedConnector={selectedConnector} onUpdateConnector={(id,patch)=>d({type:"UPD_ARR",id,p:patch})} onDeleteConnector={(id)=>{d({type:"DEL_ARR",id});setSelectedConnectorId("");}}/>}
        {!presentMode&&isMobile&&!mobileSheet&&s.sel.length>0&&<MobileQuickActionsBar
          visible
          onDuplicate={()=>d({type:"DUP"})}
          onStyle={()=>toggleMobileSheetKind("panel")}
          onConnect={()=>setMobileMode("connect")}
          canArrange={s.sel.length>1}
          onArrange={()=>setMobileArrangeOpen(true)}
          onDelete={()=>d({type:"DEL",ids:s.sel})}
        />}
        {!presentMode&&isMobile&&!mobileSheet&&<MobileBottomBar
          tool={s.tool}
          canUndo={Boolean(s.hist?.length)}
          onToggleMode={()=>{
            if(mobileMode==="navigate")setMobileMode("select");
            else setMobileMode("navigate");
          }}
          onOpenInsert={()=>toggleMobileSheetKind("insert")}
          onToggleConnect={()=>{
            if(isConnectMode(mobileMode))setMobileMode(nextModeAfterConnect());
            else setMobileMode("connect");
          }}
          onUndo={()=>d({type:"UNDO"})}
          onOpenPanel={()=>toggleMobileSheetKind("panel")}
          onOpenMore={()=>toggleMobileSheetKind("more")}
          onExitMode={exitMobileMode}
        />}
        {!presentMode&&isMobile&&mobileSheet==="insert"&&<MobileBottomSheet open title="Insert & Tools" subtitle="Mobile creation tools" onClose={()=>setMobileSheet("")} T={T} zIndex={280}>
          <RightToolPanel s={s} d={d} uid={uid} onOpenTemplates={()=>{setShowTpl(true);setMobileSheet("");}} notify={(msg,type)=>toasts.push(msg,type)} onRequestClose={()=>setMobileSheet("")} isMobile embedded/>
        </MobileBottomSheet>}
        {!presentMode&&isMobile&&mobileSheet==="panel"&&<MobileBottomSheet open title="Inspector & AI" subtitle="Properties, history, access, AI" onClose={()=>setMobileSheet("")} T={T} zIndex={280}>
          <RightPanel s={s} d={d} T={T} SC={SC} uid={uid} SHAPE_TYPES={SHAPE_TYPES} SHAPE_DEFAULTS={SHAPE_DEFAULTS} getTableInfo={getTableInfo} TABLE_DEFAULT_COL_WIDTH={TABLE_DEFAULT_COL_WIDTH} TABLE_MIN_COLS={TABLE_MIN_COLS} TABLE_MIN_ROWS={TABLE_MIN_ROWS} TABLE_MIN_COL_WIDTH={TABLE_MIN_COL_WIDTH} TABLE_MAX_COL_WIDTH={TABLE_MAX_COL_WIDTH} boardId={boardId} historyApi={historyApi} accessApi={accessApi} auditApi={auditApi} githubApi={githubApi} jiraApi={jiraApi} currentUser={user} onRestoreVersion={applyRestoredState} notify={(msg,type)=>toasts.push(msg,type)} onToggleTimeline={toggleTimeline} timelineOpen={timelineOpen} collab={collabModel} onEmitActivity={handleEmitActivity} panelWidth="100%" fill onSpreadsheetAnomalyMapChange={updateSheetAiAnomalyMap} selectedConnector={selectedConnector} onUpdateConnector={(id,patch)=>d({type:"UPD_ARR",id,p:patch})} onDeleteConnector={(id)=>{d({type:"DEL_ARR",id});setSelectedConnectorId("");}}/>
        </MobileBottomSheet>}
        {!presentMode&&isMobile&&mobileSheet==="more"&&<MobileBottomSheet open title="More Actions" subtitle="Board and view actions" onClose={()=>setMobileSheet("")} T={T} zIndex={280} snapPoints={[0.24,0.42,0.68]}>
          <div style={{padding:"10px",display:"grid",gap:8}}>
            <button onClick={()=>{setMobileSheet("");setShowSearch(true);}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>Search (Ctrl+K)</button>
            <button onClick={()=>{setMobileSheet("");setShowTpl(true);}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>Templates</button>
            <button onClick={()=>{setTimelineOpen(v=>!v);}} style={{minHeight:44,borderRadius:10,border:`1px solid ${timelineOpen?T.yDim:T.b1}`,background:timelineOpen?T.yBg:T.bg2,color:timelineOpen?T.y:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>{timelineOpen?"Hide Timeline":"Show Timeline"}</button>
            <button onClick={()=>{d({type:"SNAP_TOGGLE"});}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>{s.snapGrid?"Disable Grid":"Enable Grid"}</button>
            <button onClick={()=>{d({type:"ZOOM_FIT",vw:window.innerWidth,vh:window.innerHeight-46});}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>Fit to Screen</button>
            <button onClick={()=>{onToggleTheme?.();}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>{themeMode==="dark"?"Switch to Light":"Switch to Dark"}</button>
            {s.sel.length>1&&<button onClick={()=>{setMobileArrangeOpen(true);setMobileSheet("");}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>Auto Arrange Selection</button>}
            <button onClick={()=>setMobileStayInAdd(v=>!v)} style={{minHeight:44,borderRadius:10,border:`1px solid ${mobileStayInAdd?T.yDim:T.b1}`,background:mobileStayInAdd?T.yBg:T.bg2,color:mobileStayInAdd?T.y:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>
              Stay in add mode: {mobileStayInAdd?"ON":"OFF"}
            </button>
            {(isAddMode(mobileMode)||isConnectMode(mobileMode)||mobileMode==="select")&&<button onClick={exitMobileMode} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t1,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>Cancel Current Mode</button>}
            <div style={{display:"grid",gap:6,padding:"8px 6px",border:`1px solid ${T.b0}`,borderRadius:10,background:T.bg2}}>
              <div style={{fontSize:10.5,color:T.t2,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>AI Quick Insert</div>
              <input value={mobileAiPrompt} onChange={e=>setMobileAiPrompt(e.target.value)} placeholder="ex: User onboarding flow" style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg1,color:T.t0,padding:"0 10px",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}/>
              <button onClick={runMobileAiInsert} disabled={mobileAiBusy||!String(mobileAiPrompt||"").trim()} style={{minHeight:44,borderRadius:10,border:`1px solid ${mobileAiBusy||!String(mobileAiPrompt||"").trim()?T.b1:T.yDim}`,background:mobileAiBusy||!String(mobileAiPrompt||"").trim()?T.bg3:T.yBg,color:mobileAiBusy||!String(mobileAiPrompt||"").trim()?T.t2:T.y,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:mobileAiBusy||!String(mobileAiPrompt||"").trim()?"not-allowed":"pointer",fontWeight:700}}>
                {mobileAiBusy?"Generating...":"Generate Flow"}
              </button>
            </div>
            <button onClick={()=>setMobileSheet("")} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.yDim}`,background:T.yBg,color:T.y,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer",fontWeight:700}}>Done</button>
          </div>
        </MobileBottomSheet>}
        {!presentMode&&isMobile&&mobileArrangeOpen&&<MobileBottomSheet open title="Auto Arrange" subtitle="Selection layout options" onClose={()=>setMobileArrangeOpen(false)} T={T} zIndex={285} snapPoints={[0.24,0.4,0.6]}>
          <div style={{padding:"10px",display:"grid",gap:8}}>
            <button onClick={()=>{applyMobileArrange("vertical");setMobileArrangeOpen(false);}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>Vertical Flow</button>
            <button onClick={()=>{applyMobileArrange("horizontal");setMobileArrangeOpen(false);}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>Horizontal Flow</button>
            <button onClick={()=>{applyMobileArrange("grid");setMobileArrangeOpen(false);}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>Grid</button>
            <button onClick={()=>setMobileArrangeOpen(false)} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.yDim}`,background:T.yBg,color:T.y,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer",fontWeight:700}}>Done</button>
          </div>
        </MobileBottomSheet>}
      </div>
    </div>
  </>;
}






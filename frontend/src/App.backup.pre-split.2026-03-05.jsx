import { useState, useRef, useCallback, useEffect, createContext, useContext, useReducer } from "react";
import { io } from "socket.io-client";
import { useMemo } from "react";
import RightPanel from "./components/RightPanel";
import RightToolPanel from "./components/RightToolPanel";
import ContextMenu from "./components/context-menu/ContextMenu";
import MobileBottomSheet from "./components/MobileBottomSheet";
import MobileRadialMenu from "./components/MobileRadialMenu";
import ExecutionTimelineOverlay from "./components/ExecutionTimelineOverlay";
import TemplateMarketplacePanel from "./components/TemplateMarketplacePanel";
import { buildContextMenu } from "./components/context-menu/menuBuilder";
import { createInputController } from "./lib/input/inputController";
import { isAddMode, isConnectMode, modeToTool, nextModeAfterAdd, nextModeAfterConnect, toolToMode } from "./lib/input/modeController";
import { DEFAULT_PORTS, getPortWorldPosition, getAnchorWorldPosition, normalizeConnectorEndpoints } from "./lib/geometry/connectors/anchors";
import { connectorCapMarkerId, dashArrayForStyle, normalizeConnectorDefaultStyle, normalizeConnectorJumpStyle, normalizeConnectorRouting, normalizeConnectorStyle, reverseConnector } from "./lib/geometry/connectors/model";
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

const CONNECTOR_DEFAULT_STORAGE_KEY="pd.board.connector.defaultStyle.v1";
const CONNECTOR_REMEMBER_LAST_STORAGE_KEY="pd.board.connector.rememberLast.v1";
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

function loadStoredConnectorDefaultStyle(){
  try{
    const raw=localStorage.getItem(CONNECTOR_DEFAULT_STORAGE_KEY);
    if(!raw)return normalizeConnectorDefaultStyle({});
    return normalizeConnectorDefaultStyle(JSON.parse(raw));
  }catch{
    return normalizeConnectorDefaultStyle({});
  }
}

function saveStoredConnectorDefaultStyle(preset){
  try{
    localStorage.setItem(CONNECTOR_DEFAULT_STORAGE_KEY,JSON.stringify(normalizeConnectorDefaultStyle(preset)));
  }catch{
    // ignore storage quota errors
  }
}

function loadStoredRememberLastConnectorStyle(){
  try{
    const raw=localStorage.getItem(CONNECTOR_REMEMBER_LAST_STORAGE_KEY);
    if(raw===null)return true;
    return raw!=="0";
  }catch{
    return true;
  }
}

function saveStoredRememberLastConnectorStyle(value){
  try{
    localStorage.setItem(CONNECTOR_REMEMBER_LAST_STORAGE_KEY,value?"1":"0");
  }catch{
    // ignore storage quota errors
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
  const rows=Math.max(1,Math.min(300,Number(node.sheetRows)||12));
  const cols=Math.max(1,Math.min(52,Number(node.sheetCols)||6));
  const cellW=Math.max(68,Math.min(300,Number(node.sheetCellW)||118));
  const rowH=Math.max(24,Math.min(80,Number(node.sheetRowH)||32));
  const activeKey=String(node.sheetActive||"1,0");
  const ar=Math.max(0,Math.min(rows-1,parseInt(activeKey.split(",")[0],10)||0));
  const ac=Math.max(0,Math.min(cols-1,parseInt(activeKey.split(",")[1],10)||0));
  const selectedKey=sheetCellKey(ar,ac);
  const rawActive=String(node.sheetCells?.[selectedKey]??"");
  const localEngine=useMemo(()=>createSpreadsheetEngine({nodes:[node],arrows:[]}),[node]);
  const engine=spreadsheetEngine||localEngine;
  const flow=useMemo(()=>{
    if(engine&&typeof engine.getSheetFlow==="function")return engine.getSheetFlow(node.id);
    return{incoming:0,outgoing:0,incomingEdges:[],outgoingEdges:[]};
  },[engine,node.id]);
  const[editingKey,setEditingKey]=useState(null);
  const[editingValue,setEditingValue]=useState("");
  const[barValue,setBarValue]=useState(rawActive);
  const[barFocused,setBarFocused]=useState(false);
  const sessionIdRef=useRef("");

  useEffect(()=>{if(!editingKey)setBarValue(rawActive);},[rawActive,editingKey,node.id]);

  const withSelection=patch=>onUpd(node.id,patch);
  const setActive=(r,c)=>withSelection({sheetActive:sheetCellKey(r,c)});
  const writeCell=(r,c,val)=>{
    if(node.locked)return;
    const key=sheetCellKey(r,c);
    const next={...(node.sheetCells||{})};
    const v=String(val??"");
    if(v.length)next[key]=v;
    else delete next[key];
    withSelection({sheetCells:next,sheetActive:key});
  };
  const commitEditing=()=>{
    if(!editingKey)return;
    const bits=editingKey.split(",");
    writeCell(parseInt(bits[0],10)||0,parseInt(bits[1],10)||0,editingValue);
    setEditingKey(null);
  };
  const resizeSheet=(nextRows,nextCols)=>{
    if(node.locked)return;
    const nr=Math.max(1,Math.min(400,nextRows));
    const nc=Math.max(1,Math.min(52,nextCols));
    const nextCells={};
    Object.entries(node.sheetCells||{}).forEach(([key,val])=>{
      const bits=key.split(",");
      const r=parseInt(bits[0],10);
      const c=parseInt(bits[1],10);
      if(Number.isInteger(r)&&Number.isInteger(c)&&r>=0&&c>=0&&r<nr&&c<nc)nextCells[key]=val;
    });
    const nAr=Math.min(nr-1,ar);
    const nAc=Math.min(nc-1,ac);
    withSelection({sheetRows:nr,sheetCols:nc,sheetCells:nextCells,sheetActive:sheetCellKey(nAr,nAc)});
  };

  const isFormulaEditing=Boolean((editingKey&&String(editingValue||"").trim().startsWith("="))||(barFocused&&String(barValue||"").trim().startsWith("=")));
  const activeFormulaInput=editingKey?editingValue:barValue;
  const referencedSheetIds=useMemo(()=>{
    if(!isFormulaEditing||!engine||typeof engine.getReferencedSheetIds!=="function")return[];
    return engine.getReferencedSheetIds(activeFormulaInput,node.id);
  },[activeFormulaInput,engine,isFormulaEditing,node.id]);
  const referencedSheetKey=referencedSheetIds.join("|");

  useEffect(()=>{
    if(typeof onFormulaSessionChange!=="function")return;
    if(isFormulaEditing){
      if(!sessionIdRef.current)sessionIdRef.current=`sheet_formula_${node.id}_${Date.now()}_${Math.floor(Math.random()*10000)}`;
      onFormulaSessionChange({
        active:true,
        sessionId:sessionIdRef.current,
        sourceSheetId:node.id,
        referencedSheetIds,
      });
      return;
    }
    if(sessionIdRef.current){
      onFormulaSessionChange({
        active:false,
        sessionId:sessionIdRef.current,
        sourceSheetId:node.id,
        referencedSheetIds:[],
      });
      sessionIdRef.current="";
    }
  },[isFormulaEditing,node.id,onFormulaSessionChange,referencedSheetKey]);

  useEffect(()=>()=>{
    if(typeof onFormulaSessionChange!=="function")return;
    if(!sessionIdRef.current)return;
    onFormulaSessionChange({
      active:false,
      sessionId:sessionIdRef.current,
      sourceSheetId:node.id,
      referencedSheetIds:[],
    });
    sessionIdRef.current="";
  },[node.id,onFormulaSessionChange]);

  useEffect(()=>{
    const pick=formulaPick;
    if(!pick||!pick.sessionId||!sessionIdRef.current)return;
    if(pick.sessionId!==sessionIdRef.current)return;
    const token=String(pick.token||"").trim();
    if(!token)return;
    if(editingKey){
      setEditingValue(prev=>appendFormulaReference(prev,token));
    }else{
      setBarValue(prev=>appendFormulaReference(prev,token));
      setBarFocused(true);
    }
    if(typeof onConsumeFormulaPick==="function"&&pick.id){
      onConsumeFormulaPick(pick.id);
    }
  },[editingKey,formulaPick,onConsumeFormulaPick]);

  const formulaSessionActive=Boolean(formulaSession?.active&&formulaSession?.sessionId&&typeof onFormulaReferencePick==="function");
  const requestReferencePick=(r,c)=>{
    if(!formulaSessionActive)return false;
    const localRef=`${sheetColLabel(c)}${r+1}`;
    const token=formulaSession?.sourceSheetId===node.id
      ?localRef
      :buildSheetReferenceToken(node,r,c);
    onFormulaReferencePick({
      id:`sheet_ref_pick_${Date.now()}_${Math.floor(Math.random()*10000)}`,
      sessionId:formulaSession.sessionId,
      token,
      targetSheetId:node.id,
      targetCell:sheetCellKey(r,c),
    });
    return true;
  };

  const borderColor=sel
    ?T.y
    :(formulaSource?"#22d3ee":(formulaHighlight?"#38bdf8":(node.borderColor||T.b1)));
  const boxShadow=sel
    ?`0 0 0 2px ${T.y},0 10px 26px rgba(0,0,0,.28)`
    :(formulaSource
      ?"0 0 0 2px rgba(34,211,238,.35),0 10px 26px rgba(0,0,0,.28)"
      :(formulaHighlight
        ?"0 0 0 2px rgba(56,189,248,.26),0 8px 24px rgba(0,0,0,.22)"
        :"0 8px 24px rgba(0,0,0,.22)"));

  return<div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel?"1":"0"} className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey,e.altKey);}}
    onTouchStart={e=>{if(onTouchSel){onTouchSel(e,node.id);return;}e.stopPropagation();onSel(node.id,false,false);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,zIndex:node.zIndex||0,opacity:(node.opacity??1)*depFade,background:T.bg1,border:`2px solid ${borderColor}`,borderRadius:10,boxShadow,cursor:node.locked?"default":"move",display:"flex",flexDirection:"column",overflow:"hidden",transform:node.rotation?`rotate(${node.rotation}deg)`:undefined}}>
    <div data-sheet-ui="1" onMouseDown={e=>e.stopPropagation()} style={{height:34,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px",background:T.bg3,borderBottom:`1px solid ${T.b1}`,gap:8}}>
      <div style={{fontSize:11,fontWeight:700,color:T.t0,fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{node.text||"Spreadsheet"}</div>
      <div style={{fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace",marginLeft:"auto"}}>
        {`out:${flow.outgoing||0} in:${flow.incoming||0}`}
      </div>
      <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
        <button onClick={e=>{e.stopPropagation();resizeSheet(rows+1,cols);}} style={{height:22,padding:"0 6px",border:`1px solid ${T.b1}`,background:T.bg1,color:T.t0,borderRadius:4,fontSize:10,cursor:node.locked?"not-allowed":"pointer"}} disabled={node.locked}>+R</button>
        <button onClick={e=>{e.stopPropagation();resizeSheet(rows-1,cols);}} style={{height:22,padding:"0 6px",border:`1px solid ${T.b1}`,background:T.bg1,color:T.t0,borderRadius:4,fontSize:10,cursor:node.locked?"not-allowed":"pointer"}} disabled={node.locked||rows<=1}>-R</button>
        <button onClick={e=>{e.stopPropagation();resizeSheet(rows,cols+1);}} style={{height:22,padding:"0 6px",border:`1px solid ${T.b1}`,background:T.bg1,color:T.t0,borderRadius:4,fontSize:10,cursor:node.locked?"not-allowed":"pointer"}} disabled={node.locked}>+C</button>
        <button onClick={e=>{e.stopPropagation();resizeSheet(rows,cols-1);}} style={{height:22,padding:"0 6px",border:`1px solid ${T.b1}`,background:T.bg1,color:T.t0,borderRadius:4,fontSize:10,cursor:node.locked?"not-allowed":"pointer"}} disabled={node.locked||cols<=1}>-C</button>
      </div>
    </div>
    <div data-sheet-ui="1" onMouseDown={e=>e.stopPropagation()} style={{height:30,display:"flex",alignItems:"center",gap:8,padding:"0 8px",borderBottom:`1px solid ${T.b1}`,background:T.bg2}}>
      <span style={{fontSize:10,fontFamily:"'JetBrains Mono',monospace",color:T.t1,minWidth:56}}>{`${sheetColLabel(ac)}${ar+1}`}</span>
      <input value={barValue} onFocus={()=>setBarFocused(true)} onChange={e=>setBarValue(e.target.value)} onBlur={()=>{setBarFocused(false);writeCell(ar,ac,barValue);}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();writeCell(ar,ac,barValue);}if(e.key==="Escape"){e.preventDefault();setBarValue(rawActive);}}}
        disabled={node.locked}
        style={{flex:1,height:22,background:T.bg1,border:`1px solid ${T.b1}`,borderRadius:4,padding:"0 7px",fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.t0,outline:"none"}}/>
      {isFormulaEditing&&<span style={{fontSize:10,color:"#22d3ee",fontFamily:"'JetBrains Mono',monospace"}}>pick refs</span>}
    </div>
    <div data-sheet-ui="1" onMouseDown={e=>e.stopPropagation()} style={{flex:1,overflow:"auto",background:T.bg1}}>
      <table style={{borderCollapse:"collapse",width:"max-content",minWidth:"100%"}}>
        <thead>
          <tr>
            <th style={{position:"sticky",left:0,top:0,zIndex:4,width:42,minWidth:42,maxWidth:42,background:T.bg3,border:`1px solid ${T.b1}`,fontSize:10,color:T.t1,fontFamily:"'JetBrains Mono',monospace"}}>#</th>
            {Array.from({length:cols},(_,c)=><th key={`h-${c}`} style={{position:"sticky",top:0,zIndex:3,minWidth:cellW,maxWidth:cellW,width:cellW,background:T.bg3,border:`1px solid ${T.b1}`,fontSize:10,color:T.t1,fontFamily:"'JetBrains Mono',monospace"}}>{sheetColLabel(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({length:rows},(_,r)=><tr key={`r-${r}`}>
            <td style={{position:"sticky",left:0,zIndex:2,width:42,minWidth:42,maxWidth:42,background:T.bg2,border:`1px solid ${T.b0}`,textAlign:"center",fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{r+1}</td>
            {Array.from({length:cols},(_,c)=>{
              const key=sheetCellKey(r,c);
              let info={raw:"",display:"",num:0,error:false,errorCode:""};
              try{
                info=engine.evaluateCell(node.id,r,c);
              }catch{
                info={raw:"",display:"#REF!",num:0,error:true,errorCode:"REF"};
              }
              const isActive=key===selectedKey;
              const isEditing=editingKey===key;
              const anomalySeverity=String(anomalyMap?.[key]||"").toLowerCase();
              const anomalyBg=anomalySeverity==="high"
                ?"rgba(239,68,68,.18)"
                :anomalySeverity==="medium"
                  ?"rgba(250,204,21,.16)"
                  :anomalySeverity==="low"
                    ?"rgba(148,163,184,.14)"
                    :"";
              const anomalyOutline=anomalySeverity==="high"
                ?"rgba(239,68,68,.7)"
                :anomalySeverity==="medium"
                  ?"rgba(250,204,21,.65)"
                  :anomalySeverity==="low"
                    ?"rgba(148,163,184,.5)"
                    :"";
              return<td key={key} onMouseDown={e=>{e.stopPropagation();if(formulaSessionActive)return;onSel(node.id,false,false);}} onClick={e=>{e.stopPropagation();if(requestReferencePick(r,c))return;setActive(r,c);}} onDoubleClick={e=>{e.stopPropagation();if(node.locked)return;if(requestReferencePick(r,c))return;setActive(r,c);setEditingKey(key);setEditingValue(String(node.sheetCells?.[key]??""));}}
                style={{minWidth:cellW,maxWidth:cellW,width:cellW,height:rowH,border:`1px solid ${T.b0}`,padding:"0 6px",background:isActive?T.yBg:(anomalyBg||T.bg1),boxShadow:isActive?`inset 0 0 0 1px ${T.yDim}`:(anomalyOutline?`inset 0 0 0 1px ${anomalyOutline}`:"none"),color:info.error?T.red:T.t0,fontSize:11,fontFamily:"'JetBrains Mono',monospace",cursor:"cell"}}>
                {isEditing
                  ?<input autoFocus value={editingValue} onChange={e=>setEditingValue(e.target.value)} onBlur={commitEditing} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();commitEditing();}if(e.key==="Escape"){e.preventDefault();setEditingKey(null);setEditingValue(String(node.sheetCells?.[key]??""));}}}
                    style={{width:"100%",height:"100%",border:"none",outline:"none",background:"transparent",fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.t0}}/>
                  :<span>{info.display}</span>}
              </td>;
            })}
          </tr>)}
        </tbody>
      </table>
    </div>
    {sel&&!node.locked&&<><RH nodeId={node.id} onStart={onRSt}/><RotH nodeId={node.id} onStart={onRotSt}/></>}
  </div>;
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
   LASSO SELECTION RECT
------------------------------------------------------------ */
function Lasso({l}){
  if(!l)return null;
  const x=Math.min(l.x1,l.x2),y=Math.min(l.y1,l.y2),w=Math.abs(l.x2-l.x1),h=Math.abs(l.y2-l.y1);
  return<div style={{position:"absolute",left:x,top:y,width:w,height:h,border:`1.5px dashed ${T.y}`,background:"rgba(250,204,21,.04)",borderRadius:4,pointerEvents:"none",zIndex:100}}/>;
}

/* ------------------------------------------------------------
   CANVAS
------------------------------------------------------------ */
function Canvas({presentMode,presentFrame,isMobile=false,mobileStayInAdd=false,onOverlayStateChange,collabUsers=[],sheetAiAnomalyMapBySheet={},dataFlowRuntime=null}){
  const{s,d,boardId}=useWB();
  const{nodes,arrows,sel,tool,zoom,px,py,arrowFrom,comments,drawings,votes,snapGrid,depMode,bgColor,autoReturnToSelect}=s;
  const wRef=useRef(null);
  const drag=useRef({type:"none",sx:0,sy:0,px0:0,py0:0,nid:"",nx0:0,ny0:0,nw0:0,nh0:0,dir:""});
  const moved=useRef(false);
  const dPath=useRef([]);
  const dColor=useRef(T.y);
  const[livePath,setLivePath]=useState([]);
  const[lasso,setLasso]=useState(null);
  const[ctxMenu,setCtxMenu]=useState(null);
  const[mobileCtxMenu,setMobileCtxMenu]=useState(null);
  const[radialMenu,setRadialMenu]=useState(null);
  const[commentInput,setCommentInput]=useState(null);
  const[selectedArrow,setSelectedArrow]=useState(null);
  const[selectedConnectorIds,setSelectedConnectorIds]=useState([]);
  const[hoveredConnectorId,setHoveredConnectorId]=useState("");
  const[guides,setGuides]=useState([]);
  const[nodeDragActive,setNodeDragActive]=useState(false);
  const[hoverNodeId,setHoverNodeId]=useState("");
  const[smartConnectSuggestion,setSmartConnectSuggestion]=useState(null);
  const[portConnect,setPortConnect]=useState(null);
  const[mobileInlineEdit,setMobileInlineEdit]=useState(null);
  const[connectorSnapFx,setConnectorSnapFx]=useState(null);
  const[taskSuccessFx,setTaskSuccessFx]=useState(null);
  const[routeNodes,setRouteNodes]=useState(nodes);
  const[connectorDefaults,setConnectorDefaults]=useState(()=>loadStoredConnectorDefaultStyle());
  const[rememberLastConnectorStyle,setRememberLastConnectorStyle]=useState(()=>loadStoredRememberLastConnectorStyle());
  const[jumpConnectorSource,setJumpConnectorSource]=useState([]);
  const[sheetFormulaSession,setSheetFormulaSession]=useState(null);
  const[sheetFormulaPick,setSheetFormulaPick]=useState(null);
  const cmtRef=useRef(null);
  const pinch=useRef(null);
  const mobileInputRef=useRef(null);
  const mobilePointerCaptureRef=useRef({active:false,pointerId:null});
  const touchMoveRafRef=useRef(0);
  const touchMovePendingRef=useRef(null);
  const mouseMoveRafRef=useRef(0);
  const mouseMovePendingRef=useRef(null);
  const touchMetaRef=useRef({targetType:"canvas",targetNodeId:""});
  const cursorEmitRef=useRef({ts:0});
  const ctxUploadRef=useRef(null);
  const ctxUploadPosRef=useRef(null);
  const connectorSnapTimerRef=useRef(null);
  const taskSuccessTimerRef=useRef(null);
  const connectorDefaultsRef=useRef(connectorDefaults);

  if(!mobileInputRef.current){
    mobileInputRef.current=createInputController({
      longPressMs:400,
      moveTolerance:10,
    });
  }

  useEffect(()=>()=>{
    if(touchMoveRafRef.current){
      window.cancelAnimationFrame(touchMoveRafRef.current);
      touchMoveRafRef.current=0;
      touchMovePendingRef.current=null;
    }
    if(mouseMoveRafRef.current){
      window.cancelAnimationFrame(mouseMoveRafRef.current);
      mouseMoveRafRef.current=0;
      mouseMovePendingRef.current=null;
    }
    if(connectorSnapTimerRef.current){
      clearTimeout(connectorSnapTimerRef.current);
      connectorSnapTimerRef.current=null;
    }
    if(taskSuccessTimerRef.current){
      clearTimeout(taskSuccessTimerRef.current);
      taskSuccessTimerRef.current=null;
    }
  },[]);

  const toW=(cx,cy)=>{const r=wRef.current.getBoundingClientRect();return{x:(cx-r.left-px)/zoom,y:(cy-r.top-py)/zoom};};

  const triggerTaskSuccessFx=useCallback((node)=>{
    if(!node)return;
    const x=(Number(node.x)||0)+(Number(node.w)||120)-18;
    const y=(Number(node.y)||0)-14;
    setTaskSuccessFx({x,y,id:Date.now()});
    if(taskSuccessTimerRef.current)clearTimeout(taskSuccessTimerRef.current);
    taskSuccessTimerRef.current=setTimeout(()=>{
      setTaskSuccessFx(null);
      taskSuccessTimerRef.current=null;
    },650);
  },[]);

  useEffect(()=>{
    const timer=setTimeout(()=>setRouteNodes(nodes),96);
    return()=>clearTimeout(timer);
  },[nodes]);

  useEffect(()=>{
    const normalized=normalizeConnectorDefaultStyle(connectorDefaults);
    connectorDefaultsRef.current=normalized;
    saveStoredConnectorDefaultStyle(normalized);
  },[connectorDefaults]);

  useEffect(()=>{
    saveStoredRememberLastConnectorStyle(rememberLastConnectorStyle);
  },[rememberLastConnectorStyle]);

  const connectorPresetFromConnector=useCallback(connector=>{
    if(!connector)return normalizeConnectorDefaultStyle(connectorDefaultsRef.current);
    return normalizeConnectorDefaultStyle({
      routing:connector.routing,
      style:normalizeConnectorStyle(connector),
      jumpStyle:normalizeConnectorJumpStyle(connector.jumpStyle,"auto"),
    });
  },[]);

  const setConnectorStyleAsDefault=useCallback(connector=>{
    setConnectorDefaults(connectorPresetFromConnector(connector));
  },[connectorPresetFromConnector]);

  const resetConnectorStyleDefault=useCallback(()=>{
    setConnectorDefaults(normalizeConnectorDefaultStyle({}));
  },[]);

  const buildConnectorFromDefaults=useCallback((spec,overrides={})=>{
    if(!spec?.fromEntityId||!spec?.toEntityId)return null;
    const fromNode=nodes.find(n=>n.id===spec.fromEntityId)||null;
    const toNode=nodes.find(n=>n.id===spec.toEntityId)||null;
    const base=normalizeConnectorDefaultStyle(connectorDefaultsRef.current);
    const stylePatch=(overrides&&typeof overrides.style==="object"&&overrides.style)?overrides.style:{};
    const style=normalizeConnectorStyle({style:{...base.style,...stylePatch}});
    const explicitFlowType=String(overrides?.flowType||"").trim().toLowerCase();
    const inferredData=explicitFlowType==="data"||(isDataNodeType(fromNode?.type)&&isDataNodeType(toNode?.type));
    if(inferredData&&wouldCreateDataFlowCycle({nodes,arrows,fromId:spec.fromEntityId,toId:spec.toEntityId})){
      toasts.push("Data flow cycle prevented","error");
      return null;
    }
    const connector={
      id:uid(),
      fromId:spec.fromEntityId,
      toId:spec.toEntityId,
      from:{entityId:spec.fromEntityId,anchor:spec.fromAnchor||{type:"pos",xNorm:0.5,yNorm:0.5}},
      to:{entityId:spec.toEntityId,anchor:spec.toAnchor||{type:"pos",xNorm:0.5,yNorm:0.5}},
      routing:normalizeConnectorRouting(overrides?.routing??base.routing),
      style,
      jumpStyle:normalizeConnectorJumpStyle(overrides?.jumpStyle??base.jumpStyle,base.jumpStyle),
      label:String(overrides?.label??""),
    };
    if(inferredData){
      connector.flowType="data";
      if(!String(connector.label||"").trim())connector.label="data";
      if(!overrides?.depType)connector.depType="related";
    }
    return connector;
  },[arrows,nodes]);

  const updateConnector=useCallback((connectorOrId,patch,options={})=>{
    const source=typeof connectorOrId==="string"
      ?(arrows.find(a=>a.id===connectorOrId)||null)
      :(connectorOrId&&connectorOrId.id?connectorOrId:null);
    if(!source?.id||!patch||typeof patch!=="object")return;
    const hasStyle=Object.prototype.hasOwnProperty.call(patch,"style");
    const hasRouting=Object.prototype.hasOwnProperty.call(patch,"routing");
    const hasJumpStyle=Object.prototype.hasOwnProperty.call(patch,"jumpStyle");
    const currentStyle=normalizeConnectorStyle(source);
    const nextStyle=hasStyle?normalizeConnectorStyle({style:{...currentStyle,...(patch.style||{})}}):currentStyle;
    const nextRouting=hasRouting?normalizeConnectorRouting(patch.routing):normalizeConnectorRouting(source.routing);
    const nextJumpStyle=hasJumpStyle
      ?normalizeConnectorJumpStyle(patch.jumpStyle,normalizeConnectorJumpStyle(source.jumpStyle,"auto"))
      :normalizeConnectorJumpStyle(source.jumpStyle,"auto");
    const payload={...patch};
    if(hasStyle)payload.style=nextStyle;
    if(hasRouting)payload.routing=nextRouting;
    if(hasJumpStyle)payload.jumpStyle=nextJumpStyle;
    d({type:"UPD_ARR",id:source.id,p:payload});
    const remember=options?.rememberLast!==false;
    if(remember&&rememberLastConnectorStyle&&(hasStyle||hasRouting||hasJumpStyle)){
      setConnectorDefaults(normalizeConnectorDefaultStyle({
        routing:nextRouting,
        style:nextStyle,
        jumpStyle:nextJumpStyle,
      }));
    }
  },[arrows,d,rememberLastConnectorStyle]);

  const onSheetFormulaSessionChange=useCallback(payload=>{
    if(!payload||typeof payload!=="object")return;
    const sessionId=String(payload.sessionId||"").trim();
    if(!sessionId)return;
    if(payload.active){
      setSheetFormulaSession({
        active:true,
        sessionId,
        sourceSheetId:String(payload.sourceSheetId||""),
        referencedSheetIds:Array.isArray(payload.referencedSheetIds)?payload.referencedSheetIds.slice(0,64):[],
      });
      return;
    }
    setSheetFormulaSession(prev=>prev&&prev.sessionId===sessionId?null:prev);
  },[]);

  const onSheetFormulaReferencePick=useCallback(payload=>{
    if(!payload||typeof payload!=="object")return;
    const sessionId=String(payload.sessionId||"").trim();
    const token=String(payload.token||"").trim();
    if(!sessionId||!token)return;
    setSheetFormulaPick({
      id:String(payload.id||`sheet_ref_pick_${Date.now()}_${Math.floor(Math.random()*10000)}`),
      sessionId,
      token,
      targetSheetId:String(payload.targetSheetId||""),
      targetCell:String(payload.targetCell||""),
    });
  },[]);

  const onConsumeSheetFormulaPick=useCallback(pickId=>{
    setSheetFormulaPick(prev=>prev&&prev.id===pickId?null:prev);
  },[]);

  useEffect(()=>{
    const onEscape=e=>{
      if(e.key!=="Escape")return;
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
      d({type:"EXIT_ADD_MODE"});
    };
    window.addEventListener("keydown",onEscape);
    return()=>window.removeEventListener("keydown",onEscape);
  },[d]);
  useEffect(()=>{
    const onDeleteConnectors=e=>{
      const target=e.target;
      const tag=String(target?.tagName||"").toUpperCase();
      if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||target?.isContentEditable)return;
      if(e.key!=="Backspace"&&e.key!=="Delete")return;
      if(!selectedConnectorIds.length||sel.length)return;
      e.preventDefault();
      selectedConnectorIds.forEach(id=>d({type:"DEL_ARR",id}));
      setSelectedConnectorIds([]);
      setSelectedArrow(null);
      toasts.push(`Deleted ${selectedConnectorIds.length} connector${selectedConnectorIds.length>1?"s":""}`,"info",1200);
    };
    window.addEventListener("keydown",onDeleteConnectors);
    return()=>window.removeEventListener("keydown",onDeleteConnectors);
  },[d,selectedConnectorIds,sel.length]);

  useEffect(()=>{
    const onCloseTransientUi=()=>{
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
      drag.current.type="none";
    };
    window.addEventListener("board:close-transient-ui",onCloseTransientUi);
    return()=>window.removeEventListener("board:close-transient-ui",onCloseTransientUi);
  },[]);

  useEffect(()=>{
    if(typeof onOverlayStateChange!=="function")return;
    const hasOverlay=Boolean(ctxMenu||mobileCtxMenu||radialMenu||commentInput||selectedArrow||portConnect);
    onOverlayStateChange(hasOverlay);
  },[ctxMenu,mobileCtxMenu,radialMenu,commentInput,selectedArrow,portConnect,onOverlayStateChange]);
  useEffect(()=>{
    window.dispatchEvent(new CustomEvent("boardai:connector-selection",{detail:{id:selectedArrow||""}}));
  },[selectedArrow]);
  useEffect(()=>{
    if(!selectedArrow){
      setSelectedConnectorIds(prev=>prev.length?[]:prev);
      return;
    }
    setSelectedConnectorIds(prev=>prev.includes(selectedArrow)?prev:[...prev,selectedArrow]);
  },[selectedArrow]);
  useEffect(()=>{
    if(!selectedConnectorIds.length)return;
    const connectorIdSet=new Set(arrows.map(arr=>String(arr?.id||"")));
    setSelectedConnectorIds(prev=>{
      const next=prev.filter(id=>connectorIdSet.has(String(id||"")));
      return next.length===prev.length?prev:next;
    });
  },[arrows,selectedConnectorIds.length]);
  useEffect(()=>{
    if(!mobileInlineEdit?.nodeId)return;
    const exists=nodes.some(n=>n.id===mobileInlineEdit.nodeId);
    if(!exists)setMobileInlineEdit(null);
  },[mobileInlineEdit,nodes]);

  // IMAGE DROP
  useEffect(()=>{
    const el=wRef.current;
    const dragOver=e=>e.preventDefault();
    const drop=e=>{
      e.preventDefault();
      const f=[...e.dataTransfer.files].find(f=>f.type.startsWith("image/"));
      if(!f)return;
      const r2=new FileReader();
      r2.onload=ev=>{const{x,y}=toW(e.clientX,e.clientY);d({type:"ADD",node:{id:uid(),type:"image",src:ev.target.result,x:x-150,y:y-100,w:300,h:200}});};
      r2.readAsDataURL(f);
    };
    el.addEventListener("dragover",dragOver);
    el.addEventListener("drop",drop);
    return()=>{el.removeEventListener("dragover",dragOver);el.removeEventListener("drop",drop);};
  },[px,py,zoom]);

  // CLIPBOARD IMAGE PASTE (Ctrl+V pastes images from clipboard)
  useEffect(()=>{
    const onPaste=e=>{
      const items=[...(e.clipboardData?.items||[])];
      const img=items.find(i=>i.type.startsWith("image/"));
      if(!img)return;
      e.preventDefault();
      const blob=img.getAsFile();if(!blob)return;
      const r2=new FileReader();
      r2.onload=ev=>{const cx=window.innerWidth/2,cy=window.innerHeight/2;const{x,y}=toW(cx,cy);d({type:"ADD",node:{id:uid(),type:"image",src:ev.target.result,x:x-150,y:y-100,w:300,h:200}});toasts.push("Image pasted from clipboard","success");};
      r2.readAsDataURL(blob);
    };
    window.addEventListener("paste",onPaste);
    return()=>window.removeEventListener("paste",onPaste);
  },[px,py,zoom]);

  // LASER POINTER trail
  const laserTrail=useRef([]);
  const[laserPts,setLaserPts]=useState([]);

  const onWheel=useCallback((e)=>{
    if(e.cancelable)e.preventDefault();
    if(e.ctrlKey||e.metaKey){
      const r=wRef.current.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
      const f=e.deltaY>0?.9:1.11,nz=Math.max(.08,Math.min(6,zoom*f));
      d({type:"PAN",x:mx-(mx-px)*(nz/zoom),y:my-(my-py)*(nz/zoom)});
      d({type:"ZOOM",v:nz});
    }else d({type:"PAN",x:px-e.deltaX,y:py-e.deltaY});
  },[d,px,py,zoom]);

  useEffect(()=>{
    const el=wRef.current;
    if(!el)return;
    const wheelHandler=e=>onWheel(e);
    el.addEventListener("wheel",wheelHandler,{passive:false});
    return()=>el.removeEventListener("wheel",wheelHandler);
  },[onWheel]);

  const createCardNode=useCallback((x,y)=>({
    id:uid(),
    type:"shape",
    shapeType:"rect",
    x,
    y,
    w:170,
    h:88,
    text:"Node",
    color:T.bg3,
    textColor:T.t0,
    borderColor:T.b1,
    fontSize:13,
    fontWeight:"600",
  }),[]);
  const connectorPortsForDirection=direction=>{
    if(direction==="left")return{from:"left",to:"right"};
    if(direction==="up")return{from:"top",to:"bottom"};
    if(direction==="down")return{from:"bottom",to:"top"};
    return{from:"right",to:"left"};
  };

  const resolveSmartPlacement=useCallback((baseX,baseY,direction="right")=>{
    let x=baseX;
    let y=baseY;
    if(sel.length===1){
      const anchor=nodes.find(n=>n.id===sel[0]);
      if(anchor){
        const w=Number(anchor.w)||120;
        const h=Number(anchor.h)||80;
        if(direction==="right"){x=anchor.x+w+MOBILE_SMART_GAP;y=anchor.y+Math.max(0,(h-88)*0.5);}
        else if(direction==="left"){x=anchor.x-MOBILE_SMART_GAP-170;y=anchor.y+Math.max(0,(h-88)*0.5);}
        else if(direction==="down"){x=anchor.x+Math.max(0,(w-170)*0.5);y=anchor.y+h+Math.max(110,Math.round(MOBILE_SMART_GAP*0.7));}
        else if(direction==="up"){x=anchor.x+Math.max(0,(w-170)*0.5);y=anchor.y-Math.max(110,Math.round(MOBILE_SMART_GAP*0.7))-88;}
      }
    }
    return { x:snap(x,snapGrid), y:snap(y,snapGrid) };
  },[nodes,sel,snapGrid]);
  const createConnectedNode=useCallback((fromNodeId,direction="right",dropPoint=null)=>{
    if(!fromNodeId)return null;
    const fromNode=nodes.find(n=>n.id===fromNodeId);
    if(!fromNode)return null;
    let pos;
    if(dropPoint&&Number.isFinite(dropPoint.x)&&Number.isFinite(dropPoint.y)){
      pos=resolveSmartPlacement(dropPoint.x,dropPoint.y,direction);
    }else{
      const centerX=(Number(fromNode.x)||0)+(Number(fromNode.w)||120)*0.5;
      const centerY=(Number(fromNode.y)||0)+(Number(fromNode.h)||80)*0.5;
      pos=resolveSmartPlacement(centerX,centerY,direction);
    }
    const newNode=createCardNode(pos.x,pos.y);
    d({type:"ADD",node:newNode});
    const ports=connectorPortsForDirection(direction);
    const connector=buildConnectorFromDefaults({
      fromEntityId:fromNodeId,
      toEntityId:newNode.id,
      fromAnchor:{type:"port",portId:ports.from},
      toAnchor:{type:"port",portId:ports.to},
    });
    if(connector)d({type:"ADD_ARR",arr:connector});
    d({type:"SEL",v:[newNode.id]});
    return newNode.id;
  },[buildConnectorFromDefaults,createCardNode,d,nodes,resolveSmartPlacement]);

  const addNodeAndConnector=useCallback((fromNodeId,dropPoint)=>{
    if(!fromNodeId||!dropPoint)return;
    const fromNode=nodes.find(n=>n.id===fromNodeId);
    if(!fromNode)return;
    const dx=(dropPoint.x-(fromNode.x+(Number(fromNode.w)||120)*0.5));
    const dy=(dropPoint.y-(fromNode.y+(Number(fromNode.h)||80)*0.5));
    const direction=Math.abs(dx)>=Math.abs(dy)?(dx>=0?"right":"left"):(dy>=0?"down":"up");
    createConnectedNode(fromNodeId,direction,dropPoint);
  },[createConnectedNode,nodes]);
  const triggerConnectorSnapFx=useCallback((point)=>{
    if(!point||!Number.isFinite(Number(point.x))||!Number.isFinite(Number(point.y)))return;
    setConnectorSnapFx({x:Number(point.x),y:Number(point.y),id:Date.now()});
    if(connectorSnapTimerRef.current)clearTimeout(connectorSnapTimerRef.current);
    connectorSnapTimerRef.current=setTimeout(()=>{
      setConnectorSnapFx(null);
      connectorSnapTimerRef.current=null;
    },220);
  },[]);
  const resolveSmartConnectCandidate=useCallback((movingNodeId,nextX,nextY)=>{
    const movingNode=nodes.find(n=>n.id===movingNodeId&&!n.hidden);
    if(!movingNode)return null;
    const movedNode={
      ...movingNode,
      x:Number.isFinite(Number(nextX))?Number(nextX):(Number(movingNode.x)||0),
      y:Number.isFinite(Number(nextY))?Number(nextY):(Number(movingNode.y)||0),
    };
    const movingW=Math.max(1,Number(movedNode.w)||120);
    const movingH=Math.max(1,Number(movedNode.h)||80);
    const movingCenterX=(Number(movedNode.x)||0)+movingW*0.5;
    const movingCenterY=(Number(movedNode.y)||0)+movingH*0.5;
    const nearGap=Math.max(56,110/Math.max(.55,zoom));
    const hasDirectConnector=(fromId,toId)=>arrows.some(a=>{
      const ep=normalizeConnectorEndpoints(a);
      const from=String(ep.fromEntityId||"");
      const to=String(ep.toEntityId||"");
      return(from===fromId&&to===toId)||(from===toId&&to===fromId);
    });
    let best=null;
    let bestScore=Infinity;
    for(const other of nodes){
      if(!other||other.hidden||other.id===movingNodeId)continue;
      if(hasDirectConnector(movingNodeId,other.id))continue;
      const otherW=Math.max(1,Number(other.w)||120);
      const otherH=Math.max(1,Number(other.h)||80);
      const otherCenterX=(Number(other.x)||0)+otherW*0.5;
      const otherCenterY=(Number(other.y)||0)+otherH*0.5;
      const dx=otherCenterX-movingCenterX;
      const dy=otherCenterY-movingCenterY;
      const absDx=Math.abs(dx);
      const absDy=Math.abs(dy);
      const gapX=Math.max(0,absDx-(movingW+otherW)*0.5);
      const gapY=Math.max(0,absDy-(movingH+otherH)*0.5);
      const minGap=Math.min(gapX,gapY);
      if(minGap>nearGap)continue;
      const direction=absDx>=absDy?(dx>=0?"right":"left"):(dy>=0?"down":"up");
      const ports=connectorPortsForDirection(direction);
      const start=getPortWorldPosition(movedNode,ports.from);
      const end=getPortWorldPosition(other,ports.to);
      const score=minGap+Math.hypot(dx,dy)*0.16;
      if(score>=bestScore)continue;
      bestScore=score;
      best={
        fromId:movingNodeId,
        toId:other.id,
        fromPort:ports.from,
        toPort:ports.to,
        start,
        end,
        mid:connectorMidpoint([start,end]),
      };
    }
    return best;
  },[arrows,nodes,zoom]);
  const acceptSmartConnectSuggestion=useCallback((suggestion)=>{
    if(!suggestion?.fromId||!suggestion?.toId)return;
    const connector=buildConnectorFromDefaults({
      fromEntityId:suggestion.fromId,
      toEntityId:suggestion.toId,
      fromAnchor:{type:"port",portId:suggestion.fromPort||"right"},
      toAnchor:{type:"port",portId:suggestion.toPort||"left"},
    });
    if(connector){
      d({type:"ADD_ARR",arr:connector});
      if(suggestion.end)triggerConnectorSnapFx(suggestion.end);
      setSelectedArrow(connector.id);
    }
    setSmartConnectSuggestion(null);
  },[buildConnectorFromDefaults,d,triggerConnectorSnapFx]);

  const applyRadialAction=useCallback((actionId,worldPoint)=>{
    if(!actionId||!worldPoint)return;
    const wx=snap(worldPoint.x,snapGrid);
    const wy=snap(worldPoint.y,snapGrid);
    const selectionNode=sel.length===1?nodes.find(n=>n.id===sel[0]):null;
    if(actionId==="addText"){
      const p=resolveSmartPlacement(wx,wy,"right");
      d({type:"ADD",node:{id:uid(),type:"text",x:p.x,y:p.y,w:180,h:44,text:"Text",color:T.t0,textColor:T.t0,fontSize:22,fontWeight:"700"}});
      return;
    }
    if(actionId==="addNode"){
      let p=resolveSmartPlacement(wx,wy,"right");
      if(selectionNode&&(selectionNode.type==="frame"||selectionNode.type==="lane")){
        p={x:snap(selectionNode.x+24,snapGrid),y:snap(selectionNode.y+56,snapGrid)};
      }
      d({type:"ADD",node:createCardNode(p.x,p.y)});
      return;
    }
    if(actionId==="addContainer"){
      const p=resolveSmartPlacement(wx,wy,"down");
      d({type:"ADD",node:{id:uid(),type:"frame",x:p.x,y:p.y,w:420,h:280,text:"Container",color:"transparent",borderColor:T.b1}});
      return;
    }
    if(actionId==="addSticky"){
      const sc=SC[_si++%8];
      const p=resolveSmartPlacement(wx,wy,"right");
      d({type:"ADD",node:{id:uid(),type:"sticky",x:p.x,y:p.y,w:170,h:130,text:"",color:sc.bg,textColor:sc.t}});
      return;
    }
    if(actionId==="addImage"){
      ctxUploadPosRef.current={wx,wy};
      ctxUploadRef.current?.click();
      return;
    }
    if(actionId==="addConnector"){
      d({type:"TOOL",v:"arrow"});
      if(selectionNode)d({type:"ARR_FROM",id:selectionNode.id});
    }
  },[createCardNode,d,nodes,resolveSmartPlacement,sel,snapGrid]);

  const resolveRadialActiveId=useCallback((menu,clientPoint)=>{
    if(!menu||!clientPoint)return"";
    const dx=(Number(clientPoint.x)||0)-(Number(menu.x)||0);
    const dy=(Number(clientPoint.y)||0)-(Number(menu.y)||0);
    const r=Math.hypot(dx,dy);
    if(r<24)return"";
    let bestId="";
    let best=Infinity;
    for(const opt of MOBILE_RADIAL_OPTIONS){
      const v=MOBILE_RADIAL_VECTORS[opt.position];
      if(!v)continue;
      const d2=(dx-v.x)*(dx-v.x)+(dy-v.y)*(dy-v.y);
      if(d2<best){best=d2;bestId=opt.id;}
    }
    return best<4200?bestId:"";
  },[]);

  function onDown(e){
    if(e.button===2)return;
    setCtxMenu(null);setMobileCtxMenu(null);setRadialMenu(null);setSmartConnectSuggestion(null);
    if(!e.shiftKey){
      setSelectedArrow(null);
      setSelectedConnectorIds([]);
    }
    const connectorEl=e.target.closest("[data-connector-id]");
    if(connectorEl){
      const connectorId=String(connectorEl.getAttribute("data-connector-id")||"").trim();
      if(connectorId){
        if(e.shiftKey){
          setSelectedConnectorIds(prev=>{
            if(prev.includes(connectorId)){
              const next=prev.filter(id=>id!==connectorId);
              setSelectedArrow(next[next.length-1]||null);
              return next;
            }
            const next=[...prev,connectorId];
            setSelectedArrow(connectorId);
            return next;
          });
        }else{
          setSelectedConnectorIds([connectorId]);
          setSelectedArrow(connectorId);
        }
      }
      return;
    }
    if(e.target.closest("[data-node]")||e.target.closest("[data-arr-label]"))return;
    if(tool==="comment"){
      const selected=sel.length===1?nodes.find(n=>n.id===sel[0]):null;
      if(selected){
        const x=(Number(selected.x)||0)+(Number(selected.w)||120)+12;
        const y=(Number(selected.y)||0)-8;
        setCommentInput({x,y,nodeId:selected.id,sx:e.clientX,sy:e.clientY});
      }else{
        const{x,y}=toW(e.clientX,e.clientY);
        setCommentInput({x,y,nodeId:null,sx:e.clientX,sy:e.clientY});
      }
      return;
    }
    if(tool==="draw"){dPath.current=[toW(e.clientX,e.clientY)];drag.current={type:"draw",sx:0,sy:0,px0:0,py0:0,nid:"",nx0:0,ny0:0,nw0:0,nh0:0,dir:""};return;}
    if(tool==="laser")return; // laser just tracks mouse, no drag
    if(tool==="eraser"){drag.current={type:"eraser",sx:0,sy:0,px0:0,py0:0,nid:"",nx0:0,ny0:0,nw0:0,nh0:0,dir:""};const{x,y}=toW(e.clientX,e.clientY);d({type:"CLEAR_DRAWS_AREA",x,y,r:30/zoom});return;}
    if(tool==="select"){
      if(e.isTouch){drag.current={type:"pan",sx:e.clientX,sy:e.clientY,px0:px,py0:py,nid:"",nx0:0,ny0:0,nw0:0,nh0:0,dir:""};return;}
      const{x,y}=toW(e.clientX,e.clientY);setLasso({x1:x,y1:y,x2:x,y2:y});drag.current={type:"lasso",sx:0,sy:0,px0:0,py0:0,nid:"",nx0:0,ny0:0,nw0:0,nh0:0,dir:""};d({type:"SEL",v:[]});return;
    }
    if(tool==="pan"){drag.current={type:"pan",sx:e.clientX,sy:e.clientY,px0:px,py0:py,nid:"",nx0:0,ny0:0,nw0:0,nh0:0,dir:""};return;}
    const{x,y}=toW(e.clientX,e.clientY);
    const smart=isMobile?resolveSmartPlacement(x,y,"right"):{x:snap(x,snapGrid),y:snap(y,snapGrid)};
    const sx=smart.x,sy=smart.y;
    const selectedMilestone=sel.length===1?nodes.find(n=>n.id===sel[0]&&n.type==="milestone"):null;
    const sc=SC[_si++%8];
    let added=false;
    if(tool==="sticky"){d({type:"ADD",node:{id:uid(),type:"sticky",x:sx,y:sy,w:170,h:130,text:"",color:sc.bg,textColor:sc.t}});added=true;}
    else if(tool==="task"){
      const task={
        title:"New Task",
        description:"",
        status:"Todo",
        owner:"TBD",
        priority:"P2",
        dueDate:"TBD",
        tags:[],
        milestoneId:selectedMilestone?.executionMilestoneId||selectedMilestone?.id||"",
        milestoneTitle:selectedMilestone?.executionMilestone||String(selectedMilestone?.text||"").split("\n")[0]||"",
        githubUrl:"",
        jiraUrl:"",
      };
      d({type:"ADD",node:{
        id:uid(),
        type:"task",
        x:sx,
        y:sy,
        w:250,
        h:150,
        text:composeTaskNodeText(task),
        color:"#0f172a",
        textColor:"#e2e8f0",
        borderColor:"#334155",
        fontSize:11,
        fontWeight:"500",
        executionTaskId:uid(),
        executionTitle:task.title,
        executionDescription:task.description,
        executionStatus:task.status,
        executionOwner:task.owner,
        executionPriority:task.priority,
        executionDueDate:task.dueDate,
        executionTags:task.tags,
        executionMilestoneId:task.milestoneId||null,
        executionMilestone:task.milestoneTitle||"",
      }});added=true;
    }
    else if(tool==="milestone"){
      const mile={title:"Milestone",dueDate:"TBD",progressDone:0,progressTotal:0};
      d({type:"ADD",node:{
        id:uid(),
        type:"milestone",
        x:sx,
        y:sy,
        w:320,
        h:164,
        text:composeMilestoneNodeText(mile),
        color:"#111827",
        textColor:"#e5e7eb",
        borderColor:"#6366f1",
        fontSize:12,
        fontWeight:"700",
        executionMilestoneId:uid(),
        executionMilestone:mile.title,
        executionDueDate:mile.dueDate,
      }});added=true;
    }
    else if(tool==="decision"){
      const dec={decision:"Decision",date:"TBD",owner:"TBD",context:"",outcome:""};
      d({type:"ADD",node:{
        id:uid(),
        type:"decision",
        x:sx,
        y:sy,
        w:270,
        h:170,
        text:composeDecisionNodeText(dec),
        color:"#1f2937",
        textColor:"#f3f4f6",
        borderColor:"#f59e0b",
        fontSize:11,
        fontWeight:"600",
        executionDecisionId:uid(),
        executionDecision:dec.decision,
        executionDecisionDate:dec.date,
        executionOwner:dec.owner,
        executionContext:dec.context,
        executionOutcome:dec.outcome,
      }});added=true;
    }
    else if(tool==="transform"){
      const transformNode=createTransformNode({uid,x:sx,y:sy,transformType:"sum"});
      d({type:"ADD",node:transformNode});
      const sourceNode=sel.length===1?nodes.find(n=>n.id===sel[0]):null;
      if(sourceNode&&sourceNode.id!==transformNode.id&&isDataNodeType(sourceNode.type)){
        const connector=buildConnectorFromDefaults({
          fromEntityId:sourceNode.id,
          toEntityId:transformNode.id,
          fromAnchor:{type:"port",portId:"right"},
          toAnchor:{type:"port",portId:"left"},
        },{flowType:"data",label:"data"});
        if(connector)d({type:"ADD_ARR",arr:connector});
      }
      added=true;
    }
    else if(tool==="text"){d({type:"ADD",node:{id:uid(),type:"text",x:sx,y:sy,w:180,h:44,text:"Heading",color:T.t0,textColor:T.t0,fontSize:24,fontWeight:"700"}});added=true;}
    else if(SHAPE_DEFAULTS[tool]){d({type:"ADD",node:makeShapeNode(tool,sx,sy)});added=true;}
    else if(tool==="laneH"){d({type:"ADD",node:{id:uid(),type:"lane",orientation:"h",x:sx,y:sy,w:920,h:180,text:"Swimlane",color:T.bg3,textColor:T.t0,borderColor:T.b1}});added=true;}
    else if(tool==="laneV"){d({type:"ADD",node:{id:uid(),type:"lane",orientation:"v",x:sx,y:sy,w:220,h:640,text:"Swimlane",color:T.bg3,textColor:T.t0,borderColor:T.b1}});added=true;}
    else if(tool==="table"||tool==="sheet"){d({type:"ADD",node:makeSheetNode(sx,sy)});added=true;}
    else if(tool==="deck"){d({type:"ADD",node:makeDeckNode(sx,sy)});added=true;}
    else if(tool==="frame"){d({type:"ADD",node:{id:uid(),type:"frame",x:sx,y:sy,w:400,h:300,text:"Frame",color:"transparent",borderColor:T.b1}});added=true;}
    if(added&&isMobile&&!mobileStayInAdd){
      const nextMode=nextModeAfterAdd(toolToMode(tool),false);
      d({type:"TOOL",v:modeToTool(nextMode)});
    }
  }

  function onNodeSel(id,multi,altKey){
    if(tool==="arrow"){
      if(!arrowFrom){d({type:"ARR_FROM",id});d({type:"SEL",v:[id]});}
      else if(arrowFrom!==id){
        const connector=buildConnectorFromDefaults({
          fromEntityId:arrowFrom,
          toEntityId:id,
          fromAnchor:{type:"pos",xNorm:0.5,yNorm:0.5},
          toAnchor:{type:"pos",xNorm:0.5,yNorm:0.5},
        });
        if(connector)d({type:"ADD_ARR",arr:connector});
        d({type:"TOOL",v:modeToTool(nextModeAfterConnect())});
      }
      return;
    }
    setSelectedConnectorIds([]);
    setSelectedArrow(null);
    if(multi){
      const cur=nodes.find(n=>n.id===id);
      if(cur?.tableId&&cur.tableRole==="cell"&&!cur.hidden){
        const anchor=nodes.find(n=>sel.includes(n.id)&&n.tableId===cur.tableId&&n.tableRole==="cell"&&!n.hidden);
        if(anchor){
          const r1=Math.min(Number(anchor.tableRow),Number(cur.tableRow));
          const r2=Math.max(Number(anchor.tableRow),Number(cur.tableRow));
          const c1=Math.min(Number(anchor.tableCol),Number(cur.tableCol));
          const c2=Math.max(Number(anchor.tableCol),Number(cur.tableCol));
          const ids=nodes.filter(n=>n.tableId===cur.tableId&&n.tableRole==="cell"&&!n.hidden&&Number(n.tableRow)>=r1&&Number(n.tableRow)<=r2&&Number(n.tableCol)>=c1&&Number(n.tableCol)<=c2).map(n=>n.id);
          d({type:"SEL",v:ids});
          return;
        }
      }
      d({type:"SEL",v:sel.includes(id)?sel.filter(x=>x!==id):[...sel,id]});
    }
    else{
      if(altKey){
        // Alt+drag: duplicate and drag copy
        const n=nodes.find(n=>n.id===id);
        if(n&&!n.locked){
          const newId=uid();
          d({type:"ADD",node:{...n,id:newId}});
          d({type:"SEL",v:[newId]});
          moved.current=false;
          drag.current={type:"node",sx:0,sy:0,px0:0,py0:0,nid:newId,nx0:n.x,ny0:n.y,nw0:n.w,nh0:n.h,dir:""};
          setNodeDragActive(true);
        }
      }else if(sel.includes(id)&&sel.length>1){
        // Multi-drag: keep selection, drag all selected
        moved.current=false;
        const selNodes=nodes.filter(n=>sel.includes(n.id)&&!n.locked);
        drag.current={type:"multi-node",sx:0,sy:0,px0:0,py0:0,nid:id,nx0:0,ny0:0,nw0:0,nh0:0,dir:"",origins:Object.fromEntries(selNodes.map(n=>[n.id,{x:n.x,y:n.y}]))};
        setNodeDragActive(true);
      }else{
        d({type:"SEL",v:[id]});
        const n=nodes.find(n=>n.id===id);
        if(n&&!n.locked){
          moved.current=false;
          const fc=n.type==="frame"?nodes.filter(c=>c.id!==id&&!c.locked&&c.x+(c.w||100)/2>n.x&&c.x+(c.w||100)/2<n.x+n.w&&c.y+(c.h||60)/2>n.y&&c.y+(c.h||60)/2<n.y+n.h):[];
          drag.current={type:"node",sx:0,sy:0,px0:0,py0:0,nid:id,nx0:n.x,ny0:n.y,nw0:n.w,nh0:n.h,dir:"",fc:fc.map(c=>c.id),fcOrigins:Object.fromEntries(fc.map(c=>[c.id,{x:c.x,y:c.y}]))};
          setNodeDragActive(true);
        }
      }
    }
  }

  function onRotSt(e,nodeId){
    e.stopPropagation();
    const n=nodes.find(n=>n.id===nodeId);
    const r=wRef.current.getBoundingClientRect();
    const cx=r.left+(n.x+(n.w||100)/2)*zoom+px;
    const cy=r.top+(n.y+(n.h||60)/2)*zoom+py;
    drag.current={type:"rotate",sx:0,sy:0,px0:0,py0:0,nid:nodeId,nx0:0,ny0:0,nw0:0,nh0:0,dir:"",cx,cy};
  }

  function onRSt(e,nodeId,dir){
    e.stopPropagation();d({type:"SNAP"});
    const n=nodes.find(n=>n.id===nodeId);
    drag.current={type:"resize",sx:e.clientX,sy:e.clientY,px0:0,py0:0,nid:nodeId,nx0:n.x,ny0:n.y,nw0:n.w,nh0:n.h,dir};
    setNodeDragActive(true);
  }

  function onMove(e){
    const hoverEl=e.target?.closest?.("[data-node-id]");
    const hoverId=String(hoverEl?.getAttribute("data-node-id")||"").trim();
    setHoverNodeId(prev=>prev===hoverId?prev:hoverId);
    const dr=drag.current;
    const dragThreshold=isMobile?Math.max(6,10/Math.max(.6,zoom)):2;
    if(dr.type==="pan")d({type:"PAN",x:dr.px0+e.clientX-dr.sx,y:dr.py0+e.clientY-dr.sy});
    else if(dr.type==="node"){
      if(!dr.sx){drag.current.sx=e.clientX;drag.current.sy=e.clientY;return;}
      const dx=(e.clientX-dr.sx)/zoom,dy=(e.clientY-dr.sy)/zoom;
      if(Math.abs(dx)>dragThreshold||Math.abs(dy)>dragThreshold)moved.current=true;
      if(moved.current){
        const nx=snap(dr.nx0+dx,snapGrid),ny=snap(dr.ny0+dy,snapGrid);
        d({type:"UPD",id:dr.nid,p:{x:nx,y:ny}});
        if(dr.fc?.length){const deltas=Object.fromEntries(dr.fc.map(id=>{const o=dr.fcOrigins[id];return[id,{x:snap(o.x+dx,snapGrid),y:snap(o.y+dy,snapGrid)}];}));d({type:"UPD_MULTI",deltas});}
        // Smart guides
        const draggedNode=nodes.find(n=>n.id===dr.nid);
        if(draggedNode){
          const ox=dr.nx0+dx,oy=dr.ny0+dy,w=draggedNode.w||100,h=draggedNode.h||60;
          const others=nodes.filter(n=>n.id!==dr.nid&&!n.hidden);
          const THRESH=7/zoom;
          const vHits=new Set();
          const hHits=new Set();
          for(const o of others){
            const ow=o.w||100,oh=o.h||60;
            const myX=[ox,ox+w/2,ox+w],otX=[o.x,o.x+ow/2,o.x+ow];
            const myY=[oy,oy+h/2,oy+h],otY=[o.y,o.y+oh/2,o.y+oh];
            for(const me of myX)for(const oe of otX)if(Math.abs(me-oe)<THRESH)vHits.add(Number(oe).toFixed(2));
            for(const me of myY)for(const oe of otY)if(Math.abs(me-oe)<THRESH)hHits.add(Number(oe).toFixed(2));
          }
          const newGuides=[
            ...[...vHits].map(x=>({type:"v",x:Number(x)})),
            ...[...hHits].map(y=>({type:"h",y:Number(y)})),
          ];
          setGuides(newGuides);
        }
        const smartCandidate=resolveSmartConnectCandidate(dr.nid,nx,ny);
        setSmartConnectSuggestion(prev=>{
          if(!smartCandidate&&!prev)return prev;
          if(!smartCandidate)return null;
          if(prev&&prev.fromId===smartCandidate.fromId&&prev.toId===smartCandidate.toId&&prev.fromPort===smartCandidate.fromPort&&prev.toPort===smartCandidate.toPort)return prev;
          return smartCandidate;
        });
      }
    }
    else if(dr.type==="resize"){
      const dx=(e.clientX-dr.sx)/zoom,dy=(e.clientY-dr.sy)/zoom;
      let nx=dr.nx0,ny=dr.ny0,nw=dr.nw0,nh=dr.nh0;
      if(dr.dir.includes("e"))nw=Math.max(60,snap(dr.nw0+dx,snapGrid));
      if(dr.dir.includes("s"))nh=Math.max(40,snap(dr.nh0+dy,snapGrid));
      if(dr.dir.includes("w")){nw=Math.max(60,snap(dr.nw0-dx,snapGrid));nx=dr.nx0+dr.nw0-nw;}
      if(dr.dir.includes("n")){nh=Math.max(40,snap(dr.nh0-dy,snapGrid));ny=dr.ny0+dr.nh0-nh;}
      // Proportional resize (Shift key)
      if(e.shiftKey&&dr.nw0&&dr.nh0){
        const aspect=dr.nw0/dr.nh0;
        if(dr.dir.includes("e")||dr.dir.includes("w"))nh=Math.max(40,nw/aspect);
        else if(dr.dir.includes("s")||dr.dir.includes("n"))nw=Math.max(60,nh*aspect);
        if(dr.dir.includes("n"))ny=dr.ny0+dr.nh0-nh;
        if(dr.dir.includes("w"))nx=dr.nx0+dr.nw0-nw;
      }
      d({type:"UPD",id:dr.nid,p:{x:nx,y:ny,w:nw,h:nh}});
    }
    else if(dr.type==="draw"){const pt=toW(e.clientX,e.clientY);dPath.current=[...dPath.current,pt];setLivePath([...dPath.current]);}
    else if(dr.type==="lasso"){const{x,y}=toW(e.clientX,e.clientY);setLasso(l=>({...l,x2:x,y2:y}));}
    else if(dr.type==="multi-node"){
      if(!dr.sx){drag.current.sx=e.clientX;drag.current.sy=e.clientY;return;}
      const dx=(e.clientX-dr.sx)/zoom,dy=(e.clientY-dr.sy)/zoom;
      if(Math.abs(dx)>dragThreshold||Math.abs(dy)>dragThreshold)moved.current=true;
      if(moved.current){const deltas=Object.fromEntries(Object.entries(dr.origins).map(([id,{x,y}])=>[id,{x:snap(x+dx,snapGrid),y:snap(y+dy,snapGrid)}]));d({type:"UPD_MULTI",deltas});}
      setSmartConnectSuggestion(null);
    }
    else if(dr.type==="rotate"){
      const dx=e.clientX-dr.cx,dy=e.clientY-dr.cy;
      let angle=Math.atan2(dy,dx)*180/Math.PI+90;
      if(e.shiftKey)angle=Math.round(angle/15)*15;
      d({type:"UPD",id:dr.nid,p:{rotation:Math.round(angle)}});
    }
    // Laser pointer trail
    if(tool==="laser"){
      const{x,y}=toW(e.clientX,e.clientY);
      const now=Date.now();
      laserTrail.current=[...laserTrail.current.filter(p=>now-p.t<800),{x,y,t:now}];
      setLaserPts([...laserTrail.current]);
    }
    // Eraser: clear drawings near cursor while mouse is down
    if(dr.type==="eraser"){const{x,y}=toW(e.clientX,e.clientY);d({type:"CLEAR_DRAWS_AREA",x,y,r:30/zoom});}
    // Emit cursor to other collaborators (throttled)
    if(boardId){
      const now=performance.now();
      if(now-cursorEmitRef.current.ts>=32){
        cursorEmitRef.current.ts=now;
        const{x,y}=toW(e.clientX,e.clientY);
        socket.volatile.emit("cursor:move",{boardId,x,y});
      }
    }
  }

  function onMouseMove(e){
    if(mouseMovePendingRef.current!==e)mouseMovePendingRef.current=e;
    if(mouseMoveRafRef.current)return;
    mouseMoveRafRef.current=window.requestAnimationFrame(()=>{
      mouseMoveRafRef.current=0;
      const ev=mouseMovePendingRef.current;
      mouseMovePendingRef.current=null;
      if(ev)onMove(ev);
    });
  }

  function onUp(){
    setGuides([]);
    setNodeDragActive(false);
    if(drag.current.type!=="node"&&drag.current.type!=="multi-node"){
      setSmartConnectSuggestion(null);
    }
    if(drag.current.type==="draw"&&dPath.current.length>2){d({type:"ADD_DRAW",d:{id:uid(),pts:dPath.current,color:dColor.current}});dPath.current=[];setLivePath([]);}
    else if(drag.current.type==="lasso"&&lasso){
      const mx=Math.min(lasso.x1,lasso.x2),my=Math.min(lasso.y1,lasso.y2),mw=Math.abs(lasso.x2-lasso.x1),mh=Math.abs(lasso.y2-lasso.y1);
      if(mw>10&&mh>10){
        const ids=visibleNodes.filter(n=>n.x<mx+mw&&n.x+(n.w||100)>mx&&n.y<my+mh&&n.y+(n.h||60)>my).map(n=>n.id);
        const cx2=mx+mw;
        const cy2=my+mh;
        const connectorIds=connectorVisuals.filter(connector=>{
          const mid=connector.mid||{x:0,y:0};
          const points=(Array.isArray(connector.routePoints)&&connector.routePoints.length)?connector.routePoints:[connector.start,connector.end];
          if(mid.x>=mx&&mid.x<=cx2&&mid.y>=my&&mid.y<=cy2)return true;
          if(points.some(pt=>pt&&pt.x>=mx&&pt.x<=cx2&&pt.y>=my&&pt.y<=cy2))return true;
          const validPoints=points.filter(Boolean);
          if(validPoints.length<2)return false;
          const bx1=Math.min(...validPoints.map(pt=>pt.x));
          const by1=Math.min(...validPoints.map(pt=>pt.y));
          const bx2=Math.max(...validPoints.map(pt=>pt.x));
          const by2=Math.max(...validPoints.map(pt=>pt.y));
          return bx1<=cx2&&bx2>=mx&&by1<=cy2&&by2>=my;
        }).map(connector=>connector.id);
        d({type:"SEL",v:ids});
        setSelectedConnectorIds(connectorIds);
        setSelectedArrow(connectorIds[0]||null);
      }
      setLasso(null);
    }
    drag.current.type="none";
  }

  function openContextMenuAt(clientX,clientY,targetNodeId="",mobile=false){
    const rect=wRef.current?.getBoundingClientRect();
    if(!rect)return;
    const{x,y}=toW(clientX,clientY);
    const menuW=286;
    const menuMaxH=Math.min(520,Math.floor(rect.height*.76));
    const edge=10;
    const localX=clientX-rect.left;
    const localY=clientY-rect.top;
    const sx=Math.max(edge,Math.min(localX,rect.width-menuW-edge));
    const sy=Math.max(edge,Math.min(localY,rect.height-menuMaxH-edge));
    const hitNodeId=String(targetNodeId||"").trim();
    const hitNode=hitNodeId?nodes.find(n=>n.id===hitNodeId)||null:null;
    const effectiveSel=hitNode?(sel.includes(hitNode.id)?sel:[hitNode.id]):sel;
    if(hitNode&&!sel.includes(hitNode.id))d({type:"SEL",v:[hitNode.id]});
    const selectionCount=effectiveSel.length;
    const target=selectionCount>1?"selection":hitNode?(isContainerType(hitNode.type)?"container":"node"):"canvas";
    const baseCtx={
      target,
      selectionCount,
      entityType:hitNode?.type||"",
      targetNodeId:hitNode?.id||"",
      effectiveSelIds:effectiveSel,
      canPaste:Boolean(s.clipboard?.length),
      canImportFromUrl:true,
      detectedImportUrl:"",
    };
    const menu=buildContextMenu({
      ...baseCtx,
      commands:makeContextCommands({
        wx:x,
        wy:y,
        effectiveSelIds:effectiveSel,
        targetNode:hitNode,
        detectedImportUrl:"",
      }),
    });
    if(mobile){
      setCtxMenu(null);
      setMobileCtxMenu({
        target,
        nodeType:hitNode?.type||"",
        menu,
      });
      return;
    }
    setMobileCtxMenu(null);
    setCtxMenu({wx:x,wy:y,sx,sy,maxH:menuMaxH,menu});
  }

  function onCtx(e){
    e.preventDefault();
    e.stopPropagation();
    const nodeEl=e.target.closest("[data-node-id]");
    const hitNodeId=String(nodeEl?.getAttribute("data-node-id")||"").trim();
    openContextMenuAt(e.clientX,e.clientY,hitNodeId,false);
  }

  useEffect(()=>{
    const ctl=mobileInputRef.current;
    if(!ctl)return;
    ctl.setLongPressHandler(meta=>{
      if(!isMobile)return;
      drag.current.type="none";
      setLasso(null);
      setPortConnect(null);
      setSelectedArrow(null);
      if(meta?.targetType==="connector"){
        const connectorId=String(meta?.payload?.connectorId||"").trim();
        if(connectorId&&openConnectorMobileMenu(connectorId)){
          return;
        }
      }
      if(meta?.targetType==="canvas"){
        const world=toW(meta.x,meta.y);
        setCtxMenu(null);
        setMobileCtxMenu(null);
        setRadialMenu({x:meta.x,y:meta.y,wx:world.x,wy:world.y,activeId:""});
        return;
      }
      openContextMenuAt(meta.x,meta.y,meta.targetNodeId,true);
    });
  },[isMobile,nodes,arrows,sel,tool,zoom,px,py,s.clipboard]);

  const cycleCap=cap=>{
    const order=["none","arrow","circle","triangle"];
    const idx=order.indexOf(String(cap||"none").toLowerCase());
    return order[(idx+1+order.length)%order.length];
  };

  function buildConnectorContextGroups(connector){
    if(!connector?.source?.id)return[];
    const c=connector.source;
    const style=connector.style;
    return[
      {
        id:"connector-routing",
        label:"Change routing",
        items:[
          {id:"connector-route-straight",label:"Straight",icon:"-",enabled:connector.routing!=="straight",onSelect:()=>updateConnector(c,{routing:"straight"})},
          {id:"connector-route-ortho",label:"Orthogonal",icon:"L",enabled:connector.routing!=="ortho",onSelect:()=>updateConnector(c,{routing:"ortho"})},
          {id:"connector-route-curved",label:"Curved",icon:"~",enabled:connector.routing!=="curved",onSelect:()=>updateConnector(c,{routing:"curved"})},
          {id:"connector-route-wavy",label:"Wavy",icon:"w",enabled:connector.routing!=="wavy",onSelect:()=>updateConnector(c,{routing:"wavy"})},
        ],
      },
      {
        id:"connector-style",
        label:"Change style",
        items:[
          {id:"connector-color-default",label:"Color: default",icon:"C",onSelect:()=>updateConnector(c,{style:{stroke:T.t2}})},
          {id:"connector-color-accent",label:"Color: accent",icon:"C",onSelect:()=>updateConnector(c,{style:{stroke:T.y}})},
          {id:"connector-color-blue",label:"Color: blue",icon:"C",onSelect:()=>updateConnector(c,{style:{stroke:T.blue}})},
          {id:"connector-dash-solid",label:"Solid",icon:"S",enabled:style.dash!=="solid",onSelect:()=>updateConnector(c,{style:{dash:"solid"}})},
          {id:"connector-dash-dashed",label:"Dashed",icon:"D",enabled:style.dash!=="dashed",onSelect:()=>updateConnector(c,{style:{dash:"dashed"}})},
          {id:"connector-dash-dotted",label:"Dotted",icon:"O",enabled:style.dash!=="dotted",onSelect:()=>updateConnector(c,{style:{dash:"dotted"}})},
          {id:"connector-width-2",label:"Thickness: 2px",icon:"2",enabled:Math.round(style.width)!==2,onSelect:()=>updateConnector(c,{style:{width:2}})},
          {id:"connector-width-3",label:"Thickness: 3px",icon:"3",enabled:Math.round(style.width)!==3,onSelect:()=>updateConnector(c,{style:{width:3}})},
          {id:"connector-width-4",label:"Thickness: 4px",icon:"4",enabled:Math.round(style.width)!==4,onSelect:()=>updateConnector(c,{style:{width:4}})},
        ],
      },
      {
        id:"connector-label",
        label:"Add label",
        items:[
          {id:"connector-label-edit",label:"Edit label",icon:"L",onSelect:()=>{
            const next=window.prompt("Connector label",String(c.label||""));
            if(next===null)return;
            updateConnector(c,{label:String(next||"")});
          }},
        ],
      },
      {
        id:"connector-actions",
        label:"Delete",
        items:[
          {id:"connector-delete",label:"Delete",icon:"x",danger:true,onSelect:()=>{d({type:"DEL_ARR",id:c.id});setSelectedArrow(null);}},
        ],
      },
    ];
  }

  function openConnectorMobileMenu(connectorId){
    const connector=connectorById[connectorId];
    if(!connector)return false;
    setSelectedArrow(connectorId);
    setCtxMenu(null);
    setMobileCtxMenu({
      target:"connector",
      nodeType:"connector",
      menu:buildConnectorContextGroups(connector),
    });
    return true;
  }

  function onConnectorCtx(e,connector){
    e.preventDefault();
    e.stopPropagation();
    if(!connector?.source?.id)return;
    setSelectedArrow(connector.source.id);
    const rect=wRef.current?.getBoundingClientRect();
    if(!rect)return;
    const menuW=286;
    const menuMaxH=Math.min(460,Math.floor(rect.height*.72));
    const edge=10;
    const localX=e.clientX-rect.left;
    const localY=e.clientY-rect.top;
    const sx=Math.max(edge,Math.min(localX,rect.width-menuW-edge));
    const sy=Math.max(edge,Math.min(localY,rect.height-menuMaxH-edge));
    const menu=buildConnectorContextGroups(connector);
    setCtxMenu({sx,sy,maxH:menuMaxH,menu});
  }

  function touchEvt(e){
    const t=e.touches?.[0]||e.changedTouches?.[0];
    if(!t)return null;
    return{
      clientX:t.clientX,
      clientY:t.clientY,
      button:0,
      isTouch:true,
      target:e.target,
      preventDefault:()=>e.preventDefault(),
      stopPropagation:()=>e.stopPropagation(),
    };
  }
  const touchDistance=(a,b)=>Math.hypot((a.clientX||0)-(b.clientX||0),(a.clientY||0)-(b.clientY||0));
  const touchPoint=e=>{
    const t=e.touches?.[0]||e.changedTouches?.[0];
    if(!t)return null;
    return{x:t.clientX,y:t.clientY};
  };

  function beginMobilePress(meta){
    if(!isMobile||!mobileInputRef.current)return;
    const x=Number(meta?.x);
    const y=Number(meta?.y);
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    mobileInputRef.current.beginPress({
      x,
      y,
      targetType:String(meta?.targetType||"canvas"),
      targetNodeId:String(meta?.targetNodeId||""),
      payload:meta?.payload||null,
    });
  }

  function onNodeTouchStart(e,nodeId){
    const t=e.touches?.[0];
    if(!t)return;
    e.stopPropagation();
    e.preventDefault();
    touchMetaRef.current={targetType:"node",targetNodeId:nodeId};
    beginMobilePress({x:t.clientX,y:t.clientY,targetType:"node",targetNodeId:nodeId});
    if(tool==="pan"){
      onNodeSel(nodeId,false,false);
      return;
    }
    onNodeSel(nodeId,false,false);
  }

  function onTouchStart(e){
    if(e.touches?.length===2){
      const[a,b]=e.touches;
      if(drag.current.type==="node"&&drag.current.nid){
        const src=nodes.find(n=>n.id===drag.current.nid);
        if(src&&!src.locked){
          const clone={...src,id:uid(),x:snap((Number(src.x)||0)+GRID,snapGrid),y:snap((Number(src.y)||0)+GRID,snapGrid)};
          d({type:"ADD",node:clone});
          d({type:"SEL",v:[clone.id]});
          drag.current={...drag.current,nid:clone.id,nx0:clone.x,ny0:clone.y,dupTriggered:true};
          toasts.push("Duplicate drag mode","info");
          e.preventDefault();
          return;
        }
      }
      mobileInputRef.current?.cancelPress();
      setRadialMenu(null);
      mobileInputRef.current?.beginTwoFinger([
        {x:a.clientX,y:a.clientY},
        {x:b.clientX,y:b.clientY},
      ]);
      pinch.current={
        startDist:touchDistance(a,b),
        startZoom:zoom,
        startPx:px,
        startPy:py,
        startMx:(a.clientX+b.clientX)/2,
        startMy:(a.clientY+b.clientY)/2,
        lastA:{x:a.clientX,y:a.clientY},
        lastB:{x:b.clientX,y:b.clientY},
      };
      drag.current.type="none";
      setLasso(null);
      e.preventDefault();
      return;
    }
    if(e.touches?.length>2)return;
    pinch.current=null;
    const ev=touchEvt(e);if(!ev)return;
    const connectorEl=e.target?.closest?.("[data-connector-id]");
    const connectorId=String(connectorEl?.getAttribute?.("data-connector-id")||"").trim();
    if(connectorId){
      touchMetaRef.current={targetType:"connector",targetNodeId:connectorId};
      beginMobilePress({x:ev.clientX,y:ev.clientY,targetType:"connector",payload:{connectorId}});
      setSelectedArrow(connectorId);
      drag.current.type="none";
      e.preventDefault();
      return;
    }
    touchMetaRef.current={targetType:"canvas",targetNodeId:""};
    beginMobilePress({x:ev.clientX,y:ev.clientY,targetType:"canvas",targetNodeId:""});
    e.preventDefault();
    onDown(ev);
  }
  function onTouchMove(e){
    const p=touchPoint(e);
    if(p)mobileInputRef.current?.movePress(p);
    if(radialMenu&&e.touches?.length===1&&p){
      const activeId=resolveRadialActiveId(radialMenu,p);
      setRadialMenu(prev=>prev?{...prev,activeId}:prev);
      e.preventDefault();
      return;
    }
    if(mobileInputRef.current?.getState()?.longPressTriggered){
      e.preventDefault();
      return;
    }
    if(e.touches?.length===2&&pinch.current){
      const[a,b]=e.touches;
      mobileInputRef.current?.updateTwoFinger([
        {x:a.clientX,y:a.clientY},
        {x:b.clientX,y:b.clientY},
      ]);
      pinch.current.lastA={x:a.clientX,y:a.clientY};
      pinch.current.lastB={x:b.clientX,y:b.clientY};
      const dist=touchDistance(a,b);
      if(dist>0&&pinch.current.startDist>0){
        const scale=dist/pinch.current.startDist;
        const nz=Math.max(.08,Math.min(6,pinch.current.startZoom*scale));
        const mx=(a.clientX+b.clientX)/2;
        const my=(a.clientY+b.clientY)/2;
        const wx=(pinch.current.startMx-pinch.current.startPx)/pinch.current.startZoom;
        const wy=(pinch.current.startMy-pinch.current.startPy)/pinch.current.startZoom;
        d({type:"PAN",x:mx-wx*nz,y:my-wy*nz});
        d({type:"ZOOM",v:nz});
      }
      e.preventDefault();
      return;
    }
    if(e.touches?.length>1)return;
    const ev=touchEvt(e);if(!ev)return;
    e.preventDefault();
    touchMovePendingRef.current=ev;
    if(!touchMoveRafRef.current){
      touchMoveRafRef.current=window.requestAnimationFrame(()=>{
        touchMoveRafRef.current=0;
        const nextEv=touchMovePendingRef.current;
        touchMovePendingRef.current=null;
        if(nextEv)onMove(nextEv);
      });
    }
  }
  function onTouchEnd(e){
    if(e.touches?.length>=2)return;
    const twoFingerResult=pinch.current&&mobileInputRef.current?.endTwoFinger?.([
      pinch.current.lastA||{x:0,y:0},
      pinch.current.lastB||{x:0,y:0},
    ]);
    if(twoFingerResult?.direction==="down"){d({type:"UNDO"});}
    if(twoFingerResult?.direction==="up"){d({type:"REDO"});}
    pinch.current=null;
    if(touchMoveRafRef.current){
      window.cancelAnimationFrame(touchMoveRafRef.current);
      touchMoveRafRef.current=0;
      touchMovePendingRef.current=null;
    }
    if(radialMenu){
      const t=e.changedTouches?.[0];
      const activeId=radialMenu.activeId||resolveRadialActiveId(radialMenu,t?{x:t.clientX,y:t.clientY}:null);
      mobileInputRef.current?.endPress?.();
      if(activeId){
        applyRadialAction(activeId,{x:radialMenu.wx,y:radialMenu.wy});
      }
      setRadialMenu(null);
      drag.current.type="none";
      setLasso(null);
      e.preventDefault();
      return;
    }
    const consumedByLongPress=mobileInputRef.current?.endPress?.()||false;
    if(consumedByLongPress){
      drag.current.type="none";
      setLasso(null);
      return;
    }
    if(drag.current.type==="none"){
      const t=e.changedTouches?.[0];
      if(t){
        const tapResult=mobileInputRef.current?.registerTap?.({
          x:t.clientX,
          y:t.clientY,
          targetType:touchMetaRef.current?.targetType||"canvas",
          targetNodeId:touchMetaRef.current?.targetNodeId||"",
        });
        if(tapResult?.doubleTap){
          if(tapResult.targetType==="canvas"){
            const w=toW(t.clientX,t.clientY);
            const p=resolveSmartPlacement(w.x,w.y,"right");
            d({type:"ADD",node:createCardNode(p.x,p.y)});
          }else if(tapResult.targetType==="node"&&tapResult.targetNodeId){
            const n=nodes.find(node=>node.id===tapResult.targetNodeId);
            if(n&&!n.locked){
              setMobileInlineEdit({
                nodeId:n.id,
                text:String(n.text||""),
              });
            }
          }
        }
      }
      return;
    }
    e.preventDefault();
    onUp();
  }

  function onPointerDown(e){
    if(!isMobile||e.pointerType!=="touch")return;
    if(!wRef.current)return;
    try{
      wRef.current.setPointerCapture(e.pointerId);
      mobilePointerCaptureRef.current={active:true,pointerId:e.pointerId};
    }catch{
      mobilePointerCaptureRef.current={active:false,pointerId:null};
    }
  }
  function onPointerUp(e){
    if(!isMobile||e.pointerType!=="touch")return;
    if(!wRef.current)return;
    if(mobilePointerCaptureRef.current.active&&mobilePointerCaptureRef.current.pointerId===e.pointerId){
      try{wRef.current.releasePointerCapture(e.pointerId);}catch{}
      mobilePointerCaptureRef.current={active:false,pointerId:null};
    }
  }

  const pts2d=pts=>pts.length<2?"":pts.reduce((a,p,i)=>i===0?`M${p.x},${p.y}`:`${a}L${p.x},${p.y}`,"");
  const gs=GRID*zoom,gox=((px%gs)+gs)%gs,goy=((py%gs)+gs)%gs;
  const cursors={select:"default",pan:"grab",sticky:"cell",text:"text",task:"crosshair",milestone:"crosshair",decision:"crosshair",transform:"crosshair",rect:"crosshair",circle:"crosshair",diamond:"crosshair",triangle:"crosshair",hexagon:"crosshair",parallelogram:"crosshair",cloud:"crosshair",cylinder:"crosshair",table:"crosshair",sheet:"crosshair",deck:"crosshair",laneH:"crosshair",laneV:"crosshair",arrow:"crosshair",draw:"crosshair",comment:"copy",frame:"crosshair",laser:"none",eraser:"crosshair"};
  // Canvas theme
  const cTheme=CANVAS_THEMES.find(t=>t.id===s.canvasTheme);
  const gridDotColor=cTheme?(snapGrid?cTheme.gridSnap:cTheme.grid):(snapGrid?"#2a3d54":"#1a2a3c");
  const gridDotR=cTheme?cTheme.dot:(snapGrid?.9:.65);
  const gridDotOp=cTheme?1:(snapGrid?1:.85);
  const isContainerType=type=>type==="frame"||type==="lane"||type==="sheet"||type==="deck"||type==="milestone";
  // Focus mode: dim unselected
  const focusSel=s.focusMode&&sel.length>0;
  const focusSet=focusSel?new Set([
    ...sel,
    ...arrows.flatMap(a=>{
      const ep=normalizeConnectorEndpoints(a);
      if(sel.includes(ep.fromEntityId)||sel.includes(ep.toEntityId))return[ep.fromEntityId,ep.toEntityId];
      return[];
    }),
  ]):null;
  const visibleNodes=nodes.filter(n=>!n.hidden);
  const taskNodes=useMemo(()=>visibleNodes.filter(n=>n.type==="task"||String(n.executionTaskId||"").trim()),[visibleNodes]);
  const taskNodeIdSet=useMemo(()=>new Set(taskNodes.map(n=>n.id)),[taskNodes]);
  const blockedByDepNodeSet=useMemo(()=>{
    const blocked=new Set();
    arrows.forEach(a=>{
      const fromId=a?.from?.entityId||a.fromId;
      const toId=a?.to?.entityId||a.toId;
      if(!fromId||!toId)return;
      if(!taskNodeIdSet.has(fromId)||!taskNodeIdSet.has(toId))return;
      const depType=getConnectorDependencyType(a);
      if(!depType)return;
      if(depType==="blocks")blocked.add(toId);
    });
    return blocked;
  },[arrows,taskNodeIdSet]);
  const milestoneStatsByNode=useMemo(()=>{
    const byNode={};
    const milById={};
    visibleNodes.forEach(n=>{
      if(n.type!=="milestone")return;
      const key=String(n.executionMilestoneId||n.id);
      milById[key]=n.id;
      byNode[n.id]={done:0,total:0};
    });
    taskNodes.forEach(tn=>{
      const key=String(tn.executionMilestoneId||"").trim();
      if(!key)return;
      const mileNodeId=milById[key];
      if(!mileNodeId)return;
      const st=normExecStatus(tn.executionStatus||tn.status);
      if(!byNode[mileNodeId])byNode[mileNodeId]={done:0,total:0};
      byNode[mileNodeId].total+=1;
      if(st==="Done")byNode[mileNodeId].done+=1;
    });
    return byNode;
  },[taskNodes,visibleNodes]);
  const renderedComments=useMemo(()=>comments.map(c=>{
    const nodeId=String(c?.nodeId||"").trim();
    if(!nodeId)return c;
    const n=nodes.find(item=>item.id===nodeId);
    if(!n)return c;
    return{...c,x:(Number(n.x)||0)+(Number(n.w)||120)+12,y:(Number(n.y)||0)-8};
  }),[comments,nodes]);
  const sortedNodes=[...visibleNodes.filter(n=>n.type==="frame").sort((a,b)=>(a.zIndex||0)-(b.zIndex||0)),...visibleNodes.filter(n=>n.type!=="frame").sort((a,b)=>(a.zIndex||0)-(b.zIndex||0))];
  const deps=depMode&&sel.length?collectDependency(arrows,sel):null;
  const nodeById=useMemo(()=>Object.fromEntries(visibleNodes.map(n=>[n.id,n])),[visibleNodes]);
  const selectedConnectorIdSet=useMemo(()=>new Set(selectedConnectorIds.map(id=>String(id||""))),[selectedConnectorIds]);
  const quickAddNode=useMemo(()=>{
    if(tool!=="select"||nodeDragActive||portConnect)return null;
    const hover=String(hoverNodeId||"").trim();
    if(hover){
      const match=visibleNodes.find(n=>n.id===hover);
      if(match&&!match.locked)return match;
    }
    if(sel.length===1){
      const selected=visibleNodes.find(n=>n.id===sel[0]);
      if(selected&&!selected.locked)return selected;
    }
    return null;
  },[hoverNodeId,nodeDragActive,portConnect,sel,tool,visibleNodes]);
  const quickAddButtons=useMemo(()=>{
    if(!quickAddNode)return[];
    const nodeW=Math.max(1,Number(quickAddNode.w)||120);
    const nodeH=Math.max(1,Number(quickAddNode.h)||80);
    const cx=(Number(quickAddNode.x)||0)+nodeW*0.5;
    const cy=(Number(quickAddNode.y)||0)+nodeH*0.5;
    const offset=Math.max(10,14/Math.max(.55,zoom));
    if(isMobile){
      return[{
        id:`${quickAddNode.id}-ctx`,
        nodeId:quickAddNode.id,
        direction:"right",
        x:(Number(quickAddNode.x)||0)+nodeW+offset,
        y:(Number(quickAddNode.y)||0)+nodeH+offset*.4,
        contextual:true,
      }];
    }
    return[
      {id:`${quickAddNode.id}-right`,nodeId:quickAddNode.id,direction:"right",x:(Number(quickAddNode.x)||0)+nodeW+offset,y:cy},
      {id:`${quickAddNode.id}-left`,nodeId:quickAddNode.id,direction:"left",x:(Number(quickAddNode.x)||0)-offset,y:cy},
      {id:`${quickAddNode.id}-up`,nodeId:quickAddNode.id,direction:"up",x:cx,y:(Number(quickAddNode.y)||0)-offset},
      {id:`${quickAddNode.id}-down`,nodeId:quickAddNode.id,direction:"down",x:cx,y:(Number(quickAddNode.y)||0)+nodeH+offset},
    ];
  },[isMobile,quickAddNode,zoom]);
  const spreadsheetEngine=useMemo(()=>createSpreadsheetEngine({nodes,arrows}),[nodes,arrows]);
  const spreadsheetFlowEdgeSet=useMemo(()=>new Set((spreadsheetEngine?.sheetEdges||[]).map(edge=>`${edge.fromSheetId}->${edge.toSheetId}`)),[spreadsheetEngine]);
  const dataConnectorIdSet=useMemo(()=>new Set(Array.isArray(dataFlowRuntime?.dataConnectorIds)?dataFlowRuntime.dataConnectorIds:[]),[dataFlowRuntime]);
  const dataConnectorErrorById=dataFlowRuntime&&typeof dataFlowRuntime==="object"&&dataFlowRuntime.connectorErrorsById?dataFlowRuntime.connectorErrorsById:{};
  const dataConnectorPreviewById=dataFlowRuntime&&typeof dataFlowRuntime==="object"&&dataFlowRuntime.connectorPreviewById?dataFlowRuntime.connectorPreviewById:{};
  const dataNodeErrorById=dataFlowRuntime&&typeof dataFlowRuntime==="object"&&dataFlowRuntime.nodeErrorsById?dataFlowRuntime.nodeErrorsById:{};
  const formulaHighlightSheetSet=useMemo(()=>{
    const refs=Array.isArray(sheetFormulaSession?.referencedSheetIds)?sheetFormulaSession.referencedSheetIds:[];
    return new Set(refs);
  },[sheetFormulaSession]);
  const routingObstacleNodes=useMemo(()=>{
    return routeNodes.filter(node=>{
      if(!node||node.hidden)return false;
      if(node.type==="text")return false;
      const w=Math.max(1,Number(node.w)||0);
      const h=Math.max(1,Number(node.h)||0);
      return w>=18&&h>=18;
    });
  },[routeNodes]);
  const obstacleRects=useMemo(()=>{
    return buildObstacleRects(routingObstacleNodes,30);
  },[routingObstacleNodes]);
  const obstacleIndex=useMemo(()=>buildObstacleIndex(obstacleRects,320),[obstacleRects]);
  const baseConnectorVisuals=useMemo(()=>{
    return arrows.map(a=>{
      const ep=normalizeConnectorEndpoints(a);
      const fromNode=nodeById[ep.fromEntityId];
      const toNode=nodeById[ep.toEntityId];
      if(!fromNode||!toNode)return null;
      const style=normalizeConnectorStyle(a);
      const routing=normalizeConnectorRouting(a.routing);
      const jumpStyle=normalizeConnectorJumpStyle(a.jumpStyle,"auto");
      const start=clampCanvasPoint(getAnchorWorldPosition(fromNode,ep.fromAnchor));
      const end=clampCanvasPoint(getAnchorWorldPosition(toNode,ep.toAnchor));
      let routePoints=[start,end];
      const bounds={
        x:Math.min(start.x,end.x)-260,
        y:Math.min(start.y,end.y)-260,
        w:Math.abs(end.x-start.x)+520,
        h:Math.abs(end.y-start.y)+520,
      };
      const nearby=queryObstacleIndex(obstacleIndex,bounds).filter(o=>o.id!==ep.fromEntityId&&o.id!==ep.toEntityId);
      if(routing==="ortho"||routing==="wavy"){
        routePoints=routeOrthoAStar(start,end,nearby,{gridSize:32,margin:220});
      }else if(routing==="straight"&&nearby.length){
        const intersects=nearby.some(rect=>segmentIntersectsRect(start,end,rect,2));
        if(intersects){
          routePoints=routeOrthoAStar(start,end,nearby,{gridSize:32,margin:220});
        }
      }
      const path=defaultConnectorPath(start,end,routing,style,routePoints);
      return{
        id:a.id,
        source:a,
        fromId:ep.fromEntityId,
        toId:ep.toEntityId,
        routing,
        style,
        start,
        end,
        jumpStyle,
        routePoints,
        path,
        mid:connectorMidpoint(routePoints.length?routePoints:[start,end]),
      };
    }).filter(Boolean);
  },[arrows,nodeById,obstacleIndex]);
  useEffect(()=>{
    let cancelled=false;
    let idleId=null;
    const timer=setTimeout(()=>{
      const commit=()=>{if(!cancelled)setJumpConnectorSource(baseConnectorVisuals);};
      if(typeof window!=="undefined"&&typeof window.requestIdleCallback==="function"){
        idleId=window.requestIdleCallback(()=>commit(),{timeout:420});
      }else{
        commit();
      }
    },240);
    return()=>{
      cancelled=true;
      clearTimeout(timer);
      if(typeof window!=="undefined"&&idleId!==null&&typeof window.cancelIdleCallback==="function"){
        window.cancelIdleCallback(idleId);
      }
    };
  },[baseConnectorVisuals]);
  const connectorJumpMap=useMemo(()=>{
    return segmentsToIntersections(jumpConnectorSource,{
      endpointClearance:12,
      maxJumpsPerConnector:20,
      bucketSize:220,
      maxChecks:36000,
    });
  },[jumpConnectorSource]);
  const connectorVisuals=useMemo(()=>{
    return baseConnectorVisuals.map(connector=>{
      const jumpStyle=normalizeConnectorJumpStyle(connector.jumpStyle,"auto");
      if(jumpStyle==="off")return{...connector,jumpCount:0};
      if(!(connector.routing==="ortho"||connector.routing==="straight"))return{...connector,jumpCount:0};
      const jumps=connectorJumpMap.get(connector.id)||[];
      if(!jumps.length)return{...connector,jumpCount:0};
      const path=applyJumpsToPath(connector.routePoints.length?connector.routePoints:[connector.start,connector.end],jumps,{jumpRadius:7,jumpSpacing:16});
      if(!path)return{...connector,jumpCount:0};
      return{
        ...connector,
        path,
        jumpCount:jumps.length,
      };
    });
  },[baseConnectorVisuals,connectorJumpMap]);
  const connectorById=useMemo(()=>Object.fromEntries(connectorVisuals.map(c=>[c.id,c])),[connectorVisuals]);
  const portVisibleNodeIds=new Set([hoverNodeId,...sel,portConnect?.fromEntityId||"",portConnect?.targetPort?.nodeId||""]);
  const visiblePortNodes=visibleNodes.filter(n=>portVisibleNodeIds.has(n.id));
  const colorInputBgValue=normalizeColorInputValue(bgColor,getThemeColorHex("--ui-bg0",DEFAULT_CANVAS_BG));

  const getPortPointsForNode=node=>DEFAULT_PORTS.map(port=>{
    const p=getPortWorldPosition(node,port.id);
    return{...p,nodeId:node.id,nodeType:node.type,portId:port.id};
  });
  function findClosestPort(wx,wy,excludeNodeId=null){
    let best=null;
    let bestD=Infinity;
    for(const n of visibleNodes){
      if(excludeNodeId&&n.id===excludeNodeId)continue;
      for(const port of getPortPointsForNode(n)){
        const d2=(port.x-wx)*(port.x-wx)+(port.y-wy)*(port.y-wy);
        if(d2<bestD){bestD=d2;best=port;}
      }
    }
    if(!best)return null;
    const dist=Math.sqrt(bestD);
    const threshold=Math.max(16,26/Math.max(.2,zoom));
    return dist<=threshold?{...best,dist}:null;
  }
  function startPortConnect(e,nodeId,portId){
    e.preventDefault();
    e.stopPropagation();
    const n=nodes.find(x=>x.id===nodeId);
    if(!n)return;
    const p=getPortWorldPosition(n,portId);
    setPortConnect({fromEntityId:nodeId,fromPortId:portId,start:{x:p.x,y:p.y},mouse:{x:p.x,y:p.y},targetPort:null});
    d({type:"EXIT_ADD_MODE"});
  }
  useEffect(()=>{
    if(!portConnect)return;
    const raf={id:0,last:null};
    const commitMove=()=>{
      raf.id=0;
      if(!raf.last)return;
      const pt=raf.last;
      raf.last=null;
      const hit=findClosestPort(pt.x,pt.y,portConnect.fromEntityId);
      setPortConnect(prev=>prev?{...prev,mouse:pt,targetPort:hit}:prev);
    };
    const move=e=>{
      if(!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return;
      const pt=toW(e.clientX,e.clientY);
      raf.last=pt;
      if(!raf.id){
        raf.id=window.requestAnimationFrame(commitMove);
      }
    };
    const up=e=>{
      if(raf.id){
        window.cancelAnimationFrame(raf.id);
        raf.id=0;
      }
      const pt=toW(e.clientX,e.clientY);
      const hit=portConnect.targetPort||findClosestPort(pt.x,pt.y,portConnect.fromEntityId);
      if(hit&&hit.nodeId&&hit.nodeId!==portConnect.fromEntityId){
        const connector=buildConnectorFromDefaults({
          fromEntityId:portConnect.fromEntityId,
          toEntityId:hit.nodeId,
          fromAnchor:{type:"port",portId:portConnect.fromPortId},
          toAnchor:{type:"port",portId:hit.portId},
        });
        if(connector){
          d({type:"ADD_ARR",arr:connector});
          triggerConnectorSnapFx({x:hit.x,y:hit.y});
        }
      }else{
        addNodeAndConnector(portConnect.fromEntityId,pt);
      }
      setPortConnect(null);
    };
    window.addEventListener("pointermove",move,{passive:true});
    window.addEventListener("pointerup",up,{passive:true});
    return()=>{
      if(raf.id)window.cancelAnimationFrame(raf.id);
      window.removeEventListener("pointermove",move);
      window.removeEventListener("pointerup",up);
    };
  },[addNodeAndConnector,buildConnectorFromDefaults,portConnect,triggerConnectorSnapFx,zoom,visibleNodes]);

  const previewConnectorPath=useMemo(()=>{
    if(!portConnect)return"";
    const start=portConnect.start||{x:0,y:0};
    const end=portConnect.targetPort
      ?{x:portConnect.targetPort.x,y:portConnect.targetPort.y}
      :(portConnect.mouse||start);
    return`M${start.x},${start.y} L${end.x},${end.y}`;
  },[portConnect]);

  // Present mode: clip to frame
  const pFrameNode=presentFrame?nodes.find(n=>n.id===presentFrame):null;

  function onDblClick(e){
    if(tool==="select"&&!e.target.closest("[data-node]")){
      const{x,y}=toW(e.clientX,e.clientY);
      const sc=SC[_si++%8];
      d({type:"ADD",node:{id:uid(),type:"sticky",x:x-85,y:y-65,w:170,h:130,text:"",color:sc.bg,textColor:sc.t}});
    }
  }

  function onCtxUploadImage(e){
    const f=e.target.files?.[0];
    if(!f){e.target.value="";return;}
    const pos=ctxUploadPosRef.current||{wx:0,wy:0};
    const r2=new FileReader();
    r2.onload=ev=>{d({type:"ADD",node:{id:uid(),type:"image",src:ev.target.result,x:pos.wx-150,y:pos.wy-100,w:300,h:200}});toasts.push("Image added","success");};
    r2.readAsDataURL(f);
    e.target.value="";
    ctxUploadPosRef.current=null;
  }

  function makeContextCommands({wx,wy,effectiveSelIds,targetNode,detectedImportUrl}){
    const scopedSel=Array.isArray(effectiveSelIds)?effectiveSelIds:[];
    const scopedNodes=nodes.filter(n=>scopedSel.includes(n.id));
    const firstNode=targetNode||scopedNodes[0]||null;
    const allLocked=scopedNodes.length>0&&scopedNodes.every(n=>n.locked);
    const hasGrouped=scopedNodes.some(n=>n.groupId);
    const canUndo=Boolean(s.hist?.length);
    const canRedo=Boolean(s.fut?.length);
    const baseAdd=(node)=>{if(node)d({type:"ADD",node});};
    const normalizeLink=raw=>{const v=String(raw||"").trim();if(!v)return"";return/^https?:\/\//i.test(v)?v:`https://${v}`;};
    const addSimpleLinkNode=url=>{
      const safe=normalizeLink(url);
      if(!safe)return;
      baseAdd({id:uid(),type:"text",x:wx,y:wy,w:300,h:44,text:safe.replace(/^https?:\/\/(www\.)?/i,""),color:T.t0,textColor:T.t0,fontSize:16,fontWeight:"700",url:safe});
    };
    const setPerSelection=patch=>scopedSel.forEach(id=>d({type:"UPD",id,p:patch}));
    return{
      canUndo,
      canRedo,
      canToggleGrid:true,
      hasGroupedSelection:hasGrouped,
      isLockedSelection:allLocked,
      addSticky:()=>{const sc=SC[_si++%8];baseAdd({id:uid(),type:"sticky",x:wx,y:wy,w:170,h:130,text:"",color:sc.bg,textColor:sc.t});},
      addText:()=>baseAdd({id:uid(),type:"text",x:wx,y:wy,w:180,h:44,text:"Text",color:T.t0,textColor:T.t0,fontSize:22,fontWeight:"700"}),
      addTask:()=>{
        const task={
          id:uid(),
          type:"task",
          x:wx,
          y:wy,
          w:250,
          h:150,
          color:"#0f172a",
          textColor:"#e2e8f0",
          borderColor:"#334155",
          fontSize:11,
          fontWeight:"500",
          executionTaskId:uid(),
          executionTitle:"New Task",
          executionDescription:"",
          executionStatus:"Todo",
          executionOwner:"TBD",
          executionPriority:"P2",
          executionDueDate:"TBD",
          executionTags:[],
          executionMilestoneId:null,
          executionMilestone:"",
          executionGithubUrl:null,
          executionJiraUrl:null,
        };
        task.text=composeTaskNodeText({
          title:task.executionTitle,
          description:task.executionDescription,
          status:task.executionStatus,
          owner:task.executionOwner,
          priority:task.executionPriority,
          dueDate:task.executionDueDate,
          tags:task.executionTags,
          githubUrl:"",
          jiraUrl:"",
        });
        baseAdd(task);
      },
      addMilestone:()=>{
        const milestone={
          id:uid(),
          type:"milestone",
          x:wx,
          y:wy,
          w:320,
          h:164,
          color:"#111827",
          textColor:"#e5e7eb",
          borderColor:"#6366f1",
          fontSize:12,
          fontWeight:"700",
          executionMilestoneId:uid(),
          executionMilestone:"Milestone",
          executionDueDate:"TBD",
        };
        milestone.text=composeMilestoneNodeText({title:milestone.executionMilestone,dueDate:milestone.executionDueDate,progressDone:0,progressTotal:0});
        baseAdd(milestone);
      },
      addDecision:()=>{
        const decision={
          id:uid(),
          type:"decision",
          x:wx,
          y:wy,
          w:270,
          h:170,
          color:"#1f2937",
          textColor:"#f3f4f6",
          borderColor:"#f59e0b",
          fontSize:11,
          fontWeight:"600",
          executionDecisionId:uid(),
          executionDecision:"Decision",
          executionDecisionDate:"TBD",
          executionOwner:"TBD",
          executionContext:"",
          executionOutcome:"",
        };
        decision.text=composeDecisionNodeText({
          decision:decision.executionDecision,
          date:decision.executionDecisionDate,
          owner:decision.executionOwner,
          context:decision.executionContext,
          outcome:decision.executionOutcome,
        });
        baseAdd(decision);
      },
      addTransform:()=>{
        baseAdd(createTransformNode({uid,x:wx,y:wy,transformType:"sum"}));
      },
      addShape:(shapeType)=>baseAdd(makeShapeNode(shapeType||"rect",wx,wy)),
      addContainer:(kind)=>{
        if(kind==="frame"){baseAdd({id:uid(),type:"frame",x:wx,y:wy,w:420,h:280,text:"Frame",color:"transparent",borderColor:T.b1});return;}
        if(kind==="laneH"){baseAdd({id:uid(),type:"lane",orientation:"h",x:wx,y:wy,w:920,h:180,text:"Swimlane",color:T.bg3,textColor:T.t0,borderColor:T.b1});return;}
        if(kind==="laneV"){baseAdd({id:uid(),type:"lane",orientation:"v",x:wx,y:wy,w:220,h:640,text:"Swimlane",color:T.bg3,textColor:T.t0,borderColor:T.b1});return;}
        if(kind==="sheet"){baseAdd(makeSheetNode(wx,wy));return;}
        if(kind==="deck"){baseAdd(makeDeckNode(wx,wy));}
      },
      addChart:()=>{
        baseAdd({
          id:uid(),
          type:"chart",
          x:wx,
          y:wy,
          w:420,
          h:300,
          text:"Chart",
          chartType:"bar",
          chartSummary:"3 points",
          chartData:[
            {label:"A",value:30},
            {label:"B",value:55},
            {label:"C",value:22},
          ],
          color:"#0f1929",
          textColor:"#e2e8f0",
          borderColor:"#334155",
          fontSize:13,
          fontWeight:"600",
        });
      },
      generateBoardAi:()=>{
        const raw=window.prompt("Describe the board to generate","");
        if(raw===null)return;
        const prompt=String(raw||"").trim();
        if(!prompt)return;
        window.dispatchEvent(new CustomEvent("boardai:generate-board",{detail:{prompt}}));
      },
      addImageUpload:()=>{ctxUploadPosRef.current={wx,wy};ctxUploadRef.current?.click();},
      addLinkEmbed:()=>{
        const raw=window.prompt("Paste URL",detectedImportUrl||"https://");
        if(raw===null)return;
        addSimpleLinkNode(raw);
      },
      addMindmapNode:()=>{
        const node=makeShapeNode("circle",wx,wy);
        node.text="Idea";
        node.color="#1d4ed8";
        node.textColor="#ffffff";
        node.w=110;
        node.h=110;
        baseAdd(node);
      },
      paste:()=>d({type:"PASTE"}),
      importFromDetectedUrl:()=>{
        const raw=detectedImportUrl||window.prompt("Paste Jira/GitHub URL","");
        if(raw===null||raw===undefined)return;
        const safe=normalizeLink(raw);
        if(!safe)return;
        addSimpleLinkNode(safe);
        toasts.push("Link imported on board","success");
      },
      zoomIn:()=>d({type:"ZOOM",v:zoom*1.15}),
      zoomOut:()=>d({type:"ZOOM",v:zoom*.87}),
      fitView:()=>{const r=wRef.current;if(!r)return;d({type:"ZOOM_FIT",vw:r.offsetWidth,vh:r.offsetHeight});},
      toggleGrid:()=>d({type:"SNAP_TOGGLE"}),
      undo:()=>d({type:"UNDO"}),
      redo:()=>d({type:"REDO"}),
      openBoardSettings:()=>toasts.push("Board settings: open right panel","info"),
      renameSelection:()=>{
        if(!firstNode)return;
        const next=window.prompt("Rename",String(firstNode.text||""));
        if(next===null)return;
        d({type:"UPD",id:firstNode.id,p:{text:next}});
      },
      duplicateSelection:()=>{if(!scopedSel.length)return;d({type:"DUP"});},
      toggleLockSelection:()=>{if(!scopedSel.length)return;d({type:"LOCK_SEL"});},
      deleteSelection:()=>{if(!scopedSel.length)return;d({type:"DEL",ids:scopedSel});},
      autoLayout:()=>{if(scopedSel.length<2)return;d({type:"TIDY",ids:scopedSel});},
      align:(dir)=>{if(scopedSel.length<2)return;d({type:"ALIGN",d:dir});},
      setFill:(color)=>{
        if(!scopedSel.length)return;
        if(color===null){setPerSelection({color:T.bg3});return;}
        setPerSelection({color});
      },
      toggleBorder:()=>{
        if(!scopedSel.length)return;
        const next=scopedNodes.some(n=>n.borderColor)?null:T.b1;
        setPerSelection({borderColor:next});
      },
      addLinkToSelection:()=>{
        if(!scopedSel.length)return;
        const raw=window.prompt("Link URL",String(firstNode?.url||"https://"));
        if(raw===null)return;
        const safe=normalizeLink(raw);
        if(!safe)return;
        setPerSelection({url:safe});
      },
      startConnectFromSelection:()=>{
        const sourceId=scopedSel[0]||firstNode?.id;
        if(!sourceId)return;
        const sourceNode=nodes.find(n=>n.id===sourceId);
        if(!sourceNode)return;
        const p=getPortWorldPosition(sourceNode,"right");
        setPortConnect({
          fromEntityId:sourceId,
          fromPortId:"right",
          start:{x:p.x,y:p.y},
          mouse:{x:p.x,y:p.y},
          targetPort:null,
        });
        d({type:"EXIT_ADD_MODE"});
        toasts.push("Drag to a target port to connect","info");
      },
      manageConnections:()=>{d({type:"DEP_MODE",v:true});toasts.push("Dependency mode enabled","info");},
      groupSelection:()=>{if(scopedSel.length<2)return;d({type:"GROUP"});},
      ungroupSelection:()=>{if(!scopedSel.length)return;d({type:"UNGROUP"});},
      bringToFront:()=>{if(!scopedSel.length)return;d({type:"Z_FRONT"});},
      sendToBack:()=>{if(!scopedSel.length)return;d({type:"Z_BACK"});},
      editSelection:()=>{
        if(!firstNode)return;
        const next=window.prompt("Edit text",String(firstNode.text||""));
        if(next===null)return;
        d({type:"UPD",id:firstNode.id,p:{text:next}});
      },
      convertSelection:(kind)=>{
        if(!scopedSel.length)return;
        scopedSel.forEach(id=>{
          const n=nodes.find(x=>x.id===id);
          if(!n)return;
          const base=String(n.text||"").replace(/^\[(TASK|NOTE)\]\s*/i,"");
          if(kind==="task")d({type:"UPD",id,p:{text:`[TASK] ${base}`.trim(),color:"#fef3c7",textColor:"#713f12"}});
          else if(kind==="note")d({type:"UPD",id,p:{text:`[NOTE] ${base}`.trim(),color:"#dbeafe",textColor:"#1e3a8a"}});
          else if(kind==="text")d({type:"UPD",id,p:{text:base,fontSize:20,fontWeight:"700"}});
        });
      },
      wrapInFrame:()=>{if(scopedSel.length<1)return;d({type:"WRAP_FRAME",ids:scopedSel,title:"Frame"});},
    };
  }

  function flattenMobileContextGroups(groups){
    return(groups||[]).map(group=>{
      const items=[];
      (group.items||[]).forEach(item=>{
        if(Array.isArray(item.subMenu)&&item.subMenu.length){
          item.subMenu.forEach(subGroup=>{
            (subGroup.items||[]).forEach(subItem=>{
              items.push({
                ...subItem,
                label:`${item.label}: ${subItem.label}`,
              });
            });
          });
        }else{
          items.push(item);
        }
      });
      return{
        ...group,
        items,
      };
    }).filter(group=>Array.isArray(group.items)&&group.items.length);
  }

  const mobileCtxGroups=useMemo(()=>flattenMobileContextGroups(mobileCtxMenu?.menu),[mobileCtxMenu]);
  const mobileCtxTitle=useMemo(()=>{
    if(!mobileCtxMenu)return"Actions";
    if(mobileCtxMenu.target==="canvas")return"Canvas Actions";
    if(mobileCtxMenu.target==="container")return"Container Actions";
    if(mobileCtxMenu.target==="connector")return"Connector Actions";
    if(mobileCtxMenu.target==="selection")return"Selection Actions";
    return"Element Actions";
  },[mobileCtxMenu]);

  return<div ref={wRef} style={{flex:1,position:"relative",overflow:"hidden",background:bgColor||T.bg0,cursor:cursors[tool]||"default",touchAction:"none",overscrollBehavior:"none"}}
    onMouseDown={onDown} onMouseMove={onMouseMove} onMouseUp={onUp}
    onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
    onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    onContextMenu={onCtx} onDoubleClick={onDblClick}>

    {/* GRID */}
    {!presentMode&&<svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
      <defs><pattern id="g" width={gs} height={gs} patternUnits="userSpaceOnUse" x={gox} y={goy}><circle cx={1} cy={1} r={gridDotR} fill={gridDotColor} opacity={gridDotOp}/></pattern></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>}

    {/* WORLD */}
    <div style={{position:"absolute",inset:0,transform:`translate(${px}px,${py}px) scale(${zoom})`,transformOrigin:"0 0",
      ...(pFrameNode?{clipPath:`inset(${pFrameNode.y}px ${-(pFrameNode.x+pFrameNode.w)}px ${-(pFrameNode.y+pFrameNode.h)}px ${pFrameNode.x}px)`}:{})}}>

      {/* DRAWINGS */}
      <svg style={{position:"absolute",inset:0,width:10000,height:10000,overflow:"visible",pointerEvents:"none",zIndex:5}}>
        {drawings.map(dr=><path key={dr.id} d={pts2d(dr.pts)} fill="none" stroke={dr.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={.9}/>)}
        {livePath.length>1&&<path d={pts2d(livePath)} fill="none" stroke={dColor.current} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={.9}/>}
      </svg>

      {/* ARROWS */}
      <svg style={{position:"absolute",inset:0,width:10000,height:10000,overflow:"visible",pointerEvents:"auto",zIndex:6}}>
        <defs>
          <marker id="connector-cap-arrow-end" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><path d="M0 0 L8 3.5 L0 7 Z" fill="context-stroke"/></marker>
          <marker id="connector-cap-arrow-start" markerWidth="9" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse"><path d="M0 0 L8 3.5 L0 7 Z" fill="context-stroke"/></marker>
          <marker id="connector-cap-triangle-end" markerWidth="10" markerHeight="9" refX="9" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 Z" fill="context-stroke"/></marker>
          <marker id="connector-cap-triangle-start" markerWidth="10" markerHeight="9" refX="1" refY="4.5" orient="auto-start-reverse"><path d="M0 0 L9 4.5 L0 9 Z" fill="context-stroke"/></marker>
          <marker id="connector-cap-circle-end" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><circle cx="3.5" cy="3.5" r="2.5" fill="context-stroke"/></marker>
          <marker id="connector-cap-circle-start" markerWidth="7" markerHeight="7" refX="2" refY="3.5" orient="auto-start-reverse"><circle cx="3.5" cy="3.5" r="2.5" fill="context-stroke"/></marker>
        </defs>
        {connectorVisuals.map(connector=>{
          const a=connector.source;
          const connectorSelected=selectedConnectorIdSet.has(String(a.id||""));
          const isSel=sel.includes(connector.fromId)||sel.includes(connector.toId)||selectedArrow===a.id||connectorSelected;
          const isHover=hoveredConnectorId===a.id;
          const isSheetDataFlow=spreadsheetFlowEdgeSet.has(`${connector.fromId}->${connector.toId}`);
          const isDataFlowConnector=dataConnectorIdSet.has(a.id)||isSheetDataFlow||isDataConnector(a);
          const dataError=String(dataConnectorErrorById[a.id]||"").trim();
          const depEdge=deps?(deps.upEdges.has(a.id)||deps.downEdges.has(a.id)||sel.includes(connector.fromId)||sel.includes(connector.toId)):false;
          const depType=getConnectorDependencyType(a);
          const hasDepType=Boolean(depType);
          const depCol=depType==="blocks"?"#f97316":depType==="related"?"#22c55e":"#60a5fa";
          const depDash=depType==="related"?"dotted":depType==="blocks"?"dashed":"solid";
          const baseStroke=deps?(deps.upEdges.has(a.id)?"#60a5fa":deps.downEdges.has(a.id)?"#34d399":"#334155"):((isSel||isHover)?T.y:(hasDepType?depCol:(isDataFlowConnector?"#22d3ee":(connector.style.stroke||T.t2))));
          const stroke=dataError?T.red:baseStroke;
          const sw=deps?(depEdge?Math.max(2,connector.style.width):Math.max(1,connector.style.width*.75)):((isSel||isHover)?Math.max(2,connector.style.width+.2):connector.style.width);
          const op=deps?(depEdge?1:.2):((isSel||isHover)?1:(isDataFlowConnector?0.96:1));
          const dashArray=dashArrayForStyle(hasDepType?depDash:(isDataFlowConnector?"dashed":connector.style.dash),sw);
          const routePoints=connector.routePoints.length?connector.routePoints:[connector.start,connector.end];
          return<g
            key={a.id}
            data-connector-id={a.id}
            style={{pointerEvents:"auto"}}
            onPointerEnter={()=>setHoveredConnectorId(a.id)}
            onPointerLeave={()=>setHoveredConnectorId(v=>v===a.id?"":v)}
            onPointerDown={e=>{
              if(e.pointerType==="touch"){
                e.stopPropagation();
                setSelectedArrow(a.id);
              }
            }}
            onClick={e=>{
              e.stopPropagation();
              if(e.shiftKey)return;
              setSelectedArrow(a.id===selectedArrow?null:a.id);
            }}
            onContextMenu={e=>onConnectorCtx(e,connector)}
          >
            <path data-connector-id={a.id} d={connector.path} fill="none" stroke="transparent" strokeWidth={22} style={{cursor:"pointer"}}/>
            <path className={`connector-line${isDataFlowConnector?" connector-line-data":""}${isSel?" connector-line-selected":""}`} data-connector-id={a.id} d={connector.path} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dashArray} style={{...(connector.style.dash!=="solid"?{animation:"dash 1.5s linear infinite"}:{}),opacity:op}} markerEnd={connectorCapMarkerId(connector.style.endCap,false)} markerStart={connectorCapMarkerId(connector.style.startCap,true)}/>
            {selectedArrow===a.id&&routePoints.map((pt,idx)=><circle key={`${a.id}_cp_${idx}`} cx={pt.x} cy={pt.y} r={3.5} fill={T.yBg} stroke={T.y} strokeWidth={1.1} style={{pointerEvents:"none"}}/>)}
            {isDataFlowConnector&&<g style={{pointerEvents:"none"}}>
              <circle cx={connector.mid.x} cy={connector.mid.y} r={8} fill={dataError?"rgba(239,68,68,.25)":"rgba(34,211,238,.22)"} stroke={dataError?T.red:"#22d3ee"} strokeWidth={1.2}/>
              <text x={connector.mid.x} y={connector.mid.y+3.1} textAnchor="middle" fontSize="8" fill={dataError?T.red:"#67e8f9"} fontFamily="'JetBrains Mono',monospace" fontWeight="700">D</text>
            </g>}
          </g>;
        })}
        {previewConnectorPath&&<path d={previewConnectorPath} fill="none" stroke={T.y} strokeWidth={1.8} strokeDasharray="6 6" opacity={0.9}/>}
      </svg>
      {smartConnectSuggestion&&<svg style={{position:"absolute",inset:0,width:10000,height:10000,overflow:"visible",pointerEvents:"none",zIndex:17}}>
        <path d={`M${smartConnectSuggestion.start.x},${smartConnectSuggestion.start.y} L${smartConnectSuggestion.end.x},${smartConnectSuggestion.end.y}`} fill="none" stroke={T.blue} strokeWidth={1.8} strokeDasharray="8 6" opacity={.95}/>
        <circle cx={smartConnectSuggestion.start.x} cy={smartConnectSuggestion.start.y} r={4} fill={T.blue} opacity={.75}/>
        <circle cx={smartConnectSuggestion.end.x} cy={smartConnectSuggestion.end.y} r={4} fill={T.blue} opacity={.75}/>
      </svg>}
      {smartConnectSuggestion&&<button
        type="button"
        onPointerDown={e=>{e.stopPropagation();}}
        onClick={e=>{
          e.stopPropagation();
          acceptSmartConnectSuggestion(smartConnectSuggestion);
        }}
        style={{
          position:"absolute",
          left:smartConnectSuggestion.mid.x-Math.max(22,30/Math.max(.45,zoom)),
          top:smartConnectSuggestion.mid.y-Math.max(14,20/Math.max(.45,zoom)),
          minWidth:Math.max(46,74/Math.max(.45,zoom)),
          height:Math.max(24,30/Math.max(.45,zoom)),
          borderRadius:999,
          border:`1px solid ${T.blue}`,
          background:"rgba(30,58,138,.88)",
          color:"#dbeafe",
          fontSize:Math.max(8.5,10/Math.max(.45,zoom)),
          fontFamily:"'JetBrains Mono',monospace",
          fontWeight:700,
          cursor:"pointer",
          zIndex:25,
          pointerEvents:"auto",
        }}
      >Connect</button>}
      {quickAddButtons.map(btn=>{
        const size=Math.max(18,22/Math.max(.45,zoom));
        return<button
          key={btn.id}
          type="button"
          onPointerDown={e=>{e.stopPropagation();}}
          onClick={e=>{
            e.stopPropagation();
            createConnectedNode(btn.nodeId,btn.direction);
          }}
          title={btn.contextual?"Quick add":"Quick add connected node"}
          style={{
            position:"absolute",
            left:btn.x-size*0.5,
            top:btn.y-size*0.5,
            width:size,
            height:size,
            borderRadius:"50%",
            border:`1px solid ${btn.contextual?T.yDim:T.blue}`,
            background:btn.contextual?T.yBg:"rgba(15,23,42,.9)",
            color:btn.contextual?T.y:"#bfdbfe",
            boxShadow:btn.contextual?"0 6px 18px rgba(250,204,21,.28)":"0 6px 18px rgba(30,64,175,.28)",
            fontSize:Math.max(12,15/Math.max(.45,zoom)),
            lineHeight:1,
            fontFamily:"'JetBrains Mono',monospace",
            fontWeight:700,
            cursor:"pointer",
            zIndex:26,
            pointerEvents:"auto",
          }}
        >+</button>;
      })}
      {connectorSnapFx&&<div className="snap-pulse" style={{left:connectorSnapFx.x-10,top:connectorSnapFx.y-10,zIndex:16,pointerEvents:"none"}}/>}
      {taskSuccessFx&&<div className="success-badge" style={{position:"absolute",left:taskSuccessFx.x,top:taskSuccessFx.y,zIndex:32,pointerEvents:"none",minWidth:26,height:26,padding:"0 8px",borderRadius:999,border:`1px solid rgba(34,197,94,.45)`,background:"rgba(34,197,94,.15)",color:"#86efac",fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>OK</div>}

      {/* ARROW LABELS */}
      {connectorVisuals.map(connector=>{
        const a=connector.source;
        const isSheetDataFlow=spreadsheetFlowEdgeSet.has(`${connector.fromId}->${connector.toId}`);
        const isDataFlowConnector=dataConnectorIdSet.has(a.id)||isSheetDataFlow||isDataConnector(a);
        const displayLabel=String(a.label||"").trim()||(isDataFlowConnector?"data":"");
        return<div key={`lbl-${a.id}`} data-arr-label style={{position:"absolute",left:0,top:0,zIndex:14,pointerEvents:"none"}}>
          <ArrowLabel label={displayLabel} mx={connector.mid.x} my={connector.mid.y} onUpdate={v=>d({type:"UPD_ARR",id:a.id,p:{label:v}})} onDelete={()=>d({type:"DEL_ARR",id:a.id})}/>
        </div>;
      })}

      {/* NODES */}
      <div className={nodeDragActive?"node-drag-active":""} style={{position:"absolute",inset:0,zIndex:10}}>
        {sortedNodes.map(node=>{
          const nodeError=String(dataNodeErrorById[node.id]||"").trim();
          const renderNode=nodeError&&!String(node.dataFlowError||"").trim()?{...node,dataFlowError:nodeError}:node;
          const isSel=sel.includes(node.id);
          let depFade=1;
          if(deps){
            if(sel.includes(node.id)||deps.upNodes.has(node.id)||deps.downNodes.has(node.id))depFade=1;
            else depFade=.18;
          }
          if(focusSel&&!focusSet.has(node.id))depFade=Math.min(depFade,.15);
          const onNodeUpdate=(id,patch)=>{
            if(renderNode.type==="task"){
              const prevStatus=normExecStatus(renderNode.executionStatus||renderNode.status);
              const nextStatus=normExecStatus(patch?.executionStatus??patch?.status??renderNode.executionStatus??renderNode.status);
              if(prevStatus!=="Done"&&nextStatus==="Done"){
                triggerTaskSuccessFx(renderNode);
                toasts.push("Task marked complete","success",1800);
              }
            }
            d({type:"UPD",id,p:patch});
          };
          const p={key:renderNode.id,node:renderNode,sel:isSel,depFade,onSel:onNodeSel,onTouchSel:onNodeTouchStart,onUpd:onNodeUpdate,onRSt,onRotSt,votes:votes[renderNode.id]||0,onVote:id=>d({type:"ADD_VOTE",nodeId:id}),voteMode:tool==="vote"};
          if(renderNode.type==="sticky")return<Sticky {...p}/>;
          if(renderNode.type==="task")return<TaskNode {...p} blockedByDeps={blockedByDepNodeSet.has(renderNode.id)}/>;
          if(renderNode.type==="milestone")return<MilestoneNode {...p} milestoneStats={milestoneStatsByNode[renderNode.id]||{done:0,total:0}}/>;
          if(renderNode.type==="decision")return<DecisionNode {...p}/>;
          if(renderNode.type==="transform")return<TransformNode {...p}/>;
          if(renderNode.type==="chart")return<ChartNode {...p}/>;
          if(isKpiNodeLike(renderNode))return<KpiNode {...p}/>;
          if(renderNode.type==="shape")return<Shape {...p}/>;
          if(renderNode.type==="text")return<TxtNode {...p}/>;
          if(renderNode.type==="image")return<ImgNode {...p}/>;
          if(renderNode.type==="frame")return<FrameNode {...p}/>;
          if(renderNode.type==="lane")return<LaneNode {...p}/>;
          if(renderNode.type==="sheet")return<SpreadsheetNode
            {...p}
            spreadsheetEngine={spreadsheetEngine}
            formulaSession={sheetFormulaSession}
            formulaPick={sheetFormulaPick}
            onFormulaSessionChange={onSheetFormulaSessionChange}
            onFormulaReferencePick={onSheetFormulaReferencePick}
            onConsumeFormulaPick={onConsumeSheetFormulaPick}
            formulaHighlight={formulaHighlightSheetSet.has(renderNode.id)}
            formulaSource={sheetFormulaSession?.sourceSheetId===renderNode.id}
            anomalyMap={sheetAiAnomalyMapBySheet?.[renderNode.id]||null}
          />;
          if(renderNode.type==="deck")return<DeckNode {...p}/>;
          return null;
        })}
      </div>

      {/* CONNECTOR PORTS */}
      <div style={{position:"absolute",inset:0,zIndex:24,pointerEvents:"none"}}>
        {visiblePortNodes.map(node=>{
          const scale=Math.max(0.25,zoom);
          const size=Math.max(8,Math.min(14,12/scale));
          const hitSize=isMobile?Math.max(34,size*2.6):Math.max(20,size*1.9);
          const border=Math.max(1,1.2/scale);
          return getPortPointsForNode(node).map(port=>{
            const isSource=portConnect&&portConnect.fromEntityId===node.id&&portConnect.fromPortId===port.portId;
            const isTarget=portConnect&&portConnect.targetPort?.nodeId===node.id&&portConnect.targetPort?.portId===port.portId;
            return<button
              key={`${node.id}-${port.portId}`}
              type="button"
              title={`${port.portId.toUpperCase()} port`}
              onPointerDown={e=>{
                if(e.button!==undefined&&e.button!==0)return;
                startPortConnect(e,node.id,port.portId);
              }}
              onMouseEnter={e=>{
                e.currentTarget.style.transform="scale(1.12)";
              }}
              onMouseLeave={e=>{
                e.currentTarget.style.transform="scale(1)";
              }}
              style={{
                position:"absolute",
                left:port.x-hitSize*0.5,
                top:port.y-hitSize*0.5,
                width:hitSize,
                height:hitSize,
                borderRadius:"50%",
                border:`${border}px solid ${isTarget?T.y:isSource?T.blue:T.bg4}`,
                background:isTarget?T.yBg:isSource?"rgba(59,130,246,.35)":T.bg2,
                boxShadow:isTarget?"0 0 0 4px rgba(250,204,21,.18)":"0 0 0 3px rgba(8,16,32,.35)",
                cursor:"crosshair",
                pointerEvents:"auto",
                opacity:1,
                transition:"transform .12s ease, background .12s ease, box-shadow .12s ease",
              }}
            />;
          });
        })}
      </div>

      {/* LASSO */}
      <div style={{position:"absolute",inset:0,zIndex:99,pointerEvents:"none"}}><Lasso l={lasso}/></div>

      {/* SMART GUIDES */}
      {guides.length>0&&<svg style={{position:"absolute",inset:0,width:10000,height:10000,overflow:"visible",pointerEvents:"none",zIndex:102}}>
        {guides.map((g,i)=>g.type==="v"
          ?<line className="align-guide" key={i} x1={g.x} y1={-5000} x2={g.x} y2={15000} stroke="#3b82f6" strokeWidth={1/zoom} strokeDasharray={`${4/zoom} ${4/zoom}`} opacity={.8}/>
          :<line className="align-guide" key={i} x1={-5000} y1={g.y} x2={15000} y2={g.y} stroke="#ef4444" strokeWidth={1/zoom} strokeDasharray={`${4/zoom} ${4/zoom}`} opacity={.8}/>
        )}
      </svg>}

      {/* LASER POINTER TRAIL */}
      {tool==="laser"&&laserPts.length>0&&<svg style={{position:"absolute",inset:0,width:10000,height:10000,overflow:"visible",pointerEvents:"none",zIndex:103}}>
        {laserPts.map((p,i)=>{const age=(Date.now()-p.t)/800;return<circle key={i} cx={p.x} cy={p.y} r={4+age*10} fill="none" stroke="#ef4444" strokeWidth={2-age*1.5} opacity={Math.max(0,.9-age)}/>;})}
        {laserPts.length>0&&<circle cx={laserPts[laserPts.length-1].x} cy={laserPts[laserPts.length-1].y} r={5} fill="#ef4444" opacity={.9}/>}
      </svg>}

      {/* COMMENTS */}
      {renderedComments.map(c=><CommentDot key={c.id} c={c} isMobile={isMobile} onDel={id=>d({type:"DEL_COMMENT",id})} onUpdate={(id,patch)=>d({type:"UPDATE_COMMENT",id,patch})}/>)}

      {/* REMOTE CURSORS (world-space coordinates) */}
      {boardId&&<RemoteCursors users={collabUsers}/>}
    </div>

    {/* CONTEXT MENU */}
    {isMobile&&radialMenu&&<MobileRadialMenu
      open
      x={radialMenu.x}
      y={radialMenu.y}
      activeId={radialMenu.activeId}
      options={MOBILE_RADIAL_OPTIONS}
      onCancel={()=>{
        setRadialMenu(null);
        mobileInputRef.current?.cancelPress?.();
      }}
      T={T}
    />}
    {ctxMenu&&<ContextMenu menu={ctxMenu.menu} position={{x:ctxMenu.sx,y:ctxMenu.sy}} maxHeight={ctxMenu.maxH} onClose={()=>setCtxMenu(null)} T={T}/>}
    {isMobile&&mobileCtxMenu&&<MobileBottomSheet
      open
      title={mobileCtxTitle}
      subtitle="Long-press actions"
      onClose={()=>setMobileCtxMenu(null)}
      T={T}
      zIndex={360}
      snapPoints={[0.28,0.56,0.9]}
    >
      <div style={{padding:"8px 10px 12px",display:"grid",gap:10}}>
        {mobileCtxGroups.map(group=><div key={group.id} style={{border:`1px solid ${T.b0}`,borderRadius:10,overflow:"hidden",background:T.bg2}}>
          {group.label&&<div style={{padding:"8px 10px",fontSize:10.5,color:T.t2,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em",borderBottom:`1px solid ${T.b0}`}}>{group.label}</div>}
          <div style={{display:"grid",gap:0}}>
            {group.items.map(item=><button key={item.id} disabled={item.enabled===false} onClick={()=>{
              if(item.enabled===false)return;
              item.onSelect?.();
              setMobileCtxMenu(null);
            }} style={{minHeight:44,padding:"0 10px",display:"flex",alignItems:"center",gap:8,border:"none",borderTop:`1px solid ${T.b0}`,background:"transparent",color:item.enabled===false?T.t3:(item.danger?T.red:T.t0),cursor:item.enabled===false?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,textAlign:"left"}}>
              <span style={{width:16,textAlign:"center",color:item.enabled===false?T.t3:(item.danger?T.red:T.t1),fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{item.icon||"•"}</span>
              <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.label}</span>
              {item.shortcut&&<span style={{fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{item.shortcut}</span>}
            </button>)}
          </div>
        </div>)}
      </div>
    </MobileBottomSheet>}
    <input ref={ctxUploadRef} type="file" accept="image/*" style={{display:"none"}} onChange={onCtxUploadImage}/>
    {isMobile&&mobileInlineEdit&&<MobileBottomSheet
      open
      title="Edit Node Text"
      subtitle="Inline mobile editor"
      onClose={()=>setMobileInlineEdit(null)}
      T={T}
      zIndex={365}
      snapPoints={[0.28,0.52,0.78]}
    >
      <div style={{padding:"12px",display:"grid",gap:10}}>
        <textarea
          value={mobileInlineEdit.text}
          onChange={e=>setMobileInlineEdit(prev=>prev?{...prev,text:e.target.value}:prev)}
          rows={5}
          style={{width:"100%",minHeight:130,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,padding:"10px 11px",fontFamily:"'DM Sans',sans-serif",fontSize:13,resize:"vertical",outline:"none"}}
        />
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setMobileInlineEdit(null)} style={{flex:1,minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t1,fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>{
            const nodeId=String(mobileInlineEdit.nodeId||"").trim();
            if(nodeId)d({type:"UPD",id:nodeId,p:{text:String(mobileInlineEdit.text||"")}});
            setMobileInlineEdit(null);
          }} style={{flex:1,minHeight:44,borderRadius:10,border:`1px solid ${T.yDim}`,background:T.yBg,color:T.y,fontFamily:"'JetBrains Mono',monospace",fontSize:11,cursor:"pointer",fontWeight:700}}>Save</button>
        </div>
      </div>
    </MobileBottomSheet>}

    {/* MOBILE CONNECTOR EDITOR */}
    {isMobile&&selectedArrow&&!mobileCtxMenu&&(()=>{
      const conn=connectorById[selectedArrow];
      if(!conn)return null;
      const ar=conn.source;
      const style=conn.style;
      const jumpStyle=normalizeConnectorJumpStyle(ar.jumpStyle,"auto");
      const depType=getConnectorDependencyType(ar);
      const isDataFlowConnector=dataConnectorIdSet.has(selectedArrow)||isDataConnector(ar);
      const dataPreview=isDataFlowConnector?(dataConnectorPreviewById[selectedArrow]||null):null;
      const dataError=isDataFlowConnector?String(dataConnectorErrorById[selectedArrow]||"").trim():"";
      const ACOLS=["#475569","#64748b",T.y,T.blue,T.green,T.red,T.purple,T.teal];
      const setStyle=patch=>updateConnector(ar,{style:patch});
      return<MobileBottomSheet
        open
        title="Connector Style"
        subtitle={`Routing: ${conn.routing}`}
        onClose={()=>setSelectedArrow(null)}
        T={T}
        zIndex={370}
        snapPoints={[0.32,0.62,0.92]}
      >
        <div style={{padding:"10px",display:"grid",gap:10}}>
          {isDataFlowConnector&&<div style={{display:"grid",gap:6,padding:"8px",border:`1px solid ${dataError?T.red:T.b1}`,borderRadius:10,background:T.bg1}}>
            <div style={{fontSize:10.5,color:dataError?T.red:T.t2,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>
              DATA FLOW {dataError?`- ${dataError}`:""}
            </div>
            {dataPreview&&<div style={{display:"grid",gap:4}}>
              <div style={{fontSize:11,color:T.t1}}>{String(dataPreview.summary||"No output")}</div>
              {dataPreview.kind==="number"&&<div style={{fontSize:12,color:"#67e8f9",fontFamily:"'JetBrains Mono',monospace"}}>
                {String(dataPreview.label||"value")}: {formatNumber(dataPreview.value)}
              </div>}
              {Array.isArray(dataPreview.columns)&&dataPreview.columns.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {dataPreview.columns.slice(0,6).map((col,idx)=><span key={`${selectedArrow}_m_col_${idx}`} style={{fontSize:10,color:T.t2,border:`1px solid ${T.b0}`,borderRadius:999,padding:"2px 6px"}}>{col}</span>)}
              </div>}
              {Array.isArray(dataPreview.rows)&&dataPreview.rows.length>0&&<div style={{display:"grid",gap:3,maxHeight:120,overflowY:"auto"}}>
                {dataPreview.rows.slice(0,4).map((row,idx)=><div key={`${selectedArrow}_m_row_${idx}`} style={{fontSize:10,color:T.t1,fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {Array.isArray(row)?row.join(" | "):String(row)}
                </div>)}
              </div>}
            </div>}
          </div>}
          <div style={{display:"grid",gap:6}}>
            <div style={{fontSize:10.5,color:T.t2,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>Routing</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:6}}>
              {[["-","straight"],["L","ortho"],["~","curved"],["w","wavy"]].map(([ic,rt])=><button key={rt} onClick={()=>updateConnector(ar,{routing:rt})} style={{minHeight:44,borderRadius:10,border:`1px solid ${conn.routing===rt?T.yDim:T.b1}`,background:conn.routing===rt?T.yBg:T.bg2,color:conn.routing===rt?T.y:T.t0,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700}}>{ic} {rt}</button>)}
            </div>
          </div>

          <div style={{display:"grid",gap:6}}>
            <div style={{fontSize:10.5,color:T.t2,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>Dependency</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:6}}>
              {[["","None"],["depends_on","Depends"],["blocks","Blocks"],["related","Related"]].map(([tp,lbl])=><button key={tp||"none"} onClick={()=>tp?updateConnector(ar,{depType:tp,label:dependencyTypeLabel(tp)}):updateConnector(ar,{depType:null,label:""})} style={{minHeight:44,borderRadius:10,border:`1px solid ${depType===tp?T.yDim:T.b1}`,background:depType===tp?T.yBg:T.bg2,color:depType===tp?T.y:T.t0,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{lbl}</button>)}
            </div>
          </div>

          <div style={{display:"grid",gap:6}}>
            <div style={{fontSize:10.5,color:T.t2,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>Color</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {ACOLS.map(c=><button key={c} onClick={()=>setStyle({stroke:c})} style={{width:32,height:32,borderRadius:99,border:`2px solid ${style.stroke===c?T.y:T.b1}`,background:c,cursor:"pointer"}}/>)}
            </div>
          </div>

          <div style={{display:"grid",gap:6}}>
            <div style={{fontSize:10.5,color:T.t2,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>Dash & Width</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6}}>
              {["solid","dashed","dotted"].map(st=><button key={st} onClick={()=>setStyle({dash:st})} style={{minHeight:44,borderRadius:10,border:`1px solid ${style.dash===st?T.yDim:T.b1}`,background:style.dash===st?T.yBg:T.bg2,color:style.dash===st?T.y:T.t0,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{st}</button>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:6}}>
              {[1,2,3,4,5].map(w=><button key={w} onClick={()=>setStyle({width:w})} style={{minHeight:44,borderRadius:10,border:`1px solid ${Math.round(style.width)===w?T.yDim:T.b1}`,background:Math.round(style.width)===w?T.yBg:T.bg2,color:Math.round(style.width)===w?T.y:T.t0,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{w}px</button>)}
            </div>
          </div>

          <div style={{display:"grid",gap:6}}>
            <div style={{fontSize:10.5,color:T.t2,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>Caps</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:6}}>
              <button onClick={()=>setStyle({startCap:cycleCap(style.startCap)})} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>Start: {style.startCap}</button>
              <button onClick={()=>setStyle({endCap:cycleCap(style.endCap)})} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>End: {style.endCap}</button>
            </div>
          </div>

          {(conn.routing==="ortho"||conn.routing==="straight")&&<div style={{display:"grid",gap:6}}>
            <div style={{fontSize:10.5,color:T.t2,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>Line Jumps</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6}}>
              {["auto","on","off"].map(mode=><button key={mode} onClick={()=>updateConnector(ar,{jumpStyle:mode})} style={{minHeight:44,borderRadius:10,border:`1px solid ${jumpStyle===mode?T.yDim:T.b1}`,background:jumpStyle===mode?T.yBg:T.bg2,color:jumpStyle===mode?T.y:T.t0,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>{mode}</button>)}
            </div>
          </div>}

          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:6}}>
            <button onClick={()=>d({type:"UPD_ARR",id:selectedArrow,p:reverseConnector(ar)})} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>Reverse</button>
            <button onClick={()=>setConnectorStyleAsDefault(ar)} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>Set Default</button>
            <button onClick={resetConnectorStyleDefault} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t1,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>Reset Default</button>
            <button onClick={()=>setRememberLastConnectorStyle(v=>!v)} style={{minHeight:44,borderRadius:10,border:`1px solid ${rememberLastConnectorStyle?T.yDim:T.b1}`,background:rememberLastConnectorStyle?T.yBg:T.bg2,color:rememberLastConnectorStyle?T.y:T.t0,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>
              Remember Last: {rememberLastConnectorStyle?"ON":"OFF"}
            </button>
          </div>

          <button onClick={()=>{d({type:"DEL_ARR",id:selectedArrow});setSelectedArrow(null);}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.red}`,background:"transparent",color:T.red,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700}}>Delete Connector</button>
        </div>
      </MobileBottomSheet>;
    })()}

    {/* ARROW STYLE PANEL */}
    {selectedArrow&&!isMobile&&(()=>{
      const conn=connectorById[selectedArrow];
      if(!conn)return null;
      const ar=conn.source;
      const mx=conn.mid.x*zoom+px;
      const my=conn.mid.y*zoom+py;
      const style=conn.style;
      const jumpStyle=normalizeConnectorJumpStyle(ar.jumpStyle,"auto");
      const depType=getConnectorDependencyType(ar);
      const isDataFlowConnector=dataConnectorIdSet.has(selectedArrow)||isDataConnector(ar);
      const dataPreview=isDataFlowConnector?(dataConnectorPreviewById[selectedArrow]||null):null;
      const dataError=isDataFlowConnector?String(dataConnectorErrorById[selectedArrow]||"").trim():"";
      const setStyle=patch=>updateConnector(ar,{style:patch});
      const ACOLS=["#475569","#64748b",T.y,T.blue,T.green,T.red,T.purple,T.teal];
      return<div key="asp" className="pop" style={{position:"absolute",left:mx,top:Math.max(60,my-54),transform:"translateX(-50%)",zIndex:400,background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:10,padding:"8px 9px",display:"flex",flexDirection:"column",gap:7,alignItems:"stretch",boxShadow:"0 4px 20px rgba(0,0,0,.6)",pointerEvents:"auto",minWidth:262}}>
        {isDataFlowConnector&&<div style={{display:"grid",gap:5,padding:"6px 7px",border:`1px solid ${dataError?T.red:T.b1}`,borderRadius:8,background:T.bg1}}>
          <div style={{fontSize:9.5,color:dataError?T.red:T.t2,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>DATA FLOW {dataError?`- ${dataError}`:""}</div>
          {dataPreview&&<div style={{display:"grid",gap:3}}>
            <div style={{fontSize:10.5,color:T.t1}}>{String(dataPreview.summary||"No output")}</div>
            {dataPreview.kind==="number"&&<div style={{fontSize:10.5,color:"#67e8f9",fontFamily:"'JetBrains Mono',monospace"}}>
              {String(dataPreview.label||"value")}: {formatNumber(dataPreview.value)}
            </div>}
            {Array.isArray(dataPreview.columns)&&dataPreview.columns.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {dataPreview.columns.slice(0,5).map((col,idx)=><span key={`${selectedArrow}_d_col_${idx}`} style={{fontSize:9,color:T.t2,border:`1px solid ${T.b0}`,borderRadius:999,padding:"1px 5px"}}>{col}</span>)}
            </div>}
            {Array.isArray(dataPreview.rows)&&dataPreview.rows.length>0&&<div style={{display:"grid",gap:2,maxHeight:72,overflowY:"auto"}}>
              {dataPreview.rows.slice(0,3).map((row,idx)=><div key={`${selectedArrow}_d_row_${idx}`} style={{fontSize:9.2,color:T.t1,fontFamily:"'JetBrains Mono',monospace",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {Array.isArray(row)?row.join(" | "):String(row)}
              </div>)}
            </div>}
          </div>}
        </div>}
        <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
          {[["","None"],["depends_on","Depends"],["blocks","Blocks"],["related","Related"]].map(([tp,lbl])=><button key={tp||"none"} onClick={()=>tp?updateConnector(ar,{depType:tp,label:dependencyTypeLabel(tp)}):updateConnector(ar,{depType:null,label:""})} style={{height:22,padding:"0 7px",background:depType===tp?T.yBg:T.bg3,border:`1px solid ${depType===tp?T.yDim:T.b0}`,color:depType===tp?T.y:T.t1,borderRadius:4,cursor:"pointer",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{lbl}</button>)}
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
          {ACOLS.map(c=><div key={c} onClick={()=>setStyle({stroke:c})} style={{width:14,height:14,borderRadius:"50%",background:c,border:`2px solid ${style.stroke===c?T.y:"rgba(255,255,255,.12)"}`,cursor:"pointer",flexShrink:0}}/>)}
          <div style={{width:1,height:18,background:T.b0,margin:"0 3px"}}/>
          {["solid","dashed","dotted"].map(st=><button key={st} onClick={()=>setStyle({dash:st})} style={{height:22,padding:"0 7px",background:style.dash===st?T.yBg:T.bg3,border:`1px solid ${style.dash===st?T.yDim:T.b0}`,color:style.dash===st?T.y:T.t1,borderRadius:4,cursor:"pointer",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{st}</button>)}
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
          {[1,2,3,4,5].map(w=><button key={w} onClick={()=>setStyle({width:w})} style={{width:22,height:22,background:Math.round(style.width)===w?T.yBg:T.bg3,border:`1px solid ${Math.round(style.width)===w?T.yDim:T.b0}`,color:Math.round(style.width)===w?T.y:T.t1,borderRadius:4,cursor:"pointer",fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>{w}</button>)}
          <div style={{width:1,height:18,background:T.b0,margin:"0 3px"}}/>
          {[["-","straight"],["L","ortho"],["~","curved"],["w","wavy"]].map(([ic,rt])=><button key={rt} onClick={()=>updateConnector(ar,{routing:rt})} title={rt} style={{width:24,height:22,background:conn.routing===rt?T.yBg:T.bg3,border:`1px solid ${conn.routing===rt?T.yDim:T.b0}`,color:conn.routing===rt?T.y:T.t1,borderRadius:4,cursor:"pointer",fontSize:11}}>{ic}</button>)}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>
          <button onClick={()=>setStyle({startCap:cycleCap(style.startCap)})} title="Cycle start cap" style={{height:22,padding:"0 6px",background:T.bg3,border:`1px solid ${T.b0}`,color:T.t1,borderRadius:4,cursor:"pointer",fontSize:10}}>Start:{style.startCap}</button>
          <button onClick={()=>setStyle({endCap:cycleCap(style.endCap)})} title="Cycle end cap" style={{height:22,padding:"0 6px",background:T.bg3,border:`1px solid ${T.b0}`,color:T.t1,borderRadius:4,cursor:"pointer",fontSize:10}}>End:{style.endCap}</button>
          <button onClick={()=>d({type:"UPD_ARR",id:selectedArrow,p:reverseConnector(ar)})} title="Reverse direction" style={{height:22,padding:"0 7px",background:T.bg3,border:`1px solid ${T.b0}`,color:T.t1,borderRadius:4,cursor:"pointer",fontSize:10}}>&lt;&gt;</button>
          <button onClick={()=>{d({type:"DEL_ARR",id:selectedArrow});setSelectedArrow(null);}} style={{height:22,padding:"0 7px",background:"transparent",border:`1px solid rgba(239,68,68,.3)`,color:T.red,borderRadius:4,cursor:"pointer",fontSize:11}}>x</button>
        </div>
        {(conn.routing==="ortho"||conn.routing==="straight")&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>
          <span style={{minWidth:84}}>Line jumps</span>
          {["auto","on","off"].map(mode=><button key={mode} onClick={()=>updateConnector(ar,{jumpStyle:mode})} style={{height:22,padding:"0 7px",background:jumpStyle===mode?T.yBg:T.bg3,border:`1px solid ${jumpStyle===mode?T.yDim:T.b0}`,color:jumpStyle===mode?T.y:T.t1,borderRadius:4,cursor:"pointer",fontSize:10}}>{mode}</button>)}
          {conn.jumpCount>0&&<span style={{marginLeft:"auto",fontSize:9,color:T.t2}}>{conn.jumpCount} jumps</span>}
        </div>}
        {conn.routing==="ortho"&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:10,color:T.t2}}>
          <span style={{minWidth:84,fontFamily:"'JetBrains Mono',monospace"}}>Corner radius</span>
          <input type="range" min={0} max={36} value={Math.round(style.cornerRadius)} onChange={e=>setStyle({cornerRadius:Number(e.target.value)||0})} style={{flex:1}}/>
          <span style={{width:26,textAlign:"right",fontFamily:"'JetBrains Mono',monospace"}}>{Math.round(style.cornerRadius)}</span>
        </div>}
        {conn.routing==="wavy"&&<>
          <div style={{display:"flex",alignItems:"center",gap:8,fontSize:10,color:T.t2}}>
            <span style={{minWidth:84,fontFamily:"'JetBrains Mono',monospace"}}>Wave amp</span>
            <input type="range" min={2} max={36} value={Math.round(style.waveAmplitude)} onChange={e=>setStyle({waveAmplitude:Number(e.target.value)||0})} style={{flex:1}}/>
            <span style={{width:26,textAlign:"right",fontFamily:"'JetBrains Mono',monospace"}}>{Math.round(style.waveAmplitude)}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,fontSize:10,color:T.t2}}>
            <span style={{minWidth:84,fontFamily:"'JetBrains Mono',monospace"}}>Wave len</span>
            <input type="range" min={10} max={120} value={Math.round(style.waveLength)} onChange={e=>setStyle({waveLength:Number(e.target.value)||0})} style={{flex:1}}/>
            <span style={{width:26,textAlign:"right",fontFamily:"'JetBrains Mono',monospace"}}>{Math.round(style.waveLength)}</span>
          </div>
        </>}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
            <input type="checkbox" checked={rememberLastConnectorStyle} onChange={e=>setRememberLastConnectorStyle(e.target.checked)}/>
            Remember last style
          </label>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setConnectorStyleAsDefault(ar)} style={{height:22,padding:"0 8px",background:T.bg3,border:`1px solid ${T.b0}`,color:T.t1,borderRadius:4,cursor:"pointer",fontSize:10}}>Set default</button>
            <button onClick={resetConnectorStyleDefault} style={{height:22,padding:"0 8px",background:"transparent",border:`1px solid ${T.b0}`,color:T.t2,borderRadius:4,cursor:"pointer",fontSize:10}}>Reset</button>
          </div>
        </div>
      </div>;
    })()}

    {/* COMMENT INPUT */}
    {commentInput&&<div className="pop" style={{position:"absolute",left:commentInput.sx,top:commentInput.sy+14,background:T.bg2,border:`1px solid ${T.yDim}`,borderRadius:10,padding:12,zIndex:999,width:220,boxShadow:"0 8px 32px rgba(0,0,0,.6)"}}>
      <textarea ref={cmtRef} autoFocus placeholder="Scrie comentariul…" rows={3} style={{width:"100%",background:T.bg3,border:`1px solid ${T.b1}`,borderRadius:7,padding:"7px 9px",fontSize:12,fontFamily:"inherit",resize:"none",outline:"none",color:T.t0,marginBottom:8}}/>
      <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
        <button onClick={()=>setCommentInput(null)} style={{background:"transparent",border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Anuleaza</button>
        <button onClick={()=>{if(cmtRef.current?.value){d({type:"ADD_COMMENT",c:{id:uid(),x:commentInput.x,y:commentInput.y,nodeId:commentInput.nodeId||null,text:cmtRef.current.value,author:ME.name,ts:Date.now(),replies:[]}});if(autoReturnToSelect)d({type:"EXIT_ADD_MODE"});setCommentInput(null);}}} style={{background:T.yBg,border:`1px solid ${T.yDim}`,color:T.y,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Adauga</button>
      </div>
    </div>}

    {/* ZOOM */}
    <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:10,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,.5)",zIndex:50}}>
      {[["-",()=>d({type:"ZOOM",v:zoom*.8})],null,["+",()=>d({type:"ZOOM",v:zoom*1.25})],["1x",()=>{d({type:"ZOOM",v:1});d({type:"PAN",x:0,y:0});}],["Fit",()=>{const r=wRef.current;d({type:"ZOOM_FIT",vw:r.offsetWidth,vh:r.offsetHeight});}]].map((it,i)=>it===null?<span key="p" style={{padding:"0 12px",fontSize:11,color:T.t1,fontFamily:"'JetBrains Mono',monospace",minWidth:52,textAlign:"center"}}>{Math.round(zoom*100)}%</span>:<button key={i} onClick={it[1]} title={i===4?"Fit all (Ctrl+Shift+H)":undefined} style={{background:"transparent",border:"none",width:34,height:32,cursor:"pointer",fontSize:14,color:T.t1,fontFamily:"inherit"}} onMouseEnter={e=>e.target.style.color=T.y} onMouseLeave={e=>e.target.style.color=T.t1}>{it[0]}</button>)}
    </div>

    {/* BACKGROUND COLOR PICKER */}
    {!presentMode&&<div style={{position:"absolute",bottom:20,left:20,zIndex:50,display:"flex",alignItems:"center",gap:4,background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:8,padding:"3px 6px"}}>
      <span style={{fontSize:9,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>BG</span>
      <input type="color" value={colorInputBgValue} onChange={e=>d({type:"SET_BG",v:e.target.value})} title="Canvas background color" style={{width:20,height:20,borderRadius:4,cursor:"pointer",border:`1px solid ${T.b0}`,background:"none",padding:0}}/>
      {bgColor&&<button onClick={()=>d({type:"SET_BG",v:null})} title="Reset background" style={{background:"transparent",border:"none",color:T.t2,fontSize:11,cursor:"pointer",padding:"0 2px",lineHeight:1}}>x</button>}
    </div>}

    {/* SNAP INDICATOR */}
    {snapGrid&&<div style={{position:"absolute",bottom:20,right:84,background:T.yBg,border:`1px solid ${T.yDim}`,color:T.y,padding:"4px 10px",borderRadius:99,fontSize:10,fontFamily:"'JetBrains Mono',monospace",zIndex:50}}>SNAP {GRID}px</div>}

    {/* STATS */}
    {visibleNodes.length>0&&<div style={{position:"absolute",bottom:20,right:20,background:T.bg2,border:`1px solid ${T.b0}`,color:T.t2,padding:"4px 10px",borderRadius:20,fontSize:10,fontFamily:"'JetBrains Mono',monospace",zIndex:50}}>{visibleNodes.length}n · {arrows.length}c</div>}

    {tool==="laser"&&<div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.35)",color:"#fca5a5",padding:"7px 16px",borderRadius:20,fontSize:12,pointerEvents:"none",fontFamily:"'JetBrains Mono',monospace"}}>LASER pointer: move to highlight</div>}
    {tool==="eraser"&&<div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:T.bg2,border:`1px solid ${T.b2}`,color:T.t1,padding:"7px 16px",borderRadius:20,fontSize:12,pointerEvents:"none",fontFamily:"'JetBrains Mono',monospace"}}>ERASER: click/drag to erase drawings</div>}
    {tool==="arrow"&&<div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:T.bg2,border:`1px solid ${T.yDim}`,color:T.y,padding:"7px 16px",borderRadius:20,fontSize:12,pointerEvents:"none",fontFamily:"'JetBrains Mono',monospace"}}>{arrowFrom?"Click destination":"Click source"}</div>}
    {tool==="vote"&&<div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:T.yBg,border:`1px solid ${T.yDim}`,color:T.y,padding:"7px 16px",borderRadius:20,fontSize:12,pointerEvents:"none",fontFamily:"'JetBrains Mono',monospace"}}>VOTE mode: click any node</div>}
    {tool==="draw"&&<div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:T.bg2,border:`1px solid ${T.b2}`,color:T.t1,padding:"7px 16px",borderRadius:20,fontSize:12,pointerEvents:"none",fontFamily:"'JetBrains Mono',monospace"}}>DRAW freehand</div>}
    {tool==="select"&&sel.length===1&&<div style={{position:"absolute",top:16,right:20,background:T.bg2,border:`1px solid ${T.b1}`,color:T.t1,padding:"6px 10px",borderRadius:99,fontSize:10.5,pointerEvents:"none",fontFamily:"'JetBrains Mono',monospace"}}>Tab child · Enter sibling</div>}
    {depMode&&<div style={{position:"absolute",top:16,left:20,background:"rgba(59,130,246,.08)",border:"1px solid rgba(96,165,250,.35)",color:"#93c5fd",padding:"6px 10px",borderRadius:99,fontSize:10.5,pointerEvents:"none",fontFamily:"'JetBrains Mono',monospace"}}>DEP MODE · blue upstream · green downstream</div>}
  </div>;
}

/* ------------------------------------------------------------
   REMOTE CURSORS (rendered inside world-space div)
------------------------------------------------------------ */
function RemoteCursors({users=[]}){
  const now=Date.now();
  const list=(Array.isArray(users)?users:[]).filter(c=>Number.isFinite(Number(c?.x))&&Number.isFinite(Number(c?.y))&&now-Number(c?.ts||0)<9000);
  return<>{list.map(c=>{
    const age=Math.max(0,now-Number(c.ts||now));
    const labelVisible=age<2600;
    const opacity=Math.max(.2,1-age/9000);
    return<div key={c.socketId} style={{position:"absolute",left:c.x,top:c.y,pointerEvents:"none",zIndex:999,transform:"translate(-2px,-2px)",opacity}}>
      <svg width="14" height="18" viewBox="0 0 14 18"><path d="M0 0 L14 9 L8 11 L5.5 18 L0 0Z" fill={c.color||T.y} stroke="rgba(255,255,255,.7)" strokeWidth="1"/></svg>
      {labelVisible&&<div style={{position:"absolute",top:16,left:8,background:c.color||T.y,color:"#fff",padding:"2px 8px",borderRadius:4,fontSize:10,fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(0,0,0,.4)",fontWeight:600}}>{c.name||"User"}</div>}
    </div>;
  })}</>;
}

/* ------------------------------------------------------------
   ALIGN PANEL (floating above multi-selection, Miro-style)
------------------------------------------------------------ */
function AlignPanel(){
  const{s,d}=useWB();
  const{sel,nodes,zoom,px,py}=s;
  if(sel.length<2)return null;
  const sn=nodes.filter(n=>sel.includes(n.id));
  if(sn.length<2)return null;
  const minX=Math.min(...sn.map(n=>n.x));
  const minY=Math.min(...sn.map(n=>n.y));
  const maxX=Math.max(...sn.map(n=>n.x+(n.w||0)));
  const scrLeft=minX*zoom+px;
  const scrTop=minY*zoom+py;
  const scrW=(maxX-minX)*zoom;
  const panelLeft=scrLeft+scrW/2;
  const panelTop=Math.max(56,scrTop-50);
  const bs={width:28,height:28,background:"transparent",border:"none",color:T.t1,fontSize:13,cursor:"pointer",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center"};
  const hover=e=>{e.currentTarget.style.background=T.bg3;e.currentTarget.style.color=T.y;};
  const leave=e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.t1;};
  const applyLayout=layout=>{
    const ids=(Array.isArray(sel)?sel:[]).filter(Boolean);
    const movable=nodes.filter(n=>ids.includes(n.id)&&!n.locked);
    if(movable.length<2)return;
    if(layout==="grid"){
      d({type:"TIDY",ids});
      return;
    }
    const gap=56;
    const deltas={};
    if(layout==="horizontal"){
      const sorted=[...movable].sort((a,b)=>a.x-b.x);
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
      const sorted=[...movable].sort((a,b)=>a.y-b.y);
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
  };
  const btns=[["L","left","Align Left"],["T","top","Align Top"],["R","right","Align Right"],["B","bottom","Align Bottom"],["CX","cx","Center Horizontal"],["CY","cy","Center Vertical"],null,["DH","dh","Distribute Horizontal"],["DV","dv","Distribute Vertical"]];
  return<div className="pop" style={{position:"absolute",left:panelLeft,top:panelTop,transform:"translateX(-50%)",zIndex:300,background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:10,padding:"4px 6px",display:"flex",gap:1,boxShadow:"0 4px 20px rgba(0,0,0,.6)",pointerEvents:"auto",alignItems:"center"}}>
    {btns.map((b,i)=>b===null
      ?<div key={i} style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
      :<button key={b[1]} onClick={()=>d({type:"ALIGN",d:b[1]})} title={b[2]} style={bs} onMouseEnter={hover} onMouseLeave={leave}>{b[0]}</button>
    )}
    <div style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
    <button onClick={()=>d({type:"GROUP"})} title="Group (Ctrl+G)" style={{...bs,fontSize:9,fontFamily:"'JetBrains Mono',monospace",width:32}} onMouseEnter={hover} onMouseLeave={leave}>GRP</button>
    <button onClick={()=>d({type:"UNGROUP"})} title="Ungroup (Ctrl+Shift+G)" style={{...bs,fontSize:9,fontFamily:"'JetBrains Mono',monospace",width:36}} onMouseEnter={hover} onMouseLeave={leave}>UGRP</button>
    <div style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
    <button onClick={()=>applyLayout("vertical")} title="Vertical flow" style={{...bs,fontSize:9,fontFamily:"'JetBrains Mono',monospace",width:24}} onMouseEnter={hover} onMouseLeave={leave}>V</button>
    <button onClick={()=>applyLayout("horizontal")} title="Horizontal flow" style={{...bs,fontSize:9,fontFamily:"'JetBrains Mono',monospace",width:24}} onMouseEnter={hover} onMouseLeave={leave}>H</button>
    <button onClick={()=>applyLayout("grid")} title="Grid layout" style={{...bs,fontSize:9,fontFamily:"'JetBrains Mono',monospace",width:24}} onMouseEnter={hover} onMouseLeave={leave}>G</button>
  </div>;
}

/* ------------------------------------------------------------
   MINIMAP
------------------------------------------------------------ */
function Minimap({onClose,rightInset=300}){
  const{s,d}=useWB();
  const{nodes,zoom,px,py}=s;
  const vis=nodes.filter(n=>!n.hidden);
  if(vis.length===0)return null;
  const W=160,H=96;
  const xs=vis.map(n=>n.x),ys=vis.map(n=>n.y),x2s=vis.map(n=>n.x+(n.w||100)),y2s=vis.map(n=>n.y+(n.h||60));
  const bx=Math.min(...xs)-30,by=Math.min(...ys)-30,bw=Math.max(...x2s)-bx+30,bh=Math.max(...y2s)-by+30;
  const sc=Math.min(W/bw,H/bh,.8);
  const vpW=window.innerWidth/zoom,vpH=window.innerHeight/zoom,vpX=-px/zoom,vpY=-py/zoom;
  return<div style={{position:"absolute",bottom:60,right:rightInset,width:W,height:H,background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:8,overflow:"hidden",zIndex:60,boxShadow:"0 4px 20px rgba(0,0,0,.5)",cursor:"crosshair"}}
    onClick={e=>{const r=e.currentTarget.getBoundingClientRect();const mx=(e.clientX-r.left)/sc+bx,my=(e.clientY-r.top)/sc+by;d({type:"PAN",x:-mx*zoom+window.innerWidth/2,y:-my*zoom+window.innerHeight/2});}}>
    <svg width={W} height={H}>
      {vis.map(n=><rect key={n.id} x={(n.x-bx)*sc} y={(n.y-by)*sc} width={Math.max(2,(n.w||100)*sc)} height={Math.max(2,(n.h||60)*sc)} fill={n.type==="sticky"?n.color:n.color||T.bg3} opacity={.8} rx={1}/>)}
      <rect x={Math.max(0,(vpX-bx)*sc)} y={Math.max(0,(vpY-by)*sc)} width={Math.min(W,vpW*sc)} height={Math.min(H,vpH*sc)} fill="none" stroke={T.y} strokeWidth={1} opacity={.6}/>
    </svg>
    <div style={{position:"absolute",top:3,left:5,fontSize:9,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>minimap</div>
    {onClose&&<button onClick={e=>{e.stopPropagation();onClose();}} title="Close minimap" style={{position:"absolute",top:3,right:4,width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,borderRadius:6,fontSize:11,cursor:"pointer",lineHeight:1,padding:0}}>x</button>}
  </div>;
}

/* ------------------------------------------------------------
   TIMER
------------------------------------------------------------ */
function Timer(){
  const[secs,setSecs]=useState(0);
  const[running,setRunning]=useState(false);
  const[preset,setPreset]=useState(300);
  const[remaining,setRemaining]=useState(300);
  const[visible,setVisible]=useState(false);
  const iv=useRef(null);

  useEffect(()=>{
    if(running&&remaining>0){iv.current=setInterval(()=>setRemaining(r=>{if(r<=1){setRunning(false);return 0;}return r-1;}),1000);}
    return()=>clearInterval(iv.current);
  },[running]);

  const mm=String(Math.floor(remaining/60)).padStart(2,"0");
  const ss=String(remaining%60).padStart(2,"0");
  const pct=remaining/preset;
  const r=22,circ=2*Math.PI*r;

  if(!visible)return<button onClick={()=>setVisible(true)} style={{position:"absolute",top:14,right:20,background:T.bg2,border:`1px solid ${T.b1}`,color:T.t1,width:36,height:36,borderRadius:8,cursor:"pointer",fontSize:11,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>TMR</button>;

  return<div className="slide" style={{position:"absolute",top:14,right:20,background:T.bg2,border:`1px solid ${running?T.yDim:T.b1}`,borderRadius:14,padding:"12px 16px",zIndex:100,display:"flex",alignItems:"center",gap:12,boxShadow:running?"0 0 20px rgba(250,204,21,.15)":"none",transition:"all .3s"}}>
    {/* Circle progress */}
    <svg width={52} height={52} style={{animation:remaining<30&&running?"timerPulse .5s infinite":"none"}}>
      <circle cx={26} cy={26} r={r} fill="none" stroke={T.b1} strokeWidth={3}/>
      <circle cx={26} cy={26} r={r} fill="none" stroke={remaining<30?T.red:T.y} strokeWidth={3} strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round" transform="rotate(-90 26 26)" style={{transition:"stroke-dashoffset .5s,stroke .3s"}}/>
      <text x={26} y={31} textAnchor="middle" fill={remaining<30?T.red:T.y} fontSize={11} fontFamily="'JetBrains Mono',monospace" fontWeight={600}>{mm}:{ss}</text>
    </svg>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      <div style={{display:"flex",gap:4}}>
        {[[60,"1m"],[180,"3m"],[300,"5m"],[600,"10m"]].map(([s,l])=><button key={s} onClick={()=>{setPreset(s);setRemaining(s);setRunning(false);}} style={{background:preset===s?T.yBg:T.bg3,border:`1px solid ${preset===s?T.yDim:T.b1}`,color:preset===s?T.y:T.t1,padding:"2px 7px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>{l}</button>)}
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>setRunning(r=>!r)} style={{background:running?T.yBg:T.bg3,border:`1px solid ${running?T.yDim:T.b1}`,color:running?T.y:T.t0,padding:"4px 14px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{running?"Pause":"Start"}</button>
        <button onClick={()=>{setRunning(false);setRemaining(preset);}} style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 10px",borderRadius:7,fontSize:12,cursor:"pointer"}}>Reset</button>
        <button onClick={()=>{setRunning(false);setVisible(false);}} style={{background:"transparent",border:"none",color:T.t2,fontSize:14,cursor:"pointer"}}>x</button>
      </div>
    </div>
  </div>;
}

/* ------------------------------------------------------------
   FLOATING TOOLBAR
------------------------------------------------------------ */
const TOOLS=[
  {id:"select",icon:"SEL",k:"V"},{id:"pan",icon:"PAN",k:"H"},null,
  {id:"sticky",icon:"STK",k:"S"},{id:"text",icon:"TXT",k:"T"},{id:"task",icon:"TSK",k:"Z"},{id:"milestone",icon:"MLS",k:"W"},{id:"decision",icon:"DEC",k:"1"},{id:"transform",icon:"SUM",k:"2"},null,
  {id:"rect",icon:"R",k:"R"},{id:"circle",icon:"O",k:""},{id:"diamond",icon:"D",k:"D"},
  {id:"triangle",icon:"T",k:"Y"},{id:"hexagon",icon:"H",k:"X"},{id:"parallelogram",icon:"P",k:"Q"},
  {id:"cloud",icon:"C",k:"U"},{id:"cylinder",icon:"CY",k:"I"},{id:"table",icon:"TB",k:"B"},{id:"sheet",icon:"SH",k:""},{id:"deck",icon:"DK",k:"O"},
  {id:"laneH",icon:"LH",k:"J"},{id:"laneV",icon:"LV",k:"K"},null,
  {id:"arrow",icon:"->",k:"C"},{id:"draw",icon:"P",k:"P"},{id:"comment",icon:"C",k:"M"},{id:"frame",icon:"F",k:"F"},{id:"vote",icon:"V",k:"G"},null,
  {id:"laser",icon:"L",k:"L"},{id:"eraser",icon:"E",k:"E"},
];

function Toolbar({isMobile=false,hidden=false}){
  const{s,d}=useWB();
  const{tool,sel,hist,fut,snapGrid,nodes,arrows,depMode,zoom,px,py}=s;
  const[drawCol,setDrawCol]=useState(T.y);
  const spacePanRef=useRef({active:false,prevTool:"select"});
  const btnW=isMobile?32:36;
  const btnH=isMobile?30:34;
  const buildConnectorFromDefaults=useCallback((spec,overrides={})=>{
    if(!spec?.fromEntityId||!spec?.toEntityId)return null;
    const fromNode=nodes.find(n=>n.id===spec.fromEntityId)||null;
    const toNode=nodes.find(n=>n.id===spec.toEntityId)||null;
    const base=normalizeConnectorDefaultStyle(loadStoredConnectorDefaultStyle());
    const stylePatch=(overrides&&typeof overrides.style==="object"&&overrides.style)?overrides.style:{};
    const style=normalizeConnectorStyle({style:{...base.style,...stylePatch}});
    const explicitFlowType=String(overrides?.flowType||"").trim().toLowerCase();
    const inferredData=explicitFlowType==="data"||(isDataNodeType(fromNode?.type)&&isDataNodeType(toNode?.type));
    if(inferredData&&wouldCreateDataFlowCycle({nodes,arrows,fromId:spec.fromEntityId,toId:spec.toEntityId})){
      toasts.push("Data flow cycle prevented","error");
      return null;
    }
    const connector={
      id:uid(),
      fromId:spec.fromEntityId,
      toId:spec.toEntityId,
      from:{entityId:spec.fromEntityId,anchor:spec.fromAnchor||{type:"pos",xNorm:0.5,yNorm:0.5}},
      to:{entityId:spec.toEntityId,anchor:spec.toAnchor||{type:"pos",xNorm:0.5,yNorm:0.5}},
      routing:normalizeConnectorRouting(overrides?.routing??base.routing),
      style,
      jumpStyle:normalizeConnectorJumpStyle(overrides?.jumpStyle??base.jumpStyle,base.jumpStyle),
      label:String(overrides?.label??""),
    };
    if(inferredData){
      connector.flowType="data";
      if(!String(connector.label||"").trim())connector.label="data";
      if(!overrides?.depType)connector.depType="related";
    }
    return connector;
  },[arrows,nodes]);

  useEffect(()=>{
    const h=e=>{
      const target=e.target;
      const tag=String(target?.tagName||"").toUpperCase();
      if(tag==="TEXTAREA"||tag==="INPUT"||tag==="SELECT"||target?.isContentEditable)return;
      const oneSel=sel.length===1?nodes.find(n=>n.id===sel[0]):null;
      const hasMods=e.ctrlKey||e.metaKey||e.altKey;

      if(!hasMods&&e.code==="Space"){
        e.preventDefault();
        if(!spacePanRef.current.active&&tool!=="pan"){
          spacePanRef.current={active:true,prevTool:tool||"select"};
          d({type:"TOOL",v:"pan"});
        }
        return;
      }

      if(oneSel?.type==="sheet"){
        const rows=Math.max(1,Math.min(300,Number(oneSel.sheetRows)||12));
        const cols=Math.max(1,Math.min(52,Number(oneSel.sheetCols)||6));
        const bits=String(oneSel.sheetActive||"1,0").split(",");
        const ar=Math.max(0,Math.min(rows-1,parseInt(bits[0],10)||0));
        const ac=Math.max(0,Math.min(cols-1,parseInt(bits[1],10)||0));
        const key=`${ar},${ac}`;
        const cells=oneSel.sheetCells&&typeof oneSel.sheetCells==="object"?oneSel.sheetCells:{};
        const cur=String(cells[key]??"");
        const setActive=(r,c)=>d({type:"UPD",id:oneSel.id,p:{sheetActive:`${Math.max(0,Math.min(rows-1,r))},${Math.max(0,Math.min(cols-1,c))}`}});
        const writeCurrent=nextVal=>{
          if(oneSel.locked)return;
          const next={...cells};
          const v=String(nextVal??"");
          if(v.length)next[key]=v;else delete next[key];
          d({type:"UPD",id:oneSel.id,p:{sheetCells:next,sheetActive:key}});
        };
        if(!hasMods&&(e.key==="ArrowLeft"||e.key==="ArrowRight"||e.key==="ArrowUp"||e.key==="ArrowDown"||e.key==="Enter"||e.key==="Tab")){
          e.preventDefault();
          if(e.key==="ArrowLeft")setActive(ar,ac-1);
          if(e.key==="ArrowRight")setActive(ar,ac+1);
          if(e.key==="ArrowUp")setActive(ar-1,ac);
          if(e.key==="ArrowDown")setActive(ar+1,ac);
          if(e.key==="Enter")setActive(ar+1,ac);
          if(e.key==="Tab")setActive(ar,ac+1);
          return;
        }
        if(!hasMods&&(e.key==="Backspace"||e.key==="Delete")){
          e.preventDefault();
          writeCurrent(e.key==="Delete"?"":cur.slice(0,-1));
          return;
        }
        if(!hasMods&&e.key.length===1){
          e.preventDefault();
          writeCurrent(cur+e.key);
          return;
        }
      }

      if(oneSel?.type==="deck"){
        const slides=Array.isArray(oneSel.deckSlides)&&oneSel.deckSlides.length?oneSel.deckSlides:[{id:"fallback",title:"Slide 1",body:""}];
        const idx=Math.max(0,Math.min(slides.length-1,Number(oneSel.deckIndex)||0));
        const targetField=oneSel.deckInputTarget==="title"?"title":"body";
        const patchSlideText=text=>{
          if(oneSel.locked)return;
          const next=slides.map((sli,i)=>i===idx?{...sli,[targetField]:text}:sli);
          d({type:"UPD",id:oneSel.id,p:{deckSlides:next,deckIndex:idx}});
        };
        if(!hasMods&&(e.key==="ArrowLeft"||e.key==="ArrowRight")){
          e.preventDefault();
          if(oneSel.locked)return;
          d({type:"UPD",id:oneSel.id,p:{deckIndex:e.key==="ArrowLeft"?Math.max(0,idx-1):Math.min(slides.length-1,idx+1)}});
          return;
        }
        if(!hasMods&&e.key==="Enter"){
          e.preventDefault();
          if(targetField==="title"){
            if(oneSel.locked)return;
            d({type:"UPD",id:oneSel.id,p:{deckInputTarget:"body"}});
          }else{
            patchSlideText(String(slides[idx]?.body||"")+"\n");
          }
          return;
        }
        if(!hasMods&&(e.key==="Backspace"||e.key==="Delete")){
          e.preventDefault();
          const curText=String(slides[idx]?.[targetField]||"");
          patchSlideText(e.key==="Delete"?"":curText.slice(0,-1));
          return;
        }
        if(!hasMods&&e.key.length===1){
          e.preventDefault();
          patchSlideText(String(slides[idx]?.[targetField]||"")+e.key);
          return;
        }
      }

      const km={v:"select",h:"pan",s:"sticky",t:"text",z:"task",w:"milestone","1":"decision","2":"transform",r:"rect",d:"diamond",y:"triangle",x:"hexagon",q:"parallelogram",u:"cloud",i:"cylinder",b:"table",o:"deck",j:"laneH",k:"laneV",a:"arrow",p:"draw",m:"comment",f:"frame",g:"vote",l:"laser",e:"eraser"};
      if(e.key==="Escape"){
        e.preventDefault();
        d({type:"EXIT_ADD_MODE"});
        return;
      }
      if(!hasMods&&e.key?.toLowerCase()==="c"){
        e.preventDefault();
        d({type:"TOOL",v:"arrow"});
        return;
      }
      if(!hasMods&&e.key?.toLowerCase()==="n"){
        e.preventDefault();
        const cx=(window.innerWidth*0.5-px)/zoom;
        const cy=(window.innerHeight*0.42-py)/zoom;
        const node={id:uid(),type:"shape",shapeType:"rect",x:Math.round(cx-85),y:Math.round(cy-44),w:170,h:88,text:"Node",color:T.bg3,textColor:T.t0,borderColor:T.b1,fontSize:13,fontWeight:"600"};
        d({type:"ADD",node});
        d({type:"SEL",v:[node.id]});
        d({type:"EXIT_ADD_MODE"});
        return;
      }
      if(!e.ctrlKey&&!e.metaKey&&km[e.key?.toLowerCase()]){
        if(km[e.key.toLowerCase()]==="select")d({type:"EXIT_ADD_MODE"});
        else d({type:"TOOL",v:km[e.key.toLowerCase()]});
      }
      if((e.ctrlKey||e.metaKey)&&e.key==="z"){e.preventDefault();d({type:"UNDO"});}
      if((e.ctrlKey||e.metaKey)&&e.key==="y"){e.preventDefault();d({type:"REDO"});}
      if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key==="d"){e.preventDefault();d({type:"DUP"});}
      if((e.ctrlKey||e.metaKey)&&e.key==="c"&&sel.length){e.preventDefault();d({type:"COPY"});toasts.push(`Copied ${sel.length} element${sel.length>1?"s":""}`,"success");}
      if((e.ctrlKey||e.metaKey)&&e.key==="v"){e.preventDefault();d({type:"PASTE"});toasts.push("Pasted","success");}
      if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key==="g"&&sel.length){e.preventDefault();d({type:"GROUP"});}
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key==="G"){e.preventDefault();d({type:"UNGROUP"});}
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="l"){e.preventDefault();d({type:"TIDY",ids:sel.length?sel:undefined});}
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="d"){e.preventDefault();d({type:"DEP_MODE"});}
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="h"){e.preventDefault();const vw=window.innerWidth-268,vh=window.innerHeight-46;d({type:"ZOOM_FIT",vw,vh});}
      if((e.key==="Delete"||e.key==="Backspace")&&sel.length&&e.target===document.body)d({type:"DEL",ids:sel});
      if((e.ctrlKey||e.metaKey)&&e.key==="a"){e.preventDefault();d({type:"SEL_ALL"});}
      if(e.key==="Tab"&&sel.length===1&&!e.ctrlKey&&!e.metaKey){
        e.preventDefault();
        const p=nodes.find(n=>n.id===sel[0]);
        if(p&&!p.locked&&p.type!=="frame"){
          const sc=SC[_si++%8];
          const nx=(p.x||0)+(p.w||120)+MINDMAP_CHILD_GAP_X;
          const ny=(p.y||0)+((p.h||70)-130)/2;
          const child={id:uid(),type:"sticky",x:nx,y:ny,w:170,h:130,text:"",color:sc.bg,textColor:sc.t};
          d({type:"ADD",node:child});
          const connector=buildConnectorFromDefaults({
            fromEntityId:p.id,
            toEntityId:child.id,
            fromAnchor:{type:"port",portId:"right"},
            toAnchor:{type:"port",portId:"left"},
          });
          if(connector)d({type:"ADD_ARR",arr:connector});
          d({type:"SEL",v:[child.id]});
          d({type:"TOOL",v:"select"});
        }
      }
      if(e.key==="Enter"&&sel.length===1&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey){
        e.preventDefault();
        const cur=nodes.find(n=>n.id===sel[0]);
        if(cur&&!cur.locked&&cur.type!=="frame"){
          const sib={...cur,id:uid(),x:cur.x,y:(cur.y||0)+(cur.h||70)+MINDMAP_CHILD_GAP_Y,text:""};
          d({type:"ADD",node:sib});
          const parentEdge=arrows.find(a=>normalizeConnectorEndpoints(a).toEntityId===cur.id);
          const parentId=parentEdge?normalizeConnectorEndpoints(parentEdge).fromEntityId:"";
          if(parentId){
            const connector=buildConnectorFromDefaults({
              fromEntityId:parentId,
              toEntityId:sib.id,
              fromAnchor:{type:"port",portId:"bottom"},
              toAnchor:{type:"port",portId:"top"},
            });
            if(connector)d({type:"ADD_ARR",arr:connector});
          }
          d({type:"SEL",v:[sib.id]});
          d({type:"TOOL",v:"select"});
        }
      }
      const nudge=e.shiftKey?1:8;
      if(e.key==="ArrowLeft"&&sel.length&&!e.ctrlKey&&!e.metaKey){e.preventDefault();d({type:"MOVE_SEL",dx:-nudge,dy:0});}
      if(e.key==="ArrowRight"&&sel.length&&!e.ctrlKey&&!e.metaKey){e.preventDefault();d({type:"MOVE_SEL",dx:nudge,dy:0});}
      if(e.key==="ArrowUp"&&sel.length&&!e.ctrlKey&&!e.metaKey){e.preventDefault();d({type:"MOVE_SEL",dx:0,dy:-nudge});}
      if(e.key==="ArrowDown"&&sel.length&&!e.ctrlKey&&!e.metaKey){e.preventDefault();d({type:"MOVE_SEL",dx:0,dy:nudge});}
      // Zoom keys: = (or +) and -
      if((e.key==="="||e.key==="+")&&!e.ctrlKey&&!e.metaKey){e.preventDefault();d({type:"ZOOM",v:zoom*1.25});}
      if(e.key==="-"&&!e.ctrlKey&&!e.metaKey&&!sel.length){e.preventDefault();d({type:"ZOOM",v:zoom*.8});}
      // Focus mode toggle
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="f"){e.preventDefault();d({type:"FOCUS_MODE"});toasts.push(s.focusMode?"Focus mode off":"Focus mode on");}
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[sel,d,nodes,arrows,zoom,px,py,s.focusMode,tool,buildConnectorFromDefaults]);

  useEffect(()=>{
    const onKeyUp=e=>{
      if(e.code!=="Space")return;
      if(!spacePanRef.current.active)return;
      e.preventDefault();
      const prev=spacePanRef.current.prevTool||"select";
      spacePanRef.current.active=false;
      if(prev==="select")d({type:"EXIT_ADD_MODE"});
      else d({type:"TOOL",v:prev});
    };
    window.addEventListener("keyup",onKeyUp);
    return()=>window.removeEventListener("keyup",onKeyUp);
  },[d]);

  if(hidden)return null;

  return<div style={{position:"absolute",left:"50%",top:isMobile?"auto":14,bottom:isMobile?"max(12px, env(safe-area-inset-bottom))":"auto",transform:"translateX(-50%)",zIndex:200,display:"flex",alignItems:"center",gap:1,background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:14,padding:isMobile?"4px 6px":"5px 8px",boxShadow:"0 8px 32px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.03)",maxWidth:isMobile?"calc(100vw - 12px)":undefined,overflowX:isMobile?"auto":"visible",WebkitOverflowScrolling:isMobile?"touch":"auto"}}>
    {TOOLS.map((t2,i)=>t2===null?<div key={`d${i}`} style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
      :<button key={t2.id} onClick={()=>{if(t2.id==="select")d({type:"EXIT_ADD_MODE"});else d({type:"TOOL",v:t2.id});}} title={t2.k?`${t2.id} (${t2.k})`:t2.id}
        style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",width:btnW,height:btnH,border:tool===t2.id?`1px solid ${T.yDim}`:"1px solid transparent",borderRadius:7,background:tool===t2.id?T.yBg:"transparent",cursor:"pointer",color:tool===t2.id?T.y:T.t1,transition:"all .1s",gap:.5,flexShrink:0}}
        onMouseEnter={e=>{if(tool!==t2.id){e.currentTarget.style.background=T.bg3;e.currentTarget.style.color=T.t0;}}}
        onMouseLeave={e=>{if(tool!==t2.id){e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.t1;}}}>
        <span style={{fontSize:t2.id==="text"?10:13,fontWeight:t2.id==="text"?600:undefined,lineHeight:1}}>{t2.icon}</span>
        <span style={{fontSize:7.5,fontFamily:"'JetBrains Mono',monospace",opacity:t2.k?0.55:0,minHeight:9}}>{t2.k||"\u00a0"}</span>
      </button>
    )}
    <div style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
    <button onClick={()=>d({type:"UNDO"})} disabled={!hist.length} title="Ctrl+Z" style={{width:30,height:34,border:"1px solid transparent",borderRadius:7,background:"transparent",cursor:hist.length?"pointer":"not-allowed",color:hist.length?T.t1:T.t3,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>U</button>
    <button onClick={()=>d({type:"REDO"})} disabled={!fut.length} title="Ctrl+Y" style={{width:30,height:34,border:"1px solid transparent",borderRadius:7,background:"transparent",cursor:fut.length?"pointer":"not-allowed",color:fut.length?T.t1:T.t3,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>R</button>
    <div style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
    <button onClick={()=>d({type:"SNAP_TOGGLE"})} title="Snap to grid" style={{width:30,height:34,border:snapGrid?`1px solid ${T.yDim}`:"1px solid transparent",borderRadius:7,background:snapGrid?T.yBg:"transparent",cursor:"pointer",color:snapGrid?T.y:T.t1,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>GRD</button>
    <button onClick={()=>d({type:"DEP_MODE"})} title="Dependency mode (Ctrl+Shift+D)" style={{width:30,height:34,border:depMode?`1px solid ${T.yDim}`:"1px solid transparent",borderRadius:7,background:depMode?T.yBg:"transparent",cursor:"pointer",color:depMode?T.y:T.t1,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>DEP</button>
    <button onClick={()=>{d({type:"FOCUS_MODE"});toasts.push(s.focusMode?"Focus off":"Focus on");}} title="Focus mode (Ctrl+Shift+F)" style={{width:30,height:34,border:s.focusMode?`1px solid rgba(139,92,246,.5)`:"1px solid transparent",borderRadius:7,background:s.focusMode?"rgba(139,92,246,.1)":"transparent",cursor:"pointer",color:s.focusMode?T.purple:T.t1,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>FOC</button>
    {sel.length>0&&<>
      <div style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
      <button onClick={()=>d({type:"WRAP_FRAME",ids:sel,title:"Frame"})} title="Wrap in Frame" style={{width:30,height:34,border:"1px solid transparent",borderRadius:7,background:"transparent",cursor:"pointer",color:T.t1,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>FRM</button>
      <button onClick={()=>d({type:"TIDY",ids:sel})} title="Auto-layout (Ctrl+Shift+L)" style={{width:30,height:34,border:"1px solid transparent",borderRadius:7,background:"transparent",cursor:"pointer",color:T.t1,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>TIDY</button>
      <button onClick={()=>d({type:"DUP"})} title="Ctrl+D" style={{width:30,height:34,border:"1px solid transparent",borderRadius:7,background:"transparent",cursor:"pointer",color:T.t1,fontSize:9,fontFamily:"'JetBrains Mono',monospace"}}>DUP</button>
      <button onClick={()=>d({type:"DEL",ids:sel})} title="Delete" style={{width:30,height:34,border:"1px solid transparent",borderRadius:7,background:"transparent",cursor:"pointer",color:T.red,fontSize:12}}>DEL</button>
    </>}
    {tool==="draw"&&<>
      <div style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
      {[T.y,T.red,T.blue,T.green,"#ffffff",T.purple,T.teal].map(c=><div key={c} onClick={()=>setDrawCol(c)} style={{width:16,height:16,borderRadius:"50%",background:c,border:`2px solid ${drawCol===c?"#fff":"transparent"}`,cursor:"pointer",flexShrink:0,transition:"border .1s"}}/>)}
      <input type="color" value={drawCol} onChange={e=>setDrawCol(e.target.value)} title="Culoare custom" style={{width:20,height:20,borderRadius:"50%",cursor:"pointer",border:"none",background:"none"}}/>
      <button onClick={()=>d({type:"CLEAR_DRAWS"})} style={{background:"transparent",border:`1px solid ${T.b1}`,color:T.t2,padding:"2px 7px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",marginLeft:2}}>clear</button>
    </>}
    {tool==="vote"&&<>
      <div style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
      <button onClick={()=>d({type:"CLEAR_VOTES"})} style={{background:"transparent",border:`1px solid ${T.yDim}`,color:T.y,padding:"2px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>reset votes</button>
    </>}
  </div>;
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
  const inAddMode = tool !== "select" && tool !== "pan";
  const inConnectMode = tool === "arrow";
  const navLabel = tool === "pan" ? "Pan" : "Select";

  const Btn = ({ label, active = false, danger = false, disabled = false, onClick }) => (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        minWidth: 52,
        minHeight: 44,
        padding: "0 10px",
        borderRadius: 11,
        border: `1px solid ${active ? (danger ? "rgba(239,68,68,.5)" : T.yDim) : T.b1}`,
        background: active ? (danger ? "rgba(239,68,68,.12)" : T.yBg) : T.bg2,
        color: disabled ? T.t3 : danger ? T.red : active ? T.y : T.t1,
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: 11,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        flex: 1,
        opacity: disabled ? 0.66 : 1,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        right: 8,
        bottom: "max(8px, env(safe-area-inset-bottom))",
        zIndex: 230,
        padding: 6,
        borderRadius: 14,
        border: `1px solid ${T.b1}`,
        background: T.bg1,
        boxShadow: "0 12px 36px rgba(0,0,0,.4)",
        display: "flex",
        gap: 6,
        alignItems: "center",
      }}
    >
      <Btn label={navLabel} active={tool === "pan" || tool === "select"} onClick={onToggleMode} />
      <Btn label="Add" active={inAddMode} onClick={onOpenInsert} />
      <Btn label="Connect" active={inConnectMode} onClick={onToggleConnect} />
      <Btn label="Undo" onClick={onUndo} active={false} disabled={!canUndo} />
      <Btn label="Panel" onClick={onOpenPanel} />
      <Btn label="More" onClick={onOpenMore} />
      {(inAddMode || inConnectMode) && <Btn label="Done" danger onClick={onExitMode} />}
    </div>
  );
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
  if(!visible)return null;
  const ActionBtn=({label,onClick,danger=false})=><button
    onClick={onClick}
    style={{
      minHeight:44,
      minWidth:44,
      flex:1,
      borderRadius:11,
      border:`1px solid ${danger?"rgba(239,68,68,.45)":T.b1}`,
      background:danger?"rgba(239,68,68,.12)":T.bg2,
      color:danger?T.red:T.t0,
      fontFamily:"'JetBrains Mono',monospace",
      fontSize:11,
      fontWeight:700,
      cursor:"pointer",
      padding:"0 10px",
    }}
  >{label}</button>;
  return<div
    style={{
      position:"absolute",
      left:8,
      right:8,
      bottom:"calc(max(8px, env(safe-area-inset-bottom)) + 64px)",
      zIndex:232,
      padding:6,
      borderRadius:14,
      border:`1px solid ${T.b1}`,
      background:T.bg1,
      boxShadow:"0 10px 28px rgba(0,0,0,.35)",
      display:"flex",
      gap:6,
      alignItems:"center",
    }}
  >
    <ActionBtn label="Duplicate" onClick={onDuplicate}/>
    <ActionBtn label="Style" onClick={onStyle}/>
    <ActionBtn label="Connect" onClick={onConnect}/>
    {canArrange&&<ActionBtn label="Arrange" onClick={onArrange}/>}
    <ActionBtn label="Delete" danger onClick={onDelete}/>
  </div>;
}

/* ------------------------------------------------------------
   SEARCH PANEL
------------------------------------------------------------ */
function SearchPanel({onClose}){
  const{s,d}=useWB();
  const isMobile=useIsMobile(760);
  const[q,setQ]=useState("");
  const r=useRef(null);
  useEffect(()=>r.current?.focus(),[]);
  const results=q.trim().length>1?s.nodes.filter(n=>!n.hidden&&n.text?.toLowerCase().includes(q.toLowerCase())).slice(0,8):[];
  function goTo(node){
    d({type:"SEL",v:[node.id]});
    d({type:"PAN",x:-node.x*s.zoom+window.innerWidth/2-node.w/2*s.zoom,y:-node.y*s.zoom+window.innerHeight/2-node.h/2*s.zoom});
    onClose();
  }
  return<div className="pop" style={{position:"absolute",top:64,left:"50%",transform:"translateX(-50%)",background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:14,padding:14,zIndex:600,width:isMobile?"min(92vw,400px)":400,boxShadow:"0 16px 48px rgba(0,0,0,.7)"}}>
    <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
      <span style={{fontSize:14,color:T.t2}}>S</span>
      <input ref={r} value={q} onChange={e=>setQ(e.target.value)} placeholder="Cauta în noduri…" style={{flex:1,background:"transparent",border:"none",outline:"none",color:T.t0,fontSize:14,fontFamily:"'DM Sans',sans-serif"}}/>
      <button onClick={onClose} style={{background:"none",border:"none",color:T.t2,fontSize:16,cursor:"pointer"}}>x</button>
    </div>
    {results.length>0&&<div style={{borderTop:`1px solid ${T.b0}`,paddingTop:8,display:"flex",flexDirection:"column",gap:4}}>
      {results.map(n=><button key={n.id} onClick={()=>goTo(n)} style={{background:T.bg3,border:`1px solid ${T.b1}`,borderRadius:8,padding:"8px 12px",cursor:"pointer",textAlign:"left",color:T.t0,fontSize:12,fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:10,transition:"all .1s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.color=T.y;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t0;}}>
      <span style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}>{n.type==="sticky"?"STK":n.type==="text"?"TXT":n.type==="lane"?"LNE":"NOD"}</span>
        <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.text?.slice(0,60)||"(gol)"}</span>
        <span style={{fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{n.type}</span>
      </button>)}
    </div>}
    {q.length>1&&results.length===0&&<p style={{color:T.t2,fontSize:12,textAlign:"center",padding:"8px 0"}}>Nimic gasit pentru "{q}"</p>}
    <div style={{marginTop:10,fontSize:10,color:T.t2,textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>Ctrl+K pentru a deschide · Esc pentru a închide</div>
  </div>;
}

/* ------------------------------------------------------------
   KEYBOARD SHORTCUTS PANEL
------------------------------------------------------------ */
function ShortcutsPanel({onClose}){
  const isMobile=useIsMobile(760);
  const groups=[
    ["Tools","V Select · H Pan · S Sticky · T Text · A Arrow · P Draw · M Comment · F Frame · G Vote · L Laser · E Eraser"],
    ["Shapes","R Rect · C Circle · D Diamond · Y Triangle · X Hexagon · Q Parallelogram · U Cloud · I Cylinder · B Table · J Lane H · K Lane V"],
    ["Editing","N New node · T Text · C Connector tool · Ctrl+Z Undo · Ctrl+D Duplicate · Ctrl+C Copy · Ctrl+V Paste · Del/? Delete"],
    ["Organization","Ctrl+G Group · Ctrl+Shift+G Ungroup · Ctrl+Shift+L Auto-layout · Tab Add child · Enter Add sibling"],
    ["Canvas","Ctrl+K Search · ? Shortcuts · = Zoom in · - Zoom out · Ctrl+Shift+H Fit all · Ctrl+Shift+D Dep mode"],
    ["Navigation","Arrow keys Nudge 8px · Shift+Arrow Nudge 1px · Scroll Wheel Pan · Ctrl+Wheel Zoom · Middle-click Pan"],
    ["Advanced","Alt+Drag Duplicate · Shift+Resize Proportional · Ctrl+Click Open link · Double-click New sticky · Right-click Context menu"],
  ];
  return<div className="pop" onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,backdropFilter:"blur(6px)",animation:"shineIn .2s ease"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:T.bg1,border:`1px solid ${T.b2}`,borderRadius:20,padding:isMobile?"18px 14px":"28px 32px",width:"100%",maxWidth:isMobile?"96vw":680,maxHeight:"80vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,.7)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18,color:T.y}}>KEY</span>
          <span style={{fontSize:14,fontWeight:700,color:T.t0,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".04em"}}>KEYBOARD SHORTCUTS</span>
        </div>
        <button onClick={onClose} style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t2,width:28,height:28,borderRadius:7,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>x</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)",gap:16}}>
        {groups.map(([title,shortcuts])=><div key={title} style={{background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:12,padding:"14px 16px"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.y,fontFamily:"'JetBrains Mono',monospace",marginBottom:10,letterSpacing:".06em"}}>{title}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {shortcuts.split(" · ").map((s,i)=>{
              const parts=s.split(" ");const key=parts[0];const desc=parts.slice(1).join(" ");
              return<div key={i} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:T.t1,marginBottom:2,width:"100%"}}>
                <span style={{background:T.bg3,border:`1px solid ${T.b0}`,padding:"1px 5px",borderRadius:4,fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:T.t0,fontWeight:600,minWidth:24,textAlign:"center",flexShrink:0}}>{key}</span>
                <span style={{color:T.t2,fontSize:10}}>{desc}</span>
              </div>;
            })}
          </div>
        </div>)}
      </div>
      <div style={{marginTop:16,fontSize:10,color:T.t2,textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>Press ? or Esc to close</div>
    </div>
  </div>;
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
  const{s,d}=useWB();
  return<div className="pop" style={{position:"absolute",top:50,right:20,background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:14,padding:14,zIndex:600,width:280,boxShadow:"0 16px 48px rgba(0,0,0,.7)"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      <span style={{fontSize:10,fontWeight:700,color:T.y,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>* CANVAS THEME</span>
      <button onClick={onClose} style={{background:"none",border:"none",color:T.t2,fontSize:14,cursor:"pointer"}}>x</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
      {CANVAS_THEMES.map(th=><button key={th.id} onClick={()=>{d({type:"SET_THEME",v:th.id});toasts.push(`Theme: ${th.name}`);onClose();}}
        style={{background:th.bg,border:`2px solid ${s.canvasTheme===th.id?T.y:th.grid}`,borderRadius:8,padding:"10px 8px",cursor:"pointer",textAlign:"left",transition:"all .15s"}}
        onMouseEnter={e=>e.currentTarget.style.borderColor=T.y}
        onMouseLeave={e=>{if(s.canvasTheme!==th.id)e.currentTarget.style.borderColor=th.grid;}}>
        <div style={{fontSize:10,fontWeight:600,color:th.id.startsWith("light")||th.id==="paper"?"#333":T.t0,marginBottom:2}}>{th.name}</div>
        <div style={{fontSize:8,color:th.id.startsWith("light")||th.id==="paper"?"#888":T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{th.label}</div>
        <div style={{display:"flex",gap:3,marginTop:5}}>
          {[th.bg,th.grid,th.gridSnap].map((c,i)=><div key={i} style={{width:12,height:12,borderRadius:3,background:c,border:"1px solid rgba(255,255,255,.1)"}}/>)}
        </div>
      </button>)}
    </div>
    <button onClick={()=>{d({type:"SET_BG",v:null});d({type:"SET_THEME",v:null});toasts.push("Theme reset");onClose();}} style={{width:"100%",marginTop:8,background:T.bg3,border:`1px solid ${T.b1}`,color:T.t2,padding:"6px",borderRadius:6,cursor:"pointer",fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>Reset to default</button>
  </div>;
}

/* ------------------------------------------------------------
   TEMPLATES PANEL
------------------------------------------------------------ */
function TplPanel({onClose,isMobile=false,currentUser,onOpenBoard}){
  const{s,d,boardId}=useWB();
  const boardData=useMemo(()=>({nodes:s.nodes||[],arrows:s.arrows||[],comments:s.comments||[],votes:s.votes||{}}),[s.nodes,s.arrows,s.comments,s.votes]);

  const handleInsertData=useCallback((payload)=>{
    const sourceNodes=Array.isArray(payload?.nodes)?payload.nodes:[];
    const sourceArrows=Array.isArray(payload?.arrows)?payload.arrows:[];
    if(!sourceNodes.length)return;
    const idMap=new Map();
    const minX=Math.min(...sourceNodes.map(n=>Number(n?.x)||0));
    const minY=Math.min(...sourceNodes.map(n=>Number(n?.y)||0));
    const maxX=Math.max(...sourceNodes.map(n=>(Number(n?.x)||0)+(Number(n?.w)||120)));
    const maxY=Math.max(...sourceNodes.map(n=>(Number(n?.y)||0)+(Number(n?.h)||80)));
    const sourceCx=minX+(maxX-minX)*.5;
    const sourceCy=minY+(maxY-minY)*.5;
    const viewCx=(-s.px+window.innerWidth*0.5)/Math.max(.01,s.zoom);
    const viewCy=(-s.py+window.innerHeight*0.42)/Math.max(.01,s.zoom);
    const offsetX=Math.round(viewCx-sourceCx);
    const offsetY=Math.round(viewCy-sourceCy);
    const nodes=sourceNodes.map(node=>{
      const id=uid();
      const fromId=String(node?.id||id);
      idMap.set(fromId,id);
      return{
        ...(node||{}),
        id,
        x:Math.round((Number(node?.x)||0)+offsetX),
        y:Math.round((Number(node?.y)||0)+offsetY),
      };
    });
    const nodeIds=new Set(nodes.map(n=>n.id));
    const arrows=sourceArrows.map(arr=>{
      const fromId=idMap.get(String(arr?.fromId||""))||"";
      const toId=idMap.get(String(arr?.toId||""))||"";
      if(!fromId||!toId||fromId===toId||!nodeIds.has(fromId)||!nodeIds.has(toId))return null;
      return{
        ...(arr||{}),
        id:uid(),
        fromId,
        toId,
      };
    }).filter(Boolean);
    nodes.forEach(node=>d({type:"ADD",node}));
    arrows.forEach(arr=>d({type:"ADD_ARR",arr}));
    const ids=nodes.map(n=>n.id);
    if(ids.length>1)d({type:"TIDY",ids});
    d({type:"SEL",v:ids.slice(0,12)});
  },[d,s.px,s.py,s.zoom]);

  return<TemplateMarketplacePanel
    open
    onClose={onClose}
    isMobile={isMobile}
    api={api}
    T={T}
    uid={uid}
    boardId={boardId}
    boardData={boardData}
    currentUser={currentUser}
    onInsertData={handleInsertData}
    onOpenBoard={onOpenBoard}
    notify={(msg,type)=>toasts.push(msg,type)}
  />;
}

/* ------------------------------------------------------------
   PRESENTATION MODE
------------------------------------------------------------ */
function PresentBar({onExit,frames,curIdx,setCurIdx}){
  return<div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",background:"rgba(5,9,17,.9)",border:`1px solid ${T.b2}`,borderRadius:99,padding:"8px 16px",display:"flex",alignItems:"center",gap:12,zIndex:900,backdropFilter:"blur(12px)"}}>
    <button onClick={()=>setCurIdx(i=>Math.max(0,i-1))} disabled={curIdx===0} style={{background:"transparent",border:"none",color:curIdx===0?T.t3:T.t0,fontSize:18,cursor:curIdx===0?"not-allowed":"pointer",lineHeight:1}}>‹</button>
    <span style={{fontSize:12,color:T.t1,fontFamily:"'JetBrains Mono',monospace"}}>{curIdx+1} / {frames.length}</span>
    <span style={{fontSize:12,color:T.y,fontWeight:600}}>{frames[curIdx]?.text||"Frame"}</span>
    <button onClick={()=>setCurIdx(i=>Math.min(frames.length-1,i+1))} disabled={curIdx===frames.length-1} style={{background:"transparent",border:"none",color:curIdx===frames.length-1?T.t3:T.t0,fontSize:18,cursor:curIdx===frames.length-1?"not-allowed":"pointer",lineHeight:1}}>›</button>
    <div style={{width:1,height:20,background:T.b1}}/>
    <button onClick={onExit} style={{background:"transparent",border:"none",color:T.red,fontSize:13,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>EXIT</button>
  </div>;
}

function EditorOnboardingOverlay({
  isMobile=false,
  onClose,
  onUsePreset,
  onOpenTemplates,
  onGenerateAi,
  aiPrompt,
  setAiPrompt,
  aiBusy=false,
}){
  return<div className="onboarding-overlay">
    <div className="onboarding-card pop">
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
        <span style={{fontSize:20,color:T.y}}>AI</span>
        <div>
          <div className="ui-title" style={{fontSize:isMobile?24:28,fontWeight:800,lineHeight:1.05}}>Welcome to your board</div>
          <div className="ui-muted">Get value in under a minute with AI or a quick-start preset.</div>
        </div>
      </div>
      <div className="onboarding-grid" style={{marginTop:12}}>
        {QUICK_START_PRESETS.map(preset=><button key={preset.id} className="ui-btn" onClick={()=>onUsePreset?.(preset.id)}>{preset.label}</button>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr auto auto",gap:8,marginTop:12}}>
        <input
          value={aiPrompt}
          onChange={e=>setAiPrompt?.(e.target.value)}
          placeholder="Describe what you want to plan..."
          style={{minHeight:40,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg1,color:T.t0,padding:"0 10px",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}
        />
        <button className="ui-btn ui-btn-primary" disabled={aiBusy||!String(aiPrompt||"").trim()} onClick={()=>onGenerateAi?.(aiPrompt)}>
          {aiBusy?"Generating...":"Generate board with AI"}
        </button>
        <button className="ui-btn" onClick={onOpenTemplates}>Add template</button>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,gap:10}}>
        <div className="ui-muted">Tip: Double-click the canvas to drop a sticky note instantly.</div>
        <button className="ui-btn" style={{minHeight:34,padding:"0 10px"}} onClick={onClose}>Skip</button>
      </div>
    </div>
  </div>;
}

function EmptyBoardPrompt({onGenerateAi,onOpenTemplates,onBrainstorm,aiPrompt,setAiPrompt,aiBusy=false}){
  return<div className="canvas-empty pop">
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:18,color:T.y}}>AI</span>
      <div className="ui-title" style={{fontSize:30,fontWeight:800}}>Start creating</div>
    </div>
    <div style={{marginTop:4,color:T.t1,fontSize:13,lineHeight:1.6}}>
      Empty boards should never feel empty. Start by describing what you want to plan.
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginTop:12}}>
      <input
        value={aiPrompt}
        onChange={e=>setAiPrompt?.(e.target.value)}
        placeholder="Example: Q2 product launch strategy"
        style={{minHeight:40,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg1,color:T.t0,padding:"0 10px",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}
      />
      <button className="ui-btn ui-btn-primary" disabled={aiBusy||!String(aiPrompt||"").trim()} onClick={()=>onGenerateAi?.(aiPrompt)}>
        {aiBusy?"Generating...":"Generate board with AI"}
      </button>
    </div>
    <div className="canvas-empty-actions">
      <button className="ui-btn" onClick={onOpenTemplates}>Add template</button>
      <button className="ui-btn ui-btn-accent" onClick={onBrainstorm}>Start brainstorming</button>
    </div>
  </div>;
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
  const{s,d}=useWB();
  const{nodes,arrows,sel,hist,fut,zoom}=s;
  const visibleNodes=nodes.filter(n=>!n.hidden);
  const impRef=useRef(null);
  const menuRef=useRef(null);
  const[editName,setEditName]=useState(false);
  const[nameVal,setNameVal]=useState(boardName||"Untitled Board");
  const[menuOpen,setMenuOpen]=useState(false);
  const nameRef=useRef(null);
  useEffect(()=>setNameVal(boardName||"Untitled Board"),[boardName]);
  useEffect(()=>{if(editName)nameRef.current?.select();},[editName]);
  useEffect(()=>{if(isMobile)setMenuOpen(false);},[isMobile]);
  useEffect(()=>{
    const onDown=e=>{if(menuRef.current&&!menuRef.current.contains(e.target))setMenuOpen(false);};
    const onKey=e=>{if(e.key==="Escape")setMenuOpen(false);};
    document.addEventListener("mousedown",onDown);
    window.addEventListener("keydown",onKey);
    return()=>{document.removeEventListener("mousedown",onDown);window.removeEventListener("keydown",onKey);};
  },[]);
  function saveName(){const v=nameVal.trim()||"Untitled Board";if(v!==boardName)onRename?.(v);setEditName(false);};

  function exportSVG(){
    const vis=nodes.filter(n=>!n.hidden);
    if(!vis.length)return;
    const xs=vis.map(n=>n.x),ys=vis.map(n=>n.y),x2=vis.map(n=>n.x+(n.w||100)),y2=vis.map(n=>n.y+(n.h||60));
    const bx=Math.min(...xs)-40,by=Math.min(...ys)-40,W=Math.max(...x2)-bx+40,H=Math.max(...y2)-by+40;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#050911"/>${vis.map(n=>`<rect x="${n.x-bx}" y="${n.y-by}" width="${n.w}" height="${n.h}" rx="6" fill="${n.color||'#1c2a3e'}" stroke="${n.borderColor||'rgba(255,255,255,.08)'}" stroke-width="1.5"/><foreignObject x="${n.x-bx+8}" y="${n.y-by+8}" width="${n.w-16}" height="${n.h-16}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${n.fontSize||13}px;color:${n.textColor||'#fff'};font-family:sans-serif;word-break:break-word;font-weight:${n.fontWeight||'normal'}">${n.text||''}</div></foreignObject>`).join("")}</svg>`;
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));a.download="boardai.svg";a.click();
  }

  function exportJSON(){
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({nodes:s.nodes,arrows:s.arrows,comments:s.comments},null,2)],{type:"application/json"}));a.download="boardai.json";a.click();
  }

  function exportPNG(){
    const vis=nodes.filter(n=>!n.hidden);
    if(!vis.length)return;
    const xs=vis.map(n=>n.x),ys=vis.map(n=>n.y),x2s=vis.map(n=>n.x+(n.w||100)),y2s=vis.map(n=>n.y+(n.h||60));
    const bx=Math.min(...xs)-40,by=Math.min(...ys)-40,W=Math.max(...x2s)-bx+40,H=Math.max(...y2s)-by+40;
    const sc=2;const cv=document.createElement("canvas");cv.width=W*sc;cv.height=H*sc;
    const ctx=cv.getContext("2d");ctx.scale(sc,sc);
    ctx.fillStyle="#050911";ctx.fillRect(0,0,W,H);
    [...vis].sort((a,b)=>(a.zIndex||0)-(b.zIndex||0)).forEach(n=>{
      const x=n.x-bx,y=n.y-by,w=n.w||100,h=n.h||60;
      ctx.save();ctx.globalAlpha=n.opacity??1;
      ctx.fillStyle=n.color||"#1c2a3e";ctx.strokeStyle=n.borderColor||"rgba(255,255,255,.1)";ctx.lineWidth=n.borderWidth||1.5;
      const roundRect=()=>{const r2=6;ctx.beginPath();ctx.moveTo(x+r2,y);ctx.lineTo(x+w-r2,y);ctx.arcTo(x+w,y,x+w,y+r2,r2);ctx.lineTo(x+w,y+h-r2);ctx.arcTo(x+w,y+h,x+w-r2,y+h,r2);ctx.lineTo(x+r2,y+h);ctx.arcTo(x,y+h,x,y+h-r2,r2);ctx.lineTo(x,y+r2);ctx.arcTo(x,y,x+r2,y,r2);ctx.closePath();ctx.fill();ctx.stroke();};
      if(n.type==="shape"){
        const st=n.shapeType||"rect";
        if(st==="circle"){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
        else if(st==="diamond"){ctx.beginPath();ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h/2);ctx.lineTo(x+w/2,y+h);ctx.lineTo(x,y+h/2);ctx.closePath();ctx.fill();ctx.stroke();}
        else if(st==="triangle"){ctx.beginPath();ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.closePath();ctx.fill();ctx.stroke();}
        else if(st==="hexagon"){ctx.beginPath();ctx.moveTo(x+w*.25,y);ctx.lineTo(x+w*.75,y);ctx.lineTo(x+w,y+h*.5);ctx.lineTo(x+w*.75,y+h);ctx.lineTo(x+w*.25,y+h);ctx.lineTo(x,y+h*.5);ctx.closePath();ctx.fill();ctx.stroke();}
        else if(st==="parallelogram"){ctx.beginPath();ctx.moveTo(x+w*.16,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w*.84,y+h);ctx.lineTo(x,y+h);ctx.closePath();ctx.fill();ctx.stroke();}
        else if(st==="cloud"){
          ctx.beginPath();
          ctx.moveTo(x+w*.18,y+h*.84);
          ctx.bezierCurveTo(x+w*.08,y+h*.84,x+w*.04,y+h*.66,x+w*.1,y+h*.56);
          ctx.bezierCurveTo(x+w*.05,y+h*.4,x+w*.12,y+h*.24,x+w*.24,y+h*.26);
          ctx.bezierCurveTo(x+w*.28,y+h*.12,x+w*.38,y+h*.07,x+w*.48,y+h*.16);
          ctx.bezierCurveTo(x+w*.56,y+h*.08,x+w*.68,y+h*.1,x+w*.73,y+h*.26);
          ctx.bezierCurveTo(x+w*.84,y+h*.24,x+w*.94,y+h*.36,x+w*.91,y+h*.54);
          ctx.bezierCurveTo(x+w*.97,y+h*.66,x+w*.91,y+h*.84,x+w*.8,y+h*.84);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        else if(st==="cylinder"){
          const ry=Math.max(8,h*.1);
          ctx.beginPath();
          ctx.moveTo(x,y+ry);
          ctx.lineTo(x,y+h-ry);
          ctx.bezierCurveTo(x,y+h,x+w,y+h,x+w,y+h-ry);
          ctx.lineTo(x+w,y+ry);
          ctx.bezierCurveTo(x+w,y,x,y,x,y+ry);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(x+w/2,y+ry,w/2,ry,0,0,Math.PI*2);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(x+w/2,y+h-ry,w/2,ry,0,0,Math.PI);
          ctx.stroke();
        }else roundRect();
      }else if(n.type!=="image")roundRect();
      if(n.text){ctx.globalAlpha=1;ctx.fillStyle=n.textColor||"#fff";const fw=n.fontWeight==="bold"||n.fontWeight==="700"?"bold":"normal";ctx.font=`${fw} ${n.fontSize||13}px DM Sans,sans-serif`;ctx.textAlign=n.textAlign||"left";ctx.textBaseline="top";const tx=n.textAlign==="center"?x+w/2:x+10;(n.text||"").split("\n").slice(0,6).forEach((line,li)=>ctx.fillText(line.slice(0,80),tx,y+10+li*(n.fontSize||13)*1.4,w-16));}
      ctx.restore();
    });
    const a=document.createElement("a");a.href=cv.toDataURL("image/png");a.download="boardai.png";a.click();
  }

  function importJSON(e){
    const f=e.target.files?.[0];if(!f)return;
    const r=new FileReader();r.onload=ev=>{try{const p=JSON.parse(ev.target.result);if(p.nodes)d({type:"APPLY",nodes:p.nodes,arrows:p.arrows||[],replace:true});}catch{alert("Fi?ier invalid");}};r.readAsText(f);
    e.target.value="";
  }
  const runMenuAction=fn=>{setMenuOpen(false);if(typeof fn==="function")fn();};
  const zoomPct=Math.max(10,Math.round((zoom||1)*100));
  async function copyShareLink(){
    try{
      await navigator.clipboard.writeText(window.location.href);
      toasts.push("Board link copied","success");
    }catch{
      toasts.push("Could not copy board link","error");
    }
  }

  const frames=nodes.filter(n=>n.type==="frame");

  return<header style={{height:46,background:T.bg1,borderBottom:`1px solid ${T.b0}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:isMobile?"0 8px":"0 16px",flexShrink:0,zIndex:100,gap:8}}>
    <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,overflow:"hidden"}}>
      {/* Back to boards */}
      <button onClick={onBoards} title="All boards" style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 8px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:4}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.color=T.y;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t1;}}>‹ Boards</button>
      <span style={{fontSize:16,color:T.y,animation:"float 3s ease-in-out infinite",display:"inline-block"}}>B</span>
      {/* Editable board name */}
      {editName
        ?<input ref={nameRef} value={nameVal} onChange={e=>setNameVal(e.target.value)} onBlur={saveName} onKeyDown={e=>{if(e.key==="Enter")saveName();if(e.key==="Escape"){setNameVal(boardName||"Untitled Board");setEditName(false);}}} style={{background:T.bg3,border:`1px solid ${T.yDim}`,color:T.t0,borderRadius:6,padding:"2px 10px",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",width:isMobile?130:200}}/>
        :<span onDoubleClick={()=>setEditName(true)} title="Double-click to rename" style={{fontWeight:700,fontSize:14,color:T.t0,letterSpacing:"-.02em",fontFamily:"'Instrument Serif',serif",cursor:"text",userSelect:"none",padding:"2px 4px",borderRadius:4,maxWidth:isMobile?110:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} onMouseEnter={e=>e.currentTarget.style.background=T.bg3} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{nameVal}</span>}
      <span style={{width:1,height:16,background:T.b0,margin:"0 2px"}}/>
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        <div style={{width:5,height:5,borderRadius:"50%",background:isSaved?T.green:T.y,animation:isSaved?"none":"pulse 1.5s infinite"}}/>
        <span style={{fontSize:9.5,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{isSaved?"saved":"saving…"}</span>
      </div>
      {!isMobile&&<span style={{fontSize:9.5,color:T.t3,fontFamily:"'JetBrains Mono',monospace"}}>{visibleNodes.length}n·{arrows.length}c{sel.length?`·${sel.length}sel`:""}</span>}
      {/* Current user badge */}
      {!isMobile&&<div style={{display:"flex",alignItems:"center",gap:5,marginLeft:4,background:T.bg3,border:`1px solid ${T.b1}`,borderRadius:99,padding:"2px 8px"}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:ME.color,flexShrink:0}}/>
        <span style={{fontSize:9.5,color:T.t1,fontFamily:"'JetBrains Mono',monospace"}}>{ME.name}</span>
      </div>}
    </div>
    <div style={{display:"flex",gap:5,alignItems:"center",overflowX:isMobile?"auto":"visible"}}>
      {isMobile ? <>
        <button onClick={()=>d({type:"UNDO"})} disabled={!hist.length} title="Undo" style={{background:T.bg3,border:`1px solid ${T.b1}`,color:hist.length?T.t1:T.t3,padding:"4px 9px",borderRadius:7,fontSize:11,cursor:hist.length?"pointer":"not-allowed",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,flexShrink:0}}>U</button>
        <button onClick={()=>d({type:"REDO"})} disabled={!fut.length} title="Redo" style={{background:T.bg3,border:`1px solid ${T.b1}`,color:fut.length?T.t1:T.t3,padding:"4px 9px",borderRadius:7,fontSize:11,cursor:fut.length?"pointer":"not-allowed",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,flexShrink:0}}>R</button>
        <button onClick={onToggleTools} style={{background:toolsOpen?T.yBg:T.bg3,border:`1px solid ${toolsOpen?T.yDim:T.b1}`,color:toolsOpen?T.y:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600,flexShrink:0}}>Add</button>
        <button onClick={onToggleRight} style={{background:rightOpen?T.yBg:T.bg3,border:`1px solid ${rightOpen?T.yDim:T.b1}`,color:rightOpen?T.y:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600,flexShrink:0}}>Panel</button>
        <button onClick={onToggleMore} style={{background:moreOpen?T.yBg:T.bg3,border:`1px solid ${moreOpen?T.yDim:T.b1}`,color:moreOpen?T.y:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600,flexShrink:0}}>More</button>
      </> : <>
      <button onClick={()=>d({type:"UNDO"})} disabled={!hist.length} title="Undo (Ctrl+Z)" style={{background:T.bg3,border:`1px solid ${T.b1}`,color:hist.length?T.t1:T.t3,padding:"4px 9px",borderRadius:7,fontSize:11,cursor:hist.length?"pointer":"not-allowed",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,flexShrink:0}}>U</button>
      <button onClick={()=>d({type:"REDO"})} disabled={!fut.length} title="Redo (Ctrl+Y)" style={{background:T.bg3,border:`1px solid ${T.b1}`,color:fut.length?T.t1:T.t3,padding:"4px 9px",borderRadius:7,fontSize:11,cursor:fut.length?"pointer":"not-allowed",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,flexShrink:0}}>R</button>
      <div style={{display:"flex",alignItems:"center",background:T.bg3,border:`1px solid ${T.b1}`,borderRadius:8,overflow:"hidden",flexShrink:0}}>
        <button onClick={()=>d({type:"ZOOM",v:(zoom||1)*0.9})} title="Zoom out" style={{background:"transparent",border:"none",color:T.t1,padding:"4px 7px",fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>-</button>
        <span style={{minWidth:44,textAlign:"center",fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{zoomPct}%</span>
        <button onClick={()=>d({type:"ZOOM",v:(zoom||1)*1.1})} title="Zoom in" style={{background:"transparent",border:"none",color:T.t1,padding:"4px 7px",fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>+</button>
      </div>
      <button onClick={()=>d({type:"ZOOM_FIT",vw:window.innerWidth,vh:window.innerHeight-46})} title="Fit to screen" style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>Fit</button>
      <button onClick={onSearch} title="Ctrl+K" style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:5,flexShrink:0}}>Search <span style={{fontSize:10,color:T.t2}}>Ctrl+K</span></button>
      <button onClick={onTpl} style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>Templates</button>
      <button onClick={onToggleTheme} title="Toggle Light/Dark" style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:5}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.color=T.y;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t1;}}>
        <span>{themeMode==="dark"?"SUN":"MOON"}</span> <span>{themeMode==="dark"?"Light":"Dark"}</span>
      </button>
      {frames.length>0&&<button onClick={onPresent} style={{background:T.yBg,border:`1px solid ${T.yDim}`,color:T.y,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>Present</button>}
      <div style={{width:1,height:18,background:T.b0}}/>
      <button onClick={copyShareLink} title="Copy board link" style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>Share</button>
      <button onClick={onToggleRight} title="Open collaborators and inspector" style={{background:rightOpen?T.yBg:T.bg3,border:`1px solid ${rightOpen?T.yDim:T.b1}`,color:rightOpen?T.y:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>Collaborators</button>
      <button onClick={onToggleMinimap} title="Toggle minimap" style={{background:showMinimap?T.yBg:T.bg3,border:`1px solid ${showMinimap?T.yDim:T.b1}`,color:showMinimap?T.y:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>MAP</button>
      <button onClick={onToggleTimeline} title="Toggle execution timeline" style={{background:showTimeline?T.yBg:T.bg3,border:`1px solid ${showTimeline?T.yDim:T.b1}`,color:showTimeline?T.y:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}} onMouseEnter={e=>{if(!showTimeline){e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.color=T.y;}}} onMouseLeave={e=>{if(!showTimeline){e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t1;}}}>Timeline</button>
      <div ref={menuRef} style={{position:"relative"}}>
        <button onClick={()=>setMenuOpen(v=>!v)} title="Import/Export menu" style={{background:menuOpen?T.yBg:T.bg3,border:`1px solid ${menuOpen?T.yDim:T.b1}`,color:menuOpen?T.y:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}} onMouseEnter={e=>{if(!menuOpen){e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.color=T.y;}}} onMouseLeave={e=>{if(!menuOpen){e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t1;}}}>Export</button>
        {menuOpen&&<div className="pop" style={{position:"absolute",right:0,top:32,background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:10,padding:6,minWidth:178,boxShadow:"0 10px 30px rgba(0,0,0,.55)",zIndex:450}}>
          {[["Import JSON",()=>impRef.current?.click()],["Share link",copyShareLink],["Toggle Timeline",onToggleTimeline],["divider"],["Export SVG",exportSVG],["Export PNG",exportPNG],["Export JSON",exportJSON]].map((entry,idx)=>entry[0]==="divider"
            ?<div key={`mdiv-${idx}`} style={{height:1,background:T.b0,margin:"5px 2px"}}/>
            :<button key={entry[0]} onClick={()=>runMenuAction(entry[1])} style={{width:"100%",display:"block",textAlign:"left",background:"transparent",border:"none",color:T.t0,padding:"7px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}} onMouseEnter={e=>e.currentTarget.style.background=T.bg3} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{entry[0]}</button>)}
        </div>}
      </div></>}
      <input ref={impRef} type="file" accept=".json" onChange={importJSON} style={{display:"none"}}/>
    </div>
  </header>;
}

/* ------------------------------------------------------------
   BOARD SELECTOR (landing page)
------------------------------------------------------------ */
function Dashboard({user,onSelect,onLogout,themeMode="dark",onToggleTheme}){
  const isMobile=useIsMobile(860);
  const[boards,setBoards]=useState([]);
  const[loading,setLoading]=useState(true);
  const[name,setName]=useState("");
  const[busy,setBusy]=useState(false);
  const[delId,setDelId]=useState(null);
  const[healthBoardId,setHealthBoardId]=useState("");
  const[healthLoading,setHealthLoading]=useState(false);
  const[healthErr,setHealthErr]=useState("");
  const[healthData,setHealthData]=useState(null);
  const[healthDrawerOpen,setHealthDrawerOpen]=useState(false);

  function refresh(){api.boards().then(b=>{setBoards(b);setLoading(false);}).catch(()=>setLoading(false));}
  useEffect(()=>refresh(),[]);

  async function create(e){
    e.preventDefault();if(!name.trim()||busy)return;
    setBusy(true);const b=await api.create(name.trim());setBusy(false);
    onSelect(b.id,b.name);
  }
  async function deleteBoard(id){
    await api.del(id);setDelId(null);refresh();
  }

  async function loadHealth(boardId,{issueLimit=3}={}){
    if(!boardId)return;
    setHealthLoading(true);
    setHealthErr("");
    try{
      const payload=await api.semantic(boardId,{entityLimit:20,relationLimit:20,issueLimit});
      setHealthData(payload);
    }catch(ex){
      setHealthErr(ex.message||"Could not load execution health");
      setHealthData(null);
    }finally{
      setHealthLoading(false);
    }
  }

  useEffect(()=>{
    if(loading||!boards.length){
      setHealthBoardId("");
      setHealthData(null);
      setHealthErr("");
      return;
    }
    const targetId=healthBoardId&&boards.some(b=>b.id===healthBoardId)?healthBoardId:boards[0].id;
    if(targetId!==healthBoardId)setHealthBoardId(targetId);
    loadHealth(targetId,{issueLimit:3});
  },[loading,boards]);

  const healthBoard=boards.find(b=>b.id===healthBoardId)||null;
  const healthScore=healthData?.health?.healthScore;
  const topIssues=Array.isArray(healthData?.health?.issues)?healthData.health.issues.slice(0,3):[];
  const groupedIssues=Array.isArray(healthData?.health?.issues)
    ?healthData.health.issues.reduce((acc,it)=>{
      const key=String(it.type||"other");
      if(!acc[key])acc[key]=[];
      acc[key].push(it);
      return acc;
    },{})
    :{};
  const issueTypeLabel={
    orphan_task:"Orphan tasks",
    missing_owner:"Missing owner",
    missing_due_date:"Missing due date",
    overdue:"Overdue",
    empty_milestone:"Empty milestones",
    circular_dependency:"Circular dependencies",
  };
  const scoreCol=healthScore>=85?"#86efac":healthScore>=65?"#facc15":"#fca5a5";
  const scoreBg=healthScore>=85?"rgba(34,197,94,.15)":healthScore>=65?"rgba(250,204,21,.15)":"rgba(239,68,68,.14)";

  const fmt=ts=>{if(!ts)return"";const dt=new Date(ts*1000);return dt.toLocaleDateString("ro-RO",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});};

  return<div style={{height:"100vh",background:T.bg0,display:"flex",flexDirection:"column",fontFamily:"'DM Sans',sans-serif",overflow:"hidden"}}>
    <style>{CSS}</style>
    {/* Header */}
    <div style={{display:"flex",alignItems:isMobile?"flex-start":"center",justifyContent:"space-between",padding:isMobile?"12px 14px":"16px 32px",borderBottom:`1px solid ${T.b0}`,flexShrink:0,flexDirection:isMobile?"column":"row",gap:isMobile?10:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:22,color:T.y,animation:"float 3s ease-in-out infinite",display:"inline-block"}}>B</span>
        <span style={{fontFamily:"'Instrument Serif',serif",fontSize:20,color:T.t0,fontWeight:800,letterSpacing:"-.03em"}}>Board<span style={{color:T.y}}>AI</span></span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:isMobile?"wrap":"nowrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:7,background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:99,padding:"5px 12px"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:user?.color||T.y}}/>
          <span style={{fontSize:12,color:T.t0,fontWeight:500}}>{user?.name||"Guest"}</span>
          {!isMobile&&<span style={{fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{user?.email}</span>}
        </div>
        <button onClick={onToggleTheme} style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"6px 10px",borderRadius:7,cursor:"pointer",fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
          {themeMode==="dark"?"Light":"Dark"}
        </button>
        <button onClick={onLogout} style={{background:"transparent",border:`1px solid ${T.b1}`,color:T.t2,padding:"6px 12px",borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Sign out</button>
      </div>
    </div>

    {/* Main content */}
    <div style={{flex:1,overflow:"auto",padding:isMobile?"20px 12px":"40px 32px"}}>
      <div style={{maxWidth:700,margin:"0 auto"}}>
        {/* Welcome */}
        <div style={{marginBottom:36}}>
          <h1 style={{fontFamily:"'Instrument Serif',serif",fontSize:isMobile?28:34,color:T.t0,fontWeight:800,letterSpacing:"-.03em",margin:"0 0 6px"}}>
            Welcome back, <span style={{color:T.y}}>{user?.name?.split(" ")[0]||"there"}</span> ?
          </h1>
          <p style={{color:T.t1,fontSize:13,margin:0}}>Your collaborative whiteboards — pick one or create a new one.</p>
        </div>

        {/* Execution Health */}
        {!!healthBoard&&<div style={{background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:16,padding:isMobile?"14px 12px":"18px 20px",marginBottom:24,boxShadow:"0 4px 20px rgba(0,0,0,.35)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:10,color:T.y,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,letterSpacing:".07em"}}>EXECUTION HEALTH</span>
            <span style={{marginLeft:"auto",fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{healthBoard.name}</span>
          </div>
          {healthLoading&&<div style={{fontSize:11,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>Loading health…</div>}
          {!healthLoading&&healthErr&&<div style={{fontSize:11,color:"#fca5a5"}}>{healthErr}</div>}
          {!healthLoading&&!healthErr&&typeof healthScore==="number"&&<>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{background:scoreBg,border:`1px solid ${scoreCol}66`,color:scoreCol,padding:"6px 10px",borderRadius:10,fontSize:18,fontWeight:800,fontFamily:"'JetBrains Mono',monospace",minWidth:64,textAlign:"center"}}>
                {healthScore}
              </div>
              <div style={{fontSize:11,color:T.t1,lineHeight:1.5}}>
                <div style={{fontSize:12,color:T.t0,fontWeight:600}}>Execution score</div>
                <div>{healthData?.health?.totalIssues||0} issues detected</div>
              </div>
              <button onClick={async()=>{setHealthDrawerOpen(true);await loadHealth(healthBoard.id,{issueLimit:500});}} style={{marginLeft:"auto",background:T.bg3,border:`1px solid ${T.b1}`,color:T.t0,padding:"7px 10px",borderRadius:8,cursor:"pointer",fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>
                Details
              </button>
            </div>
            {topIssues.length>0&&<div style={{display:"grid",gap:6}}>
              {topIssues.map((it,idx)=><div key={`${it.id||it.type}-${idx}`} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:T.bg3,border:`1px solid ${T.b1}`,borderRadius:7}}>
                <span style={{fontSize:10,color:T.y,fontFamily:"'JetBrains Mono',monospace",minWidth:18}}>{idx+1}.</span>
                <span style={{fontSize:11,color:T.t0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{it.message||issueTypeLabel[it.type]||it.type}</span>
              </div>)}
            </div>}
          </>}
        </div>}

        {/* Create board */}
        <div style={{background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:16,padding:isMobile?"14px 12px":"20px 24px",marginBottom:28,boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}>
          <div style={{fontSize:10,color:T.y,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,marginBottom:12,letterSpacing:".06em"}}>NEW BOARD</div>
          <form onSubmit={create} style={{display:"flex",gap:8,flexDirection:isMobile?"column":"row"}}>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Board name…" autoFocus style={{flex:1,background:T.bg3,border:`1px solid ${T.b1}`,borderRadius:8,padding:"9px 12px",color:T.t0,fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}} onFocus={e=>e.target.style.borderColor=T.yDim} onBlur={e=>e.target.style.borderColor=T.b1}/>
            <button type="submit" disabled={!name.trim()||busy} style={{background:name.trim()&&!busy?T.yBg:"transparent",border:`1px solid ${name.trim()&&!busy?T.yDim:T.b1}`,color:name.trim()&&!busy?T.y:T.t3,padding:"9px 18px",borderRadius:8,cursor:name.trim()&&!busy?"pointer":"not-allowed",fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap",transition:"all .15s",width:isMobile?"100%":"auto"}}>Create {"->"}</button>
          </form>
        </div>

        {/* Existing boards */}
        {loading&&<div style={{display:"grid",gap:10,padding:"10px 0"}}>
          {[0,1,2].map(i=><div key={i} style={{height:62,borderRadius:12,border:`1px solid ${T.b1}`,background:`linear-gradient(90deg,${T.bg2},${T.bg3},${T.bg2})`,backgroundSize:"200% 100%",animation:"pulse 1.2s ease-in-out infinite"}}/>)}
        </div>}
        {!loading&&boards.length===0&&<div style={{textAlign:"center",padding:"30px 0 24px",color:T.t2,fontSize:13,fontFamily:"'JetBrains Mono',monospace",display:"grid",gap:10}}>
          <div>No boards yet - create your first in seconds.</div>
          <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
            {["Brainstorm board","Product roadmap","Meeting notes"].map(label=><button key={label} onClick={()=>setName(label)} className="ui-btn" style={{minHeight:34,padding:"0 10px"}}>{label}</button>)}
          </div>
        </div>}
        {!loading&&boards.length>0&&<div style={{background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:16,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,.4)"}}>
          <div style={{padding:isMobile?"12px":"12px 20px",borderBottom:`1px solid ${T.b0}`,fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,letterSpacing:".08em",textTransform:"uppercase"}}>My Boards ({boards.length})</div>
          {boards.map((b,i)=><div key={b.id} style={{display:"flex",alignItems:"center",gap:12,padding:isMobile?"11px 12px":"13px 20px",borderBottom:i<boards.length-1?`1px solid ${T.b0}`:"none",cursor:"pointer",transition:"background .1s"}} onClick={()=>onSelect(b.id,b.name)} onMouseEnter={e=>e.currentTarget.style.background=T.bg3} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{width:36,height:36,borderRadius:9,background:T.bg3,border:`1px solid ${T.b1}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,flexShrink:0}}>BRD</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,color:T.t0,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.name}</div>
              <div style={{fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace",marginTop:2}}>Updated {fmt(b.updated_at)}</div>
            </div>
            <button onClick={e=>{e.stopPropagation();setDelId(b.id);}} title="Delete" style={{background:"transparent",border:"none",color:T.t3,fontSize:13,cursor:"pointer",padding:"5px 7px",borderRadius:5,flexShrink:0,opacity:.6}} onMouseEnter={e=>{e.currentTarget.style.color=T.red;e.currentTarget.style.opacity="1";}} onMouseLeave={e=>{e.currentTarget.style.color=T.t3;e.currentTarget.style.opacity=".6";}}>DEL</button>
            {!isMobile&&<span style={{fontSize:14,color:T.t2,flexShrink:0}}>{">"}</span>}
          </div>)}
        </div>}
      </div>
    </div>

    {/* Delete confirm modal */}
    {delId&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,backdropFilter:"blur(4px)"}} onClick={()=>setDelId(null)}>
      <div className="pop" onClick={e=>e.stopPropagation()} style={{background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:14,padding:isMobile?18:24,width:"min(92vw,320px)",boxShadow:"0 16px 48px rgba(0,0,0,.7)"}}>
        <p style={{color:T.t0,fontSize:14,marginBottom:16,lineHeight:1.5}}>Delete board <strong>"{boards.find(b=>b.id===delId)?.name}"</strong>? This is irreversible.</p>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>setDelId(null)} style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"6px 14px",borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Cancel</button>
          <button onClick={()=>deleteBoard(delId)} style={{background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.4)",color:"#fca5a5",padding:"6px 14px",borderRadius:7,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:600}}>Delete</button>
        </div>
      </div>
    </div>}
    {healthDrawerOpen&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:1001,backdropFilter:"blur(4px)"}} onClick={()=>setHealthDrawerOpen(false)}>
      <div className="slide" onClick={e=>e.stopPropagation()} style={{position:"absolute",right:0,top:0,bottom:0,width:"min(94vw,460px)",background:T.bg1,borderLeft:`1px solid ${T.b1}`,display:"flex",flexDirection:"column"}}>
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${T.b0}`,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:10,color:T.y,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,letterSpacing:".07em"}}>EXECUTION HEALTH DETAILS</span>
          <span style={{marginLeft:"auto",fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{healthBoard?.name||"-"}</span>
          <button onClick={()=>setHealthDrawerOpen(false)} style={{background:"transparent",border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 8px",borderRadius:7,fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>Close</button>
        </div>
        <div style={{padding:"12px 12px 16px",overflowY:"auto",display:"grid",gap:10}}>
          {healthLoading&&<div style={{fontSize:11,color:T.t2}}>Loading…</div>}
          {!healthLoading&&healthErr&&<div style={{fontSize:11,color:"#fca5a5"}}>{healthErr}</div>}
          {!healthLoading&&!healthErr&&Object.keys(groupedIssues).length===0&&<div style={{fontSize:11,color:"#86efac"}}>No issues detected.</div>}
          {!healthLoading&&!healthErr&&Object.entries(groupedIssues).map(([type,list])=><div key={type} style={{background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:10,padding:"8px 8px 6px"}}>
            <div style={{fontSize:10,color:T.y,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,marginBottom:6,letterSpacing:".04em"}}>{issueTypeLabel[type]||type} ({list.length})</div>
            <div style={{display:"grid",gap:6}}>
              {list.map((issue,idx)=>{
                const canFocus=Boolean(issue?.sourceNodeId);
                return<button key={`${issue.id||type}-${idx}`} onClick={()=>{
                  if(!healthBoard)return;
                  setHealthDrawerOpen(false);
                  onSelect(healthBoard.id,healthBoard.name,{focusNodeId:issue?.sourceNodeId||null});
                }} disabled={!canFocus}
                  title={canFocus?"Open board and focus node":"TODO: issue has no source node id"}
                  style={{textAlign:"left",background:T.bg3,border:`1px solid ${canFocus?T.b1:T.b0}`,borderRadius:8,padding:"7px 8px",color:canFocus?T.t0:T.t2,cursor:canFocus?"pointer":"not-allowed",fontSize:11,lineHeight:1.35}}>
                  {issue.message||`${type} issue`}
                </button>;
              })}
            </div>
          </div>)}
        </div>
      </div>
    </div>}
  </div>;
}

/* ------------------------------------------------------------
   AUTH MODAL
------------------------------------------------------------ */
function AuthModal({initTab="login",onClose,onSuccess}){
  const isMobile=useIsMobile(720);
  const[tab,setTab]=useState(initTab);
  const[email,setEmail]=useState("");
  const[uname,setUname]=useState("");
  const[pw,setPw]=useState("");
  const[err,setErr]=useState("");
  const[loading,setLoading]=useState(false);

  async function submit(e){
    e.preventDefault();setErr("");setLoading(true);
    try{
      const isReg=tab==="register";
      const data=isReg?await api.register(email,uname,pw):await api.login(email,pw);
      if(data.error)throw new Error(data.error);
      localStorage.setItem("boardai_token",data.token);
      localStorage.setItem("boardai_user",JSON.stringify(data.user));
      onSuccess(data.user);
    }catch(ex){setErr(ex.message||"Authentication failed");}
    finally{setLoading(false);}
  }

  const inp={background:T.bg3,border:`1px solid ${T.b1}`,borderRadius:8,padding:"9px 12px",color:T.t0,fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",width:"100%"};

  return<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,backdropFilter:"blur(6px)",padding:isMobile?12:0}} onClick={onClose}>
    <div className="pop" onClick={e=>e.stopPropagation()} style={{background:T.bg1,border:`1px solid ${T.b2}`,borderRadius:20,padding:isMobile?"20px 16px":"32px 36px",width:"100%",maxWidth:isMobile?"100%":420,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,.7)"}}>
      <div style={{textAlign:"center",marginBottom:26}}>
        <div style={{fontSize:34,color:T.y,marginBottom:6,animation:"float 3s ease-in-out infinite",display:"inline-block"}}>B</div>
        <h2 style={{fontFamily:"'Instrument Serif',serif",fontSize:isMobile?24:28,color:T.t0,fontWeight:800,letterSpacing:"-.03em",margin:0}}>Board<span style={{color:T.y}}>AI</span></h2>
      </div>
      {/* Tabs */}
      <div style={{display:"flex",background:T.bg0,borderRadius:10,padding:3,marginBottom:22}}>
        {["login","register"].map(t=><button key={t} onClick={()=>{setTab(t);setErr("");}} style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",background:tab===t?T.bg3:"transparent",color:tab===t?T.t0:T.t2,fontSize:12.5,cursor:"pointer",fontFamily:"inherit",fontWeight:tab===t?600:400,transition:"all .15s"}}>{t==="login"?"Sign In":"Create Account"}</button>)}
      </div>
      <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:11}}>
        {tab==="register"&&<input value={uname} onChange={e=>setUname(e.target.value)} placeholder="Your name" required style={inp} onFocus={e=>e.target.style.borderColor=T.yDim} onBlur={e=>e.target.style.borderColor=T.b1}/>}
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" required style={inp} onFocus={e=>e.target.style.borderColor=T.yDim} onBlur={e=>e.target.style.borderColor=T.b1}/>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password (min 6 chars)" required minLength={6} style={inp} onFocus={e=>e.target.style.borderColor=T.yDim} onBlur={e=>e.target.style.borderColor=T.b1}/>
        {err&&<div style={{background:"rgba(239,68,68,.09)",border:"1px solid rgba(239,68,68,.35)",borderRadius:7,padding:"7px 10px",fontSize:11.5,color:"#fca5a5",fontFamily:"'JetBrains Mono',monospace"}}>{err}</div>}
        <button type="submit" disabled={loading} style={{background:T.y,color:"#0c1829",border:"none",padding:"12px",borderRadius:9,cursor:loading?"not-allowed":"pointer",fontSize:14,fontFamily:"inherit",fontWeight:700,marginTop:4,opacity:loading?.6:1,transition:"opacity .15s"}}>{loading?"Loading…":tab==="login"?"Sign In":"Create Account"}</button>
      </form>
      <div style={{marginTop:16,textAlign:"center",fontSize:11.5,color:T.t2}}>
        {tab==="login"?"No account? ":"Have an account? "}
        <button onClick={()=>{setTab(tab==="login"?"register":"login");setErr("");}} style={{background:"none",border:"none",color:T.y,cursor:"pointer",fontSize:11.5,fontFamily:"inherit",textDecoration:"underline"}}>{tab==="login"?"Create one":"Sign in"}</button>
      </div>
    </div>
  </div>;
}

/* ------------------------------------------------------------
   LANDING PAGE
------------------------------------------------------------ */
function LandingPage({onLogin,themeMode="dark",onToggleTheme}){
  const isMobile=useIsMobile(860);
  const[showAuth,setShowAuth]=useState(false);
  const[authTab,setAuthTab]=useState("login");
  function openAuth(tab){setAuthTab(tab);setShowAuth(true);}

  const features=[
    {icon:"AI",title:"AI-Powered",desc:"DeepSeek AI generates boards, analyzes files, and helps structure your thinking instantly"},
    {icon:"SYNC",title:"Real-time Collab",desc:"Work with your team simultaneously — see cursors, changes, and comments live"},
    {icon:"TPL",title:"12 Templates",desc:"Mind maps, flowcharts, kanban, SWOT, OKR, user journeys, roadmaps, and more"},
    {icon:"EDIT",title:"Rich Editing",desc:"Stickies, shapes, text, arrows, frames, swimlanes, tables — full creative control"},
    {icon:"TOOLS",title:"Workshop Tools",desc:"Voting, timer, dependency mode, and presentation mode for remote facilitation"},
    {icon:"FILE",title:"File Upload",desc:"Upload documents and images — AI maps them into visual boards instantly"},
  ];

  return<div style={{minHeight:"100vh",background:T.bg0,fontFamily:"'DM Sans',sans-serif",overflow:"auto"}}>
    <style>{CSS}</style>
    {/* Header */}
    <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:isMobile?"12px 14px":"18px 44px",borderBottom:`1px solid ${T.b0}`,position:"sticky",top:0,background:T.bg0,zIndex:50,backdropFilter:"blur(12px)",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:22,color:T.y,animation:"float 3s ease-in-out infinite",display:"inline-block"}}>B</span>
        <span style={{fontFamily:"'Instrument Serif',serif",fontSize:isMobile?18:21,color:T.t0,fontWeight:800,letterSpacing:"-.03em"}}>Board<span style={{color:T.y}}>AI</span></span>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onToggleTheme} style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:isMobile?"6px 10px":"8px 12px",borderRadius:8,cursor:"pointer",fontSize:isMobile?12:13,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>
          {themeMode==="dark"?"Light":"Dark"}
        </button>
        <button onClick={()=>openAuth("login")} style={{background:"transparent",border:`1px solid ${T.b1}`,color:T.t1,padding:isMobile?"6px 10px":"8px 18px",borderRadius:8,cursor:"pointer",fontSize:isMobile?12:13,fontFamily:"inherit",transition:"all .15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.b2;e.currentTarget.style.color=T.t0;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t1;}}>Sign in</button>
        <button onClick={()=>openAuth("register")} style={{background:T.yBg,border:`1px solid ${T.yDim}`,color:T.y,padding:isMobile?"6px 10px":"8px 20px",borderRadius:8,cursor:"pointer",fontSize:isMobile?12:13,fontFamily:"inherit",fontWeight:600}}>Get Started</button>
      </div>
    </header>

    {/* Hero */}
    <section style={{textAlign:"center",padding:isMobile?"52px 14px 40px":"88px 20px 64px",maxWidth:860,margin:"0 auto"}}>
      <div style={{display:"inline-block",background:T.yBg,border:`1px solid ${T.yDim}`,color:T.y,padding:"4px 14px",borderRadius:99,fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:600,letterSpacing:".06em",marginBottom:30}}>AI-POWERED COLLABORATIVE WHITEBOARD</div>
      <h1 style={{fontFamily:"'Instrument Serif',serif",fontSize:"clamp(40px,6vw,68px)",fontWeight:800,color:T.t0,lineHeight:1.07,letterSpacing:"-.04em",marginBottom:22}}>
        Your ideas,{" "}
        <span style={{color:T.y,fontStyle:"italic"}}>beautifully organized</span>
        <br/>and alive
      </h1>
      <p style={{color:T.t1,fontSize:isMobile?14:16,lineHeight:1.75,maxWidth:560,margin:"0 auto 40px"}}>BoardAI is a real-time collaborative whiteboard powered by AI. Build mind maps, flowcharts, kanban boards — in seconds. Together.</p>
      <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
      <button onClick={()=>openAuth("register")} style={{background:T.y,color:"#0c1829",border:"none",padding:"14px 32px",borderRadius:11,cursor:"pointer",fontSize:15,fontFamily:"inherit",fontWeight:700,boxShadow:"0 4px 24px rgba(250,204,21,.35)",transition:"transform .15s"}} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>Start for free</button>
        <button onClick={()=>openAuth("login")} style={{background:"transparent",border:`1px solid ${T.b2}`,color:T.t0,padding:"14px 28px",borderRadius:11,cursor:"pointer",fontSize:15,fontFamily:"inherit"}}>Sign in</button>
      </div>
    </section>

    {/* Board preview mockup */}
    <section style={{maxWidth:1000,margin:"0 auto",padding:isMobile?"0 12px 42px":"0 24px 80px"}}>
      <div style={{background:T.bg1,border:`1px solid ${T.b1}`,borderRadius:20,padding:isMobile?14:28,boxShadow:"0 24px 80px rgba(0,0,0,.5)",position:"relative"}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:12,marginBottom:12}}>
          {[{bg:"#fef9c3",t:"#713f12",text:"Sticky notes & mind maps"},{bg:"#dbeafe",t:"#1e3a8a",text:"Shapes & diagrams"},{bg:"#dcfce7",t:"#14532d",text:"Templates library"}].map((c,i)=><div key={i} style={{background:c.bg,color:c.t,padding:"18px 16px",borderRadius:10,fontSize:12,fontWeight:600,lineHeight:1.5}}>{c.text}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:12}}>
          {[{bg:"#fce7f3",t:"#831843",text:"Kanban & roadmaps"},{bg:"#ede9fe",t:"#4c1d95",text:"OKR & strategy boards"},{bg:"#ffedd5",t:"#7c2d12",text:"Real-time collaboration"}].map((c,i)=><div key={i} style={{background:c.bg,color:c.t,padding:"18px 16px",borderRadius:10,fontSize:12,fontWeight:600,lineHeight:1.5}}>{c.text}</div>)}
        </div>
        <div style={{position:"absolute",top:14,right:14,background:T.y,color:"#0c1829",padding:"4px 11px",borderRadius:99,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>AI</div>
      </div>
    </section>

    {/* Features grid */}
    <section style={{maxWidth:1000,margin:"0 auto",padding:isMobile?"0 12px 56px":"0 24px 88px"}}>
      <div style={{textAlign:"center",marginBottom:52}}>
        <h2 style={{fontFamily:"'Instrument Serif',serif",fontSize:"clamp(28px,4vw,42px)",color:T.t0,fontWeight:800,letterSpacing:"-.03em",marginBottom:14}}>Everything you need to think, plan, and build</h2>
        <p style={{color:T.t1,fontSize:15,lineHeight:1.7,maxWidth:480,margin:"0 auto"}}>From solo ideation to team workshops — all in one collaborative canvas.</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fit,minmax(280px,1fr))",gap:20}}>
        {features.map((f,i)=><div key={i} style={{background:T.bg1,border:`1px solid ${T.b1}`,borderRadius:16,padding:"26px 22px",transition:"border-color .2s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.b2} onMouseLeave={e=>e.currentTarget.style.borderColor=T.b1}>
          <div style={{fontSize:30,marginBottom:14}}>{f.icon}</div>
          <h3 style={{fontSize:14.5,color:T.t0,fontWeight:700,marginBottom:9}}>{f.title}</h3>
          <p style={{fontSize:12.5,color:T.t1,lineHeight:1.65,margin:0}}>{f.desc}</p>
        </div>)}
      </div>
    </section>

    {/* CTA */}
    <section style={{textAlign:"center",padding:isMobile?"46px 14px 56px":"64px 20px 80px",background:T.bg1,borderTop:`1px solid ${T.b0}`,borderBottom:`1px solid ${T.b0}`}}>
      <h2 style={{fontFamily:"'Instrument Serif',serif",fontSize:"clamp(26px,4vw,40px)",color:T.t0,fontWeight:800,letterSpacing:"-.03em",marginBottom:14}}>Ready to think on a <span style={{color:T.y}}>bigger canvas</span>?</h2>
      <p style={{color:T.t1,fontSize:14,lineHeight:1.7,marginBottom:30,maxWidth:420,margin:"0 auto 30px"}}>Join your team on BoardAI — free to start, powerful from day one.</p>
      <button onClick={()=>openAuth("register")} style={{background:T.y,color:"#0c1829",border:"none",padding:"14px 34px",borderRadius:11,cursor:"pointer",fontSize:15,fontFamily:"inherit",fontWeight:700,boxShadow:"0 4px 24px rgba(250,204,21,.35)"}}>Get started free →</button>
    </section>

    {/* Footer */}
    <footer style={{padding:isMobile?"14px 12px":"22px 44px",display:"flex",alignItems:"center",justifyContent:"space-between",color:T.t3,fontSize:11,fontFamily:"'JetBrains Mono',monospace",flexDirection:isMobile?"column":"row",gap:isMobile?6:0}}>
      <span>◈ BoardAI · 2026</span>
      <span>collaborative whiteboard platform</span>
    </footer>

    {showAuth&&<AuthModal initTab={authTab} onClose={()=>setShowAuth(false)} onSuccess={u=>{setShowAuth(false);onLogin(u);}}/>}
  </div>;
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

  if(!user)return<LandingPage onLogin={handleLogin} themeMode={themeMode} onToggleTheme={toggleTheme}/>;
  if(!authReady)return<div style={{height:"100vh",display:"grid",placeItems:"center",background:T.bg0,color:T.t1,fontFamily:"'JetBrains Mono',monospace",fontSize:12}}>Validating session...</div>;
  if(!boardId)return<Dashboard user={user} onSelect={openBoard} onLogout={handleLogout} themeMode={themeMode} onToggleTheme={toggleTheme}/>;

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
        {showEmptyBoardPrompt&&<EmptyBoardPrompt
          onGenerateAi={runQuickAiBoard}
          onOpenTemplates={()=>setShowTpl(true)}
          onBrainstorm={startBrainstormNow}
          aiPrompt={quickAiPrompt}
          setAiPrompt={setQuickAiPrompt}
          aiBusy={quickAiBusy}
        />}
        {showOnboardingOverlay&&<EditorOnboardingOverlay
          isMobile={isMobile}
          onClose={markOnboardingDone}
          onUsePreset={applyQuickStartPreset}
          onOpenTemplates={()=>setShowTpl(true)}
          onGenerateAi={runQuickAiBoard}
          aiPrompt={quickAiPrompt}
          setAiPrompt={setQuickAiPrompt}
          aiBusy={quickAiBusy}
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
        {!presentMode&&!isMobile&&<RightToolPanel s={s} d={d} uid={uid} onOpenTemplates={()=>setShowTpl(true)} notify={(msg,type)=>toasts.push(msg,type)} topOffset={56} side="left" leftInset={12}/>}
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
        {presentMode&&<PresentBar onExit={()=>setPresentMode(false)} frames={frames} curIdx={presentIdx} setCurIdx={setPresentIdx}/>}
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





import { useState, useRef, useCallback, useEffect, createContext, useContext, useReducer } from "react";

/* ════════════════════════════════════════════════════════════
   GLOBAL CSS — Obsidian Studio aesthetic
   Fonts: Instrument Serif (display) + JetBrains Mono + DM Sans
════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;width:100%;overflow:hidden;}
body{font-family:'DM Sans',sans-serif;background:#050911;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-thumb{background:#1c2a3a;border-radius:99px;}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes popIn{from{opacity:0;transform:scale(.94);}to{opacity:1;transform:scale(1);}}
@keyframes slideIn{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:translateX(0);}}
@keyframes glow{0%,100%{box-shadow:0 0 12px rgba(250,204,21,.25);}50%{box-shadow:0 0 28px rgba(250,204,21,.5);}}
@keyframes timerPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.04);}}
@keyframes dash{to{stroke-dashoffset:-24;}}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}
.na{animation:fadeUp .18s ease forwards;}
.pop{animation:popIn .14s ease forwards;}
.slide{animation:slideIn .18s ease forwards;}
button:focus-visible{outline:2px solid #facc15;outline-offset:2px;}
input[type=range]{accent-color:#facc15;}
input[type=checkbox]{accent-color:#facc15;width:13px;height:13px;}
input[type=color]{-webkit-appearance:none;appearance:none;width:24px;height:24px;border:none;border-radius:50%;cursor:pointer;padding:0;background:none;}
input[type=color]::-webkit-color-swatch-wrapper{padding:0;border-radius:50%;}
input[type=color]::-webkit-color-swatch{border:none;border-radius:50%;}
`;

/* ════════════════════════════════════════════════════════════
   DESIGN TOKENS
════════════════════════════════════════════════════════════ */
const T = {
  bg0:"#050911", bg1:"#0a1020", bg2:"#0f1929", bg3:"#162032", bg4:"#1c2a3e",
  b0:"#1a2a3c", b1:"#223146", b2:"#2a3d54",
  t0:"#f0f6ff", t1:"#8ba4be", t2:"#4a6278", t3:"#2a3d52",
  y:"#facc15", yDim:"#713f12", yBg:"rgba(250,204,21,.07)",
  blue:"#3b82f6", green:"#22c55e", red:"#ef4444", purple:"#a78bfa", teal:"#2dd4bf",
};

const SC=[
  {bg:"#fef9c3",t:"#713f12"},{bg:"#dcfce7",t:"#14532d"},{bg:"#dbeafe",t:"#1e3a8a"},
  {bg:"#fce7f3",t:"#831843"},{bg:"#ede9fe",t:"#4c1d95"},{bg:"#ccfbf1",t:"#134e4a"},
  {bg:"#ffedd5",t:"#7c2d12"},{bg:"#ecfdf5",t:"#065f46"},
];
let _si=0;
let _uid=Date.now();
const uid=()=>`e${_uid++}`;

/* ════════════════════════════════════════════════════════════
   SNAP-TO-GRID HELPER
════════════════════════════════════════════════════════════ */
const GRID=24;
const snap=(v,enabled)=>enabled?Math.round(v/GRID)*GRID:v;

/* ════════════════════════════════════════════════════════════
   TEMPLATES
════════════════════════════════════════════════════════════ */
const TPLS={
  kanban:{name:"Kanban",icon:"▦",build:()=>{
    const cols=[["📋 Backlog","#1c2a3e"],["⚙ In Progress","#162032"],["✅ Done","#0f1929"]];
    const n=[],oy=60,cw=240,ch=520,gap=20;
    cols.forEach(([l,bg],i)=>{
      const x=60+i*(cw+gap);
      n.push({id:uid(),type:"shape",shapeType:"rect",x,y:oy,w:cw,h:ch,text:"",color:bg,textColor:T.t0,borderColor:T.b1,fontSize:13});
      n.push({id:uid(),type:"text",x:x+14,y:oy+14,w:cw-28,h:36,text:l,color:T.t0,textColor:T.t0,fontSize:14,fontWeight:"600"});
      for(let j=0;j<3;j++){const s=SC[(i*3+j)%8];n.push({id:uid(),type:"sticky",x:x+12,y:oy+60+j*112,w:cw-24,h:98,text:`Task ${i*3+j+1}`,color:s.bg,textColor:s.t,fontSize:12});}
    });
    return{nodes:n,arrows:[]};
  }},
  swot:{name:"SWOT",icon:"◈",build:()=>{
    const q=[["Strengths","#166534","#dcfce7","#14532d"],["Weaknesses","#991b1b","#fef2f2","#7f1d1d"],["Opportunities","#1d4ed8","#eff6ff","#1e3a8a"],["Threats","#b45309","#fffbeb","#78350f"]];
    const n=[];
    n.push({id:uid(),type:"text",x:200,y:16,w:380,h:50,text:"SWOT Analysis",color:T.t0,textColor:T.t0,fontSize:28,fontWeight:"600"});
    q.forEach(([l,border,bg,tc],i)=>{
      const x=60+(i%2)*390,y=80+Math.floor(i/2)*280;
      n.push({id:uid(),type:"shape",shapeType:"rect",x,y,w:360,h:260,text:"",color:bg,textColor:tc,borderColor:border,fontSize:13});
      n.push({id:uid(),type:"text",x:x+16,y:y+16,w:220,h:34,text:l,color:border,textColor:border,fontSize:15,fontWeight:"700"});
      for(let j=0;j<3;j++)n.push({id:uid(),type:"sticky",x:x+16,y:y+58+j*64,w:328,h:56,text:`Punct ${j+1}...`,color:bg,textColor:tc,fontSize:11});
    });
    return{nodes:n,arrows:[]};
  }},
  mindmap:{name:"Mind Map",icon:"✦",build:()=>{
    const br=[{t:"Idei",c:"#3b82f6"},{t:"Resurse",c:"#22c55e"},{t:"Obiective",c:"#f59e0b"},{t:"Riscuri",c:"#ef4444"},{t:"Timeline",c:"#8b5cf6"},{t:"Echipă",c:"#06b6d4"}];
    const center={id:uid(),type:"shape",shapeType:"circle",x:415,y:315,w:170,h:170,text:"Proiect",color:"#0c1829",textColor:T.y,borderColor:T.y,fontSize:15,fontWeight:"700",glowColor:T.y};
    const n=[center],a=[];
    br.forEach((b,i)=>{
      const ang=((2*Math.PI)/br.length)*i-Math.PI/2;
      const bid=uid();
      const bx=500+260*Math.cos(ang)-75,by=400+260*Math.sin(ang)-30;
      n.push({id:bid,type:"shape",shapeType:"rect",x:bx,y:by,w:150,h:60,text:b.t,color:b.c,textColor:"#fff",borderColor:"rgba(255,255,255,.12)",fontSize:13,fontWeight:"600"});
      a.push({id:uid(),fromId:center.id,toId:bid});
      for(let j=0;j<2;j++){
        const a2=ang+(j-.5)*.65,r2=175,sid=uid();
        const s=SC[i%8];
        n.push({id:sid,type:"sticky",x:bx+75+r2*Math.cos(a2)-60,y:by+30+r2*Math.sin(a2)-22,w:120,h:44,text:`Sub-idee ${j+1}`,color:s.bg,textColor:s.t,fontSize:11});
        a.push({id:uid(),fromId:bid,toId:sid});
      }
    });
    return{nodes:n,arrows:a};
  }},
  retro:{name:"Retrospectivă",icon:"↺",build:()=>{
    const cols=[["😊 Ce a mers","#dcfce7","#14532d"],["😢 Ce n-a mers","#fee2e2","#7f1d1d"],["💡 Îmbunătățiri","#dbeafe","#1e3a8a"],["🎯 Acțiuni","#fef9c3","#713f12"]];
    const n=[];
    n.push({id:uid(),type:"text",x:120,y:16,w:500,h:46,text:"Sprint Retrospective",color:T.t0,textColor:T.t0,fontSize:26,fontWeight:"600"});
    cols.forEach(([l,bg,tc],i)=>{
      const x=60+i*220;
      n.push({id:uid(),type:"shape",shapeType:"rect",x,y:80,w:200,h:500,text:"",color:bg,textColor:tc,borderColor:"rgba(0,0,0,.08)",fontSize:13});
      n.push({id:uid(),type:"text",x:x+10,y:96,w:180,h:34,text:l,color:tc,textColor:tc,fontSize:13,fontWeight:"600"});
      for(let j=0;j<3;j++)n.push({id:uid(),type:"sticky",x:x+10,y:140+j*112,w:180,h:98,text:"",color:bg,textColor:tc,fontSize:12});
    });
    return{nodes:n,arrows:[]};
  }},
  flowchart:{name:"Flowchart",icon:"⟶",build:()=>{
    const steps=[{t:"Start",c:"#22c55e",s:"circle"},{t:"Definește problema",c:"#3b82f6",s:"rect"},{t:"Analizează",c:"#3b82f6",s:"rect"},{t:"Decide?",c:"#f59e0b",s:"diamond"},{t:"Implementează",c:"#3b82f6",s:"rect"},{t:"End",c:"#ef4444",s:"circle"}];
    const n=steps.map((s,i)=>({id:uid(),type:"shape",shapeType:s.s,x:s.s==="diamond"?380:400,y:60+i*130,w:s.s==="circle"?100:160,h:s.s==="diamond"?80:66,text:s.t,color:s.c,textColor:"#fff",borderColor:"rgba(255,255,255,.12)",fontSize:12,fontWeight:"600"}));
    const a=n.slice(0,-1).map((_,i)=>({id:uid(),fromId:n[i].id,toId:n[i+1].id}));
    n.push({id:uid(),type:"sticky",x:620,y:430+50,w:140,h:54,text:"Nu → Revizuiește",color:"#fef9c3",textColor:"#713f12",fontSize:11});
    return{nodes:n,arrows:a};
  }},
  journey:{name:"User Journey",icon:"→",build:()=>{
    const stages=["🔍 Awareness","🤔 Consideration","✅ Decision","🛒 Purchase","❤️ Loyalty"];
    const rows=["Acțiuni","Emoții","Touchpoints","Oportunități"];
    const rBg=["#dbeafe","#fce7f3","#dcfce7","#fef9c3"],rTc=["#1e3a8a","#831843","#14532d","#713f12"];
    const n=[];
    n.push({id:uid(),type:"text",x:80,y:8,w:720,h:46,text:"User Journey Map",color:T.t0,textColor:T.t0,fontSize:26,fontWeight:"600"});
    stages.forEach((s,i)=>n.push({id:uid(),type:"shape",shapeType:"rect",x:180+i*162,y:62,w:152,h:48,text:s,color:T.bg3,textColor:T.t0,borderColor:T.b1,fontSize:11,fontWeight:"600"}));
    rows.forEach((r,ri)=>{
      n.push({id:uid(),type:"shape",shapeType:"rect",x:18,y:120+ri*108,w:152,h:98,text:r,color:T.bg2,textColor:T.t1,borderColor:T.b0,fontSize:11,fontWeight:"600"});
      stages.forEach((_,si)=>n.push({id:uid(),type:"sticky",x:180+si*162,y:120+ri*108,w:152,h:98,text:"",color:rBg[ri],textColor:rTc[ri],fontSize:11}));
    });
    return{nodes:n,arrows:[]};
  }},
  roadmap:{name:"Roadmap",icon:"🗺",build:()=>{
    const qs=["Q1","Q2","Q3","Q4"];
    const tracks=["🎯 Features","🐛 Bugs","📊 Research"];
    const n=[];
    n.push({id:uid(),type:"text",x:80,y:8,w:720,h:46,text:"Product Roadmap 2025",color:T.t0,textColor:T.t0,fontSize:26,fontWeight:"600"});
    qs.forEach((q,i)=>n.push({id:uid(),type:"shape",shapeType:"rect",x:180+i*210,y:62,w:200,h:42,text:q,color:T.y,textColor:"#0c1829",borderColor:"transparent",fontSize:13,fontWeight:"700"}));
    tracks.forEach((tr,ti)=>{
      n.push({id:uid(),type:"shape",shapeType:"rect",x:18,y:114+ti*128,w:152,h:118,text:tr,color:T.bg2,textColor:T.t0,borderColor:T.b0,fontSize:12,fontWeight:"600"});
      qs.forEach((_,qi)=>n.push({id:uid(),type:"sticky",x:180+qi*210,y:114+ti*128,w:200,h:118,text:`Item ${ti*4+qi+1}`,color:SC[(ti+qi)%8].bg,textColor:SC[(ti+qi)%8].t,fontSize:11}));
    });
    return{nodes:n,arrows:[]};
  }},
  bmc:{name:"Business Canvas",icon:"◫",build:()=>{
    const bl=[
      {t:"🤝 Key Partners",x:16,y:68,w:180,h:320,c:"#dbeafe",tc:"#1e3a8a"},
      {t:"⚙ Key Activities",x:206,y:68,w:180,h:155,c:"#dcfce7",tc:"#14532d"},
      {t:"💎 Value Props",x:396,y:68,w:200,h:320,c:"#fce7f3",tc:"#831843"},
      {t:"👥 Relationships",x:606,y:68,w:180,h:155,c:"#ede9fe",tc:"#4c1d95"},
      {t:"🎯 Segments",x:796,y:68,w:180,h:320,c:"#ccfbf1",tc:"#134e4a"},
      {t:"🔑 Key Resources",x:206,y:233,w:180,h:155,c:"#fef9c3",tc:"#713f12"},
      {t:"📣 Channels",x:606,y:233,w:180,h:155,c:"#ffedd5",tc:"#7c2d12"},
      {t:"💰 Cost Structure",x:16,y:398,w:478,h:138,c:"#ecfdf5",tc:"#065f46"},
      {t:"💵 Revenue Streams",x:504,y:398,w:472,h:138,c:"#fef2f2","tc":"#7f1d1d"},
    ];
    const n=[];
    n.push({id:uid(),type:"text",x:100,y:8,w:700,h:46,text:"Business Model Canvas",color:T.t0,textColor:T.t0,fontSize:24,fontWeight:"600"});
    bl.forEach(b=>n.push({id:uid(),type:"shape",shapeType:"rect",x:b.x,y:b.y,w:b.w,h:b.h,text:b.t,color:b.c,textColor:b.tc,borderColor:"rgba(0,0,0,.07)",fontSize:10,fontWeight:"600"}));
    return{nodes:n,arrows:[]};
  }},
  okr:{name:"OKR Board",icon:"🎯",build:()=>{
    const n=[];
    n.push({id:uid(),type:"text",x:80,y:8,w:600,h:50,text:"OKR Q1 2025",color:T.t0,textColor:T.t0,fontSize:28,fontWeight:"600"});
    const objs=["Creștere Vânzări","Satisfacție Clienți","Inovație Produs"];
    objs.forEach((obj,oi)=>{
      const y=80+oi*220;
      n.push({id:uid(),type:"shape",shapeType:"rect",x:60,y,w:720,h:36,text:`O${oi+1}: ${obj}`,color:T.y,textColor:"#0c1829",borderColor:"transparent",fontSize:13,fontWeight:"700"});
      for(let ki=0;ki<3;ki++){
        const s=SC[(oi*3+ki)%8];
        n.push({id:uid(),type:"sticky",x:60+ki*240,y:y+46,w:228,h:160,text:`KR${ki+1}: Atinge ${(ki+1)*30}% din target\n\n🎯 Target:\n📊 Progres:\n✅ Status:`,color:s.bg,textColor:s.t,fontSize:11});
      }
    });
    return{nodes:n,arrows:[]};
  }},
  table:{name:"Tabel 5×4",icon:"▦",build:()=>{
    const n=[];
    const cols=["Coloana 1","Coloana 2","Coloana 3","Coloana 4","Coloana 5"];
    const rows=4;
    n.push({id:uid(),type:"text",x:80,y:8,w:500,h:46,text:"Tabel Personalizat",color:T.t0,textColor:T.t0,fontSize:24,fontWeight:"600"});
    cols.forEach((c,ci)=>n.push({id:uid(),type:"shape",shapeType:"rect",x:60+ci*160,y:68,w:152,h:40,text:c,color:T.bg3,textColor:T.y,borderColor:T.b1,fontSize:12,fontWeight:"700"}));
    for(let ri=0;ri<rows;ri++)
      cols.forEach((_,ci)=>n.push({id:uid(),type:"sticky",x:60+ci*160,y:118+ri*56,w:152,h:48,text:"",color:ri%2===0?"#f0f9ff":"#f8fafc",textColor:"#1e293b",fontSize:11}));
    return{nodes:n,arrows:[]};
  }},
};

/* ════════════════════════════════════════════════════════════
   STATE REDUCER
════════════════════════════════════════════════════════════ */
const Ctx=createContext(null);
function reducer(s,a){
  switch(a.type){
    case"TOOL":return{...s,tool:a.v,arrowFrom:null};
    case"SEL":return{...s,sel:a.v};
    case"ZOOM":return{...s,zoom:Math.max(.08,Math.min(6,a.v))};
    case"PAN":return{...s,px:a.x,py:a.y};
    case"SNAP_TOGGLE":return{...s,snapGrid:!s.snapGrid};
    case"ADD":return{...s,nodes:[...s.nodes,a.node],hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
    case"UPD":return{...s,nodes:s.nodes.map(n=>n.id===a.id?{...n,...a.p}:n)};
    case"UPD_SEL":return{...s,nodes:s.nodes.map(n=>s.sel.includes(n.id)?{...n,...a.p}:n)};
    case"DEL":return{...s,nodes:s.nodes.filter(n=>!a.ids.includes(n.id)),arrows:s.arrows.filter(a2=>!a.ids.includes(a2.fromId)&&!a.ids.includes(a2.toId)),sel:[],hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
    case"ADD_ARR":return{...s,arrows:[...s.arrows,a.arr]};
    case"DEL_ARR":return{...s,arrows:s.arrows.filter(r=>r.id!==a.id)};
    case"UPD_ARR":return{...s,arrows:s.arrows.map(r=>r.id===a.id?{...r,...a.p}:r)};
    case"ARR_FROM":return{...s,arrowFrom:a.id};
    case"CLEAR":return{...s,nodes:[],arrows:[],sel:[],arrowFrom:null,comments:[],drawings:[],hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
    case"APPLY":{
      const base=a.replace?[]:s.nodes,baseA=a.replace?[]:s.arrows;
      return{...s,nodes:[...base,...a.nodes],arrows:[...baseA,...(a.arrows||[])],hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
    }
    case"UNDO":{
      if(!s.hist.length)return s;
      const prev=s.hist[s.hist.length-1];
      return{...s,nodes:prev.n,arrows:prev.a,hist:s.hist.slice(0,-1),fut:[{n:s.nodes,a:s.arrows},...s.fut]};
    }
    case"REDO":{
      if(!s.fut.length)return s;
      const nxt=s.fut[0];
      return{...s,nodes:nxt.n,arrows:nxt.a,fut:s.fut.slice(1),hist:[...s.hist,{n:s.nodes,a:s.arrows}]};
    }
    case"DUP":{
      const td=s.nodes.filter(n=>s.sel.includes(n.id));
      const nd=td.map(n=>({...n,id:uid(),x:n.x+GRID,y:n.y+GRID}));
      return{...s,nodes:[...s.nodes,...nd],sel:nd.map(n=>n.id),hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
    }
    case"SNAP":return{...s,hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
    case"ADD_COMMENT":return{...s,comments:[...s.comments,a.c]};
    case"DEL_COMMENT":return{...s,comments:s.comments.filter(c=>c.id!==a.id)};
    case"ADD_DRAW":return{...s,drawings:[...s.drawings,a.d]};
    case"CLEAR_DRAWS":return{...s,drawings:[]};
    case"ADD_VOTE":return{...s,votes:{...s.votes,[a.nodeId]:(s.votes[a.nodeId]||0)+1}};
    case"CLEAR_VOTES":return{...s,votes:{}};
    case"LOAD":return{...a.state,hist:[],fut:[]};
    default:return s;
  }
}
const INIT={nodes:[],arrows:[],sel:[],tool:"select",zoom:1,px:0,py:0,arrowFrom:null,hist:[],fut:[],comments:[],drawings:[],votes:{},snapGrid:false};

function WBP({children}){
  const[s,d]=useReducer(reducer,INIT);

  // AUTOSAVE
  useEffect(()=>{
    const t=setTimeout(()=>{
      try{localStorage.setItem("boardai_v7",JSON.stringify({nodes:s.nodes,arrows:s.arrows,comments:s.comments,votes:s.votes}));}catch{}
    },1000);
    return()=>clearTimeout(t);
  },[s.nodes,s.arrows,s.comments,s.votes]);

  // AUTOLOAD on mount
  useEffect(()=>{
    try{
      const saved=localStorage.getItem("boardai_v7");
      if(saved){const p=JSON.parse(saved);if(p.nodes?.length)d({type:"APPLY",nodes:p.nodes,arrows:p.arrows||[],replace:true});}
    }catch{}
  },[]);

  return<Ctx.Provider value={{s,d}}>{children}</Ctx.Provider>;
}
const useWB=()=>useContext(Ctx);

/* ════════════════════════════════════════════════════════════
   AI HELPER
════════════════════════════════════════════════════════════ */
async function aiCall(msg,sys){
  if(!window.claude?.complete)throw new Error("window.claude non disponibil");
  return await window.claude.complete(`SYSTEM:\n${sys}\n\nUSER:\n${msg}`,{maxTokens:1000});
}
const WB_SYS=`Whiteboard AI. EXCLUSIV JSON fără markdown.
{"nodes":[{"id":"n1","type":"sticky"|"shape"|"text","x":nr,"y":nr,"w":nr,"h":nr,"text":"str","color":"hex","textColor":"hex","shapeType":"rect"|"circle"|"diamond","fontSize":nr,"fontWeight":"normal"|"bold"}],"arrows":[{"id":"a1","fromId":"n1","toId":"n2","label":""}],"message":"str"}
sticky w=170 h=130. rect 150×75. circle 100×100. diamond 130×85. Spațiu 40px. DOAR JSON.`;
const SW_SYS=`Spider web din fișier. EXCLUSIV JSON.
{"title":"str","nodes":[{"id":"n0","type":"shape","shapeType":"circle","x":415,"y":315,"w":170,"h":170,"text":"tema","color":"#0c1829","textColor":"#facc15","borderColor":"#facc15","fontSize":14,"fontWeight":"700","glowColor":"#facc15"}],"arrows":[{"id":"a1","fromId":"n0","toId":"n1"}],"summary":"str"}
Nivel1 rect 150×60 la r=270 de centrul 500,400. textColor="#fff" bold. Nivel2 rect 130×48 la r=175 de parent. textColor="#1e293b".
Culori n1: #3b82f6 #22c55e #f59e0b #ef4444 #8b5cf6 #06b6d4 #f97316 #ec4899. DOAR JSON.`;

/* ════════════════════════════════════════════════════════════
   EDITABLE TEXT
════════════════════════════════════════════════════════════ */
function ET({value,onChange,style}){
  const[ed,setEd]=useState(false);
  const r=useRef(null);
  useEffect(()=>{if(ed&&r.current){r.current.focus();r.current.select?.();}},[ed]);
  if(ed)return<textarea ref={r} defaultValue={value}
    onBlur={e=>{onChange(e.target.value);setEd(false);}}
    onKeyDown={e=>{if(e.key==="Escape")setEd(false);}}
    style={{...style,background:"transparent",border:"none",outline:"none",resize:"none",width:"100%",height:"100%",fontFamily:"inherit",padding:0,caretColor:T.y}}/>;
  return<div onDoubleClick={()=>setEd(true)} style={{...style,width:"100%",height:"100%",wordBreak:"break-word",whiteSpace:"pre-wrap",minHeight:14}}>
    {value||<span style={{opacity:.2,fontSize:".85em",fontStyle:"italic"}}>dbl-click…</span>}
  </div>;
}

/* ════════════════════════════════════════════════════════════
   RESIZE HANDLES
════════════════════════════════════════════════════════════ */
const RDS=[{d:"se",s:{bottom:-5,right:-5,cursor:"se-resize"}},{d:"sw",s:{bottom:-5,left:-5,cursor:"sw-resize"}},{d:"ne",s:{top:-5,right:-5,cursor:"ne-resize"}},{d:"nw",s:{top:-5,left:-5,cursor:"nw-resize"}},{d:"e",s:{top:"50%",right:-5,transform:"translateY(-50%)",cursor:"e-resize"}},{d:"w",s:{top:"50%",left:-5,transform:"translateY(-50%)",cursor:"w-resize"}},{d:"s",s:{bottom:-5,left:"50%",transform:"translateX(-50%)",cursor:"s-resize"}},{d:"n",s:{top:-5,left:"50%",transform:"translateX(-50%)",cursor:"n-resize"}}];
function RH({nodeId,onStart}){
  return RDS.map(({d,s})=><div key={d} onMouseDown={e=>{e.stopPropagation();onStart(e,nodeId,d);}} style={{...s,position:"absolute",width:9,height:9,background:T.bg2,border:`1.5px solid ${T.y}`,borderRadius:2,zIndex:30}}/>);
}

/* ════════════════════════════════════════════════════════════
   VOTE BADGE
════════════════════════════════════════════════════════════ */
function VoteBadge({count,onClick}){
  return<div onClick={e=>{e.stopPropagation();onClick();}} style={{position:"absolute",top:-10,right:-10,background:T.y,color:"#0c1829",borderRadius:99,minWidth:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,cursor:"pointer",padding:"0 6px",zIndex:20,fontFamily:"'JetBrains Mono',monospace",boxShadow:`0 2px 8px rgba(250,204,21,.4)`}}>
    {count?`${count} ✦`:"+ ✦"}
  </div>;
}

/* ════════════════════════════════════════════════════════════
   NODE COMPONENTS
════════════════════════════════════════════════════════════ */
function Sticky({node,sel,onSel,onUpd,onRSt,votes,onVote,voteMode}){
  const glow=sel?`0 0 0 2px ${T.y},0 8px 28px rgba(250,204,21,.18)`:"0 4px 20px rgba(0,0,0,.4)";
  return<div className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,background:node.color,opacity:node.opacity??1,borderRadius:6,padding:"12px 14px 12px 14px",boxShadow:glow,cursor:"move",userSelect:"none",transition:"box-shadow .15s"}}>
    <ET value={node.text} onChange={t=>onUpd(node.id,{text:t})} style={{fontSize:node.fontSize||13,color:node.textColor||"#1e293b",fontWeight:node.fontWeight||"normal",lineHeight:1.5}}/>
    {sel&&<RH nodeId={node.id} onStart={onRSt}/>}
    {voteMode&&<VoteBadge count={votes||0} onClick={()=>onVote(node.id)}/>}
  </div>;
}

function Shape({node,sel,onSel,onUpd,onRSt,votes,onVote,voteMode}){
  const isDia=node.shapeType==="diamond";
  const br=node.shapeType==="circle"?"50%":isDia?0:8;
  const glow=[sel?`0 0 0 2px ${T.y},0 8px 24px rgba(250,204,21,.15)`:"",node.glowColor?`0 0 20px ${node.glowColor}55`:""].filter(Boolean).join(",")||"0 4px 20px rgba(0,0,0,.45)";
  return<div className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,background:node.color,opacity:node.opacity??1,borderRadius:br,border:`1.5px solid ${node.borderColor||"rgba(255,255,255,.08)"}`,transform:isDia?"rotate(45deg)":undefined,boxShadow:glow,cursor:"move",userSelect:"none",display:"flex",alignItems:"center",justifyContent:"center",transition:"box-shadow .15s"}}>
    <div style={{transform:isDia?"rotate(-45deg)":undefined,width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",padding:10}}>
      <ET value={node.text} onChange={t=>onUpd(node.id,{text:t})} style={{fontSize:node.fontSize||13,color:node.textColor||"#fff",fontWeight:node.fontWeight||"600",textAlign:"center",lineHeight:1.3}}/>
    </div>
    {sel&&<RH nodeId={node.id} onStart={onRSt}/>}
    {voteMode&&<VoteBadge count={votes||0} onClick={()=>onVote(node.id)}/>}
  </div>;
}

function TxtNode({node,sel,onSel,onUpd,onRSt}){
  return<div className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,minHeight:node.h,opacity:node.opacity??1,cursor:"move",userSelect:"none",outline:sel?`2px solid ${T.y}`:"none",outlineOffset:4,borderRadius:4}}>
    <ET value={node.text} onChange={t=>onUpd(node.id,{text:t})} style={{fontSize:node.fontSize||22,color:node.textColor||node.color||T.t0,fontWeight:node.fontWeight||"700",lineHeight:1.2,letterSpacing:"-.02em"}}/>
    {sel&&<RH nodeId={node.id} onStart={onRSt}/>}
  </div>;
}

function FrameNode({node,sel,onSel,onUpd,onRSt}){
  return<div onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,background:"rgba(255,255,255,.015)",border:`2px solid ${sel?T.y:T.b1}`,borderRadius:10,cursor:"move",pointerEvents:"none"}}>
    <div style={{position:"absolute",top:-26,left:0,background:sel?T.y:T.b1,color:sel?"#0c1829":T.t1,padding:"3px 12px",borderRadius:"6px 6px 0 0",fontSize:11,fontWeight:600,fontFamily:"'JetBrains Mono',monospace",pointerEvents:"auto",cursor:"move",whiteSpace:"nowrap"}} onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey);}}>
      <ET value={node.text||"Frame"} onChange={t=>onUpd(node.id,{text:t})} style={{display:"inline",fontSize:11,color:"inherit",fontWeight:600}}/>
    </div>
    {sel&&<RH nodeId={node.id} onStart={onRSt}/>}
  </div>;
}

function ImgNode({node,sel,onSel,onRSt}){
  return<div className="na" onMouseDown={e=>{e.stopPropagation();onSel(node.id,e.shiftKey);}}
    style={{position:"absolute",left:node.x,top:node.y,width:node.w,height:node.h,opacity:node.opacity??1,borderRadius:8,overflow:"hidden",border:`2px solid ${sel?T.y:"transparent"}`,cursor:"move",boxShadow:"0 4px 20px rgba(0,0,0,.5)"}}>
    <img src={node.src} alt="" style={{width:"100%",height:"100%",objectFit:"cover",pointerEvents:"none"}}/>
    {sel&&<RH nodeId={node.id} onStart={onRSt}/>}
  </div>;
}

/* ════════════════════════════════════════════════════════════
   ARROW LABEL (editable)
════════════════════════════════════════════════════════════ */
function ArrowLabel({label,mx,my,onUpdate,onDelete}){
  const[ed,setEd]=useState(false);
  const r=useRef(null);
  useEffect(()=>{if(ed&&r.current)r.current.focus();},[ed]);
  return<div style={{position:"absolute",left:mx-40,top:my-14,width:80,textAlign:"center",pointerEvents:"auto",zIndex:15}}>
    {ed?<input ref={r} defaultValue={label||""} onBlur={e=>{onUpdate(e.target.value);setEd(false);}} onKeyDown={e=>{if(e.key==="Escape"||e.key==="Enter"){onUpdate(e.target.value);setEd(false);}}} style={{background:T.bg2,border:`1px solid ${T.b2}`,color:T.t0,borderRadius:4,padding:"2px 6px",fontSize:10,width:"100%",fontFamily:"'JetBrains Mono',monospace",outline:"none",textAlign:"center"}}/>
    :<span onDoubleClick={()=>setEd(true)} onContextMenu={e=>{e.stopPropagation();e.preventDefault();onDelete();}} style={{background:label?T.bg2:"transparent",color:label?T.t1:"transparent",padding:"2px 7px",borderRadius:4,fontSize:10,cursor:"text",fontFamily:"'JetBrains Mono',monospace",border:label?`1px solid ${T.b0}`:"none",userSelect:"none"}}>{label||"…"}</span>}
  </div>;
}

/* ════════════════════════════════════════════════════════════
   COMMENT DOT
════════════════════════════════════════════════════════════ */
function CommentDot({c,onDel}){
  const[open,setOpen]=useState(false);
  return<div style={{position:"absolute",left:c.x,top:c.y,zIndex:80}}>
    <div onClick={()=>setOpen(o=>!o)} style={{width:22,height:22,borderRadius:"50% 50% 50% 0",background:T.y,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:10,fontWeight:700,color:"#0c1829",boxShadow:`0 2px 8px rgba(250,204,21,.4)`,animation:"float 3s ease-in-out infinite"}}>!</div>
    {open&&<div className="pop" style={{position:"absolute",left:26,top:-6,background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:10,padding:"10px 12px",minWidth:160,maxWidth:220,boxShadow:"0 4px 20px rgba(0,0,0,.6)",zIndex:90}}>
      <p style={{fontSize:12,color:T.t0,lineHeight:1.5,marginBottom:8}}>{c.text}</p>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{c.author}</span>
        <button onClick={()=>onDel(c.id)} style={{background:"none",border:"none",color:T.red,fontSize:12,cursor:"pointer"}}>✕</button>
      </div>
    </div>}
  </div>;
}

/* ════════════════════════════════════════════════════════════
   LASSO SELECTION RECT
════════════════════════════════════════════════════════════ */
function Lasso({l}){
  if(!l)return null;
  const x=Math.min(l.x1,l.x2),y=Math.min(l.y1,l.y2),w=Math.abs(l.x2-l.x1),h=Math.abs(l.y2-l.y1);
  return<div style={{position:"absolute",left:x,top:y,width:w,height:h,border:`1.5px dashed ${T.y}`,background:"rgba(250,204,21,.04)",borderRadius:4,pointerEvents:"none",zIndex:100}}/>;
}

/* ════════════════════════════════════════════════════════════
   CANVAS
════════════════════════════════════════════════════════════ */
function Canvas({presentMode,presentFrame}){
  const{s,d}=useWB();
  const{nodes,arrows,sel,tool,zoom,px,py,arrowFrom,comments,drawings,votes,snapGrid}=s;
  const wRef=useRef(null);
  const drag=useRef({type:"none",sx:0,sy:0,px0:0,py0:0,nid:"",nx0:0,ny0:0,nw0:0,nh0:0,dir:""});
  const moved=useRef(false);
  const dPath=useRef([]);
  const dColor=useRef(T.y);
  const[livePath,setLivePath]=useState([]);
  const[lasso,setLasso]=useState(null);
  const[ctxMenu,setCtxMenu]=useState(null);
  const[commentInput,setCommentInput]=useState(null);
  const[selectedArrow,setSelectedArrow]=useState(null);
  const cmtRef=useRef(null);

  const toW=(cx,cy)=>{const r=wRef.current.getBoundingClientRect();return{x:(cx-r.left-px)/zoom,y:(cy-r.top-py)/zoom};};

  // IMAGE DROP
  useEffect(()=>{
    const el=wRef.current;
    const drop=e=>{
      e.preventDefault();
      const f=[...e.dataTransfer.files].find(f=>f.type.startsWith("image/"));
      if(!f)return;
      const r2=new FileReader();
      r2.onload=ev=>{const{x,y}=toW(e.clientX,e.clientY);d({type:"ADD",node:{id:uid(),type:"image",src:ev.target.result,x:x-150,y:y-100,w:300,h:200}});};
      r2.readAsDataURL(f);
    };
    el.addEventListener("dragover",e=>e.preventDefault());
    el.addEventListener("drop",drop);
    return()=>{el.removeEventListener("dragover",e=>e.preventDefault());el.removeEventListener("drop",drop);};
  },[px,py,zoom]);

  function onDown(e){
    if(e.button===2)return;
    if(e.target.closest("[data-node]")||e.target.closest("[data-arr-label]"))return;
    setCtxMenu(null);setSelectedArrow(null);
    if(tool==="comment"){const{x,y}=toW(e.clientX,e.clientY);setCommentInput({x,y,sx:e.clientX,sy:e.clientY});return;}
    if(tool==="draw"){dPath.current=[toW(e.clientX,e.clientY)];drag.current={type:"draw",sx:0,sy:0,px0:0,py0:0,nid:"",nx0:0,ny0:0,nw0:0,nh0:0,dir:""};return;}
    if(tool==="select"){const{x,y}=toW(e.clientX,e.clientY);setLasso({x1:x,y1:y,x2:x,y2:y});drag.current={type:"lasso",sx:0,sy:0,px0:0,py0:0,nid:"",nx0:0,ny0:0,nw0:0,nh0:0,dir:""};d({type:"SEL",v:[]});return;}
    if(tool==="pan"){drag.current={type:"pan",sx:e.clientX,sy:e.clientY,px0:px,py0:py,nid:"",nx0:0,ny0:0,nw0:0,nh0:0,dir:""};return;}
    const{x,y}=toW(e.clientX,e.clientY);
    const sx=snap(x,snapGrid),sy=snap(y,snapGrid);
    const sc=SC[_si++%8];
    if(tool==="sticky")d({type:"ADD",node:{id:uid(),type:"sticky",x:sx,y:sy,w:170,h:130,text:"",color:sc.bg,textColor:sc.t}});
    else if(tool==="text")d({type:"ADD",node:{id:uid(),type:"text",x:sx,y:sy,w:180,h:44,text:"Heading",color:T.t0,textColor:T.t0,fontSize:24,fontWeight:"700"}});
    else if(tool==="rect")d({type:"ADD",node:{id:uid(),type:"shape",x:sx,y:sy,w:150,h:76,text:"",color:T.bg3,textColor:T.t0,shapeType:"rect",borderColor:T.b1}});
    else if(tool==="circle")d({type:"ADD",node:{id:uid(),type:"shape",x:sx,y:sy,w:100,h:100,text:"",color:T.bg3,textColor:T.t0,shapeType:"circle",borderColor:T.b1}});
    else if(tool==="diamond")d({type:"ADD",node:{id:uid(),type:"shape",x:sx,y:sy,w:130,h:86,text:"",color:T.bg3,textColor:T.t0,shapeType:"diamond",borderColor:T.b1}});
    else if(tool==="frame")d({type:"ADD",node:{id:uid(),type:"frame",x:sx,y:sy,w:400,h:300,text:"Frame",color:"transparent",borderColor:T.b1}});
  }

  function onNodeSel(id,multi){
    if(tool==="arrow"){
      if(!arrowFrom){d({type:"ARR_FROM",id});d({type:"SEL",v:[id]});}
      else if(arrowFrom!==id){d({type:"ADD_ARR",arr:{id:uid(),fromId:arrowFrom,toId:id,label:""}});d({type:"TOOL",v:"select"});}
      return;
    }
    if(multi)d({type:"SEL",v:sel.includes(id)?sel.filter(x=>x!==id):[...sel,id]});
    else{
      d({type:"SEL",v:[id]});
      const n=nodes.find(n=>n.id===id);
      if(n){moved.current=false;drag.current={type:"node",sx:0,sy:0,px0:0,py0:0,nid:id,nx0:n.x,ny0:n.y,nw0:n.w,nh0:n.h,dir:""};}
    }
  }

  function onRSt(e,nodeId,dir){
    e.stopPropagation();d({type:"SNAP"});
    const n=nodes.find(n=>n.id===nodeId);
    drag.current={type:"resize",sx:e.clientX,sy:e.clientY,px0:0,py0:0,nid:nodeId,nx0:n.x,ny0:n.y,nw0:n.w,nh0:n.h,dir};
  }

  function onMove(e){
    const dr=drag.current;
    if(dr.type==="pan")d({type:"PAN",x:dr.px0+e.clientX-dr.sx,y:dr.py0+e.clientY-dr.sy});
    else if(dr.type==="node"){
      if(!dr.sx){drag.current.sx=e.clientX;drag.current.sy=e.clientY;return;}
      const dx=(e.clientX-dr.sx)/zoom,dy=(e.clientY-dr.sy)/zoom;
      if(Math.abs(dx)>2||Math.abs(dy)>2)moved.current=true;
      if(moved.current){const nx=snap(dr.nx0+dx,snapGrid),ny=snap(dr.ny0+dy,snapGrid);d({type:"UPD",id:dr.nid,p:{x:nx,y:ny}});}
    }
    else if(dr.type==="resize"){
      const dx=(e.clientX-dr.sx)/zoom,dy=(e.clientY-dr.sy)/zoom;
      let nx=dr.nx0,ny=dr.ny0,nw=dr.nw0,nh=dr.nh0;
      if(dr.dir.includes("e"))nw=Math.max(60,snap(dr.nw0+dx,snapGrid));
      if(dr.dir.includes("s"))nh=Math.max(40,snap(dr.nh0+dy,snapGrid));
      if(dr.dir.includes("w")){nw=Math.max(60,snap(dr.nw0-dx,snapGrid));nx=dr.nx0+dr.nw0-nw;}
      if(dr.dir.includes("n")){nh=Math.max(40,snap(dr.nh0-dy,snapGrid));ny=dr.ny0+dr.nh0-nh;}
      d({type:"UPD",id:dr.nid,p:{x:nx,y:ny,w:nw,h:nh}});
    }
    else if(dr.type==="draw"){const pt=toW(e.clientX,e.clientY);dPath.current=[...dPath.current,pt];setLivePath([...dPath.current]);}
    else if(dr.type==="lasso"){const{x,y}=toW(e.clientX,e.clientY);setLasso(l=>({...l,x2:x,y2:y}));}
  }

  function onUp(){
    if(drag.current.type==="draw"&&dPath.current.length>2){d({type:"ADD_DRAW",d:{id:uid(),pts:dPath.current,color:dColor.current}});dPath.current=[];setLivePath([]);}
    else if(drag.current.type==="lasso"&&lasso){
      const mx=Math.min(lasso.x1,lasso.x2),my=Math.min(lasso.y1,lasso.y2),mw=Math.abs(lasso.x2-lasso.x1),mh=Math.abs(lasso.y2-lasso.y1);
      if(mw>10&&mh>10){const ids=nodes.filter(n=>n.x<mx+mw&&n.x+(n.w||100)>mx&&n.y<my+mh&&n.y+(n.h||60)>my).map(n=>n.id);d({type:"SEL",v:ids});}
      setLasso(null);
    }
    drag.current.type="none";
  }

  function onWheel(e){
    e.preventDefault();
    if(e.ctrlKey||e.metaKey){
      const r=wRef.current.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
      const f=e.deltaY>0?.9:1.11,nz=Math.max(.08,Math.min(6,zoom*f));
      d({type:"PAN",x:mx-(mx-px)*(nz/zoom),y:my-(my-py)*(nz/zoom)});
      d({type:"ZOOM",v:nz});
    }else d({type:"PAN",x:px-e.deltaX,y:py-e.deltaY});
  }

  function onCtx(e){e.preventDefault();const{x,y}=toW(e.clientX,e.clientY);setCtxMenu({wx:x,wy:y,sx:Math.min(e.clientX,window.innerWidth-200),sy:Math.min(e.clientY,window.innerHeight-280)});}

  const pts2d=pts=>pts.length<2?"":pts.reduce((a,p,i)=>i===0?`M${p.x},${p.y}`:`${a}L${p.x},${p.y}`,"");
  const gs=GRID*zoom,gox=((px%gs)+gs)%gs,goy=((py%gs)+gs)%gs;
  const cursors={select:"default",pan:"grab",sticky:"cell",text:"text",rect:"crosshair",circle:"crosshair",diamond:"crosshair",arrow:"crosshair",draw:"crosshair",comment:"copy",frame:"crosshair"};
  const sortedNodes=[...nodes.filter(n=>n.type==="frame"),...nodes.filter(n=>n.type!=="frame")];

  // Present mode: clip to frame
  const pFrameNode=presentFrame?nodes.find(n=>n.id===presentFrame):null;

  return<div ref={wRef} style={{flex:1,position:"relative",overflow:"hidden",background:T.bg0,cursor:cursors[tool]||"default"}}
    onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onWheel={onWheel} onContextMenu={onCtx}>

    {/* GRID */}
    {!presentMode&&<svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
      <defs><pattern id="g" width={gs} height={gs} patternUnits="userSpaceOnUse" x={gox} y={goy}><circle cx={1} cy={1} r={snapGrid?.9:.65} fill={snapGrid?"#2a3d54":"#1a2a3c"} opacity={snapGrid?1:.85}/></pattern></defs>
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
      <svg style={{position:"absolute",inset:0,width:10000,height:10000,overflow:"visible",pointerEvents:"none",zIndex:6}}>
        <defs>
          <marker id="ah" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#475569"/></marker>
          <marker id="ahy" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill={T.y}/></marker>
        </defs>
        {arrows.map(a=>{
          const fn=nodes.find(n=>n.id===a.fromId),tn=nodes.find(n=>n.id===a.toId);
          if(!fn||!tn)return null;
          const fx=fn.x+fn.w/2,fy=fn.y+fn.h/2,tx=tn.x+tn.w/2,ty=tn.y+tn.h/2;
          const mx=(fx+tx)/2,my=(fy+ty)/2,cp1x=fx+(mx-fx)*.8,cp2x=tx-(tx-mx)*.8;
          const isSel=sel.includes(fn.id)||sel.includes(tn.id)||selectedArrow===a.id;
          return<g key={a.id} style={{pointerEvents:"auto"}} onClick={()=>setSelectedArrow(a.id===selectedArrow?null:a.id)}>
            <path d={`M${fx},${fy} C${cp1x},${fy} ${cp2x},${ty} ${tx},${ty}`} fill="none" stroke="transparent" strokeWidth={12} style={{cursor:"pointer"}}/>
            <path d={`M${fx},${fy} C${cp1x},${fy} ${cp2x},${ty} ${tx},${ty}`} fill="none" stroke={isSel?T.y:"#334155"} strokeWidth={isSel?2:1.5} strokeDasharray="6 4" style={{animation:"dash 1.5s linear infinite"}} markerEnd={isSel?"url(#ahy)":"url(#ah)"}/>
          </g>;
        })}
      </svg>

      {/* ARROW LABELS */}
      {arrows.map(a=>{
        const fn=nodes.find(n=>n.id===a.fromId),tn=nodes.find(n=>n.id===a.toId);
        if(!fn||!tn)return null;
        const mx=(fn.x+fn.w/2+tn.x+tn.w/2)/2,my=(fn.y+fn.h/2+tn.y+tn.h/2)/2;
        return<div key={`lbl-${a.id}`} data-arr-label style={{position:"absolute",left:0,top:0,zIndex:14,pointerEvents:"none"}}>
          <ArrowLabel label={a.label} mx={mx} my={my} onUpdate={v=>d({type:"UPD_ARR",id:a.id,p:{label:v}})} onDelete={()=>d({type:"DEL_ARR",id:a.id})}/>
        </div>;
      })}

      {/* NODES */}
      <div style={{position:"absolute",inset:0,zIndex:10}}>
        {sortedNodes.map(node=>{
          const isSel=sel.includes(node.id);
          const p={key:node.id,node,sel:isSel,onSel:onNodeSel,onUpd:(id,patch)=>d({type:"UPD",id,p:patch}),onRSt,votes:votes[node.id]||0,onVote:id=>d({type:"ADD_VOTE",nodeId:id}),voteMode:tool==="vote"};
          if(node.type==="sticky")return<Sticky {...p}/>;
          if(node.type==="shape")return<Shape {...p}/>;
          if(node.type==="text")return<TxtNode {...p}/>;
          if(node.type==="image")return<ImgNode {...p}/>;
          if(node.type==="frame")return<FrameNode {...p}/>;
          return null;
        })}
      </div>

      {/* LASSO */}
      <div style={{position:"absolute",inset:0,zIndex:99,pointerEvents:"none"}}><Lasso l={lasso}/></div>

      {/* COMMENTS */}
      {comments.map(c=><CommentDot key={c.id} c={c} onDel={id=>d({type:"DEL_COMMENT",id})}/>)}
    </div>

    {/* CONTEXT MENU */}
    {ctxMenu&&<div className="pop" onClick={()=>setCtxMenu(null)} style={{position:"absolute",left:ctxMenu.sx,top:ctxMenu.sy,background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:10,padding:6,zIndex:999,minWidth:190,boxShadow:"0 8px 32px rgba(0,0,0,.6)"}}>
      {[[`📝 Sticky`,()=>{const sc=SC[_si++%8];d({type:"ADD",node:{id:uid(),type:"sticky",x:ctxMenu.wx,y:ctxMenu.wy,w:170,h:130,text:"",color:sc.bg,textColor:sc.t}});}],[`T Text`,()=>d({type:"ADD",node:{id:uid(),type:"text",x:ctxMenu.wx,y:ctxMenu.wy,w:180,h:44,text:"Text",color:T.t0,textColor:T.t0,fontSize:22,fontWeight:"700"}})],[`▭ Rect`,()=>d({type:"ADD",node:{id:uid(),type:"shape",x:ctxMenu.wx,y:ctxMenu.wy,w:150,h:76,text:"",color:T.bg3,textColor:T.t0,shapeType:"rect",borderColor:T.b1}})],["divider"],[`💬 Comentariu`,()=>setCommentInput({x:ctxMenu.wx,y:ctxMenu.wy,sx:ctxMenu.sx,sy:ctxMenu.sy})],sel.length>0&&[`⧉ Duplică (${sel.length})`,()=>d({type:"DUP"})],sel.length>0&&[`🗑 Șterge (${sel.length})`,()=>d({type:"DEL",ids:sel})],["divider"],[`⬇ Export SVG`,null]].filter(Boolean).map((it,i)=>it[0]==="divider"?<div key={i} style={{height:1,background:T.b0,margin:"4px 0"}}/> :<button key={i} onClick={it[1]||(()=>{})} style={{display:"block",width:"100%",background:"transparent",border:"none",color:T.t0,padding:"7px 12px",borderRadius:7,fontSize:12,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}} onMouseEnter={e=>{e.currentTarget.style.background=T.bg3;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>{it[0]}</button>)}
    </div>}

    {/* COMMENT INPUT */}
    {commentInput&&<div className="pop" style={{position:"absolute",left:commentInput.sx,top:commentInput.sy+14,background:T.bg2,border:`1px solid ${T.yDim}`,borderRadius:10,padding:12,zIndex:999,width:220,boxShadow:"0 8px 32px rgba(0,0,0,.6)"}}>
      <textarea ref={cmtRef} autoFocus placeholder="Scrie comentariul…" rows={3} style={{width:"100%",background:T.bg3,border:`1px solid ${T.b1}`,borderRadius:7,padding:"7px 9px",fontSize:12,fontFamily:"inherit",resize:"none",outline:"none",color:T.t0,marginBottom:8}}/>
      <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
        <button onClick={()=>setCommentInput(null)} style={{background:"transparent",border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Anulează</button>
        <button onClick={()=>{if(cmtRef.current?.value){d({type:"ADD_COMMENT",c:{id:uid(),x:commentInput.x,y:commentInput.y,text:cmtRef.current.value,author:"Tu"}});setCommentInput(null);}}} style={{background:T.yBg,border:`1px solid ${T.yDim}`,color:T.y,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Adaugă</button>
      </div>
    </div>}

    {/* ZOOM */}
    <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"center",background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:10,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,.5)",zIndex:50}}>
      {[["−",()=>d({type:"ZOOM",v:zoom*.8})],null,["+",()=>d({type:"ZOOM",v:zoom*1.25})],["⟳",()=>{d({type:"ZOOM",v:1});d({type:"PAN",x:0,y:0});}]].map((it,i)=>it===null?<span key="p" style={{padding:"0 12px",fontSize:11,color:T.t1,fontFamily:"'JetBrains Mono',monospace",minWidth:52,textAlign:"center"}}>{Math.round(zoom*100)}%</span>:<button key={i} onClick={it[1]} style={{background:"transparent",border:"none",width:34,height:32,cursor:"pointer",fontSize:14,color:T.t1,fontFamily:"inherit"}} onMouseEnter={e=>e.target.style.color=T.y} onMouseLeave={e=>e.target.style.color=T.t1}>{it[0]}</button>)}
    </div>

    {/* SNAP INDICATOR */}
    {snapGrid&&<div style={{position:"absolute",bottom:20,right:84,background:T.yBg,border:`1px solid ${T.yDim}`,color:T.y,padding:"4px 10px",borderRadius:99,fontSize:10,fontFamily:"'JetBrains Mono',monospace",zIndex:50}}>SNAP {GRID}px</div>}

    {/* STATS */}
    {nodes.length>0&&<div style={{position:"absolute",bottom:20,right:20,background:T.bg2,border:`1px solid ${T.b0}`,color:T.t2,padding:"4px 10px",borderRadius:20,fontSize:10,fontFamily:"'JetBrains Mono',monospace",zIndex:50}}>{nodes.length}n · {arrows.length}c</div>}

    {tool==="arrow"&&<div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:T.bg2,border:`1px solid ${T.yDim}`,color:T.y,padding:"7px 16px",borderRadius:20,fontSize:12,pointerEvents:"none",fontFamily:"'JetBrains Mono',monospace"}}>{arrowFrom?"→ Click pe destinație":"→ Click pe sursă"}</div>}
    {tool==="vote"&&<div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:T.yBg,border:`1px solid ${T.yDim}`,color:T.y,padding:"7px 16px",borderRadius:20,fontSize:12,pointerEvents:"none",fontFamily:"'JetBrains Mono',monospace"}}>✦ Mod vot — click pe orice element</div>}
    {tool==="draw"&&<div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:T.bg2,border:`1px solid ${T.b2}`,color:T.t1,padding:"7px 16px",borderRadius:20,fontSize:12,pointerEvents:"none",fontFamily:"'JetBrains Mono',monospace"}}>✏ Desenează liber</div>}
  </div>;
}

/* ════════════════════════════════════════════════════════════
   MINIMAP
════════════════════════════════════════════════════════════ */
function Minimap(){
  const{s,d}=useWB();
  const{nodes,zoom,px,py}=s;
  if(nodes.length===0)return null;
  const W=160,H=96;
  const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),x2s=nodes.map(n=>n.x+(n.w||100)),y2s=nodes.map(n=>n.y+(n.h||60));
  const bx=Math.min(...xs)-30,by=Math.min(...ys)-30,bw=Math.max(...x2s)-bx+30,bh=Math.max(...y2s)-by+30;
  const sc=Math.min(W/bw,H/bh,.8);
  const vpW=window.innerWidth/zoom,vpH=window.innerHeight/zoom,vpX=-px/zoom,vpY=-py/zoom;
  return<div style={{position:"absolute",bottom:60,right:20,width:W,height:H,background:T.bg2,border:`1px solid ${T.b1}`,borderRadius:8,overflow:"hidden",zIndex:60,boxShadow:"0 4px 20px rgba(0,0,0,.5)",cursor:"crosshair"}}
    onClick={e=>{const r=e.currentTarget.getBoundingClientRect();const mx=(e.clientX-r.left)/sc+bx,my=(e.clientY-r.top)/sc+by;d({type:"PAN",x:-mx*zoom+window.innerWidth/2,y:-my*zoom+window.innerHeight/2});}}>
    <svg width={W} height={H}>
      {nodes.map(n=><rect key={n.id} x={(n.x-bx)*sc} y={(n.y-by)*sc} width={Math.max(2,(n.w||100)*sc)} height={Math.max(2,(n.h||60)*sc)} fill={n.type==="sticky"?n.color:n.color||T.bg3} opacity={.8} rx={1}/>)}
      <rect x={Math.max(0,(vpX-bx)*sc)} y={Math.max(0,(vpY-by)*sc)} width={Math.min(W,vpW*sc)} height={Math.min(H,vpH*sc)} fill="none" stroke={T.y} strokeWidth={1} opacity={.6}/>
    </svg>
    <div style={{position:"absolute",top:3,left:5,fontSize:9,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>minimap</div>
  </div>;
}

/* ════════════════════════════════════════════════════════════
   TIMER
════════════════════════════════════════════════════════════ */
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

  if(!visible)return<button onClick={()=>setVisible(true)} style={{position:"absolute",top:14,right:20,background:T.bg2,border:`1px solid ${T.b1}`,color:T.t1,width:36,height:36,borderRadius:8,cursor:"pointer",fontSize:16,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}>⏱</button>;

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
        <button onClick={()=>setRunning(r=>!r)} style={{background:running?T.yBg:T.bg3,border:`1px solid ${running?T.yDim:T.b1}`,color:running?T.y:T.t0,padding:"4px 14px",borderRadius:7,fontSize:12,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{running?"⏸ Pauză":"▶ Start"}</button>
        <button onClick={()=>{setRunning(false);setRemaining(preset);}} style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 10px",borderRadius:7,fontSize:12,cursor:"pointer"}}>↺</button>
        <button onClick={()=>{setRunning(false);setVisible(false);}} style={{background:"transparent",border:"none",color:T.t2,fontSize:14,cursor:"pointer"}}>✕</button>
      </div>
    </div>
  </div>;
}

/* ════════════════════════════════════════════════════════════
   FLOATING TOOLBAR
════════════════════════════════════════════════════════════ */
const TOOLS=[
  {id:"select",icon:"◈",k:"V"},{id:"pan",icon:"⊹",k:"H"},null,
  {id:"sticky",icon:"▦",k:"S"},{id:"text",icon:"Aa",k:"T"},null,
  {id:"rect",icon:"▬",k:"R"},{id:"circle",icon:"◯",k:"C"},{id:"diamond",icon:"◇",k:"D"},null,
  {id:"arrow",icon:"⟶",k:"A"},{id:"draw",icon:"✏",k:"P"},{id:"comment",icon:"💬",k:"M"},{id:"frame",icon:"⬚",k:"F"},{id:"vote",icon:"✦",k:"G"},
];

function Toolbar(){
  const{s,d}=useWB();
  const{tool,sel,hist,fut,snapGrid}=s;
  const[drawCol,setDrawCol]=useState(T.y);

  useEffect(()=>{
    const h=e=>{
      if(e.target.tagName==="TEXTAREA"||e.target.tagName==="INPUT")return;
      const km={v:"select",h:"pan",s:"sticky",t:"text",r:"rect",c:"circle",d:"diamond",a:"arrow",p:"draw",m:"comment",f:"frame",g:"vote"};
      if(km[e.key?.toLowerCase()])d({type:"TOOL",v:km[e.key.toLowerCase()]});
      if((e.ctrlKey||e.metaKey)&&e.key==="z"){e.preventDefault();d({type:"UNDO"});}
      if((e.ctrlKey||e.metaKey)&&e.key==="y"){e.preventDefault();d({type:"REDO"});}
      if((e.ctrlKey||e.metaKey)&&e.key==="d"){e.preventDefault();d({type:"DUP"});}
      if((e.key==="Delete"||e.key==="Backspace")&&sel.length&&e.target===document.body)d({type:"DEL",ids:sel});
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[sel,d]);

  return<div style={{position:"absolute",left:"50%",top:14,transform:"translateX(-50%)",zIndex:200,display:"flex",alignItems:"center",gap:1,background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:14,padding:"5px 8px",boxShadow:"0 8px 32px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.03)"}}>
    {TOOLS.map((t2,i)=>t2===null?<div key={`d${i}`} style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
      :<button key={t2.id} onClick={()=>d({type:"TOOL",v:t2.id})} title={`${t2.id} (${t2.k})`}
        style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",width:36,height:34,border:tool===t2.id?`1px solid ${T.yDim}`:"1px solid transparent",borderRadius:7,background:tool===t2.id?T.yBg:"transparent",cursor:"pointer",color:tool===t2.id?T.y:T.t1,transition:"all .1s",gap:.5}}
        onMouseEnter={e=>{if(tool!==t2.id){e.currentTarget.style.background=T.bg3;e.currentTarget.style.color=T.t0;}}}
        onMouseLeave={e=>{if(tool!==t2.id){e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.t1;}}}>
        <span style={{fontSize:t2.id==="text"?10:13,fontWeight:t2.id==="text"?600:undefined,lineHeight:1}}>{t2.icon}</span>
        <span style={{fontSize:7.5,fontFamily:"'JetBrains Mono',monospace",opacity:.55}}>{t2.k}</span>
      </button>
    )}
    <div style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
    <button onClick={()=>d({type:"UNDO"})} disabled={!hist.length} title="Ctrl+Z" style={{width:30,height:34,border:"1px solid transparent",borderRadius:7,background:"transparent",cursor:hist.length?"pointer":"not-allowed",color:hist.length?T.t1:T.t3,fontSize:14}}>↩</button>
    <button onClick={()=>d({type:"REDO"})} disabled={!fut.length} title="Ctrl+Y" style={{width:30,height:34,border:"1px solid transparent",borderRadius:7,background:"transparent",cursor:fut.length?"pointer":"not-allowed",color:fut.length?T.t1:T.t3,fontSize:14}}>↪</button>
    <div style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
    <button onClick={()=>d({type:"SNAP_TOGGLE"})} title="Snap to grid" style={{width:30,height:34,border:snapGrid?`1px solid ${T.yDim}`:"1px solid transparent",borderRadius:7,background:snapGrid?T.yBg:"transparent",cursor:"pointer",color:snapGrid?T.y:T.t1,fontSize:12,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>⊞</button>
    {sel.length>0&&<>
      <div style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
      <button onClick={()=>d({type:"DUP"})} title="Ctrl+D" style={{width:30,height:34,border:"1px solid transparent",borderRadius:7,background:"transparent",cursor:"pointer",color:T.t1,fontSize:12}}>⧉</button>
      <button onClick={()=>d({type:"DEL",ids:sel})} title="Delete" style={{width:30,height:34,border:"1px solid transparent",borderRadius:7,background:"transparent",cursor:"pointer",color:T.red,fontSize:12}}>🗑</button>
    </>}
    {tool==="draw"&&<>
      <div style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
      {[T.y,T.red,T.blue,T.green,"#ffffff",T.purple,T.teal].map(c=><div key={c} onClick={()=>setDrawCol(c)} style={{width:16,height:16,borderRadius:"50%",background:c,border:`2px solid ${drawCol===c?"#fff":"transparent"}`,cursor:"pointer",flexShrink:0,transition:"border .1s"}}/>)}
      <input type="color" value={drawCol} onChange={e=>setDrawCol(e.target.value)} title="Culoare custom" style={{width:20,height:20,borderRadius:"50%",cursor:"pointer",border:"none",background:"none"}}/>
      <button onClick={()=>d({type:"CLEAR_DRAWS"})} style={{background:"transparent",border:`1px solid ${T.b1}`,color:T.t2,padding:"2px 7px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",marginLeft:2}}>✕ clear</button>
    </>}
    {tool==="vote"&&<>
      <div style={{width:1,height:22,background:T.b0,margin:"0 2px"}}/>
      <button onClick={()=>d({type:"CLEAR_VOTES"})} style={{background:"transparent",border:`1px solid ${T.yDim}`,color:T.y,padding:"2px 8px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>reset votes</button>
    </>}
  </div>;
}

/* ════════════════════════════════════════════════════════════
   SEARCH PANEL
════════════════════════════════════════════════════════════ */
function SearchPanel({onClose}){
  const{s,d}=useWB();
  const[q,setQ]=useState("");
  const r=useRef(null);
  useEffect(()=>r.current?.focus(),[]);
  const results=q.trim().length>1?s.nodes.filter(n=>n.text?.toLowerCase().includes(q.toLowerCase())).slice(0,8):[];
  function goTo(node){
    d({type:"SEL",v:[node.id]});
    d({type:"PAN",x:-node.x*s.zoom+window.innerWidth/2-node.w/2*s.zoom,y:-node.y*s.zoom+window.innerHeight/2-node.h/2*s.zoom});
    onClose();
  }
  return<div className="pop" style={{position:"absolute",top:64,left:"50%",transform:"translateX(-50%)",background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:14,padding:14,zIndex:600,width:400,boxShadow:"0 16px 48px rgba(0,0,0,.7)"}}>
    <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
      <span style={{fontSize:14,color:T.t2}}>🔍</span>
      <input ref={r} value={q} onChange={e=>setQ(e.target.value)} placeholder="Caută în noduri…" style={{flex:1,background:"transparent",border:"none",outline:"none",color:T.t0,fontSize:14,fontFamily:"'DM Sans',sans-serif"}}/>
      <button onClick={onClose} style={{background:"none",border:"none",color:T.t2,fontSize:16,cursor:"pointer"}}>✕</button>
    </div>
    {results.length>0&&<div style={{borderTop:`1px solid ${T.b0}`,paddingTop:8,display:"flex",flexDirection:"column",gap:4}}>
      {results.map(n=><button key={n.id} onClick={()=>goTo(n)} style={{background:T.bg3,border:`1px solid ${T.b1}`,borderRadius:8,padding:"8px 12px",cursor:"pointer",textAlign:"left",color:T.t0,fontSize:12,fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:10,transition:"all .1s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.color=T.y;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t0;}}>
        <span style={{fontSize:16}}>{n.type==="sticky"?"▦":n.type==="text"?"T":"◯"}</span>
        <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.text?.slice(0,60)||"(gol)"}</span>
        <span style={{fontSize:10,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{n.type}</span>
      </button>)}
    </div>}
    {q.length>1&&results.length===0&&<p style={{color:T.t2,fontSize:12,textAlign:"center",padding:"8px 0"}}>Nimic găsit pentru "{q}"</p>}
    <div style={{marginTop:10,fontSize:10,color:T.t2,textAlign:"center",fontFamily:"'JetBrains Mono',monospace"}}>Ctrl+K pentru a deschide · Esc pentru a închide</div>
  </div>;
}

/* ════════════════════════════════════════════════════════════
   TEMPLATES PANEL
════════════════════════════════════════════════════════════ */
function TplPanel({onClose}){
  const{d}=useWB();
  const apply=key=>{const{nodes,arrows}=TPLS[key].build();d({type:"APPLY",nodes,arrows,replace:false});onClose();};
  return<div className="pop" style={{position:"absolute",top:56,left:"50%",transform:"translateX(-50%)",background:T.bg2,border:`1px solid ${T.b2}`,borderRadius:14,padding:16,zIndex:500,width:580,boxShadow:"0 16px 48px rgba(0,0,0,.7)"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
      <span style={{fontSize:13,fontWeight:700,color:T.t0,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".05em"}}>📋 TEMPLATES</span>
      <button onClick={onClose} style={{background:"none",border:"none",color:T.t1,fontSize:18,cursor:"pointer",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:6}}>✕</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
      {Object.entries(TPLS).map(([key,t])=><button key={key} onClick={()=>apply(key)}
        style={{background:T.bg3,border:`1px solid ${T.b1}`,borderRadius:10,padding:"12px 8px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:7,transition:"all .15s",fontFamily:"inherit"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.background=T.yBg;}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.background=T.bg3;}}>
        <span style={{fontSize:20}}>{t.icon}</span>
        <span style={{fontSize:10.5,color:T.t0,fontWeight:600,textAlign:"center",lineHeight:1.3}}>{t.name}</span>
      </button>)}
    </div>
  </div>;
}

/* ════════════════════════════════════════════════════════════
   PRESENTATION MODE
════════════════════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════════════════════
   PROPS PANEL
════════════════════════════════════════════════════════════ */
const PBG=["#fef9c3","#dcfce7","#dbeafe","#fce7f3","#ede9fe","#ccfbf1","#ffedd5","#fef2f2","#1c2a3e","#0c1829","#162032","#ffffff"];
const PTXT=["#1e293b","#0c1829","#ffffff",T.y,"#3b82f6","#22c55e","#ef4444","#a78bfa","#94a3b8"];
const PBRD=["rgba(255,255,255,.08)",T.y,"#3b82f6","#22c55e","#ef4444","#a78bfa","rgba(0,0,0,.15)","#fff","#f97316"];
const PSZ=[10,11,12,13,14,16,18,20,24,28,32,40,48];

function PropsPanel(){
  const{s,d}=useWB();
  const{sel,nodes}=s;
  if(!sel.length)return null;
  const f=nodes.find(n=>n.id===sel[0]);
  if(!f)return null;
  const u=p=>d({type:"UPD_SEL",p});
  function Sec({label,children}){return<div style={{marginBottom:11}}><div style={{fontSize:9,fontWeight:600,color:T.t2,textTransform:"uppercase",letterSpacing:".1em",fontFamily:"'JetBrains Mono',monospace",marginBottom:7}}>{label}</div>{children}</div>;}
  function CGrid({colors,cur,onChange}){return<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{colors.map(c=><button key={c} onClick={()=>onChange(c)} style={{width:19,height:19,borderRadius:"50%",background:c,border:`2px solid ${cur===c?T.y:"rgba(255,255,255,.08)"}`,cursor:"pointer",flexShrink:0,transition:"transform .1s",boxShadow:cur===c?`0 0 8px ${T.y}50`:"none"}} onMouseEnter={e=>e.target.style.transform="scale(1.3)"} onMouseLeave={e=>e.target.style.transform="scale(1)"}/>)}</div>;}
  return<div className="pop" style={{borderBottom:`1px solid ${T.b0}`,padding:"12px 12px 4px",background:T.bg1,flexShrink:0}}>
    <div style={{fontSize:9.5,fontWeight:600,color:T.y,marginBottom:12,fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:5}}>◈ PROPS {sel.length>1?`(${sel.length})`:""}</div>
    <Sec label="Fundal"><div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}><CGrid colors={PBG} cur={f.color} onChange={c=>u({color:c})}/><input type="color" value={f.color||"#000000"} onChange={e=>u({color:e.target.value})} title="Custom color"/></div></Sec>
    <Sec label="Text"><div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}><CGrid colors={PTXT} cur={f.textColor} onChange={c=>u({textColor:c})}/><input type="color" value={f.textColor||"#ffffff"} onChange={e=>u({textColor:e.target.value})} title="Custom color"/></div></Sec>
    {f.type==="shape"&&<Sec label="Bordură"><CGrid colors={PBRD} cur={f.borderColor} onChange={c=>u({borderColor:c})}/></Sec>}
    <Sec label="Font"><div style={{display:"flex",flexWrap:"wrap",gap:3}}>{PSZ.map(sz=><button key={sz} onClick={()=>u({fontSize:sz})} style={{background:f.fontSize===sz?T.yBg:T.bg3,border:`1px solid ${f.fontSize===sz?T.yDim:T.b0}`,color:f.fontSize===sz?T.y:T.t1,borderRadius:4,padding:"2px 6px",fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>{sz}</button>)}</div></Sec>
    <Sec label="Style"><div style={{display:"flex",gap:5,marginBottom:8}}>
      <button onClick={()=>u({fontWeight:f.fontWeight==="bold"?"normal":"bold"})} style={{width:28,height:24,border:`1px solid ${f.fontWeight==="bold"?T.yDim:T.b0}`,background:f.fontWeight==="bold"?T.yBg:T.bg3,color:f.fontWeight==="bold"?T.y:T.t1,borderRadius:4,cursor:"pointer",fontSize:12,fontWeight:700}}>B</button>
      <button onClick={()=>u({fontStyle:f.fontStyle==="italic"?"normal":"italic"})} style={{width:28,height:24,border:`1px solid ${f.fontStyle==="italic"?T.yDim:T.b0}`,background:f.fontStyle==="italic"?T.yBg:T.bg3,color:f.fontStyle==="italic"?T.y:T.t1,borderRadius:4,cursor:"pointer",fontSize:12,fontStyle:"italic"}}>I</button>
    </div></Sec>
    <Sec label={`Opacitate ${Math.round((f.opacity??1)*100)}%`}><input type="range" min={.1} max={1} step={.05} value={f.opacity??1} onChange={e=>u({opacity:parseFloat(e.target.value)})} style={{width:"100%",marginBottom:6}}/></Sec>
    <Sec label="W × H"><div style={{display:"flex",gap:6,marginBottom:6}}>
      {[["W","w"],["H","h"]].map(([l,k])=><div key={k} style={{display:"flex",alignItems:"center",gap:4,background:T.bg3,border:`1px solid ${T.b0}`,borderRadius:5,padding:"3px 7px",flex:1}}>
        <span style={{fontSize:9.5,color:T.t2,fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{l}</span>
        <input type="number" value={Math.round(f[k]||0)} min={40} onChange={e=>u({[k]:parseInt(e.target.value)||40})} style={{background:"transparent",border:"none",outline:"none",color:T.t0,fontSize:10.5,fontFamily:"'JetBrains Mono',monospace",width:"100%",textAlign:"right"}}/>
      </div>)}
    </div></Sec>
  </div>;
}

/* ════════════════════════════════════════════════════════════
   FILE ZONE
════════════════════════════════════════════════════════════ */
function FileZone({onFile,loading,fn,summary,error}){
  const ref=useRef(null);
  const[drag,setDrag]=useState(false);
  const[replace,setReplace]=useState(true);
  function read(file){const r=new FileReader();r.onload=ev=>onFile(ev.target.result,file.name,replace);r.readAsText(file,"UTF-8");}
  return<div style={{borderBottom:`1px solid ${T.b0}`,padding:10,background:T.bg1,flexShrink:0}}>
    <div style={{fontSize:9.5,fontWeight:600,color:T.y,marginBottom:8,fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:5}}>
      <span style={{animation:loading?"spin 1s linear infinite":"none",display:"inline-block"}}>✦</span> SPIDER WEB · FIȘIER
    </div>
    <div onClick={()=>!loading&&ref.current?.click()}
      onDrop={e=>{e.preventDefault();setDrag(false);if(!loading&&e.dataTransfer.files[0])read(e.dataTransfer.files[0]);}}
      onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
      style={{border:`1.5px dashed ${drag||loading?T.y:T.b1}`,borderRadius:9,padding:"11px 8px",cursor:loading?"default":"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:drag||loading?T.yBg:"transparent",transition:"all .2s",minHeight:70}}>
      <input ref={ref} type="file" accept=".md,.txt,.csv,.json,.ts,.tsx,.js,.jsx,.html,.py,.yaml,.yml" onChange={e=>{if(e.target.files?.[0])read(e.target.files[0]);e.target.value="";}} style={{display:"none"}}/>
      {loading?<><div style={{width:18,height:18,border:`2.5px solid ${T.yDim}`,borderTopColor:T.y,borderRadius:"50%",animation:"spin .7s linear infinite"}}/><span style={{fontSize:11,color:T.y,fontFamily:"'JetBrains Mono',monospace"}}>Analizez…</span></>
       :summary?<><span style={{color:T.green,fontSize:15}}>✓</span><span style={{fontSize:10.5,color:T.green,fontFamily:"'JetBrains Mono',monospace"}}>{fn?.slice(0,22)}</span></>
       :<><span style={{fontSize:18}}>📄</span><span style={{fontSize:11.5,color:T.t1,fontWeight:500}}>Trage fișier sau click</span><span style={{fontSize:10,color:T.t2}}>.md .txt .json .ts .py</span></>}
    </div>
    {error&&<div style={{marginTop:6,background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",color:"#fca5a5",fontSize:11,padding:"5px 8px",borderRadius:5,lineHeight:1.5}}>⚠ {error}</div>}
    {summary&&<div style={{marginTop:6,background:"rgba(34,197,94,.07)",border:"1px solid rgba(34,197,94,.2)",color:"#86efac",fontSize:11,padding:"5px 8px",borderRadius:5,lineHeight:1.5}}>✦ {summary}</div>}
    <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:10,color:T.t2,userSelect:"none",marginTop:6}}>
      <input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)}/><span>Înlocuiește canvas</span>
    </label>
  </div>;
}

/* ════════════════════════════════════════════════════════════
   RIGHT PANEL (AI + all panels)
════════════════════════════════════════════════════════════ */
const CHIPS=["Mind map marketing","Flowchart vânzări","SWOT analysis","Kanban board","Timeline produs","Org chart","User journey","Brainstorming startup","OKR board","Customer persona"];

function RightPanel(){
  const{s,d}=useWB();
  const[prompt,setPrompt]=useState("");
  const[loading,setLoading]=useState(false);
  const[fl,setFl]=useState(false);
  const[fn,setFn]=useState(null);
  const[fs,setFs]=useState(null);
  const[fe,setFe]=useState(null);
  const[msgs,setMsgs]=useState([]);
  const[open,setOpen]=useState(true);
  const endRef=useRef(null);
  useEffect(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),[msgs]);

  function applyParsed(raw,replace=false){
    const clean=raw.replace(/^```(?:json)?\s*/m,"").replace(/\s*```\s*$/m,"").trim();
    const p=JSON.parse(clean);
    if(!p.nodes?.length)throw new Error("Fără noduri");
    const im={};
    const nn=p.nodes.map(n=>{const id=uid();im[n.id]=id;return{...n,id};});
    const na=(p.arrows||[]).map(a=>({id:uid(),fromId:im[a.fromId]||a.fromId,toId:im[a.toId]||a.toId,label:a.label||""}));
    d({type:"APPLY",nodes:nn,arrows:na,replace});
    return{nodes:nn,message:p.message,summary:p.summary};
  }

  async function send(text=prompt){
    if(!text.trim()||loading)return;
    setLoading(true);setMsgs(p=>[...p,{role:"user",text}]);setPrompt("");
    try{const raw=await aiCall(text,WB_SYS);const r=applyParsed(raw);setMsgs(p=>[...p,{role:"ai",text:r.message||`${r.nodes.length} elemente ✓`}]);}
    catch(e){setMsgs(p=>[...p,{role:"ai",text:`⚠ ${e.message}`}]);}
    setLoading(false);
  }

  async function handleFile(content,name,replace){
    if(!content){setFe("Nu s-a putut citi.");return;}
    setFn(name);setFl(true);setFe(null);setFs(null);
    const tr=content.length>6000?content.slice(0,6000)+"\n[trunchiat]":content;
    try{const raw=await aiCall(`Fișier: "${name}"\n\n${tr}`,SW_SYS);const r=applyParsed(raw,replace);setFs(r.summary||`${r.nodes.length} noduri`);}
    catch(e){setFe(e.message);}
    setFl(false);
  }

  // VOTE RESULTS sorted
  const voteResults=Object.entries(s.votes).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([id,v])=>({node:s.nodes.find(n=>n.id===id),v})).filter(e=>e.node);

  return<div style={{width:268,background:T.bg1,borderLeft:`1px solid ${T.b0}`,display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
    <FileZone onFile={handleFile} loading={fl} fn={fn} summary={fs} error={fe}/>
    <PropsPanel/>

    {/* Vote results */}
    {voteResults.length>0&&<div style={{borderBottom:`1px solid ${T.b0}`,padding:"10px 12px",background:T.bg1,flexShrink:0}}>
      <div style={{fontSize:9.5,fontWeight:600,color:T.y,marginBottom:8,fontFamily:"'JetBrains Mono',monospace"}}>✦ REZULTATE VOT</div>
      {voteResults.slice(0,5).map(({node,v},i)=><div key={node.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,padding:"5px 8px",background:T.bg3,borderRadius:6,border:`1px solid ${T.b1}`}}>
        <span style={{fontSize:11,fontWeight:700,color:T.y,fontFamily:"'JetBrains Mono',monospace",minWidth:18}}>#{i+1}</span>
        <span style={{flex:1,fontSize:11,color:T.t0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{node.text?.slice(0,30)||"(gol)"}</span>
        <span style={{fontSize:11,fontWeight:700,color:T.y,fontFamily:"'JetBrains Mono',monospace"}}>{v}✦</span>
      </div>)}
    </div>}

    {/* AI Chat */}
    <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",cursor:"pointer",userSelect:"none",borderBottom:`1px solid ${T.b0}`,flexShrink:0}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:loading?T.y:T.green,animation:loading?"pulse 1s infinite":"none"}}/>
      <span style={{fontSize:10,fontWeight:600,color:T.t0,fontFamily:"'JetBrains Mono',monospace",flex:1,letterSpacing:".06em"}}>ASISTENT AI</span>
      <span style={{fontSize:9,color:T.t2}}>{open?"▲":"▼"}</span>
    </div>
    {open&&<div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden",padding:"9px 9px 7px",minHeight:0}}>
      {msgs.length===0&&<div style={{marginBottom:9}}>
        <p style={{fontSize:11,color:T.t2,marginBottom:7,lineHeight:1.5}}>Generez orice structură pe canvas:</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          {CHIPS.map(c=><button key={c} onClick={()=>send(c)} style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"3px 8px",borderRadius:5,fontSize:10.5,cursor:"pointer",fontFamily:"inherit",lineHeight:1.4,transition:"all .12s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.color=T.y;e.currentTarget.style.background=T.yBg;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t1;e.currentTarget.style.background=T.bg3;}}>{c}</button>)}
        </div>
      </div>}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:5,paddingRight:2}}>
        {msgs.map((m,i)=><div key={i} style={{display:"flex",gap:6,fontSize:11.5,lineHeight:1.5,padding:"6px 9px",borderRadius:7,background:m.role==="user"?T.bg3:"rgba(250,204,21,.05)",border:`1px solid ${m.role==="user"?T.b1:T.yDim}`,color:m.role==="user"?T.t0:T.y,animation:"fadeUp .18s ease"}}>
          <span style={{fontSize:9,opacity:.5,fontFamily:"'JetBrains Mono',monospace",flexShrink:0,marginTop:2}}>{m.role==="user"?"you":" ai"}</span>
          <span>{m.text}</span>
        </div>)}
        {loading&&<div style={{display:"flex",gap:6,padding:"6px 9px",borderRadius:7,background:"rgba(250,204,21,.05)",border:`1px solid ${T.yDim}`,color:T.y,fontSize:11.5,animation:"pulse 1s infinite"}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,opacity:.5}}> ai</span><span>Generez…</span></div>}
        <div ref={endRef}/>
      </div>
      <div style={{display:"flex",gap:5,alignItems:"flex-end",marginTop:7,flexShrink:0}}>
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
          placeholder="ce să creez…" rows={2}
          style={{flex:1,background:T.bg3,border:`1px solid ${T.b1}`,borderRadius:7,padding:"6px 8px",fontSize:11.5,fontFamily:"'DM Sans',sans-serif",resize:"none",outline:"none",color:T.t0,lineHeight:1.4}}
          onFocus={e=>e.target.style.borderColor=T.yDim} onBlur={e=>e.target.style.borderColor=T.b1}/>
        <button onClick={()=>send()} disabled={loading} style={{width:32,height:32,background:loading?T.bg3:T.yBg,border:`1px solid ${loading?T.b1:T.yDim}`,borderRadius:7,color:loading?T.t3:T.y,fontSize:15,cursor:loading?"not-allowed":"pointer",flexShrink:0}}>↑</button>
      </div>
      <button onClick={()=>{d({type:"CLEAR"});setMsgs([]);setFs(null);setFn(null);}} style={{marginTop:5,background:"transparent",border:`1px solid ${T.b0}`,color:T.t2,padding:"4px",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",letterSpacing:".04em"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.red;e.currentTarget.style.color="#fca5a5";}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b0;e.currentTarget.style.color=T.t2;}}>CLEAR ALL</button>
    </div>}
  </div>;
}

/* ════════════════════════════════════════════════════════════
   TOPBAR
════════════════════════════════════════════════════════════ */
function TopBar({onTpl,onSearch,onPresent,isSaved}){
  const{s,d}=useWB();
  const{nodes,arrows,sel}=s;
  const impRef=useRef(null);

  function exportSVG(){
    if(!nodes.length)return;
    const xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),x2=nodes.map(n=>n.x+(n.w||100)),y2=nodes.map(n=>n.y+(n.h||60));
    const bx=Math.min(...xs)-40,by=Math.min(...ys)-40,W=Math.max(...x2)-bx+40,H=Math.max(...y2)-by+40;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#050911"/>${nodes.map(n=>`<rect x="${n.x-bx}" y="${n.y-by}" width="${n.w}" height="${n.h}" rx="6" fill="${n.color||'#1c2a3e'}" stroke="${n.borderColor||'rgba(255,255,255,.08)'}" stroke-width="1.5"/><foreignObject x="${n.x-bx+8}" y="${n.y-by+8}" width="${n.w-16}" height="${n.h-16}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${n.fontSize||13}px;color:${n.textColor||'#fff'};font-family:sans-serif;word-break:break-word;font-weight:${n.fontWeight||'normal'}">${n.text||''}</div></foreignObject>`).join("")}</svg>`;
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));a.download="boardai.svg";a.click();
  }

  function exportJSON(){
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({nodes:s.nodes,arrows:s.arrows,comments:s.comments},null,2)],{type:"application/json"}));a.download="boardai.json";a.click();
  }

  function importJSON(e){
    const f=e.target.files?.[0];if(!f)return;
    const r=new FileReader();r.onload=ev=>{try{const p=JSON.parse(ev.target.result);if(p.nodes)d({type:"APPLY",nodes:p.nodes,arrows:p.arrows||[],replace:true});}catch{alert("Fișier invalid");}};r.readAsText(f);
    e.target.value="";
  }

  const frames=nodes.filter(n=>n.type==="frame");

  return<header style={{height:46,background:T.bg1,borderBottom:`1px solid ${T.b0}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",flexShrink:0,zIndex:100}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <span style={{fontSize:16,color:T.y,animation:"float 3s ease-in-out infinite",display:"inline-block"}}>◈</span>
      <span style={{fontWeight:800,fontSize:15,color:T.t0,letterSpacing:"-.04em",fontFamily:"'Instrument Serif',serif"}}>Board<span style={{color:T.y}}>AI</span></span>
      <span style={{width:1,height:16,background:T.b0,margin:"0 4px"}}/>
      <div style={{display:"flex",alignItems:"center",gap:5}}>
        <div style={{width:5,height:5,borderRadius:"50%",background:isSaved?T.green:T.y,animation:isSaved?"none":"pulse 1.5s infinite"}}/>
        <span style={{fontSize:9.5,color:T.t2,fontFamily:"'JetBrains Mono',monospace"}}>{isSaved?"saved":"saving…"}</span>
      </div>
      <span style={{fontSize:9.5,color:T.t3,fontFamily:"'JetBrains Mono',monospace"}}>{nodes.length}n·{arrows.length}c{sel.length?`·${sel.length}sel`:""}</span>
    </div>
    <div style={{display:"flex",gap:5,alignItems:"center"}}>
      <button onClick={onSearch} title="Ctrl+K" style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:5}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.color=T.y;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t1;}}>🔍 <span style={{fontSize:10,color:T.t2}}>Ctrl+K</span></button>
      <button onClick={onTpl} style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.color=T.y;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t1;}}>📋 Templates</button>
      {frames.length>0&&<button onClick={onPresent} style={{background:T.yBg,border:`1px solid ${T.yDim}`,color:T.y,padding:"4px 10px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>▶ Present</button>}
      <div style={{width:1,height:18,background:T.b0}}/>
      <button onClick={()=>impRef.current?.click()} style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 9px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.color=T.y;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t1;}}>⬆ Import</button>
      <button onClick={exportSVG} style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 9px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.color=T.y;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t1;}}>SVG</button>
      <button onClick={exportJSON} style={{background:T.bg3,border:`1px solid ${T.b1}`,color:T.t1,padding:"4px 9px",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.yDim;e.currentTarget.style.color=T.y;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.t1;}}>JSON</button>
      <input ref={impRef} type="file" accept=".json" onChange={importJSON} style={{display:"none"}}/>
    </div>
  </header>;
}

/* ════════════════════════════════════════════════════════════
   APP ROOT
════════════════════════════════════════════════════════════ */
export default function App(){
  const[showTpl,setShowTpl]=useState(false);
  const[showSearch,setShowSearch]=useState(false);
  const[presentMode,setPresentMode]=useState(false);
  const[presentIdx,setPresentIdx]=useState(0);
  const[isSaved,setIsSaved]=useState(true);

  // Ctrl+K
  useEffect(()=>{
    const h=e=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="k"){e.preventDefault();setShowSearch(s=>!s);}
      if(e.key==="Escape"){setShowSearch(false);setShowTpl(false);}
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[]);

  // Saved indicator
  useEffect(()=>{setIsSaved(false);const t=setTimeout(()=>setIsSaved(true),1500);return()=>clearTimeout(t);},[]);

  return<WBP>
    <InnerApp showTpl={showTpl} setShowTpl={setShowTpl} showSearch={showSearch} setShowSearch={setShowSearch} presentMode={presentMode} setPresentMode={setPresentMode} presentIdx={presentIdx} setPresentIdx={setPresentIdx} isSaved={isSaved} setIsSaved={setIsSaved}/>
  </WBP>;
}

function InnerApp({showTpl,setShowTpl,showSearch,setShowSearch,presentMode,setPresentMode,presentIdx,setPresentIdx,isSaved,setIsSaved}){
  const{s}=useWB();
  const frames=s.nodes.filter(n=>n.type==="frame");
  const presentFrame=presentMode&&frames.length>0?frames[presentIdx]?.id:null;

  // Track saves
  useEffect(()=>{setIsSaved(false);const t=setTimeout(()=>setIsSaved(true),1500);return()=>clearTimeout(t);},[s.nodes,s.arrows]);

  return<>
    <style>{CSS}</style>
    <div style={{display:"flex",flexDirection:"column",height:"100vh",width:"100vw",background:T.bg0}}>
      {!presentMode&&<TopBar onTpl={()=>setShowTpl(o=>!o)} onSearch={()=>setShowSearch(o=>!o)} onPresent={()=>{setPresentMode(true);setPresentIdx(0);}} isSaved={isSaved}/>}
      <div style={{display:"flex",flex:1,overflow:"hidden",position:"relative"}}>
        <Canvas presentMode={presentMode} presentFrame={presentFrame}/>
        {!presentMode&&<Toolbar/>}
        {!presentMode&&<Minimap/>}
        <Timer/>
        {showTpl&&!presentMode&&<TplPanel onClose={()=>setShowTpl(false)}/>}
        {showSearch&&!presentMode&&<SearchPanel onClose={()=>setShowSearch(false)}/>}
        {presentMode&&<PresentBar onExit={()=>setPresentMode(false)} frames={frames} curIdx={presentIdx} setCurIdx={setPresentIdx}/>}
        {!presentMode&&<RightPanel/>}
      </div>
    </div>
  </>;
}

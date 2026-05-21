export function createBoardState({ T, SC, CANVAS_THEMES, uid }) {
  const GRID=24;
  const snap=(v,enabled)=>enabled?Math.round(v/GRID)*GRID:v;
  
  const SHAPE_DEFAULTS={
    rect:{w:150,h:76},
    circle:{w:100,h:100},
    diamond:{w:130,h:86},
    triangle:{w:150,h:110},
    hexagon:{w:170,h:108},
    parallelogram:{w:170,h:96},
    cloud:{w:190,h:124},
    cylinder:{w:160,h:116},
  };
  const SHAPE_TYPES=Object.keys(SHAPE_DEFAULTS);
  const TABLE_DEFAULT_COL_WIDTH=156;
  const TABLE_DEFAULT_ROW_HEIGHT=44;
  const TABLE_DEFAULT_HEAD_HEIGHT=40;
  const TABLE_MIN_COLS=2;
  const TABLE_MAX_COLS=12;
  const TABLE_MIN_ROWS=1;
  const TABLE_MAX_ROWS=40;
  const TABLE_MIN_COL_WIDTH=96;
  const TABLE_MAX_COL_WIDTH=420;
  const TIDY_GAP_X=72;
  const TIDY_GAP_Y=72;
  const MINDMAP_CHILD_GAP_X=170;
  const MINDMAP_CHILD_GAP_Y=32;
  
  function makeShapeNode(shapeType,x,y){
    const d=SHAPE_DEFAULTS[shapeType]||SHAPE_DEFAULTS.rect;
    return{
      id:uid(),
      type:"shape",
      shapeType,
      x,
      y,
      w:d.w,
      h:d.h,
      text:"",
      color:T.bg3,
      textColor:T.t0,
      borderColor:T.b1,
    };
  }

  function cloneNodePayload(node){
    const copy={...node};
    if(copy.reactions&&typeof copy.reactions==="object")copy.reactions={...copy.reactions};
    if(copy.sheetCells&&typeof copy.sheetCells==="object")copy.sheetCells={...copy.sheetCells};
    if(copy.sheetColSizes&&typeof copy.sheetColSizes==="object")copy.sheetColSizes={...copy.sheetColSizes};
    if(copy.sheetRowSizes&&typeof copy.sheetRowSizes==="object")copy.sheetRowSizes={...copy.sheetRowSizes};
    if(Array.isArray(copy.deckSlides))copy.deckSlides=copy.deckSlides.map(sl=>({...sl}));
    return copy;
  }

  function makeSheetNode(x,y,opts={}){
    const rows=Math.max(3,Math.min(200,Number(opts.rows)||12));
    const cols=Math.max(2,Math.min(26,Number(opts.cols)||6));
    const cellW=Math.max(70,Math.min(280,Number(opts.cellW)||118));
    const rowH=Math.max(24,Math.min(72,Number(opts.rowH)||32));
    const seedCells={};
    if(opts.seedHeaders!==false){
      for(let c=0;c<cols;c++)seedCells[`0,${c}`]=`Col ${c+1}`;
    }
    return{
      id:uid(),
      type:"sheet",
      x,
      y,
      w:Math.max(360,Math.min(2200,Number(opts.w)||Math.max(560,cols*cellW+72))),
      h:Math.max(240,Math.min(1400,Number(opts.h)||Math.max(320,rows*rowH+92))),
      text:opts.title||"Spreadsheet",
      color:"#ffffff",
      textColor:"#0f172a",
      borderColor:"#94a3b8",
      fontSize:12,
      fontWeight:"500",
      sheetRows:rows,
      sheetCols:cols,
      sheetCellW:cellW,
      sheetRowH:rowH,
      sheetCells:seedCells,
      sheetActive:"1,0",
    };
  }

  function makeDeckNode(x,y,opts={}){
    const slidesIn=Array.isArray(opts.slides)&&opts.slides.length?opts.slides:[
      {title:"Slide 1",body:"Objective and context"},
      {title:"Slide 2",body:"Plan and milestones"},
      {title:"Slide 3",body:"Risks and decisions"},
    ];
    const slides=slidesIn.map((sl,i)=>({
      id:sl.id||uid(),
      title:sl.title||`Slide ${i+1}`,
      body:sl.body||"",
      notes:sl.notes||"",
    }));
    return{
      id:uid(),
      type:"deck",
      x,
      y,
      w:Math.max(420,Math.min(1800,Number(opts.w)||760)),
      h:Math.max(280,Math.min(1200,Number(opts.h)||460)),
      text:opts.title||"Presentation",
      color:"#0f172a",
      textColor:"#e2e8f0",
      borderColor:"#334155",
      deckAccent:opts.deckAccent||"#facc15",
      deckIndex:Math.max(0,Math.min(slides.length-1,Number(opts.deckIndex)||0)),
      deckSlides:slides,
      deckInputTarget:opts.deckInputTarget==="title"?"title":"body",
    };
  }

  function makeNoteNode(x,y,opts={}){
    return{
      id:uid(),
      type:"note",
      x,
      y,
      w:Math.max(300,Number(opts.w)||400),
      h:Math.max(200,Number(opts.h)||500),
      text:opts.text||"# New Note\n\nWrite something...",
      color:T.bg2,
      textColor:T.t0,
      borderColor:T.b1,
    };
  }
  
  function makeTablePack(x,y,opts={}){
    const cols=Math.max(TABLE_MIN_COLS,Math.min(8,Number(opts.cols)||5));
    const rows=Math.max(2,Math.min(24,Number(opts.rows)||5));
    const cellW=TABLE_DEFAULT_COL_WIDTH;
    const cellH=TABLE_DEFAULT_ROW_HEIGHT;
    const headH=TABLE_DEFAULT_HEAD_HEIGHT;
    const tableId=uid();
    const gid=uid();
    const nodes=[
      {id:uid(),type:"text",groupId:gid,tableId,tableRole:"title",x,y:y-42,w:cols*cellW,h:32,text:"Table",color:T.t0,textColor:T.t0,fontSize:20,fontWeight:"700"},
    ];
    for(let c=0;c<cols;c++){
      nodes.push({
        id:uid(),
        groupId:gid,
        tableId,
        tableRole:"header",
        tableCol:c,
        type:"shape",
        shapeType:"rect",
        x:x+c*cellW,
        y,
        w:cellW,
        h:headH,
        text:`Col ${c+1}`,
        color:T.bg4,
        textColor:T.y,
        borderColor:T.b2,
        fontSize:12,
        fontWeight:"700",
      });
    }
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        nodes.push({
          id:uid(),
          groupId:gid,
          tableId,
          tableRole:"cell",
          tableRow:r,
          tableCol:c,
          type:"shape",
          shapeType:"rect",
          x:x+c*cellW,
          y:y+headH+r*cellH,
          w:cellW,
          h:cellH,
          text:"",
          color:r%2===0?"#edf4ff":"#f8fbff",
          textColor:"#1e293b",
          borderColor:"#cbd5e1",
          fontSize:11,
        });
      }
    }
    return{nodes,arrows:[]};
  }
  
  function getTableInfo(nodes,tableId){
    const list=nodes.filter(n=>n.tableId===tableId);
    if(!list.length)return null;
    const title=list.find(n=>n.tableRole==="title")||null;
    const headers=list.filter(n=>n.tableRole==="header").sort((a,b)=>(a.tableCol??0)-(b.tableCol??0));
    const cells=list.filter(n=>n.tableRole==="cell");
    if(!headers.length)return null;
    const cols=headers.map(h=>Number(h.tableCol)).filter(Number.isFinite).sort((a,b)=>a-b);
    const rows=[...new Set(cells.map(c=>Number(c.tableRow)).filter(r=>Number.isInteger(r)&&r>=0))].sort((a,b)=>a-b);
    const x0=Math.min(...headers.map(h=>h.x));
    const y0=Math.min(...headers.map(h=>h.y));
    const headH=Math.max(28,Number(headers[0].h)||TABLE_DEFAULT_HEAD_HEIGHT);
    const rowH=Math.max(24,Number(cells[0]?.h)||TABLE_DEFAULT_ROW_HEIGHT);
    const colWidths=Object.fromEntries(cols.map(c=>{
      const h=headers.find(x=>Number(x.tableCol)===c);
      return[c,Math.max(TABLE_MIN_COL_WIDTH,Math.min(TABLE_MAX_COL_WIDTH,Number(h?.w)||TABLE_DEFAULT_COL_WIDTH))];
    }));
    const groupId=headers[0]?.groupId||cells[0]?.groupId||title?.groupId||null;
    return{
      title,
      headers,
      cells,
      cols,
      rows,
      x0,
      y0,
      headH,
      rowH,
      colWidths,
      groupId,
      totalWidth:cols.reduce((s,c)=>s+(colWidths[c]||TABLE_DEFAULT_COL_WIDTH),0),
    };
  }
  
  function getTableColumnStart(info,col){
    let x=info.x0;
    for(const c of info.cols){if(c>=col)break;x+=info.colWidths[c]||TABLE_DEFAULT_COL_WIDTH;}
    return x;
  }

  function getConnectorFromId(connector){
    return connector?.from?.entityId||connector?.fromId||"";
  }

  function getConnectorToId(connector){
    return connector?.to?.entityId||connector?.toId||"";
  }

  function remapConnectorEntities(connector,idMap){
    const next={...connector};
    const fromId=getConnectorFromId(connector);
    const toId=getConnectorToId(connector);
    next.fromId=idMap[fromId]||fromId;
    next.toId=idMap[toId]||toId;
    if(connector?.from){
      next.from={...connector.from,entityId:idMap[fromId]||fromId};
    }
    if(connector?.to){
      next.to={...connector.to,entityId:idMap[toId]||toId};
    }
    return next;
  }
  
  function collectDependency(arrows,startIds){
    const start=new Set(startIds||[]);
    if(!start.size)return{upNodes:new Set(),downNodes:new Set(),upEdges:new Set(),downEdges:new Set()};
    const byTo={},byFrom={};
    (arrows||[]).forEach(a=>{
      const toId=getConnectorToId(a);
      const fromId=getConnectorFromId(a);
      if(!toId||!fromId)return;
      if(!byTo[toId])byTo[toId]=[];
      if(!byFrom[fromId])byFrom[fromId]=[];
      byTo[toId].push(a);
      byFrom[fromId].push(a);
    });
    const upNodes=new Set(),downNodes=new Set(),upEdges=new Set(),downEdges=new Set();
    const qu=[...start],qd=[...start];
    const vu=new Set(start),vd=new Set(start);
    while(qu.length){
      const n=qu.shift();
      for(const e of(byTo[n]||[])){
        const fromId=getConnectorFromId(e);
        upEdges.add(e.id);
        if(fromId&&!vu.has(fromId)){vu.add(fromId);upNodes.add(fromId);qu.push(fromId);}
      }
    }
    while(qd.length){
      const n=qd.shift();
      for(const e of(byFrom[n]||[])){
        const toId=getConnectorToId(e);
        downEdges.add(e.id);
        if(toId&&!vd.has(toId)){vd.add(toId);downNodes.add(toId);qd.push(toId);}
      }
    }
    return{upNodes,downNodes,upEdges,downEdges};
  }
  
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
      const sheet=makeSheetNode(80,72,{rows:8,cols:5,title:"Tabel Personalizat"});
      return{nodes:[sheet],arrows:[]};
    }},
    spreadsheet:{name:"Spreadsheet",icon:"▤",build:()=>{
      const sheet=makeSheetNode(80,72,{rows:14,cols:7,title:"Budget Planning"});
      return{nodes:[sheet],arrows:[]};
    }},
    slides:{name:"Slides Deck",icon:"▣",build:()=>{
      const deck=makeDeckNode(90,82,{
        title:"Quarterly Review",
        slides:[
          {title:"Context",body:"Goals, constraints, and assumptions"},
          {title:"Execution",body:"Milestones, owners, and dependencies"},
          {title:"Risks",body:"Top blockers and mitigation"},
        ],
      });
      return{nodes:[deck],arrows:[]};
    }},
    cloudInfra:{name:"Cloud Architecture",icon:"☁",build:()=>{
      const n=[],a=[];
      n.push({id:uid(),type:"text",x:90,y:8,w:680,h:46,text:"Cloud Architecture Snapshot",color:T.t0,textColor:T.t0,fontSize:24,fontWeight:"600"});
      const users={id:uid(),type:"shape",shapeType:"circle",x:80,y:220,w:110,h:110,text:"Users",color:"#1f2937",textColor:"#fff",borderColor:"#475569",fontSize:12,fontWeight:"700"};
      const edge={id:uid(),type:"shape",shapeType:"cloud",x:260,y:170,w:220,h:140,text:"Edge / CDN",color:"#0f766e",textColor:"#ecfeff",borderColor:"#2dd4bf",fontSize:13,fontWeight:"700"};
      const api={id:uid(),type:"shape",shapeType:"rect",x:560,y:185,w:190,h:95,text:"API Gateway",color:"#1d4ed8",textColor:"#fff",borderColor:"#93c5fd",fontSize:13,fontWeight:"700"};
      const svc={id:uid(),type:"shape",shapeType:"hexagon",x:820,y:186,w:170,h:95,text:"Services",color:"#6d28d9",textColor:"#fff",borderColor:"#c4b5fd",fontSize:13,fontWeight:"700"};
      const db={id:uid(),type:"shape",shapeType:"cylinder",x:560,y:340,w:180,h:130,text:"MongoDB",color:"#14532d",textColor:"#dcfce7",borderColor:"#86efac",fontSize:12,fontWeight:"700"};
      const queue={id:uid(),type:"shape",shapeType:"parallelogram",x:820,y:348,w:190,h:92,text:"Queue / Events",color:"#7c2d12",textColor:"#ffedd5",borderColor:"#fdba74",fontSize:12,fontWeight:"700"};
      [users,edge,api,svc,db,queue].forEach(v=>n.push(v));
      a.push({id:uid(),fromId:users.id,toId:edge.id,label:"HTTPS"});
      a.push({id:uid(),fromId:edge.id,toId:api.id,label:"route"});
      a.push({id:uid(),fromId:api.id,toId:svc.id,label:"RPC"});
      a.push({id:uid(),fromId:svc.id,toId:db.id,label:"read/write"});
      a.push({id:uid(),fromId:svc.id,toId:queue.id,label:"publish"});
      return{nodes:n,arrows:a};
    }},
  };
  
  /* ════════════════════════════════════════════════════════════
     STATE REDUCER
  ════════════════════════════════════════════════════════════ */

  const ADD_TOOLS=new Set([
    "sticky","text","rect","circle","diamond","triangle","hexagon","parallelogram","cloud","cylinder",
    "laneH","laneV","table","sheet","deck","note","task","milestone","decision","transform","frame","comment","vote","arrow",
  ]);

  function reducer(s,a){
    switch(a.type){
      case"TOOL":{
        const next=String(a.v||"select");
        return{
          ...s,
          tool:next,
          lastNonAddTool:next==="select"||next==="pan"?next:(s.lastNonAddTool||"select"),
          arrowFrom:null,
        };
      }
      case"EXIT_ADD_MODE":
        return{
          ...s,
          tool:"select",
          lastNonAddTool:"select",
          arrowFrom:null,
        };
      case"TOGGLE_AUTO_RETURN_TO_SELECT":
        return{...s,autoReturnToSelect:a.v===undefined?!s.autoReturnToSelect:Boolean(a.v)};
      case"DEP_MODE":return{...s,depMode:a.v!==undefined?Boolean(a.v):!s.depMode};
      case"SEL":return{...s,sel:a.v};
      case"ZOOM":return{...s,zoom:Math.max(.08,Math.min(6,a.v))};
      case"PAN":return{...s,px:a.x,py:a.y};
      case"SNAP_TOGGLE":return{...s,snapGrid:!s.snapGrid};
      case"ADD":{
        const nextTool=s.autoReturnToSelect&&ADD_TOOLS.has(s.tool)?"select":s.tool;
        return{
          ...s,
          tool:nextTool,
          lastNonAddTool:nextTool==="select"||nextTool==="pan"?nextTool:(s.lastNonAddTool||"select"),
          nodes:[...s.nodes,a.node],
          hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],
          fut:[],
        };
      }
      case"UPD":return{...s,nodes:s.nodes.map(n=>n.id===a.id?{...n,...a.p}:n)};
      case"UPD_SEL":return{...s,nodes:s.nodes.map(n=>s.sel.includes(n.id)?{...n,...a.p}:n)};
      case"UPD_MULTI":return{...s,nodes:s.nodes.map(n=>a.deltas[n.id]?{...n,...a.deltas[n.id]}:n)};
      case"MOVE_SEL":return{...s,nodes:s.nodes.map(n=>s.sel.includes(n.id)&&!n.locked?{...n,x:n.x+a.dx,y:n.y+a.dy}:n)};
      case"SEL_ALL":return{...s,sel:s.nodes.filter(n=>!n.hidden).map(n=>n.id)};
      case"DEL":{
        const del=new Set(Array.isArray(a.ids)?a.ids:[]);
        s.nodes.forEach(n=>{if(n.mergeParentId&&del.has(n.mergeParentId))del.add(n.id);});
        const ids=[...del];
        return{
          ...s,
          nodes:s.nodes.filter(n=>!del.has(n.id)),
          arrows:s.arrows.filter(a2=>{
            const fromId=getConnectorFromId(a2);
            const toId=getConnectorToId(a2);
            return!ids.includes(fromId)&&!ids.includes(toId);
          }),
          sel:[],
          hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],
          fut:[],
        };
      }
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
        const nd=td.map(n=>({...cloneNodePayload(n),id:uid(),x:n.x+GRID,y:n.y+GRID}));
        return{...s,nodes:[...s.nodes,...nd],sel:nd.map(n=>n.id),hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
      }
      case"SNAP":return{...s,hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
      case"ADD_COMMENT":return{...s,comments:[...s.comments,a.c]};
      case"UPDATE_COMMENT":return{...s,comments:s.comments.map(c=>c.id===a.id?{...c,...(a.patch||{})}:c)};
      case"DEL_COMMENT":return{...s,comments:s.comments.filter(c=>c.id!==a.id)};
      case"ADD_DRAW":return{...s,drawings:[...s.drawings,a.d]};
      case"CLEAR_DRAWS":return{...s,drawings:[]};
      case"ADD_VOTE":return{...s,votes:{...s.votes,[a.nodeId]:(s.votes[a.nodeId]||0)+1}};
      case"CLEAR_VOTES":return{...s,votes:{}};
      case"LOAD":return{
        ...INIT,
        ...a.state,
        lastNonAddTool:typeof a.state?.lastNonAddTool==="string"?a.state.lastNonAddTool:"select",
        autoReturnToSelect:a.state?.autoReturnToSelect!==false,
        hist:[],
        fut:[],
      };
      // ── new Miro features ──
      case"COPY":return{...s,clipboard:s.nodes.filter(n=>s.sel.includes(n.id))};
      case"PASTE":{
        if(!s.clipboard?.length)return s;
        const im={};
        const gm={},tm={};
        const nd=s.clipboard.map(n=>{
          const base=cloneNodePayload(n);
          const id=uid();
          im[n.id]=id;
          const groupId=n.groupId?(gm[n.groupId]||(gm[n.groupId]=uid())):n.groupId;
          const tableId=n.tableId?(tm[n.tableId]||(tm[n.tableId]=uid())):n.tableId;
          return{...base,id,groupId,tableId,x:n.x+GRID*2,y:n.y+GRID*2};
        });
        const clipIds=new Set(s.clipboard.map(n=>n.id));
        const na=s.arrows
          .filter(a=>{
            const fromId=getConnectorFromId(a);
            const toId=getConnectorToId(a);
            return clipIds.has(fromId)&&clipIds.has(toId);
          })
          .map(a=>remapConnectorEntities({...a,id:uid()},im));
        return{...s,nodes:[...s.nodes,...nd],arrows:[...s.arrows,...na],sel:nd.map(n=>n.id),hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
      }
      case"TABLE_ADD_ROW":{
        const info=getTableInfo(s.nodes,a.tableId);
        if(!info)return s;
        if(info.rows.length>=TABLE_MAX_ROWS)return s;
        const targetRow=Number.isInteger(a.row)?Math.max(0,Math.min(a.row,info.rows.length)):info.rows.length;
        const newCells=[];
        for(const n of s.nodes){
          if(n.tableId!==a.tableId||n.tableRole!=="cell")continue;
          const r=Number(n.tableRow);
          if(Number.isInteger(r)&&r>=targetRow){
            newCells.push({id:n.id,p:{tableRow:r+1,y:n.y+info.rowH}});
          }
        }
        let cursorX=info.x0;
        const created=info.cols.map(c=>{
          const w=info.colWidths[c]||TABLE_DEFAULT_COL_WIDTH;
          const cell={
            id:uid(),
            groupId:info.groupId,
            tableId:a.tableId,
            tableRole:"cell",
            tableRow:targetRow,
            tableCol:c,
            type:"shape",
            shapeType:"rect",
            x:cursorX,
            y:info.y0+info.headH+targetRow*info.rowH,
            w,
            h:info.rowH,
            text:"",
            color:targetRow%2===0?"#edf4ff":"#f8fbff",
            textColor:"#1e293b",
            borderColor:"#cbd5e1",
            fontSize:11,
          };
          cursorX+=w;
          return cell;
        });
        const movedMap=Object.fromEntries(newCells.map(m=>[m.id,m.p]));
        return{
          ...s,
          nodes:[...s.nodes.map(n=>movedMap[n.id]?{...n,...movedMap[n.id]}:n),...created],
          hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],
          fut:[],
        };
      }
      case"TABLE_DEL_ROW":{
        const info=getTableInfo(s.nodes,a.tableId);
        if(!info||info.rows.length<=TABLE_MIN_ROWS)return s;
        const targetRow=Number.isInteger(a.row)?Math.max(0,Math.min(a.row,info.rows.length-1)):info.rows[info.rows.length-1];
        const nextNodes=[];
        for(const n of s.nodes){
          if(n.tableId!==a.tableId||n.tableRole!=="cell"){nextNodes.push(n);continue;}
          const r=Number(n.tableRow);
          if(!Number.isInteger(r)){nextNodes.push(n);continue;}
          if(r===targetRow)continue;
          if(r>targetRow)nextNodes.push({...n,tableRow:r-1,y:n.y-info.rowH});
          else nextNodes.push(n);
        }
        return{...s,nodes:nextNodes,hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
      }
      case"TABLE_ADD_COL":{
        const info=getTableInfo(s.nodes,a.tableId);
        if(!info||info.cols.length>=TABLE_MAX_COLS)return s;
        const insertCol=Number.isInteger(a.col)?Math.max(0,Math.min(a.col,info.cols.length)):info.cols.length;
        const insW=Math.max(TABLE_MIN_COL_WIDTH,Math.min(TABLE_MAX_COL_WIDTH,Number(a.width)||TABLE_DEFAULT_COL_WIDTH));
        const insX=getTableColumnStart(info,insertCol);
        const updated=s.nodes.map(n=>{
          if(n.tableId!==a.tableId)return n;
          if(n.tableRole==="title")return{...n,w:(n.w||info.totalWidth)+insW};
          if((n.tableRole==="header"||n.tableRole==="cell")&&Number(n.tableCol)>=insertCol){
            return{...n,tableCol:Number(n.tableCol)+1,x:n.x+insW};
          }
          return n;
        });
        const groupId=info.groupId;
        const header={
          id:uid(),groupId,tableId:a.tableId,tableRole:"header",tableCol:insertCol,type:"shape",shapeType:"rect",
          x:insX,y:info.y0,w:insW,h:info.headH,text:`Col ${insertCol+1}`,color:T.bg4,textColor:T.y,borderColor:T.b2,fontSize:12,fontWeight:"700",
        };
        const created=[header,...info.rows.map(r=>({
          id:uid(),groupId,tableId:a.tableId,tableRole:"cell",tableRow:r,tableCol:insertCol,type:"shape",shapeType:"rect",
          x:insX,y:info.y0+info.headH+r*info.rowH,w:insW,h:info.rowH,text:"",color:r%2===0?"#edf4ff":"#f8fbff",textColor:"#1e293b",borderColor:"#cbd5e1",fontSize:11,
        }))];
        return{
          ...s,
          nodes:[...updated,...created].map(n=>{
            if(n.tableId!==a.tableId||n.tableRole!=="header")return n;
            const c=Number(n.tableCol);
            if(!Number.isInteger(c))return n;
            return{...n,text:`Col ${c+1}`};
          }),
          hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],
          fut:[],
        };
      }
      case"TABLE_DEL_COL":{
        const info=getTableInfo(s.nodes,a.tableId);
        if(!info||info.cols.length<=TABLE_MIN_COLS)return s;
        const targetCol=Number.isInteger(a.col)?Math.max(0,Math.min(a.col,info.cols.length-1)):info.cols[info.cols.length-1];
        const remW=info.colWidths[targetCol]||TABLE_DEFAULT_COL_WIDTH;
        const nextNodes=[];
        for(const n of s.nodes){
          if(n.tableId!==a.tableId){nextNodes.push(n);continue;}
          if(n.tableRole==="title"){nextNodes.push({...n,w:Math.max(TABLE_MIN_COL_WIDTH,(n.w||info.totalWidth)-remW)});continue;}
          if(n.tableRole!=="header"&&n.tableRole!=="cell"){nextNodes.push(n);continue;}
          const c=Number(n.tableCol);
          if(!Number.isInteger(c)){nextNodes.push(n);continue;}
          if(c===targetCol)continue;
          if(c>targetCol)nextNodes.push({...n,tableCol:c-1,x:n.x-remW});
          else nextNodes.push(n);
        }
        const renamed=nextNodes.map(n=>{
          if(n.tableId!==a.tableId||n.tableRole!=="header")return n;
          const c=Number(n.tableCol);
          return{...n,text:`Col ${c+1}`};
        });
        return{...s,nodes:renamed,hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
      }
      case"TABLE_SET_COL_WIDTH":{
        const info=getTableInfo(s.nodes,a.tableId);
        if(!info)return s;
        const col=Number(a.col);
        if(!Number.isInteger(col)||!info.cols.includes(col))return s;
        const oldW=info.colWidths[col]||TABLE_DEFAULT_COL_WIDTH;
        const newW=Math.max(TABLE_MIN_COL_WIDTH,Math.min(TABLE_MAX_COL_WIDTH,Number(a.width)||oldW));
        const diff=newW-oldW;
        if(Math.abs(diff)<.5)return s;
        const nextNodes=s.nodes.map(n=>{
          if(n.tableId!==a.tableId)return n;
          if(n.tableRole==="title")return{...n,w:Math.max(TABLE_MIN_COL_WIDTH,(n.w||info.totalWidth)+diff)};
          if(n.tableRole!=="header"&&n.tableRole!=="cell")return n;
          const c=Number(n.tableCol);
          if(!Number.isInteger(c))return n;
          if(c===col)return{...n,w:newW};
          if(c>col)return{...n,x:n.x+diff};
          return n;
        });
        return{...s,nodes:nextNodes,hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
      }
      case"TABLE_MERGE_SEL":{
        const cells=s.nodes.filter(n=>s.sel.includes(n.id)&&n.tableRole==="cell"&&n.tableId&&!n.hidden);
        if(cells.length<2)return s;
        const tableId=cells[0].tableId;
        if(cells.some(n=>n.tableId!==tableId))return s;
        const info=getTableInfo(s.nodes,tableId);
        if(!info)return s;
        const rows=[...new Set(cells.map(n=>Number(n.tableRow)).filter(Number.isInteger))].sort((a,b)=>a-b);
        const cols=[...new Set(cells.map(n=>Number(n.tableCol)).filter(Number.isInteger))].sort((a,b)=>a-b);
        if(!rows.length||!cols.length)return s;
        const minR=rows[0],maxR=rows[rows.length-1],minC=cols[0],maxC=cols[cols.length-1];
        const target=[];
        for(let r=minR;r<=maxR;r++){
          for(let c=minC;c<=maxC;c++){
            const found=s.nodes.find(n=>n.tableId===tableId&&n.tableRole==="cell"&&Number(n.tableRow)===r&&Number(n.tableCol)===c);
            if(!found)return s;
            target.push(found);
          }
        }
        if(target.length!==cells.length)return s;
        if(target.some(n=>n.hidden||n.mergeParentId||(Number(n.mergeSpanCols)||1)>1||(Number(n.mergeSpanRows)||1)>1))return s;
        const root=target.find(n=>Number(n.tableRow)===minR&&Number(n.tableCol)===minC);
        if(!root)return s;
        const selCols=[];for(let c=minC;c<=maxC;c++)selCols.push(c);
        const selRows=[];for(let r=minR;r<=maxR;r++)selRows.push(r);
        const w=selCols.reduce((sum,c)=>sum+(info.colWidths[c]||TABLE_DEFAULT_COL_WIDTH),0);
        const h=selRows.length*info.rowH;
        const tIds=new Set(target.map(n=>n.id));
        const next=s.nodes.map(n=>{
          if(n.id===root.id)return{...n,w,h,hidden:false,mergeParentId:null,mergeSpanCols:selCols.length,mergeSpanRows:selRows.length,mergeCols:selCols,mergeRows:selRows};
          if(tIds.has(n.id))return{...n,hidden:true,mergeParentId:root.id};
          return n;
        });
        return{...s,nodes:next,sel:[root.id],hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
      }
      case"TABLE_UNMERGE_SEL":{
        const root=s.nodes.find(n=>s.sel.includes(n.id)&&n.tableRole==="cell"&&n.tableId&&((Number(n.mergeSpanCols)||1)>1||(Number(n.mergeSpanRows)||1)>1));
        if(!root)return s;
        const info=getTableInfo(s.nodes,root.tableId);
        if(!info)return s;
        const r0=Number(root.tableRow)||0,c0=Number(root.tableCol)||0;
        const cols=Array.isArray(root.mergeCols)&&root.mergeCols.length?root.mergeCols:[...Array(Number(root.mergeSpanCols)||1)].map((_,i)=>c0+i);
        const rows=Array.isArray(root.mergeRows)&&root.mergeRows.length?root.mergeRows:[...Array(Number(root.mergeSpanRows)||1)].map((_,i)=>r0+i);
        const next=s.nodes.map(n=>{
          if(n.id===root.id){
            const w=info.colWidths[c0]||TABLE_DEFAULT_COL_WIDTH;
            const x=getTableColumnStart(info,c0);
            const y=info.y0+info.headH+r0*info.rowH;
            return{...n,x,y,w,h:info.rowH,hidden:false,mergeParentId:null,mergeSpanCols:1,mergeSpanRows:1,mergeCols:null,mergeRows:null};
          }
          if(n.mergeParentId===root.id&&n.tableId===root.tableId&&n.tableRole==="cell"){
            const c=Number(n.tableCol),r=Number(n.tableRow);
            return{...n,hidden:false,mergeParentId:null,x:getTableColumnStart(info,c),y:info.y0+info.headH+r*info.rowH,w:info.colWidths[c]||TABLE_DEFAULT_COL_WIDTH,h:info.rowH};
          }
          return n;
        });
        return{...s,nodes:next,hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
      }
      case"WRAP_FRAME":{
        const ids=(Array.isArray(a.ids)&&a.ids.length?a.ids:s.sel).filter(Boolean);
        if(!ids.length)return s;
        const target=s.nodes.filter(n=>ids.includes(n.id)&&n.type!=="frame");
        if(!target.length)return s;
        const minX=Math.min(...target.map(n=>n.x));
        const minY=Math.min(...target.map(n=>n.y));
        const maxX=Math.max(...target.map(n=>n.x+(n.w||100)));
        const maxY=Math.max(...target.map(n=>n.y+(n.h||60)));
        const frame={id:uid(),type:"frame",x:minX-40,y:minY-56,w:(maxX-minX)+80,h:(maxY-minY)+96,text:a.title||"Frame",color:"transparent",borderColor:T.b1};
        return{...s,nodes:[...s.nodes,frame],sel:[frame.id],hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
      }
      case"TIDY":{
        const ids=(Array.isArray(a.ids)&&a.ids.length?a.ids:s.sel).filter(Boolean);
        const candidates=s.nodes.filter(n=>(ids.length?ids.includes(n.id):true)&&n.type!=="frame"&&!n.locked);
        if(candidates.length<2)return s;
        const sorted=[...candidates].sort((p,q)=>p.y===q.y?p.x-q.x:p.y-q.y);
        const startX=Math.min(...sorted.map(n=>n.x));
        const startY=Math.min(...sorted.map(n=>n.y));
        const cols=Math.max(2,Math.ceil(Math.sqrt(sorted.length)));
        const rowHeights=[];
        const colWidths=[];
        for(let i=0;i<sorted.length;i++){
          const r=Math.floor(i/cols),c=i%cols;
          const w=sorted[i].w||120,h=sorted[i].h||70;
          rowHeights[r]=Math.max(rowHeights[r]||0,h);
          colWidths[c]=Math.max(colWidths[c]||0,w);
        }
        const colStarts=[];
        let cx=startX;
        for(let c=0;c<cols;c++){colStarts[c]=cx;cx+=(colWidths[c]||120)+TIDY_GAP_X;}
        const rowStarts=[];
        let cy=startY;
        for(let r=0;r<rowHeights.length;r++){rowStarts[r]=cy;cy+=(rowHeights[r]||70)+TIDY_GAP_Y;}
        const upd={};
        for(let i=0;i<sorted.length;i++){
          const r=Math.floor(i/cols),c=i%cols,n=sorted[i];
          const cellW=colWidths[c]||n.w||120;
          const cellH=rowHeights[r]||n.h||70;
          upd[n.id]={x:colStarts[c]+(cellW-(n.w||120))/2,y:rowStarts[r]+(cellH-(n.h||70))/2};
        }
        return{...s,nodes:s.nodes.map(n=>upd[n.id]?{...n,...upd[n.id]}:n),hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
      }
      case"LOCK_SEL":return{...s,nodes:s.nodes.map(n=>s.sel.includes(n.id)?{...n,locked:!n.locked}:n)};
      case"Z_FRONT":{const mx=Math.max(0,...s.nodes.map(n=>n.zIndex||0));return{...s,nodes:s.nodes.map(n=>s.sel.includes(n.id)?{...n,zIndex:mx+1}:n)};}
      case"Z_BACK":return{...s,nodes:s.nodes.map(n=>s.sel.includes(n.id)?{...n,zIndex:0}:n)};
      case"Z_FWD":{return{...s,nodes:s.nodes.map(n=>s.sel.includes(n.id)?{...n,zIndex:(n.zIndex||0)+1}:n)};}
      case"Z_BWD":{return{...s,nodes:s.nodes.map(n=>s.sel.includes(n.id)?{...n,zIndex:Math.max(0,(n.zIndex||0)-1)}:n)};}
      case"ALIGN":{
        const sel=s.nodes.filter(n=>s.sel.includes(n.id));
        if(sel.length<2)return s;
        let upd={};
        if(a.d==="left"){const v=Math.min(...sel.map(n=>n.x));sel.forEach(n=>upd[n.id]={x:v});}
        else if(a.d==="right"){const v=Math.max(...sel.map(n=>n.x+n.w));sel.forEach(n=>upd[n.id]={x:v-n.w});}
        else if(a.d==="top"){const v=Math.min(...sel.map(n=>n.y));sel.forEach(n=>upd[n.id]={y:v});}
        else if(a.d==="bottom"){const v=Math.max(...sel.map(n=>n.y+n.h));sel.forEach(n=>upd[n.id]={y:v-n.h});}
        else if(a.d==="cx"){const v=(Math.min(...sel.map(n=>n.x))+Math.max(...sel.map(n=>n.x+n.w)))/2;sel.forEach(n=>upd[n.id]={x:v-n.w/2});}
        else if(a.d==="cy"){const v=(Math.min(...sel.map(n=>n.y))+Math.max(...sel.map(n=>n.y+n.h)))/2;sel.forEach(n=>upd[n.id]={y:v-n.h/2});}
        else if(a.d==="dh"){const sorted=[...sel].sort((a,b)=>a.x-b.x);const span=sorted[sorted.length-1].x+sorted[sorted.length-1].w-sorted[0].x;const tw=sorted.reduce((s,n)=>s+n.w,0);const gap=(span-tw)/(sorted.length-1);let x=sorted[0].x;sorted.forEach(n=>{upd[n.id]={x};x+=n.w+gap;});}
        else if(a.d==="dv"){const sorted=[...sel].sort((a,b)=>a.y-b.y);const span=sorted[sorted.length-1].y+sorted[sorted.length-1].h-sorted[0].y;const th=sorted.reduce((s,n)=>s+n.h,0);const gap=(span-th)/(sorted.length-1);let y=sorted[0].y;sorted.forEach(n=>{upd[n.id]={y};y+=n.h+gap;});}
        return{...s,nodes:s.nodes.map(n=>upd[n.id]?{...n,...upd[n.id]}:n),hist:[...s.hist.slice(-80),{n:s.nodes,a:s.arrows}],fut:[]};
      }
      case"GROUP":{const gid=uid();return{...s,nodes:s.nodes.map(n=>s.sel.includes(n.id)?{...n,groupId:gid}:n)};}
      case"UNGROUP":return{...s,nodes:s.nodes.map(n=>s.sel.includes(n.id)?{...n,groupId:null}:n)};
      case"SET_TEXT_ALIGN":return{...s,nodes:s.nodes.map(n=>s.sel.includes(n.id)?{...n,textAlign:a.v}:n)};
      case"ZOOM_FIT":{if(!s.nodes.length)return s;const xs=s.nodes.map(n=>n.x),ys=s.nodes.map(n=>n.y),x2s=s.nodes.map(n=>n.x+(n.w||100)),y2s=s.nodes.map(n=>n.y+(n.h||60));const bx=Math.min(...xs)-60,by=Math.min(...ys)-60,bw=Math.max(...x2s)-bx+60,bh=Math.max(...y2s)-by+60;const nz=Math.min(6,Math.max(.08,Math.min(a.vw/bw,a.vh/bh)*.9));return{...s,zoom:nz,px:(a.vw-bw*nz)/2-bx*nz,py:(a.vh-bh*nz)/2-by*nz};}
      case"SET_BG":return{...s,bgColor:a.v||null};
      case"FOCUS_MODE":return{...s,focusMode:!s.focusMode};
      case"SET_THEME":{const th=CANVAS_THEMES.find(t=>t.id===a.v);return th?{...s,bgColor:th.bg,canvasTheme:a.v}:{...s,canvasTheme:null};}
      case"ADD_REACTION":{const rn=s.nodes.find(n=>n.id===a.nodeId);if(!rn)return s;const rx={...(rn.reactions||{})};rx[a.emoji]=(rx[a.emoji]||0)+1;return{...s,nodes:s.nodes.map(n=>n.id===a.nodeId?{...n,reactions:rx}:n)};}
      case"REMOVE_REACTION":{const rn2=s.nodes.find(n=>n.id===a.nodeId);if(!rn2)return s;const rx2={...(rn2.reactions||{})};if(rx2[a.emoji])rx2[a.emoji]--;if(rx2[a.emoji]<=0)delete rx2[a.emoji];return{...s,nodes:s.nodes.map(n=>n.id===a.nodeId?{...n,reactions:rx2}:n)};}
      case"STICKY_SIZE":{const szMap={S:{w:120,h:90},M:{w:170,h:130},L:{w:240,h:180},XL:{w:320,h:240}};const sz=szMap[a.v]||szMap.M;return{...s,nodes:s.nodes.map(n=>s.sel.includes(n.id)&&n.type==="sticky"?{...n,...sz}:n)};}
      case"CLEAR_DRAWS_AREA":{if(!a.x||!a.r)return s;return{...s,drawings:s.drawings.filter(dr=>{const hit=dr.pts.some(p=>Math.hypot(p.x-a.x,p.y-a.y)<a.r);return!hit;})};}
      default:return s;
    }
  }
  const INIT={
    nodes:[],
    arrows:[],
    sel:[],
    tool:"select",
    lastNonAddTool:"select",
    autoReturnToSelect:true,
    zoom:1,
    px:0,
    py:0,
    arrowFrom:null,
    hist:[],
    fut:[],
    comments:[],
    drawings:[],
    votes:{},
    snapGrid:false,
    clipboard:[],
    depMode:false,
    bgColor:null,
    canvasTheme:null,
    focusMode:false,
  };
  
  /* ════════════════════════════════════════════════════════════
     END OF STATE BLOCK
  ════════════════════════════════════════════════════════════ */

  return {
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
    makeNoteNode,
    makeTablePack,
    getTableInfo,
    getTableColumnStart,
    collectDependency,
    TPLS,
    reducer,
    INIT,
  };
}

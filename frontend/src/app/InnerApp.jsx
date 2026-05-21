import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import CommandPalette from "../components/CommandPalette";

export default function InnerApp({boardId,boardName,setBoardName,onBoards,user,themeMode,onToggleTheme,wb,deps:innerDeps}){
  const{s,d,emitActivity}=wb;
  const{
    T,CSS,SC,ME,toasts,uid,api,socket,INIT,
    SHAPE_TYPES,SHAPE_DEFAULTS,getTableInfo,TABLE_DEFAULT_COL_WIDTH,TABLE_MIN_COLS,TABLE_MIN_ROWS,TABLE_MIN_COL_WIDTH,TABLE_MAX_COL_WIDTH,
    EDITOR_ONBOARDING_STORAGE_KEY,QUICK_START_PRESETS,
    isAddMode,isConnectMode,modeToTool,nextModeAfterAdd,nextModeAfterConnect,toolToMode,
    normalizeConnectorRouting,normalizeConnectorStyle,normalizeConnectorJumpStyle,normalizeConnectorEndpoints,normalizeChartType,normalizeTransformType,wouldCreateDataFlowCycle,createTransformNode,isDataConnector,isDataNodeType,reverseConnector,getConnectorDependencyType,dependencyTypeLabel,formatNumber,chartSeriesPath,
    parseJsonObjectLoose,buildQuickStartGraph,normExecDueDate,normExecStatus,normExecPriority,parseExecTags,composeTaskNodeText,composeMilestoneNodeText,composeDecisionNodeText,
    normalizePresenceState,deriveExecutionSnapshot,useDataFlowEngine,useIsMobile,
    Canvas,TopBar,ExecutionTimelineOverlay,Toolbar,LeftToolbar,Minimap,AlignPanel,Timer,TplPanel,SearchPanel,PresentBarView,RightPanel,RightToolPanel,MobileQuickActionsBar,MobileBottomBar,MobileBottomSheet,EmptyBoardPromptView,EditorOnboardingOverlayView,makeNoteNode,
  }=innerDeps;
  const isMobile=useIsMobile(920);
  const[showTpl,setShowTpl]=useState(false);
  const[showSearch,setShowSearch]=useState(false);
  const[showPalette,setShowPalette]=useState(false);
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
  const vaultApi=useMemo(()=>( {
    projects:(opts)=>api.vaultProjects(opts||{}),
    createProject:(payload)=>api.vaultCreateProject(payload||{}),
    updateProject:(projectId,payload)=>api.vaultUpdateProject(projectId,payload||{}),
    ingest:(payload)=>api.vaultIngest(payload||{}),
    records:(opts)=>api.vaultRecords(opts||{}),
    recordDetail:(recordId,opts)=>api.vaultRecordDetail(recordId,opts||{}),
    createRecord:(payload)=>api.vaultCreateRecord(payload||{}),
    updateRecord:(recordId,payload)=>api.vaultUpdateRecord(recordId,payload||{}),
    reveal:(recordId)=>api.vaultRevealRecord(recordId),
    subscriptions:(opts)=>api.vaultSubscriptions(opts||{}),
    summary:()=>api.vaultSummary(),
  }),[]);
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

  useEffect(() => {
    const onFocusNote = e => {
      const idOrTitle = String(e?.detail?.id || "").trim();
      if (!idOrTitle) return;
      let node = s.nodes.find(n => n.id === idOrTitle);
      if (!node) {
        node = s.nodes.find(n => {
          if (n.type !== 'note') return false;
          const title = n.text?.split('\n')[0].replace(/^#+\s*/, '').trim();
          return title?.toLowerCase() === idOrTitle.toLowerCase();
        });
      }
      if (node) {
        d({ type: "SEL", v: [node.id] });
        const cx = (node.x || 0) + (node.w || 400) / 2;
        const cy = (node.y || 0) + (node.h || 500) / 2;
        const tx = window.innerWidth * 0.5 - cx * s.zoom;
        const ty = window.innerHeight * 0.42 - cy * s.zoom;
        d({ type: "PAN", x: tx, y: ty });
      } else {
        toasts.push(`Note "${idOrTitle}" not found`, "info");
      }
    };
    window.addEventListener("boardai:focus-note", onFocusNote);
    return () => window.removeEventListener("boardai:focus-note", onFocusNote);
  }, [s.nodes, s.zoom, d, toasts]);
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

  // Command Palette / Search / Escape
  useEffect(()=>{
    const h=e=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="k"){
        e.preventDefault();
        setShowPalette(p=>!p);
      }
      if(e.key==="Escape"){
        setShowSearch(false);
        setShowPalette(false);
        setShowTpl(false);
        setMobileSheet("");
        d({type:"EXIT_ADD_MODE"});
      }
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
        {!presentMode&&<TopBar onTpl={()=>setShowTpl(o=>!o)} onSearch={()=>setShowPalette(true)} onPresent={()=>{setPresentMode(true);setPresentIdx(0);}} isSaved={isSaved} boardName={boardName} onRename={handleRename} onBoards={onBoards} isMobile={isMobile} onToggleRight={()=>{if(isMobile)toggleMobileSheetKind("panel");else setRightPanelOpen(v=>!v);}} rightOpen={isMobile?mobileSheet==="panel":rightPanelOpen} onToggleTools={()=>toggleMobileSheetKind("insert")} toolsOpen={mobileSheet==="insert"} onToggleMore={()=>toggleMobileSheetKind("more")} moreOpen={mobileSheet==="more"} themeMode={themeMode} onToggleTheme={onToggleTheme} showMinimap={showMinimap} onToggleMinimap={()=>setShowMinimap(v=>!v)} showTimeline={timelineOpen} onToggleTimeline={toggleTimeline}/>}
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
        {!presentMode&&!isMobile&&showMinimap&&<Minimap onClose={()=>setShowMinimap(false)} rightInset={rightPanelOpen?380:12}/>}
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
        {showSearch&&!presentMode&&<SearchPanel onClose={()=>setShowSearch(false)} api={api} boardId={boardId} />}
        <CommandPalette
          isOpen={showPalette}
          onClose={() => setShowPalette(false)}
          api={api}
          boardId={boardId}
          s={s}
          d={d}
          T={T}
          themeMode={themeMode}
          onToggleTheme={onToggleTheme}
          onToggleMinimap={() => setShowMinimap(v => !v)}
          onToggleTimeline={toggleTimeline}
          showMinimap={showMinimap}
          showTimeline={timelineOpen}
          rightOpen={rightPanelOpen}
          onToggleRight={() => { if(isMobile) toggleMobileSheetKind("panel"); else setRightPanelOpen(v => !v); }}
        />
        {presentMode&&<PresentBarView onExit={()=>setPresentMode(false)} frames={frames} curIdx={presentIdx} setCurIdx={setPresentIdx} T={T}/>}
        {!presentMode&&!isMobile&&rightPanelOpen&&<RightPanel s={s} d={d} T={T} SC={SC} uid={uid} SHAPE_TYPES={SHAPE_TYPES} SHAPE_DEFAULTS={SHAPE_DEFAULTS} getTableInfo={getTableInfo} TABLE_DEFAULT_COL_WIDTH={TABLE_DEFAULT_COL_WIDTH} TABLE_MIN_COLS={TABLE_MIN_COLS} TABLE_MIN_ROWS={TABLE_MIN_ROWS} TABLE_MIN_COL_WIDTH={TABLE_MIN_COL_WIDTH} TABLE_MAX_COL_WIDTH={TABLE_MAX_COL_WIDTH} boardId={boardId} historyApi={historyApi} accessApi={accessApi} auditApi={auditApi} githubApi={githubApi} jiraApi={jiraApi} vaultApi={vaultApi} currentUser={user} onRestoreVersion={applyRestoredState} notify={(msg,type)=>toasts.push(msg,type)} onToggleTimeline={toggleTimeline} timelineOpen={timelineOpen} collab={collabModel} onEmitActivity={handleEmitActivity} panelWidth={360} topOffset={68} rightInset={12} onRequestClose={()=>setRightPanelOpen(false)} onSpreadsheetAnomalyMapChange={updateSheetAiAnomalyMap} selectedConnector={selectedConnector} onUpdateConnector={(id,patch)=>d({type:"UPD_ARR",id,p:patch})} onDeleteConnector={(id)=>{d({type:"DEL_ARR",id});setSelectedConnectorId("");}}/>}
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
          <RightPanel s={s} d={d} T={T} SC={SC} uid={uid} SHAPE_TYPES={SHAPE_TYPES} SHAPE_DEFAULTS={SHAPE_DEFAULTS} getTableInfo={getTableInfo} TABLE_DEFAULT_COL_WIDTH={TABLE_DEFAULT_COL_WIDTH} TABLE_MIN_COLS={TABLE_MIN_COLS} TABLE_MIN_ROWS={TABLE_MIN_ROWS} TABLE_MIN_COL_WIDTH={TABLE_MIN_COL_WIDTH} TABLE_MAX_COL_WIDTH={TABLE_MAX_COL_WIDTH} boardId={boardId} historyApi={historyApi} accessApi={accessApi} auditApi={auditApi} githubApi={githubApi} jiraApi={jiraApi} vaultApi={vaultApi} currentUser={user} onRestoreVersion={applyRestoredState} notify={(msg,type)=>toasts.push(msg,type)} onToggleTimeline={toggleTimeline} timelineOpen={timelineOpen} collab={collabModel} onEmitActivity={handleEmitActivity} panelWidth="100%" fill onSpreadsheetAnomalyMapChange={updateSheetAiAnomalyMap} selectedConnector={selectedConnector} onUpdateConnector={(id,patch)=>d({type:"UPD_ARR",id,p:patch})} onDeleteConnector={(id)=>{d({type:"DEL_ARR",id});setSelectedConnectorId("");}}/>
        </MobileBottomSheet>}
        {!presentMode&&isMobile&&mobileSheet==="more"&&<MobileBottomSheet open title="More Actions" subtitle="Board and view actions" onClose={()=>setMobileSheet("")} T={T} zIndex={280} snapPoints={[0.24,0.42,0.68]}>
          <div style={{padding:"10px",display:"grid",gap:8}}>
            <button onClick={()=>{setMobileSheet("");setShowSearch(true);}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>Search (Ctrl+K)</button>
            <button onClick={()=>{setMobileSheet("");setShowTpl(true);}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>Templates</button>
            <button onClick={()=>{setTimelineOpen(v=>!v);}} style={{minHeight:44,borderRadius:10,border:`1px solid ${timelineOpen?T.yDim:T.b1}`,background:timelineOpen?T.yBg:T.bg2,color:timelineOpen?T.y:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>{timelineOpen?"Hide Timeline":"Show Timeline"}</button>
            <button onClick={()=>{d({type:"SNAP_TOGGLE"});}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>{s.snapGrid?"Disable Grid":"Enable Grid"}</button>
            <button onClick={()=>{d({type:"ZOOM_FIT",vw:window.innerWidth,vh:window.innerHeight-62});}} style={{minHeight:44,borderRadius:10,border:`1px solid ${T.b1}`,background:T.bg2,color:T.t0,fontFamily:"'JetBrains Mono',monospace",fontSize:12,cursor:"pointer"}}>Fit to Screen</button>
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







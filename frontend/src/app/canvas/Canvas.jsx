import { useCallback, useEffect, useMemo } from "react";

export default function Canvas({presentMode,presentFrame,isMobile=false,mobileStayInAdd=false,onOverlayStateChange,collabUsers=[],sheetAiAnomalyMapBySheet={},dataFlowRuntime=null,wb,deps:canvasDeps}){
  const{s,d,boardId}=wb;
  const{
    T,SC,ME,toasts,uid,GRID,snap,CANVAS_THEMES,MOBILE_SMART_GAP,MOBILE_RADIAL_OPTIONS,MOBILE_RADIAL_VECTORS,DEFAULT_CANVAS_BG,getNextStickySwatch,
    loadStoredConnectorDefaultStyle,loadStoredRememberLastConnectorStyle,saveStoredConnectorDefaultStyle,saveStoredRememberLastConnectorStyle,
    createInputController,
    isAddMode,isConnectMode,modeToTool,nextModeAfterAdd,nextModeAfterConnect,toolToMode,
    DEFAULT_PORTS,getPortWorldPosition,getAnchorWorldPosition,normalizeConnectorEndpoints,
    normalizeConnectorDefaultStyle,normalizeConnectorJumpStyle,normalizeConnectorRouting,normalizeConnectorStyle,reverseConnector,
    applyJumpsToPath,buildObstacleIndex,buildObstacleRects,clampCanvasPoint,connectorMidpoint,defaultConnectorPath,queryObstacleIndex,routeOrthoAStar,segmentIntersectsRect,segmentsToIntersections,
    appendFormulaReference,buildSheetReferenceToken,createSpreadsheetEngine,sheetCellKey,sheetColLabel,
    createTransformNode,isDataConnector,isDataNodeType,normalizeChartType,normalizeTransformType,wouldCreateDataFlowCycle,collectDependency,SHAPE_DEFAULTS,makeShapeNode,makeSheetNode,makeDeckNode,
    useCanvasUiState,useConnectorStyleController,useSheetFormulaBridge,useCanvasTransientUiHandlers,useConnectorSelectionSync,useCanvasImageIo,useCanvasWheelPanZoom,useCanvasLaserTrail,useTouchPointerCapture,useCanvasTouchHelpers,useCanvasMouseMoveRaf,useCanvasTouchMoveRaf,useTouchGestureUndoRedo,useTouchRadialMenuEnd,useTouchLongPressEnd,useTouchDoubleTapEnd,usePortConnectController,useConnectorContextMenu,useCanvasContextCommands,useCanvasPointerController,useCanvasContextMenuController,useCanvasContextImageUpload,useCanvasDoubleClickInsert,useCanvasNodeTransformStart,useCanvasNodeTouchStart,useCanvasTouchStartTarget,useCanvasTouchMoveNonPinch,useCanvasTouchEndHandler,useCanvasTouchStartTwoFinger,useCanvasTouchMovePinch,useCanvasTouchStartHandler,useCanvasTouchMoveHandler,
    ContextMenu,MobileBottomSheet,MobileRadialMenu,ConnectorRenderer,NodeRenderer,SelectionOverlay,GuidesOverlay,RemoteCursorsView,CanvasHud,ConnectorStylePanels,
    normalizeColorInputValue,getThemeColorHex,normExecStatus,normExecPriority,normExecDueDate,parseExecTags,normalizePresenceState,normalizeDependencyType,inferDependencyType,dependencyTypeLabel,getConnectorDependencyType,composeTaskNodeText,composeMilestoneNodeText,composeDecisionNodeText,isKpiNodeLike,formatNumber,chartSeriesPath,
    Sticky,TaskNode,MilestoneNode,DecisionNode,TransformNode,ChartNode,KpiNode,Shape,TxtNode,ImgNode,FrameNode,LaneNode,SpreadsheetNode,DeckNode,ArrowLabel,CommentDot,RH,RotH,
    socket,
  }=canvasDeps;
  const{nodes,arrows,sel,tool,zoom,px,py,arrowFrom,comments,drawings,votes,snapGrid,depMode,bgColor,autoReturnToSelect}=s;
  const {
    wRef,drag,moved,dPath,dColor,
    livePath,setLivePath,lasso,setLasso,ctxMenu,setCtxMenu,mobileCtxMenu,setMobileCtxMenu,radialMenu,setRadialMenu,
    commentInput,setCommentInput,selectedArrow,setSelectedArrow,selectedConnectorIds,setSelectedConnectorIds,
    hoveredConnectorId,setHoveredConnectorId,guides,setGuides,nodeDragActive,setNodeDragActive,hoverNodeId,setHoverNodeId,
    smartConnectSuggestion,setSmartConnectSuggestion,portConnect,setPortConnect,mobileInlineEdit,setMobileInlineEdit,
    connectorSnapFx,setConnectorSnapFx,taskSuccessFx,setTaskSuccessFx,routeNodes,setRouteNodes,
    connectorDefaults,setConnectorDefaults,rememberLastConnectorStyle,setRememberLastConnectorStyle,jumpConnectorSource,setJumpConnectorSource,
    sheetFormulaSession,setSheetFormulaSession,sheetFormulaPick,setSheetFormulaPick,
    cmtRef,pinch,mobileInputRef,mobilePointerCaptureRef,touchMoveRafRef,touchMovePendingRef,mouseMoveRafRef,mouseMovePendingRef,
    touchMetaRef,cursorEmitRef,ctxUploadRef,ctxUploadPosRef,connectorSnapTimerRef,taskSuccessTimerRef,connectorDefaultsRef,
  }=useCanvasUiState({
    defaultDrawColor:T.y,
    nodes,
    loadStoredConnectorDefaultStyle,
    loadStoredRememberLastConnectorStyle,
    createInputController,
  });

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

  const {
    connectorPresetFromConnector,
    setConnectorStyleAsDefault,
    resetConnectorStyleDefault,
    buildConnectorFromDefaults,
    updateConnector,
  }=useConnectorStyleController({
    arrows,
    nodes,
    dispatch:d,
    connectorDefaults,
    setConnectorDefaults,
    connectorDefaultsRef,
    rememberLastConnectorStyle,
    notify:(message,type)=>toasts.push(message,type),
    uid,
    saveStoredConnectorDefaultStyle,
    saveStoredRememberLastConnectorStyle,
  });

  const {
    onSheetFormulaSessionChange,
    onSheetFormulaReferencePick,
    onConsumeSheetFormulaPick,
  }=useSheetFormulaBridge({
    setSheetFormulaSession,
    setSheetFormulaPick,
  });

  useCanvasTransientUiHandlers({
    dispatch:d,
    selectedConnectorIds,
    hasNodeSelection:sel.length>0,
    setCommentInput,
    setCtxMenu,
    setMobileCtxMenu,
    setSelectedArrow,
    setSelectedConnectorIds,
    setLasso,
    setPortConnect,
    setSheetFormulaSession,
    setSheetFormulaPick,
    setRadialMenu,
    mobileInputRef,
    dragRef:drag,
    notify:(message,type,duration)=>toasts.push(message,type,duration),
  });

  useEffect(()=>{
    if(typeof onOverlayStateChange!=="function")return;
    const hasOverlay=Boolean(ctxMenu||mobileCtxMenu||radialMenu||commentInput||selectedArrow||portConnect);
    onOverlayStateChange(hasOverlay);
  },[ctxMenu,mobileCtxMenu,radialMenu,commentInput,selectedArrow,portConnect,onOverlayStateChange]);
  useConnectorSelectionSync({
    arrows,
    selectedArrow,
    selectedConnectorIds,
    setSelectedConnectorIds,
  });
  useEffect(()=>{
    if(!mobileInlineEdit?.nodeId)return;
    const exists=nodes.some(n=>n.id===mobileInlineEdit.nodeId);
    if(!exists)setMobileInlineEdit(null);
  },[mobileInlineEdit,nodes]);

  useCanvasImageIo({
    wRef,
    toW,
    dispatch:d,
    uid,
    notify:(message,type,duration)=>toasts.push(message,type,duration),
    px,
    py,
    zoom,
  });

  const { laserPts, appendLaserPoint } = useCanvasLaserTrail({ toW });
  const { onPointerDown, onPointerUp } = useTouchPointerCapture({
    isMobile,
    wRef,
    mobilePointerCaptureRef,
  });
  const { touchEvt, touchDistance, touchPoint, beginMobilePress } = useCanvasTouchHelpers({
    isMobile,
    mobileInputRef,
  });
  const { onMouseMove } = useCanvasMouseMoveRaf({
    mouseMovePendingRef,
    mouseMoveRafRef,
    onMove,
  });
  const { scheduleTouchMove, cancelScheduledTouchMove } = useCanvasTouchMoveRaf({
    touchMovePendingRef,
    touchMoveRafRef,
    onMove,
  });
  const { handleTwoFingerGestureEnd } = useTouchGestureUndoRedo({
    pinchRef:pinch,
    mobileInputRef,
    dispatch:d,
  });
  const { consumeLongPressEnd } = useTouchLongPressEnd({
    mobileInputRef,
    dragRef:drag,
    setLasso,
  });

  useCanvasWheelPanZoom({
    wRef,
    dispatch:d,
    px,
    py,
    zoom,
  });

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
  const { consumeDoubleTapEnd } = useTouchDoubleTapEnd({
    mobileInputRef,
    touchMetaRef,
    dragRef:drag,
    toW,
    resolveSmartPlacement,
    dispatch:d,
    createCardNode,
    nodes,
    setMobileInlineEdit,
  });
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
      const sc=getNextStickySwatch();
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
  const { consumeRadialTouchEnd } = useTouchRadialMenuEnd({
    radialMenu,
    resolveRadialActiveId,
    applyRadialAction,
    mobileInputRef,
    setRadialMenu,
    dragRef:drag,
    setLasso,
  });

  function onDown(e){
    handlePointerDown(e);
  }

  function onNodeSel(id,multi,altKey){
    handlePointerNodeSel(id,multi,altKey);
  }

  function onMove(e){
    handlePointerMove(e);
  }

  function onUp(){
    handlePointerUp();
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

  const pts2d=pts=>pts.length<2?"":pts.reduce((a,p,i)=>i===0?`M${p.x},${p.y}`:`${a}L${p.x},${p.y}`,"");
  const gs=GRID*zoom,gox=((px%gs)+gs)%gs,goy=((py%gs)+gs)%gs;
  const cursors={select:"default",pan:"grab",sticky:"cell",text:"text",task:"crosshair",milestone:"crosshair",decision:"crosshair",transform:"crosshair",rect:"crosshair",circle:"crosshair",diamond:"crosshair",triangle:"crosshair",hexagon:"crosshair",parallelogram:"crosshair",cloud:"crosshair",cylinder:"crosshair",table:"crosshair",sheet:"crosshair",deck:"crosshair",laneH:"crosshair",laneV:"crosshair",arrow:"crosshair",draw:"crosshair",comment:"copy",frame:"crosshair",laser:"none",eraser:"crosshair"};
  // Canvas theme
  const cTheme=CANVAS_THEMES.find(t=>t.id===s.canvasTheme);
  const gridDotColor=cTheme?(snapGrid?cTheme.gridSnap:cTheme.grid):(snapGrid?"#2a3d54":"#1a2a3c");
  const gridDotR=cTheme?cTheme.dot:(snapGrid?.9:.65);
  const gridDotOp=cTheme?1:(snapGrid?1:.85);
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
  const { cycleCap, openConnectorMobileMenu, onConnectorCtx } = useConnectorContextMenu({
    connectorById,
    T,
    updateConnector,
    d,
    setSelectedArrow,
    wRef,
    setCtxMenu,
    setMobileCtxMenu,
  });
  const { visiblePortNodes, getPortPointsForNode, startPortConnect, previewConnectorPath } = usePortConnectController({
    hoverNodeId,
    sel,
    portConnect,
    setPortConnect,
    visibleNodes,
    DEFAULT_PORTS,
    getPortWorldPosition,
    nodes,
    d,
    toW,
    buildConnectorFromDefaults,
    addNodeAndConnector,
    triggerConnectorSnapFx,
    zoom,
  });
  const {
    onDown: handlePointerDown,
    onNodeSel: handlePointerNodeSel,
    onMove: handlePointerMove,
    onUp: handlePointerUp,
  } = useCanvasPointerController({
    setCtxMenu,
    setMobileCtxMenu,
    setRadialMenu,
    setSmartConnectSuggestion,
    setSelectedArrow,
    setSelectedConnectorIds,
    tool,
    sel,
    nodes,
    setCommentInput,
    toW,
    dPath,
    drag,
    dispatch:d,
    zoom,
    px,
    py,
    lasso,
    setLasso,
    isMobile,
    resolveSmartPlacement,
    snap,
    snapGrid,
    getNextStickySwatch:()=>getNextStickySwatch(),
    uid,
    composeTaskNodeText,
    composeMilestoneNodeText,
    composeDecisionNodeText,
    createTransformNode,
    isDataNodeType,
    buildConnectorFromDefaults,
    T,
    SHAPE_DEFAULTS,
    makeShapeNode,
    makeSheetNode,
    makeDeckNode,
    mobileStayInAdd,
    nextModeAfterAdd,
    toolToMode,
    modeToTool,
    arrowFrom,
    nextModeAfterConnect,
    moved,
    setNodeDragActive,
    wRef,
    setHoverNodeId,
    setGuides,
    resolveSmartConnectCandidate,
    setLivePath,
    appendLaserPoint,
    boardId,
    cursorEmitRef,
    socket,
    dColor,
    visibleNodes,
    connectorVisuals,
  });
  const { makeContextCommands } = useCanvasContextCommands({
    nodes,
    state:s,
    dispatch:d,
    uid,
    T,
    toasts,
    zoom,
    wRef,
    ctxUploadPosRef,
    ctxUploadRef,
    makeShapeNode,
    makeSheetNode,
    makeDeckNode,
    composeTaskNodeText,
    composeMilestoneNodeText,
    composeDecisionNodeText,
    createTransformNode,
    getPortWorldPosition,
    setPortConnect,
    getNextStickySwatch:()=>getNextStickySwatch(),
  });
  const { openContextMenuAt, onCtx, mobileCtxGroups, mobileCtxTitle } = useCanvasContextMenuController({
    wRef,
    toW,
    nodes,
    sel,
    dispatch:d,
    clipboard:s.clipboard,
    makeContextCommands,
    setCtxMenu,
    setMobileCtxMenu,
    mobileCtxMenu,
  });
  const { onCtxUploadImage } = useCanvasContextImageUpload({
    dispatch:d,
    uid,
    ctxUploadPosRef,
    notify:(message,type)=>toasts.push(message,type),
  });
  const { onDblClick } = useCanvasDoubleClickInsert({
    tool,
    toW,
    dispatch:d,
    uid,
    getNextStickySwatch:()=>getNextStickySwatch(),
  });
  const { onRotSt, onRSt } = useCanvasNodeTransformStart({
    nodes,
    wRef,
    zoom,
    px,
    py,
    dragRef:drag,
    dispatch:d,
    setNodeDragActive,
  });
  const { onNodeTouchStart } = useCanvasNodeTouchStart({
    touchMetaRef,
    beginMobilePress,
    tool,
    onNodeSel,
  });
  const { handleTouchStartTarget } = useCanvasTouchStartTarget({
    touchEvt,
    touchMetaRef,
    beginMobilePress,
    setSelectedArrow,
    dragRef:drag,
    onDown,
  });
  const { runTouchMovePrelude, runTouchMoveTail } = useCanvasTouchMoveNonPinch({
    touchPoint,
    mobileInputRef,
    radialMenu,
    resolveRadialActiveId,
    setRadialMenu,
    touchEvt,
    scheduleTouchMove,
  });
  const { handlePinchTouchMove } = useCanvasTouchMovePinch({
    mobileInputRef,
    pinchRef:pinch,
    touchDistance,
    dispatch:d,
  });
  const { handleTwoFingerTouchStart } = useCanvasTouchStartTwoFinger({
    dragRef:drag,
    nodes,
    uid,
    snap,
    snapGrid,
    GRID,
    dispatch:d,
    notify:(message,type)=>toasts.push(message,type),
    mobileInputRef,
    setRadialMenu,
    pinchRef:pinch,
    touchDistance,
    zoom,
    px,
    py,
    setLasso,
  });
  const { onTouchStart } = useCanvasTouchStartHandler({
    handleTwoFingerTouchStart,
    pinchRef:pinch,
    handleTouchStartTarget,
  });
  const { onTouchEnd } = useCanvasTouchEndHandler({
    handleTwoFingerGestureEnd,
    cancelScheduledTouchMove,
    consumeRadialTouchEnd,
    consumeLongPressEnd,
    consumeDoubleTapEnd,
    onUp,
  });
  const { onTouchMove } = useCanvasTouchMoveHandler({
    runTouchMovePrelude,
    handlePinchTouchMove,
    runTouchMoveTail,
  });
  const colorInputBgValue=normalizeColorInputValue(bgColor,getThemeColorHex("--ui-bg0",DEFAULT_CANVAS_BG));

  // Present mode: clip to frame
  const pFrameNode=presentFrame?nodes.find(n=>n.id===presentFrame):null;

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
      <ConnectorRenderer
        connectorVisuals={connectorVisuals}
        selectedConnectorIdSet={selectedConnectorIdSet}
        sel={sel}
        selectedArrow={selectedArrow}
        setSelectedArrow={setSelectedArrow}
        setHoveredConnectorId={setHoveredConnectorId}
        hoveredConnectorId={hoveredConnectorId}
        spreadsheetFlowEdgeSet={spreadsheetFlowEdgeSet}
        dataConnectorIdSet={dataConnectorIdSet}
        dataConnectorErrorById={dataConnectorErrorById}
        deps={deps}
        T={T}
        onConnectorCtx={onConnectorCtx}
        isDataConnector={isDataConnector}
        getConnectorDependencyType={getConnectorDependencyType}
        previewConnectorPath={previewConnectorPath}
      />
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
      <NodeRenderer
        nodeDragActive={nodeDragActive}
        sortedNodes={sortedNodes}
        dataNodeErrorById={dataNodeErrorById}
        sel={sel}
        deps={deps}
        focusSel={focusSel}
        focusSet={focusSet}
        normExecStatus={normExecStatus}
        triggerTaskSuccessFx={triggerTaskSuccessFx}
        onTaskComplete={()=>toasts.push("Task marked complete","success",1800)}
        d={d}
        onNodeSel={onNodeSel}
        onNodeTouchStart={onNodeTouchStart}
        onRSt={onRSt}
        onRotSt={onRotSt}
        votes={votes}
        tool={tool}
        blockedByDepNodeSet={blockedByDepNodeSet}
        milestoneStatsByNode={milestoneStatsByNode}
        isKpiNodeLike={isKpiNodeLike}
        spreadsheetEngine={spreadsheetEngine}
        sheetFormulaSession={sheetFormulaSession}
        sheetFormulaPick={sheetFormulaPick}
        onSheetFormulaSessionChange={onSheetFormulaSessionChange}
        onSheetFormulaReferencePick={onSheetFormulaReferencePick}
        onConsumeSheetFormulaPick={onConsumeSheetFormulaPick}
        formulaHighlightSheetSet={formulaHighlightSheetSet}
        sheetAiAnomalyMapBySheet={sheetAiAnomalyMapBySheet}
        components={{Sticky,TaskNode,MilestoneNode,DecisionNode,TransformNode,ChartNode,KpiNode,Shape,TxtNode,ImgNode,FrameNode,LaneNode,SpreadsheetNode,DeckNode}}
      />

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
      <SelectionOverlay lasso={lasso}/>

      {/* SMART GUIDES */}
      <GuidesOverlay guides={guides} zoom={zoom}/>

      {/* LASER POINTER TRAIL */}
      {tool==="laser"&&laserPts.length>0&&<svg style={{position:"absolute",inset:0,width:10000,height:10000,overflow:"visible",pointerEvents:"none",zIndex:103}}>
        {laserPts.map((p,i)=>{const age=(Date.now()-p.t)/800;return<circle key={i} cx={p.x} cy={p.y} r={4+age*10} fill="none" stroke="#ef4444" strokeWidth={2-age*1.5} opacity={Math.max(0,.9-age)}/>;})}
        {laserPts.length>0&&<circle cx={laserPts[laserPts.length-1].x} cy={laserPts[laserPts.length-1].y} r={5} fill="#ef4444" opacity={.9}/>}
      </svg>}

      {/* COMMENTS */}
      {renderedComments.map(c=><CommentDot key={c.id} c={c} isMobile={isMobile} onDel={id=>d({type:"DEL_COMMENT",id})} onUpdate={(id,patch)=>d({type:"UPDATE_COMMENT",id,patch})}/>)}

      {/* REMOTE CURSORS (world-space coordinates) */}
      {boardId&&<RemoteCursorsView users={collabUsers} T={T}/>}
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

    <ConnectorStylePanels
      isMobile={isMobile}
      selectedArrow={selectedArrow}
      mobileCtxMenu={mobileCtxMenu}
      connectorById={connectorById}
      normalizeConnectorJumpStyle={normalizeConnectorJumpStyle}
      getConnectorDependencyType={getConnectorDependencyType}
      dataConnectorIdSet={dataConnectorIdSet}
      isDataConnector={isDataConnector}
      dataConnectorPreviewById={dataConnectorPreviewById}
      dataConnectorErrorById={dataConnectorErrorById}
      T={T}
      updateConnector={updateConnector}
      formatNumber={formatNumber}
      dependencyTypeLabel={dependencyTypeLabel}
      cycleCap={cycleCap}
      d={d}
      reverseConnector={reverseConnector}
      setSelectedArrow={setSelectedArrow}
      setConnectorStyleAsDefault={setConnectorStyleAsDefault}
      resetConnectorStyleDefault={resetConnectorStyleDefault}
      rememberLastConnectorStyle={rememberLastConnectorStyle}
      setRememberLastConnectorStyle={setRememberLastConnectorStyle}
      zoom={zoom}
      px={px}
      py={py}
    />

    <CanvasHud
      commentInput={commentInput}
      setCommentInput={setCommentInput}
      cmtRef={cmtRef}
      d={d}
      uid={uid}
      ME={ME}
      autoReturnToSelect={autoReturnToSelect}
      T={T}
      zoom={zoom}
      wRef={wRef}
      presentMode={presentMode}
      colorInputBgValue={colorInputBgValue}
      bgColor={bgColor}
      snapGrid={snapGrid}
      GRID={GRID}
      visibleNodes={visibleNodes}
      arrows={arrows}
      tool={tool}
      arrowFrom={arrowFrom}
      sel={sel}
      depMode={depMode}
    />
  </div>;
}





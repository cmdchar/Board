export const DEFAULT_PORTS=[
  {id:"top",xNorm:0.5,yNorm:0},
  {id:"right",xNorm:1,yNorm:0.5},
  {id:"bottom",xNorm:0.5,yNorm:1},
  {id:"left",xNorm:0,yNorm:0.5},
];

const PORT_MAP=Object.fromEntries(DEFAULT_PORTS.map(p=>[p.id,p]));

const clamp01=v=>Math.max(0,Math.min(1,Number.isFinite(Number(v))?Number(v):0));

export function getPortWorldPosition(entityBBox,portId){
  const box=entityBBox||{};
  const x=Number(box.x)||0;
  const y=Number(box.y)||0;
  const w=Math.max(1,Number(box.w)||100);
  const h=Math.max(1,Number(box.h)||60);
  const port=PORT_MAP[String(portId||"").toLowerCase()]||PORT_MAP.right;
  return{
    x:x+w*port.xNorm,
    y:y+h*port.yNorm,
    xNorm:port.xNorm,
    yNorm:port.yNorm,
    portId:port.id,
  };
}

export function getAnchorWorldPosition(entity,anchor){
  if(!entity)return{x:0,y:0,xNorm:0.5,yNorm:0.5,portId:"center"};
  const box={x:entity.x||0,y:entity.y||0,w:entity.w||100,h:entity.h||60};
  if(anchor?.type==="port"){
    return getPortWorldPosition(box,anchor.portId);
  }
  if(anchor?.type==="pos"){
    const xNorm=clamp01(anchor.xNorm);
    const yNorm=clamp01(anchor.yNorm);
    return{
      x:box.x+box.w*xNorm,
      y:box.y+box.h*yNorm,
      xNorm,
      yNorm,
      portId:"pos",
    };
  }
  return{
    x:box.x+box.w*0.5,
    y:box.y+box.h*0.5,
    xNorm:0.5,
    yNorm:0.5,
    portId:"center",
  };
}

export function normalizeConnectorEndpoints(connector){
  const c=connector||{};
  const fromEntityId=c.from?.entityId||c.fromId||"";
  const toEntityId=c.to?.entityId||c.toId||"";
  const fromAnchor=c.from?.anchor||(fromEntityId?{type:"pos",xNorm:0.5,yNorm:0.5}:null);
  const toAnchor=c.to?.anchor||(toEntityId?{type:"pos",xNorm:0.5,yNorm:0.5}:null);
  return{
    fromEntityId,
    toEntityId,
    fromAnchor,
    toAnchor,
  };
}

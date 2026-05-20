const PI2=Math.PI*2;

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

const dist=(a,b)=>Math.hypot((b.x||0)-(a.x||0),(b.y||0)-(a.y||0));

function pointInsideRect(point,rect,padding=0){
  if(!point||!rect)return false;
  const pad=Math.max(0,Number(padding)||0);
  const rx=(rect.x||0)-pad;
  const ry=(rect.y||0)-pad;
  const rw=Math.max(0,(rect.w||0)+pad*2);
  const rh=Math.max(0,(rect.h||0)+pad*2);
  return point.x>=rx&&point.x<=rx+rw&&point.y>=ry&&point.y<=ry+rh;
}

// Liang-Barsky clipping for robust segment-vs-rect intersection.
export function segmentIntersectsRect(a,b,rect,padding=0){
  if(!a||!b||!rect)return false;
  const pad=Math.max(0,Number(padding)||0);
  const rx=(rect.x||0)-pad;
  const ry=(rect.y||0)-pad;
  const rw=Math.max(0,(rect.w||0)+pad*2);
  const rh=Math.max(0,(rect.h||0)+pad*2);
  if(rw<=0||rh<=0)return false;
  if(pointInsideRect(a,{x:rx,y:ry,w:rw,h:rh})||pointInsideRect(b,{x:rx,y:ry,w:rw,h:rh}))return true;
  const x0=Number(a.x)||0;
  const y0=Number(a.y)||0;
  const x1=Number(b.x)||0;
  const y1=Number(b.y)||0;
  const dx=x1-x0;
  const dy=y1-y0;
  const p=[-dx,dx,-dy,dy];
  const q=[x0-rx,rx+rw-x0,y0-ry,ry+rh-y0];
  let t0=0;
  let t1=1;
  for(let i=0;i<4;i++){
    const pi=p[i];
    const qi=q[i];
    if(Math.abs(pi)<0.000001){
      if(qi<0)return false;
      continue;
    }
    const t=qi/pi;
    if(pi<0){
      if(t>t1)return false;
      if(t>t0)t0=t;
    }else{
      if(t<t0)return false;
      if(t<t1)t1=t;
    }
  }
  return t0<=t1&&t0<=1&&t1>=0;
}

export function simplifyPolyline(points){
  if(!Array.isArray(points)||points.length<=2)return Array.isArray(points)?points:[];
  const out=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const p0=out[out.length-1];
    const p1=points[i];
    const p2=points[i+1];
    const v1x=(p1.x||0)-(p0.x||0);
    const v1y=(p1.y||0)-(p0.y||0);
    const v2x=(p2.x||0)-(p1.x||0);
    const v2y=(p2.y||0)-(p1.y||0);
    if(Math.abs(v1x*v2y-v1y*v2x)<0.0001){
      continue;
    }
    out.push(p1);
  }
  out.push(points[points.length-1]);
  return out;
}

export function buildObstacleRects(entities,padding=24){
  if(!Array.isArray(entities)||!entities.length)return[];
  const pad=Math.max(0,Number(padding)||0);
  return entities
    .filter(Boolean)
    .map(node=>{
      const x=Number(node.x)||0;
      const y=Number(node.y)||0;
      const w=Math.max(1,Number(node.w)||1);
      const h=Math.max(1,Number(node.h)||1);
      return{
        id:node.id||"",
        x:x-pad,
        y:y-pad,
        w:w+pad*2,
        h:h+pad*2,
      };
    });
}

const rectIntersects=(a,b)=>a.x<=b.x+b.w&&a.x+a.w>=b.x&&a.y<=b.y+b.h&&a.y+a.h>=b.y;

const pathBounds=(start,end,margin)=>({
  x:Math.min(start.x,end.x)-margin,
  y:Math.min(start.y,end.y)-margin,
  w:Math.abs(end.x-start.x)+margin*2,
  h:Math.abs(end.y-start.y)+margin*2,
});

export function buildObstacleIndex(obstacles,bucketSize=320){
  const size=Math.max(48,Number(bucketSize)||320);
  const map=new Map();
  const items=Array.isArray(obstacles)?obstacles:[];
  const key=(bx,by)=>`${bx}:${by}`;
  for(const obstacle of items){
    if(!obstacle)continue;
    const minBx=Math.floor((obstacle.x||0)/size);
    const maxBx=Math.floor(((obstacle.x||0)+(obstacle.w||0))/size);
    const minBy=Math.floor((obstacle.y||0)/size);
    const maxBy=Math.floor(((obstacle.y||0)+(obstacle.h||0))/size);
    for(let bx=minBx;bx<=maxBx;bx++){
      for(let by=minBy;by<=maxBy;by++){
        const k=key(bx,by);
        if(!map.has(k))map.set(k,[]);
        map.get(k).push(obstacle);
      }
    }
  }
  return{size,map};
}

export function queryObstacleIndex(index,bounds){
  if(!index||!bounds)return[];
  const size=index.size||320;
  const map=index.map||new Map();
  const minBx=Math.floor((bounds.x||0)/size);
  const maxBx=Math.floor(((bounds.x||0)+(bounds.w||0))/size);
  const minBy=Math.floor((bounds.y||0)/size);
  const maxBy=Math.floor(((bounds.y||0)+(bounds.h||0))/size);
  const seen=new Set();
  const out=[];
  for(let bx=minBx;bx<=maxBx;bx++){
    for(let by=minBy;by<=maxBy;by++){
      const list=map.get(`${bx}:${by}`)||[];
      for(const obstacle of list){
        if(!obstacle||seen.has(obstacle))continue;
        seen.add(obstacle);
        if(rectIntersects(obstacle,bounds))out.push(obstacle);
      }
    }
  }
  return out;
}

function roundToGrid(v,origin,size){
  return Math.round((v-origin)/size);
}

function toWorld(gx,origin,size){
  return origin+gx*size;
}

function makeKey(x,y){
  return`${x},${y}`;
}

function parseKey(key){
  const[sx,sy]=String(key).split(",");
  return{x:Number(sx)||0,y:Number(sy)||0};
}

function lineIntersectsRect(a,b,rect){
  const minX=Math.min(a.x,b.x);
  const maxX=Math.max(a.x,b.x);
  const minY=Math.min(a.y,b.y);
  const maxY=Math.max(a.y,b.y);
  const bb={x:minX,y:minY,w:maxX-minX,h:maxY-minY};
  return rectIntersects(bb,rect);
}

function directOrtho(start,end,obstacles){
  const first={x:end.x,y:start.y};
  const second={x:start.x,y:end.y};
  const pathA=[start,first,end];
  const pathB=[start,second,end];
  const intersects=pts=>{
    for(let i=0;i<pts.length-1;i++){
      if((obstacles||[]).some(o=>lineIntersectsRect(pts[i],pts[i+1],o)))return true;
    }
    return false;
  };
  if(!intersects(pathA))return simplifyPolyline(pathA);
  if(!intersects(pathB))return simplifyPolyline(pathB);
  return null;
}

export function routeOrthoAStar(start,end,obstacles,options={}){
  if(!start||!end)return[];
  const grid=Math.max(8,Number(options.gridSize)||32);
  const margin=Math.max(grid*3,Number(options.margin)||160);
  const turnPenalty=Math.max(0,Number(options.turnPenalty)||0.18);
  const relevant=Array.isArray(obstacles)?obstacles:[];
  const direct=directOrtho(start,end,relevant);
  if(direct)return direct;

  const bounds=pathBounds(start,end,margin);
  let minX=bounds.x;
  let minY=bounds.y;
  let maxX=bounds.x+bounds.w;
  let maxY=bounds.y+bounds.h;
  for(const obstacle of relevant){
    minX=Math.min(minX,(obstacle.x||0)-grid*2);
    minY=Math.min(minY,(obstacle.y||0)-grid*2);
    maxX=Math.max(maxX,(obstacle.x||0)+(obstacle.w||0)+grid*2);
    maxY=Math.max(maxY,(obstacle.y||0)+(obstacle.h||0)+grid*2);
  }
  const cols=Math.max(6,Math.ceil((maxX-minX)/grid));
  const rows=Math.max(6,Math.ceil((maxY-minY)/grid));
  const blocked=new Set();
  for(const obstacle of relevant){
    const sx=Math.floor(((obstacle.x||0)-minX)/grid);
    const ex=Math.ceil(((obstacle.x||0)+(obstacle.w||0)-minX)/grid);
    const sy=Math.floor(((obstacle.y||0)-minY)/grid);
    const ey=Math.ceil(((obstacle.y||0)+(obstacle.h||0)-minY)/grid);
    for(let gx=sx;gx<=ex;gx++){
      for(let gy=sy;gy<=ey;gy++){
        if(gx>=0&&gy>=0&&gx<=cols&&gy<=rows){
          blocked.add(makeKey(gx,gy));
        }
      }
    }
  }
  const sx=roundToGrid(start.x,minX,grid);
  const sy=roundToGrid(start.y,minY,grid);
  const ex=roundToGrid(end.x,minX,grid);
  const ey=roundToGrid(end.y,minY,grid);
  const startKey=makeKey(sx,sy);
  const endKey=makeKey(ex,ey);
  blocked.delete(startKey);
  blocked.delete(endKey);

  const h=(x,y)=>Math.abs(ex-x)+Math.abs(ey-y);
  const open=[{x:sx,y:sy,key:startKey,f:0,g:0,dir:""}];
  const bestG=new Map([[startKey,0]]);
  const cameFrom=new Map();
  const cameDir=new Map();
  const dirs=[
    {dx:1,dy:0,d:"r"},
    {dx:-1,dy:0,d:"l"},
    {dx:0,dy:1,d:"d"},
    {dx:0,dy:-1,d:"u"},
  ];
  let found=endKey;
  let guard=0;
  const maxVisited=Math.max(22000,cols*rows*4);

  while(open.length&&guard<maxVisited){
    guard++;
    let bestIndex=0;
    for(let i=1;i<open.length;i++){
      if(open[i].f<open[bestIndex].f)bestIndex=i;
    }
    const current=open.splice(bestIndex,1)[0];
    if(current.key===endKey){
      found=current.key;
      break;
    }
    for(const dir of dirs){
      const nx=current.x+dir.dx;
      const ny=current.y+dir.dy;
      if(nx<0||ny<0||nx>cols||ny>rows)continue;
      const nKey=makeKey(nx,ny);
      if(blocked.has(nKey))continue;
      const turnCost=current.dir&&current.dir!==dir.d?turnPenalty:0;
      const tentativeG=(bestG.get(current.key)||0)+1+turnCost;
      if(tentativeG>=(bestG.get(nKey)||Infinity))continue;
      bestG.set(nKey,tentativeG);
      cameFrom.set(nKey,current.key);
      cameDir.set(nKey,dir.d);
      open.push({
        x:nx,
        y:ny,
        key:nKey,
        dir:dir.d,
        g:tentativeG,
        f:tentativeG+h(nx,ny),
      });
    }
  }

  if(!cameFrom.has(endKey)){
    return simplifyPolyline([start,{x:end.x,y:start.y},end]);
  }

  const points=[];
  let cursor=found;
  points.push(end);
  while(cursor!==startKey){
    const p=parseKey(cursor);
    points.push({
      x:toWorld(p.x,minX,grid),
      y:toWorld(p.y,minY,grid),
    });
    cursor=cameFrom.get(cursor);
    if(!cursor)break;
  }
  points.push(start);
  points.reverse();
  points[0]={x:start.x,y:start.y};
  points[points.length-1]={x:end.x,y:end.y};
  return simplifyPolyline(points);
}

export function pathToSvgOrCanvasPoints(waypoints,cornerRadius=0){
  const pts=Array.isArray(waypoints)?waypoints.filter(Boolean):[];
  if(pts.length<2)return"";
  const radius=Math.max(0,Number(cornerRadius)||0);
  if(radius<=0){
    return pts.reduce((acc,p,i)=>i===0?`M${p.x},${p.y}`:`${acc} L${p.x},${p.y}`,"");
  }
  let d=`M${pts[0].x},${pts[0].y}`;
  for(let i=1;i<pts.length-1;i++){
    const prev=pts[i-1];
    const cur=pts[i];
    const next=pts[i+1];
    const segIn=dist(prev,cur);
    const segOut=dist(cur,next);
    if(segIn<0.001||segOut<0.001){
      d+=` L${cur.x},${cur.y}`;
      continue;
    }
    const r=Math.min(radius,segIn*0.48,segOut*0.48);
    if(r<0.4){
      d+=` L${cur.x},${cur.y}`;
      continue;
    }
    const inUx=(cur.x-prev.x)/segIn;
    const inUy=(cur.y-prev.y)/segIn;
    const outUx=(next.x-cur.x)/segOut;
    const outUy=(next.y-cur.y)/segOut;
    const a={x:cur.x-inUx*r,y:cur.y-inUy*r};
    const b={x:cur.x+outUx*r,y:cur.y+outUy*r};
    d+=` L${a.x},${a.y} Q${cur.x},${cur.y} ${b.x},${b.y}`;
  }
  const last=pts[pts.length-1];
  d+=` L${last.x},${last.y}`;
  return d;
}

export function buildBezierPath(start,end,controlStrategy="auto"){
  if(!start||!end)return"";
  const dx=end.x-start.x;
  const dy=end.y-start.y;
  const len=Math.max(36,Math.hypot(dx,dy)*0.36);
  const horizontal=Math.abs(dx)>=Math.abs(dy);
  const mode=controlStrategy==="horizontal"?"h":controlStrategy==="vertical"?"v":(horizontal?"h":"v");
  let c1;
  let c2;
  if(mode==="h"){
    const dir=Math.sign(dx||1);
    c1={x:start.x+len*dir,y:start.y};
    c2={x:end.x-len*dir,y:end.y};
  }else{
    const dir=Math.sign(dy||1);
    c1={x:start.x,y:start.y+len*dir};
    c2={x:end.x,y:end.y-len*dir};
  }
  return`M${start.x},${start.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`;
}

export function buildWavyPath(basePath,amplitude=8,wavelength=26){
  const pts=Array.isArray(basePath)?basePath.filter(Boolean):[];
  if(pts.length<2)return"";
  const amp=Math.max(0,Number(amplitude)||0);
  const wave=Math.max(8,Number(wavelength)||26);
  if(amp<=0.2)return pathToSvgOrCanvasPoints(pts,0);
  const samples=[];
  let walked=0;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i];
    const b=pts[i+1];
    const seg=dist(a,b);
    if(seg<0.001)continue;
    const steps=Math.max(2,Math.ceil(seg/7));
    const nx=-(b.y-a.y)/seg;
    const ny=(b.x-a.x)/seg;
    for(let s=0;s<=steps;s++){
      if(i>0&&s===0)continue;
      const t=s/steps;
      const baseX=a.x+(b.x-a.x)*t;
      const baseY=a.y+(b.y-a.y)*t;
      const phase=(walked+seg*t)/wave*PI2;
      const wobble=Math.sin(phase)*amp;
      samples.push({
        x:baseX+nx*wobble,
        y:baseY+ny*wobble,
      });
    }
    walked+=seg;
  }
  return samples.reduce((acc,p,i)=>i===0?`M${p.x},${p.y}`:`${acc} L${p.x},${p.y}`,"");
}

const overlapBounds=(a,b)=>a.x<=b.x+b.w&&a.x+a.w>=b.x&&a.y<=b.y+b.h&&a.y+a.h>=b.y;

const segmentBounds=(a,b,pad=0)=>({
  x:Math.min(a.x,b.x)-pad,
  y:Math.min(a.y,b.y)-pad,
  w:Math.abs(b.x-a.x)+pad*2,
  h:Math.abs(b.y-a.y)+pad*2,
});

const cross=(ax,ay,bx,by)=>ax*by-ay*bx;

const pointOnSegment=(a,b,t)=>({
  x:a.x+(b.x-a.x)*t,
  y:a.y+(b.y-a.y)*t,
});

function intersectSegments(segA,segB){
  const p=segA.a;
  const q=segB.a;
  const rx=segA.dx;
  const ry=segA.dy;
  const sx=segB.dx;
  const sy=segB.dy;
  const denom=cross(rx,ry,sx,sy);
  if(Math.abs(denom)<0.000001)return null;
  const qpx=q.x-p.x;
  const qpy=q.y-p.y;
  const t=cross(qpx,qpy,sx,sy)/denom;
  const u=cross(qpx,qpy,rx,ry)/denom;
  if(t<=0.0005||t>=0.9995||u<=0.0005||u>=0.9995)return null;
  return{
    x:p.x+rx*t,
    y:p.y+ry*t,
    t,
    u,
  };
}

export function buildSegmentSpatialIndex(segments,bucketSize=220){
  const size=Math.max(24,Number(bucketSize)||220);
  const map=new Map();
  const key=(bx,by)=>`${bx}:${by}`;
  const list=Array.isArray(segments)?segments:[];
  for(let i=0;i<list.length;i++){
    const seg=list[i];
    if(!seg)continue;
    const minBx=Math.floor(seg.bounds.x/size);
    const maxBx=Math.floor((seg.bounds.x+seg.bounds.w)/size);
    const minBy=Math.floor(seg.bounds.y/size);
    const maxBy=Math.floor((seg.bounds.y+seg.bounds.h)/size);
    for(let bx=minBx;bx<=maxBx;bx++){
      for(let by=minBy;by<=maxBy;by++){
        const k=key(bx,by);
        if(!map.has(k))map.set(k,[]);
        map.get(k).push(i);
      }
    }
  }
  return{size,map,segments:list};
}

export function querySegmentSpatialIndex(index,bounds){
  if(!index||!bounds)return[];
  const size=index.size||220;
  const map=index.map||new Map();
  const minBx=Math.floor(bounds.x/size);
  const maxBx=Math.floor((bounds.x+bounds.w)/size);
  const minBy=Math.floor(bounds.y/size);
  const maxBy=Math.floor((bounds.y+bounds.h)/size);
  const out=[];
  const seen=new Set();
  for(let bx=minBx;bx<=maxBx;bx++){
    for(let by=minBy;by<=maxBy;by++){
      const list=map.get(`${bx}:${by}`)||[];
      for(const idx of list){
        if(seen.has(idx))continue;
        seen.add(idx);
        out.push(idx);
      }
    }
  }
  return out;
}

function connectorPriority(metaA,metaB){
  if(metaA.z!==metaB.z)return metaA.z-metaB.z;
  if(metaA.created!==metaB.created)return metaA.created-metaB.created;
  if(metaA.order!==metaB.order)return metaA.order-metaB.order;
  return String(metaA.id||"").localeCompare(String(metaB.id||""));
}

function buildConnectorSegments(connectors){
  const out=[];
  const metaByConnector=new Map();
  (Array.isArray(connectors)?connectors:[]).forEach((connector,order)=>{
    if(!connector||!(connector.routing==="ortho"||connector.routing==="straight"))return;
    const pts=Array.isArray(connector.routePoints)&&connector.routePoints.length>=2
      ?connector.routePoints
      :[connector.start,connector.end].filter(Boolean);
    if(pts.length<2)return;
    const source=connector.source||{};
    metaByConnector.set(connector.id,{
      id:connector.id,
      z:Number(source.zIndex)||0,
      created:Number(source.createdAt||source.created_at)||0,
      order,
      jumpStyle:String(connector.jumpStyle||source.jumpStyle||"auto").toLowerCase(),
    });
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i];
      const b=pts[i+1];
      if(!a||!b)continue;
      const dx=(b.x||0)-(a.x||0);
      const dy=(b.y||0)-(a.y||0);
      const len=Math.hypot(dx,dy);
      if(len<1)continue;
      out.push({
        connectorId:connector.id,
        segmentIndex:i,
        a:{x:Number(a.x)||0,y:Number(a.y)||0},
        b:{x:Number(b.x)||0,y:Number(b.y)||0},
        dx,
        dy,
        len,
        bounds:segmentBounds(a,b,0.5),
      });
    }
  });
  return{segments:out,metaByConnector};
}

function selectJumpOwner(segA,segB,metaByConnector,countByConnector,maxJumpsPerConnector){
  const metaA=metaByConnector.get(segA.connectorId);
  const metaB=metaByConnector.get(segB.connectorId);
  if(!metaA||!metaB)return null;
  const ranked=connectorPriority(metaA,metaB)>=0
    ?[{seg:segA,meta:metaA,other:segB},{seg:segB,meta:metaB,other:segA}]
    :[{seg:segB,meta:metaB,other:segA},{seg:segA,meta:metaA,other:segB}];
  for(const candidate of ranked){
    if(candidate.meta.jumpStyle==="off")continue;
    if((countByConnector.get(candidate.seg.connectorId)||0)>=maxJumpsPerConnector)continue;
    return candidate;
  }
  return null;
}

export function segmentsToIntersections(connectors,options={}){
  const endpointClearance=Math.max(4,Number(options.endpointClearance)||12);
  const maxJumpsPerConnector=Math.max(1,Number(options.maxJumpsPerConnector)||20);
  const maxChecks=Math.max(500,Number(options.maxChecks)||25000);
  const jumpMap=new Map();
  const countByConnector=new Map();
  const{segments,metaByConnector}=buildConnectorSegments(connectors);
  if(!segments.length)return jumpMap;
  const index=buildSegmentSpatialIndex(segments,options.bucketSize||220);
  let checks=0;
  for(let i=0;i<segments.length;i++){
    const segA=segments[i];
    const candidates=querySegmentSpatialIndex(index,segA.bounds);
    for(const j of candidates){
      if(j<=i)continue;
      if(checks++>maxChecks)return jumpMap;
      const segB=segments[j];
      if(!segB||segA.connectorId===segB.connectorId)continue;
      if(!overlapBounds(segA.bounds,segB.bounds))continue;
      const hit=intersectSegments(segA,segB);
      if(!hit)continue;
      const aEdge=Math.min(hit.t*segA.len,(1-hit.t)*segA.len);
      const bEdge=Math.min(hit.u*segB.len,(1-hit.u)*segB.len);
      if(aEdge<endpointClearance||bEdge<endpointClearance)continue;
      const owner=selectJumpOwner(segA,segB,metaByConnector,countByConnector,maxJumpsPerConnector);
      if(!owner)continue;
      const ownerIsA=owner.seg===segA;
      const t=ownerIsA?hit.t:hit.u;
      const other=owner.other;
      const normalSign=Math.sign(cross(owner.seg.dx,owner.seg.dy,other.dx,other.dy))||1;
      const list=jumpMap.get(owner.seg.connectorId)||[];
      list.push({
        x:hit.x,
        y:hit.y,
        segmentIndex:owner.seg.segmentIndex,
        t,
        normalSign,
      });
      jumpMap.set(owner.seg.connectorId,list);
      countByConnector.set(owner.seg.connectorId,(countByConnector.get(owner.seg.connectorId)||0)+1);
    }
  }
  return jumpMap;
}

export function applyJumpsToPath(points,intersections,options={}){
  const pts=Array.isArray(points)?points.filter(Boolean):[];
  if(pts.length<2)return"";
  const jumps=Array.isArray(intersections)?intersections:[];
  const radius=Math.max(2,Math.min(18,Number(options.jumpRadius)||7));
  const spacing=Math.max(radius*1.5,Number(options.jumpSpacing)||radius*2.2);
  if(!jumps.length){
    return pathToSvgOrCanvasPoints(pts,0);
  }
  const bySegment=new Map();
  for(const jump of jumps){
    const segIndex=Number(jump?.segmentIndex);
    if(!Number.isInteger(segIndex)||segIndex<0||segIndex>=pts.length-1)continue;
    if(!bySegment.has(segIndex))bySegment.set(segIndex,[]);
    bySegment.get(segIndex).push(jump);
  }
  let d=`M${pts[0].x},${pts[0].y}`;
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i];
    const b=pts[i+1];
    const dx=(b.x||0)-(a.x||0);
    const dy=(b.y||0)-(a.y||0);
    const len=Math.hypot(dx,dy);
    if(len<0.001){
      d+=` L${b.x},${b.y}`;
      continue;
    }
    const ux=dx/len;
    const uy=dy/len;
    const nx=-uy;
    const ny=ux;
    const segJumps=(bySegment.get(i)||[])
      .map(j=>({t:Math.max(0,Math.min(1,Number(j.t)||0)),normalSign:Math.sign(Number(j.normalSign)||1)||1}))
      .sort((p,q)=>p.t-q.t);
    if(!segJumps.length){
      d+=` L${b.x},${b.y}`;
      continue;
    }
    let cursorDist=0;
    let lastJumpCenter=-Infinity;
    for(const jump of segJumps){
      const centerDist=jump.t*len;
      if(centerDist-lastJumpCenter<spacing)continue;
      const inDist=Math.max(cursorDist,centerDist-radius);
      const outDist=Math.min(len,centerDist+radius);
      if(outDist-inDist<radius*0.65)continue;
      const inPt=pointOnSegment(a,b,inDist/len);
      const outPt=pointOnSegment(a,b,outDist/len);
      d+=` L${inPt.x},${inPt.y}`;
      const midDist=(inDist+outDist)*0.5;
      const midPt=pointOnSegment(a,b,midDist/len);
      const lift=(radius*1.15)*jump.normalSign;
      const ctrlX=midPt.x+nx*lift;
      const ctrlY=midPt.y+ny*lift;
      d+=` Q${ctrlX},${ctrlY} ${outPt.x},${outPt.y}`;
      cursorDist=outDist;
      lastJumpCenter=centerDist;
    }
    if(cursorDist<len-0.001){
      d+=` L${b.x},${b.y}`;
    }
  }
  return d;
}

export function connectorMidpoint(waypoints){
  const pts=Array.isArray(waypoints)?waypoints.filter(Boolean):[];
  if(!pts.length)return{x:0,y:0};
  if(pts.length===1)return{x:pts[0].x,y:pts[0].y};
  let total=0;
  for(let i=0;i<pts.length-1;i++)total+=dist(pts[i],pts[i+1]);
  const half=total*0.5;
  let walk=0;
  for(let i=0;i<pts.length-1;i++){
    const seg=dist(pts[i],pts[i+1]);
    if(walk+seg>=half){
      const t=(half-walk)/Math.max(0.001,seg);
      return{
        x:pts[i].x+(pts[i+1].x-pts[i].x)*t,
        y:pts[i].y+(pts[i+1].y-pts[i].y)*t,
      };
    }
    walk+=seg;
  }
  const last=pts[pts.length-1];
  return{x:last.x,y:last.y};
}

export function defaultConnectorPath(start,end,routing,style,routePoints){
  const normalizedRouting=routing||"straight";
  if(normalizedRouting==="curved"){
    return buildBezierPath(start,end,"auto");
  }
  if(normalizedRouting==="wavy"){
    return buildWavyPath(routePoints||[start,end],style?.waveAmplitude,style?.waveLength);
  }
  if(normalizedRouting==="ortho"){
    return pathToSvgOrCanvasPoints(routePoints||[start,end],style?.cornerRadius||0);
  }
  return pathToSvgOrCanvasPoints(routePoints||[start,end],0);
}

export function clampCanvasPoint(point){
  return{
    x:clamp(Number(point?.x)||0,-50000,50000),
    y:clamp(Number(point?.y)||0,-50000,50000),
  };
}

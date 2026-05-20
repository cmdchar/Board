import assert from "node:assert/strict";
import { getPortWorldPosition, normalizeConnectorEndpoints } from "../src/lib/geometry/connectors/anchors.js";
import { normalizeConnectorDefaultStyle, normalizeConnectorJumpStyle, normalizeConnectorStyle } from "../src/lib/geometry/connectors/model.js";
import { applyJumpsToPath, buildSegmentSpatialIndex, querySegmentSpatialIndex, routeOrthoAStar, segmentIntersectsRect, segmentsToIntersections } from "../src/lib/geometry/connectors/routing.js";

function testPorts(){
  const box={x:10,y:20,w:200,h:100};
  const top=getPortWorldPosition(box,"top");
  const right=getPortWorldPosition(box,"right");
  const bottom=getPortWorldPosition(box,"bottom");
  const left=getPortWorldPosition(box,"left");
  assert.deepEqual({x:top.x,y:top.y},{x:110,y:20});
  assert.deepEqual({x:right.x,y:right.y},{x:210,y:70});
  assert.deepEqual({x:bottom.x,y:bottom.y},{x:110,y:120});
  assert.deepEqual({x:left.x,y:left.y},{x:10,y:70});
}

function testRouting(){
  const start={x:0,y:0};
  const end={x:240,y:0};
  const obstacles=[{id:"obs",x:90,y:-24,w:60,h:48}];
  const path=routeOrthoAStar(start,end,obstacles,{gridSize:24,margin:120});
  assert.ok(Array.isArray(path)&&path.length>=3,"A* should provide a routed polyline");
  assert.equal(path[0].x,start.x);
  assert.equal(path[0].y,start.y);
  assert.equal(path[path.length-1].x,end.x);
  assert.equal(path[path.length-1].y,end.y);
  const hasDetour=path.some(p=>Math.abs(p.y)>0.001);
  assert.ok(hasDetour,"path should detour around blocking obstacle");
}

function testBackCompat(){
  const legacy={id:"c1",fromId:"n1",toId:"n2",style:"dashed",width:3,color:"#0ea5e9",startArrow:true,endArrow:false};
  const ep=normalizeConnectorEndpoints(legacy);
  assert.equal(ep.fromEntityId,"n1");
  assert.equal(ep.toEntityId,"n2");
  const style=normalizeConnectorStyle(legacy);
  assert.equal(style.dash,"dashed");
  assert.equal(style.width,3);
  assert.equal(style.stroke,"#0ea5e9");
  assert.equal(style.startCap,"arrow");
  assert.equal(style.endCap,"none");
}

function testDefaultStyleNormalization(){
  const preset=normalizeConnectorDefaultStyle({
    routing:"curve",
    style:{width:4,dash:"dotted",stroke:"#22c55e"},
    jumpStyle:"on",
  });
  assert.equal(preset.routing,"curved");
  assert.equal(preset.style.width,4);
  assert.equal(preset.style.dash,"dotted");
  assert.equal(preset.style.stroke,"#22c55e");
  assert.equal(preset.jumpStyle,"on");
  assert.equal(normalizeConnectorJumpStyle("bad"),"auto");
}

function testSegmentSpatialIndex(){
  const segments=[
    {bounds:{x:0,y:0,w:100,h:20}},
    {bounds:{x:220,y:200,w:60,h:60}},
    {bounds:{x:80,y:-20,w:40,h:140}},
  ];
  const index=buildSegmentSpatialIndex(segments,80);
  const near=querySegmentSpatialIndex(index,{x:10,y:-10,w:120,h:60});
  assert.ok(near.includes(0));
  assert.ok(near.includes(2));
  assert.ok(!near.includes(1));
}

function testLineJumps(){
  const connectors=[
    {
      id:"a",
      routing:"ortho",
      jumpStyle:"auto",
      routePoints:[{x:0,y:0},{x:140,y:0}],
      start:{x:0,y:0},
      end:{x:140,y:0},
      source:{id:"a"},
    },
    {
      id:"b",
      routing:"ortho",
      jumpStyle:"auto",
      routePoints:[{x:70,y:-80},{x:70,y:80}],
      start:{x:70,y:-80},
      end:{x:70,y:80},
      source:{id:"b"},
    },
  ];
  const jumpMap=segmentsToIntersections(connectors,{endpointClearance:10,maxJumpsPerConnector:5,bucketSize:64,maxChecks:2000});
  const jumps=jumpMap.get("b")||[];
  assert.equal(jumps.length,1);
  const path=applyJumpsToPath(connectors[1].routePoints,jumps,{jumpRadius:8,jumpSpacing:12});
  assert.ok(path.startsWith("M70,-80"),"jump path should start at source point");
  assert.ok(path.includes("Q"),"jump path should contain a bridge curve");
}

function testSegmentRectIntersection(){
  const rect={x:50,y:50,w:80,h:60};
  assert.equal(segmentIntersectsRect({x:0,y:0},{x:200,y:200},rect),true);
  assert.equal(segmentIntersectsRect({x:0,y:0},{x:40,y:40},rect),false);
}

testPorts();
testRouting();
testBackCompat();
testDefaultStyleNormalization();
testSegmentSpatialIndex();
testLineJumps();
testSegmentRectIntersection();
console.log("connector tests: ok");

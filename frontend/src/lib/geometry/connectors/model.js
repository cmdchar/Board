export const CONNECTOR_DEFAULT_STYLE={
  stroke:"#64748b",
  width:1.8,
  dash:"solid",
  startCap:"none",
  endCap:"arrow",
  cornerRadius:12,
  waveAmplitude:8,
  waveLength:26,
};

export const CONNECTOR_ROUTINGS=["straight","ortho","curved","wavy"];
export const CONNECTOR_JUMP_STYLES=["auto","on","off"];
export const CONNECTOR_DEFAULT_JUMP_STYLE="auto";
export const CONNECTOR_DEFAULT_PRESET={
  routing:"straight",
  style:{...CONNECTOR_DEFAULT_STYLE},
  jumpStyle:CONNECTOR_DEFAULT_JUMP_STYLE,
};

export function normalizeConnectorRouting(raw){
  const v=String(raw||"").toLowerCase();
  if(v==="elbow")return"ortho";
  if(v==="curve")return"curved";
  if(CONNECTOR_ROUTINGS.includes(v))return v;
  return"straight";
}

export function normalizeConnectorJumpStyle(raw,fallback=CONNECTOR_DEFAULT_JUMP_STYLE){
  const v=String(raw||"").toLowerCase();
  if(v==="auto"||v==="on"||v==="off")return v;
  return fallback;
}

export function normalizeConnectorCap(raw,fallback){
  const v=String(raw||"").toLowerCase();
  if(v==="arrow"||v==="triangle"||v==="circle"||v==="none")return v;
  return fallback;
}

export function normalizeConnectorDash(raw,fallback="solid"){
  const v=String(raw||"").toLowerCase();
  if(v==="solid"||v==="dashed"||v==="dotted")return v;
  return fallback;
}

export function resolveLegacyStyle(connector){
  if(!connector)return{};
  const legacyDash=connector.style&&typeof connector.style==="string"?connector.style:"";
  const startCap=connector.startArrow===true?"arrow":undefined;
  const endCap=connector.endArrow===false?"none":undefined;
  return{
    stroke:connector.color,
    width:connector.width,
    dash:legacyDash||undefined,
    startCap,
    endCap,
  };
}

export function normalizeConnectorStyle(connector){
  const legacy=resolveLegacyStyle(connector);
  const styleObj=(connector&&typeof connector.style==="object"&&connector.style)?connector.style:{};
  const merged={
    ...CONNECTOR_DEFAULT_STYLE,
    ...legacy,
    ...styleObj,
  };
  return{
    stroke:String(merged.stroke||CONNECTOR_DEFAULT_STYLE.stroke),
    width:Math.max(1,Math.min(12,Number(merged.width)||CONNECTOR_DEFAULT_STYLE.width)),
    dash:normalizeConnectorDash(merged.dash,CONNECTOR_DEFAULT_STYLE.dash),
    startCap:normalizeConnectorCap(merged.startCap,CONNECTOR_DEFAULT_STYLE.startCap),
    endCap:normalizeConnectorCap(merged.endCap,CONNECTOR_DEFAULT_STYLE.endCap),
    cornerRadius:Math.max(0,Math.min(48,Number(merged.cornerRadius)||CONNECTOR_DEFAULT_STYLE.cornerRadius)),
    waveAmplitude:Math.max(0,Math.min(48,Number(merged.waveAmplitude)||CONNECTOR_DEFAULT_STYLE.waveAmplitude)),
    waveLength:Math.max(8,Math.min(240,Number(merged.waveLength)||CONNECTOR_DEFAULT_STYLE.waveLength)),
  };
}

export function normalizeConnectorDefaultStyle(raw){
  const source=(raw&&typeof raw==="object")?raw:{};
  return{
    routing:normalizeConnectorRouting(source.routing),
    style:normalizeConnectorStyle({style:(source.style&&typeof source.style==="object")?source.style:{}}),
    jumpStyle:normalizeConnectorJumpStyle(source.jumpStyle,CONNECTOR_DEFAULT_JUMP_STYLE),
  };
}

export function dashArrayForStyle(dash,width){
  if(dash==="dashed")return`${Math.max(4,width*3)} ${Math.max(3,width*2)}`;
  if(dash==="dotted")return`${Math.max(1,width)} ${Math.max(3,width*2.5)}`;
  return"none";
}

export function connectorCapMarkerId(cap,isStart=false){
  const side=isStart?"start":"end";
  if(cap==="arrow")return`url(#connector-cap-arrow-${side})`;
  if(cap==="triangle")return`url(#connector-cap-triangle-${side})`;
  if(cap==="circle")return`url(#connector-cap-circle-${side})`;
  return undefined;
}

export function withConnectorStylePatch(connector,patch){
  const current=normalizeConnectorStyle(connector);
  return{
    ...patch,
    style:{
      ...current,
      ...(patch&&patch.style?patch.style:{}),
    },
  };
}

export function reverseConnector(connector){
  const from=(connector&&connector.from)?{...connector.from}:null;
  const to=(connector&&connector.to)?{...connector.to}:null;
  const fromId=connector?.fromId||connector?.from?.entityId||"";
  const toId=connector?.toId||connector?.to?.entityId||"";
  return{
    fromId:toId,
    toId:fromId,
    from:to,
    to:from,
  };
}

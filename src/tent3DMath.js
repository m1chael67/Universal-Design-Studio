// Deterministic, dependency-free layout conversion for the 3D concept viewer.
// The interior editor uses X along tent length and Y across tent width.
const finite=(n,d=0)=>Number.isFinite(Number(n))?Number(n):d;
export const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export function tentDimensions(tent){
  return {length:clamp(finite(tent?.length,40),2,250),width:clamp(finite(tent?.width,20),2,250)};
}
const originalWallMap={top:'left',right:'top',bottom:'right',left:'bottom'};
export function normalizedInterior(tent){
  const {length,width}=tentDimensions(tent);
  const interior=tent?.interior||{};
  const old=interior.orientation!=='landscape-v1';
  const objects=(Array.isArray(interior.objects)?interior.objects:[]).slice(0,350).map(o=>{
    const x=finite(o.x),y=finite(o.y);
    return {...o,x:old?y:x,y:old?width-x:y,rot:old?((finite(o.rot)-90)%360+360)%360:finite(o.rot)};
  });
  const doors=(Array.isArray(interior.doors)?interior.doors:[]).slice(0,40).map(d=>{
    if(!old)return {...d};
    return {...d,wall:originalWallMap[d.wall]||'left',
      at:d.wall==='top'||d.wall==='bottom'?width-finite(d.at):finite(d.at)};
  });
  const input=interior.sidewalls||{};
  const sidewalls=old?{
    top:Boolean(input.right),right:Boolean(input.bottom),bottom:Boolean(input.left),left:Boolean(input.top)
  }:{
    top:Boolean(input.top),right:Boolean(input.right),bottom:Boolean(input.bottom),left:Boolean(input.left)
  };
  return {objects,doors,sidewalls,length,width};
}
export function getWallSegments(wall,doors,length,width){
  const span=wall==='top'||wall==='bottom'?length:width;
  const openings=(doors||[]).filter(d=>d.wall===wall).map(d=>{
    const at=clamp(finite(d.at),0,span),w=clamp(finite(d.width,5),1,Math.min(span,30));
    return {start:clamp(at-w/2,0,span),end:clamp(at+w/2,0,span)};
  }).filter(g=>g.end>g.start).sort((a,b)=>a.start-b.start);
  const segments=[];
  let cursor=0;
  for(const gap of openings){
    if(gap.start>cursor+0.01)segments.push({start:cursor,end:gap.start});
    cursor=Math.max(cursor,gap.end);
  }
  if(cursor<span-0.01)segments.push({start:cursor,end:span});
  return {segments,openings,span};
}
export function objectPosition(o,length,width){
  return {x:clamp(finite(o.x,length/2),-30,length+30)-length/2,
    z:clamp(finite(o.y,width/2),-30,width+30)-width/2,
    rotation:finite(o.rot)*Math.PI/180};
}

export function sitePlacements(tents){
  const valid=(Array.isArray(tents)?tents:[]).filter(t=>
    t.lng!=null&&t.lat!=null&&Number.isFinite(Number(t.lng))&&Number.isFinite(Number(t.lat))&&
    Math.abs(Number(t.lat))<=85&&Math.abs(Number(t.lng))<=180
  ).slice(0,75);
  if(!valid.length)return [];
  const originLng=valid.reduce((n,t)=>n+Number(t.lng),0)/valid.length;
  const originLat=valid.reduce((n,t)=>n+Number(t.lat),0)/valid.length;
  const cos=Math.max(.1,Math.cos(originLat*Math.PI/180));
  return valid.map(t=>{
    const x=clamp((Number(t.lng)-originLng)*111319.49*3.280839895*cos,-10000,10000);
    const z=clamp(-(Number(t.lat)-originLat)*111132.92*3.280839895,-10000,10000);
    const theta=(90-finite(t.rotation))*Math.PI/180;
    return {tent:t,x,z,theta};
  });
}
export function siteRadius(tents){
  const placements=sitePlacements(tents);
  return Math.max(20,...placements.map(p=>{
    const {length,width}=tentDimensions(p.tent);
    return Math.hypot(p.x,p.z)+Math.hypot(length,width)/2;
  }));
}

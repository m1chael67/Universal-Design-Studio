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

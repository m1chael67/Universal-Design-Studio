// Feet-based 3D camera: orbit the centered tent outdoors; move the eye indoors.
export const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
// Eye-level, first-person lens: turn your head rather than swinging on a long arm.
export const WALK_FOV=60;
export const PERSPECTIVE_FOV=48;
export function exteriorPose(length,width,eave,aspect=1.4,siteExtent=0){
  const ratio=clamp(Number(aspect)||1,0.4,4);
  const vfov=PERSPECTIVE_FOV*Math.PI/180,hfov=2*Math.atan(Math.tan(vfov/2)*ratio);
  const L=siteExtent>0?siteExtent*2:length,W=siteExtent>0?siteExtent*2:width;
  const projected=L*.74+W*.4;
  const height=eave+Math.min(width*.25,14);
  const distance=Math.max(13,projected/(2*Math.tan(hfov/2))*1.14,
    (height+W*.38)/(2*Math.tan(vfov/2))*1.2);
  const target={x:0,y:Math.min(eave*.55,5),z:0};
  return {distance,target,position:{x:distance*.36,y:target.y+distance*.43,z:distance*.83}};
}
export function walkStart(length,width,eave){
  const margin=Math.min(2,Math.min(length,width)*.12);
  return {x:-length/2+margin+Math.min(3,length*.18),
    y:clamp(eave-1.5,3,5.5),z:0};
}
export function walkEye(position,length,width,eave){
  const margin=Math.min(2,Math.min(length,width)*.12);
  return {x:clamp(position.x,-length/2+margin,length/2-margin),
    y:clamp(eave-1.5,3,5.5),z:clamp(position.z,-width/2+margin,width/2-margin)};
}
export function walkDirection(yaw,pitch){
  const c=Math.cos(pitch);
  return {x:Math.cos(yaw)*c,y:Math.sin(pitch),z:Math.sin(yaw)*c};
}
export function walkTarget(position,yaw,pitch){
  const v=walkDirection(yaw,pitch);
  return {x:position.x+5*v.x,y:position.y+5*v.y,z:position.z+5*v.z};
}
export function dragLook(look,dx,dy){
  return {yaw:look.yaw-Number(dx)*.0022,
    pitch:clamp(look.pitch+Number(dy)*.0022,-1.4,1.4)};
}

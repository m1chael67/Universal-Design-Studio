// West Coast FRAME geometry reference: Tentandtable 20 x 40 installation
// https://www.tentandtable.net/media/tnt/instructions/Assembly_WCF_10w_20w_rev3-NN.pdf
// This is an illustrative geometry profile, not a manufacturer-specific parts list.
import {clamp} from './tent3DMath.js';
export function westCoastProfile(length,width,eave=7){
  const span=Math.min(length,width);
  // Standard West Coast 20-foot wide manuals show a 5-foot roof rise.
  // The hip ridge begins approximately half the width in from each end.
  const rise=span*.25;
  const hip=Math.min(span/2,length/2);
  const left=-length/2+hip,right=length/2-hip;
  const bays=Math.max(1,Math.ceil(length/10));
  const xs=Array.from({length:bays+1},(_,i)=>-length/2+length*i/bays);
  const ridgeXs=[left,right,...xs.filter(x=>x>left+.01&&x<right-.01)].sort((a,b)=>a-b);
  return {length,width,eave,ridge:eave+rise,rise,hip,left,right,
    xs,ridgeXs:[...new Set(ridgeXs.map(x=>Number(x.toFixed(5))))],
    legXs:xs,legCount:2*(bays+1),bayCount:bays,
    exactTenFootBays:Math.abs(length/10-Math.round(length/10))<.0001};
}
export function constrainedWalkPosition(position,target,length,width,eave=7){
  const margin=Math.min(2,Math.min(length,width)*.12);
  const xMin=-length/2+margin,xMax=length/2-margin;
  const zMin=-width/2+margin,zMax=width/2-margin;
  const height=clamp(eave-1.5,3,5.5);
  return {
    position:{x:clamp(position.x,xMin,xMax),y:height,z:clamp(position.z,zMin,zMax)},
    target:{x:clamp(target.x,xMin,xMax),y:height,z:clamp(target.z,zMin,zMax)}
  };
}

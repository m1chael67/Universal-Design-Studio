// Celina Classic / ETS West Coast FRAME family: visual center-to-center geometry.
// Celina Layout Handbook (5th ed.), Classic Series Frame pp. 9–30:
// https://celinaeurope.com/wp-content/uploads/2025/06/layout-handbook.pdf
// Celina 20x40 Classic: https://www.ecanopy.com/files/Manuals/celinatent20x40framedirections.pdf
// Celina 30x60 ETS: https://www.ecanopy.com/files/Manuals/celinatent30x60etsframetentinstructions.pdf
// Celina 40x80 ETS: https://www.ecanopy.com/files/Manuals/celinatent40x80etsframetentinstructions.pdf
// Tube CUT lengths are shorter than nominal spans due to fitting insertion.
// This model is not a BOM, a structural design, or manufacturer installation instructions.
import {clamp} from './tent3DMath.js';

const profiles={
  10:{pitch:2.5,bay:10,endSpans:[],family:'Celina Classic 10 ft'},
  15:{pitch:3.75,bay:15,endSpans:[],family:'Celina Classic 15 ft'},
  20:{pitch:5,bay:10,endSpans:[0],family:'Celina Classic 20 ft'},
  30:{pitch:8,bay:15,endSpans:[0],family:'Celina Classic/ETS 30 ft'},
  40:{pitch:10,bay:10,endSpans:[-10,0,10],family:'Celina ETS double-tube 40 ft'}
};
const round=n=>Number(n.toFixed(5));
function frameSpans(length,width,family){
  if(family===30&&(length===40||length===50)){
    return length===40?[15,10,15]:[15,10,10,15];
  }
  if(family===15){
    const celinaMixed={
      20:[10,10],40:[15,10,15],50:[15,10,10,15],
      70:[15,15,10,15,15],80:[15,15,10,10,15,15],
      100:[15,15,15,10,15,15,15],
      110:[15,15,15,10,10,15,15,15]
    };
    if(celinaMixed[length])return celinaMixed[length];
  }
  const bay=profiles[family]?.bay||Math.min(20,Math.max(5,Math.floor(width/2)));
  // Unsupported lengths remain an explicit *approximation*, never labeled Celina BOM.
  const count=Math.max(1,Math.round(length/bay));
  return Array.from({length:count},()=>length/count);
}
export function westCoastProfile(length,width,eave=7){
  length=clamp(Number(length)||40,2,250);
  width=clamp(Number(width)||20,2,250);
  eave=clamp(Number(eave)||7,3,25);
  const family=profiles[width]?width:null;
  const cfg=profiles[family]||null;
  const span=Math.min(length,width);
  const rise=cfg?cfg.pitch:span*.25;
  const hip=Math.min(width/2,length/2);
  const left=-length/2+hip,right=length/2-hip;
  const lengths=frameSpans(length,width,family);
  const xs=[-length/2];
  for(const segment of lengths)xs.push(round(xs.at(-1)+segment));
  xs[xs.length-1]=length/2;
  const ridgeXs=[left,right,...xs.filter(x=>x>left+.01&&x<right-.01)]
    .map(round).sort((a,b)=>a-b).filter((x,i,arr)=>!i||Math.abs(x-arr[i-1])>.01);
  const legXs=xs;
  const endLegZs=(cfg?.endSpans||[]).filter(z=>Math.abs(z)<width/2);
  // For 40-ft Celina ETS: four quarter-hip joints, with branches to end and side tees.
  const hipJoints=family===40?[-1,1].flatMap(sign=>[-1,1].map(side=>({
    x:sign*(length/2-10),z:side*10,y:eave+rise*.5
  }))):[];
  const supported=Boolean(cfg)&&length>=width&&
    (family!==15||length%15===0||[20,40,50,70,80,100,110].includes(length))&&
    (family!==30||length%15===0||length===40||length===50);
  const bayCount=lengths.length;
  return {length,width,eave,ridge:eave+rise,rise,hip,left,right,
    xs,ridgeXs,legXs,endLegZs,legCount:2*(legXs.length+endLegZs.length),
    bayCount,bayLengths:lengths,hipJoints,family:cfg?.family||'Generic West Coast-style approximation',
    familyWidth:family,verifiedFamily:supported,
    doubleTube:family===30||family===40,
    // 6-way crowns at hip starts; 8-way at square footprint (no distinct hip ends).
    crownCount:right-left<.01?1:2,
    ridgeCrownCount:Math.max(0,ridgeXs.length-(right-left<.01?1:2)),
    exactTenFootBays:lengths.every(b=>Math.abs(b-10)<.001)};
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

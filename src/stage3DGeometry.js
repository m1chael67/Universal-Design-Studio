// Feet-based geometry shared by 3D stage rendering and regression tests.
// Stage dimensions are multiples of 4 ft. Deck-top height is measured from
// the ground, including the deck, rather than added on top of supports.
const clamped=(v,min,max)=>Math.min(max,Math.max(min,v));
const finite=(v,fallback)=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):fallback;
export const DEFAULT_STAGE_HEIGHT_INCHES=16;
export const STAGE_PANEL_FEET=4;
export function stage3DGeometry(width,depth,heightInches=DEFAULT_STAGE_HEIGHT_INCHES){
  const w=clamped(finite(width,4),.35,200),d=clamped(finite(depth,4),.35,200);
  const columns=Math.max(1,Math.round(w/STAGE_PANEL_FEET));
  const rows=Math.max(1,Math.round(d/STAGE_PANEL_FEET));
  const cellWidth=w/columns,cellDepth=d/rows;
  const topFeet=clamped(finite(heightInches,DEFAULT_STAGE_HEIGHT_INCHES)/12,4/12,6);
  const thicknessFeet=1.5/12; // ~1.5 inch removable platform deck, INCLUDED in top height
  const panels=[];
  for(let x=0;x<columns;x++)for(let z=0;z<rows;z++){
    panels.push({
      x:-w/2+(x+.5)*cellWidth,z:-d/2+(z+.5)*cellDepth,
      width:cellWidth,depth:cellDepth
    });
  }
  // Only one shared leg at each grid corner, including section intersections.
  const legPoints=[];
  for(let x=0;x<=columns;x++)for(let z=0;z<=rows;z++){
    legPoints.push({
      x:-w/2+x*cellWidth,z:-d/2+z*cellDepth
    });
  }
  return {w,d,columns,rows,cellWidth,cellDepth,topFeet,thicknessFeet,
    supportTopFeet:topFeet-thicknessFeet,panels,legPoints};
}
export function stair3DGeometry(depth,heightInches=DEFAULT_STAGE_HEIGHT_INCHES){
  const d=clamped(finite(depth,3),.35,50);
  const topFeet=clamped(finite(heightInches,DEFAULT_STAGE_HEIGHT_INCHES)/12,4/12,6);
  const count=Math.max(2,Math.ceil(topFeet/(7/12))); // ~7-inch maximum rise
  const treadRun=d/count;
  // -Z in the unrotated 3D object == the TOP/STAGE -Y edge in the 2D SVG.
  // Highest tread is at the NEGATIVE local z edge; heights decrease as z increases.
  const treads=Array.from({length:count},(_,i)=>({
    z:-d/2+(i+.5)*treadRun,
    heightFeet:topFeet*(count-i)/count,
    runFeet:treadRun
  }));
  return {depth:d,topFeet,count,treads,topEdgeZ:-d/2,bottomEdgeZ:d/2};
}
export function planOffsetTo3D(x,y,rotationDegrees=0){
  const a=Number(rotationDegrees)*Math.PI/180;
  // Match SVG transform="rotate(deg)": positive angles rotate clockwise on screen.
  return {x:x*Math.cos(a)-y*Math.sin(a),z:x*Math.sin(a)+y*Math.cos(a)};
}

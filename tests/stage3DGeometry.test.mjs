import test from 'node:test';
import assert from 'node:assert/strict';
import {stage3DGeometry,stair3DGeometry,planOffsetTo3D,DEFAULT_STAGE_HEIGHT_INCHES} from '../src/stage3DGeometry.js';
import {findStageForStairs} from '../src/stageMatching.js';
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, `${a} ≠ ${b}`);

test('16 inches is the exact deck TOP height above the ground, not the leg height',()=>{
  const g=stage3DGeometry(8,12);
  assert.equal(DEFAULT_STAGE_HEIGHT_INCHES,16);
  approx(g.topFeet,4/3);
  approx(g.supportTopFeet+g.thicknessFeet,g.topFeet);
  assert.equal(Math.round(g.topFeet*12),16);
  assert.equal(g.panels.length,6);
  assert.equal(g.columns,2);assert.equal(g.rows,3);
});
test('8x12 stage has one shared leg at each of 12 corners and intersections',()=>{
  const g=stage3DGeometry(8,12);
  assert.equal(g.legPoints.length,12);
  const unique=new Set(g.legPoints.map(({x,z})=>x+':'+z));
  assert.equal(unique.size,12);
  for(const x of [-4,0,4])for(const z of [-6,-2,2,6]){
    assert.ok(unique.has(x+':'+z),'missing leg at '+x+','+z);
  }
  for(const panel of g.panels){approx(panel.width,4);approx(panel.depth,4);}
});
test('a 4x4 single section has four corner legs',()=>{
  const g=stage3DGeometry(4,4,16);
  assert.equal(g.panels.length,1);
  assert.equal(g.legPoints.length,4);
});
test('a 24-inch stage matches exactly two feet high',()=>{
  const g=stage3DGeometry(8,8,24);
  approx(g.topFeet,2);assert.equal(g.legPoints.length,9);
});
test('stairs highest tread remains on the 2D TOP/STAGE edge',()=>{
  const g=stair3DGeometry(3,16);
  approx(g.topFeet,4/3);
  assert.equal(g.topEdgeZ,-1.5);
  assert.equal(g.bottomEdgeZ,1.5);
  assert.ok(g.treads.length>=2);
  approx(g.treads[0].heightFeet,g.topFeet);
  for(let i=1;i<g.treads.length;i++){
    assert.ok(g.treads[i].z>g.treads[i-1].z);
    assert.ok(g.treads[i].heightFeet<g.treads[i-1].heightFeet);
  }
});
test('staircase TOP/STAGE marker faces stage in every 90-degree orientation',()=>{
  const stage={id:'stage',type:'stage',x:20,y:20,w:8,h:12,heightInches:16};
  const stair=stair3DGeometry(3,16);
  for(const rotation of [0,90,180,270]){
    // Bottom of stage in local plan; stairs are 1.5 feet outside its edge.
    const center=planOffsetTo3D(0,12/2+1.5,rotation);
    const top=planOffsetTo3D(0,stair.topEdgeZ,rotation);
    const bottom=planOffsetTo3D(0,stair.bottomEdgeZ,rotation);
    const item={id:'stairs',type:'stairs',x:stage.x+center.x,y:stage.y+center.z,
      w:4,h:3,rot:rotation};
    const rotatedStage={...stage,rot:rotation};
    const link=findStageForStairs(item,[rotatedStage]);
    assert.equal(link?.stageId,'stage',`unlinked at angle ${rotation}`);
    const topPoint={x:center.x+top.x,z:center.z+top.z};
    const bottomPoint={x:center.x+bottom.x,z:center.z+bottom.z};
    // The top edge MUST be closer to the stage center than the low edge.
    assert.ok(Math.hypot(topPoint.x,topPoint.z)<Math.hypot(bottomPoint.x,bottomPoint.z),
      `reversed in ${rotation}-degree view`);
  }
});

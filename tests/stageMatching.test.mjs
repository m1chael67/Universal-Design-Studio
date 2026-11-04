import test from 'node:test';
import assert from 'node:assert/strict';
import {findStageForStairs,resolveStairHeights} from '../src/stageMatching.js';

const stage={id:'main',type:'stage',x:20,y:10,w:8,h:8,rot:0,heightInches:24};
const stairs={id:'stairs',type:'stairs',x:14.5,y:10,w:4,h:3,rot:90};

test('stairs attached at their marked top edge inherit the stage deck height',()=>{
  const match=findStageForStairs(stairs,[stage,stairs]);
  assert.equal(match?.stageId,'main');
  assert.equal(match?.side,'left');
  assert.equal(match?.stageHeightInches,24);
  const resolved=resolveStairHeights([stairs,stage]);
  assert.equal(resolved[0].heightInches,24);
  assert.equal(resolved[0].attachedStageId,'main');
});
test('changing a stage height immediately changes attached stair height',()=>{
  assert.equal(resolveStairHeights([stairs,{...stage,heightInches:36}])[0].heightInches,36);
});
test('stairs along top edge must face away from the stage',()=>{
  const connected={...stairs,x:20,y:4.5,rot:180};
  assert.equal(findStageForStairs(connected,[stage])?.side,'top');
  const backwards={...stairs,x:20,y:7.5,rot:0};
  assert.equal(findStageForStairs(backwards,[stage]),null);
});
test('rotated stages and stairs can connect',()=>{
  // Rotating both pieces 90 degrees around the stage center preserves attachment.
  const linked={...stairs,x:20,y:4.5,rot:180};
  const rotatedStage={...stage,rot:90};
  const dx=linked.x-stage.x,dy=linked.y-stage.y;
  const rotatedStairs={...linked,x:stage.x-dy,y:stage.y+dx,rot:270};
  assert.equal(findStageForStairs(rotatedStairs,[rotatedStage])?.stageId,'main');
});
test('nearby but unaligned or distant stairs remain unlinked',()=>{
  assert.equal(findStageForStairs({...stairs,x:5},[stage]),null);
  assert.equal(findStageForStairs({...stairs,rot:45},[stage]),null);
  assert.equal(resolveStairHeights([{...stairs,x:5,heightInches:18},stage])[0].heightInches,18);
});
test('stage removal does not leave a stale stair link',()=>{
  const out=resolveStairHeights([stairs]);
  assert.equal(out[0].attachedStageId,null);
  assert.equal(out[0].heightInches,16);
});

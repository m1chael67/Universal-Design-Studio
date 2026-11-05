import test from 'node:test';
import assert from 'node:assert/strict';
import {westCoastProfile,constrainedWalkPosition,fortyWideCrownRafters} from '../src/westCoastProfile.js';
test('20 x 40 West Coast frame uses 10-foot bays, hip ridge, 7-foot legs',()=>{
  const p=westCoastProfile(40,20,7);
  assert.equal(p.bayCount,4);
  assert.equal(p.ridge,12);
  assert.equal(p.left,-10);
  assert.equal(p.right,10);
  assert.equal(p.legCount,12);
  assert.deepEqual(p.xs,[-20,-10,0,10,20]);
});
test('walk-through camera and look target stay inside footprint',()=>{
  const b=constrainedWalkPosition({x:100,y:50,z:-80},{x:-90,y:-20,z:50},40,20,7);
  assert.deepEqual(b.position,{x:18,y:5.5,z:-8});
  assert.deepEqual(b.target,{x:-18,y:5.5,z:8});
});
test('shorter tents still have usable walk boundaries',()=>{
  const b=constrainedWalkPosition({x:99,y:0,z:99},{x:99,y:0,z:99},10,10,7);
  assert.ok(b.position.x<5&&b.position.z<5);
});

test('40-wide six-way end crowns have five unique rafters plus one ridge spreader',()=>{
  const p=westCoastProfile(80,40,7);
  for(const end of ['left','right']){
    const targets=fortyWideCrownRafters(p,end);
    assert.equal(targets.length,5);
    assert.equal(new Set(targets.map(t=>t.join(','))).size,5);
    assert.equal(targets.filter(t=>t[1]>p.eave).length,2);
  }
});

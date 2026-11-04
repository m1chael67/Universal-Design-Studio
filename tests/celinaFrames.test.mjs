import test from 'node:test';
import assert from 'node:assert/strict';
import {westCoastProfile} from '../src/westCoastProfile.js';
test('Celina Classic 20x40: 5-ft pitch, 12 legs, three ridge crowns, 10-ft bays',()=>{
  const p=westCoastProfile(40,20,7);
  assert.equal(p.rise,5);assert.equal(p.ridge,12);
  assert.equal(p.legCount,12);assert.equal(p.crownCount,2);
  assert.equal(p.ridgeCrownCount,1);
  assert.deepEqual(p.ridgeXs,[-10,0,10]);
  assert.deepEqual(p.endLegZs,[0]);
  assert.deepEqual(p.bayLengths,[10,10,10,10]);
  assert.equal(p.verifiedFamily,true);
});
test('Celina Classic/ETS 30x60: 8-ft roof pitch, 15-ft bays',()=>{
  const p=westCoastProfile(60,30,7);
  assert.equal(p.rise,8);assert.equal(p.ridge,15);
  assert.equal(p.legCount,12);assert.deepEqual(p.bayLengths,[15,15,15,15]);
  assert.deepEqual(p.ridgeXs,[-15,0,15]);
  assert.equal(p.doubleTube,true);
});
test('30x40 uses mixed 15/10/15 bays shown in Celina layout handbook',()=>{
  const p=westCoastProfile(40,30,7);
  assert.deepEqual(p.bayLengths,[15,10,15]);
  assert.equal(p.legCount,10);
  assert.deepEqual(p.ridgeXs,[-5,5]);
});
test('Celina 40x80 ETS: 10-ft bays, 10-ft pitch, four quarter-hip joints and 24 legs',()=>{
  const p=westCoastProfile(80,40,7);
  assert.equal(p.ridge,17);assert.equal(p.legCount,24);
  assert.equal(p.hipJoints.length,4);
  assert.deepEqual(p.ridgeXs,[-20,-10,0,10,20]);
  assert.deepEqual(p.endLegZs,[-10,0,10]);
  assert.equal(p.crownCount,2);assert.equal(p.ridgeCrownCount,3);
  assert.equal(p.verifiedFamily,true);
});
test('Custom sizes display an explicit approximated frame profile',()=>{
  const p=westCoastProfile(47,26,7);
  assert.equal(p.verifiedFamily,false);
  assert.equal(p.ridge,13.5);
  assert.ok(p.legCount>0);
});

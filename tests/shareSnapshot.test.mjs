import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSharedTent,restoreSharedTent} from '../src/shareSnapshot.js';
import {normalizedInterior,objectPosition} from '../src/tent3DMath.js';

test('customer snapshot retains landscape furniture positions and door openings',()=>{
  const t={id:'t1',name:'Forty-wide',width:40,length:80,rotation:90,
    interior:{orientation:'landscape-v1',objects:[
      {id:'stage',type:'stage',x:66,y:12,w:8,h:8,rot:0}
    ],doors:[{wall:'top',at:35,width:8}],sidewalls:{top:true}}};
  const shared=makeSharedTent(t);
  assert.equal(shared.interior.orientation,'landscape-v1');
  assert.equal(shared.interior.objects[0].x,66);
  assert.equal(shared.interior.objects[0].y,12);
  assert.equal(normalizedInterior(shared).objects[0].x,66);
  assert.equal(objectPosition(shared.interior.objects[0],80,40).x,26);
  assert.equal(shared.interior.doors[0].width,8);
  assert.equal(shared.interior.sidewalls.top,true);
});
test('older customer share snapshots missing orientation are not rotated again',()=>{
  const t={width:40,length:80,interior:{objects:[
    {id:'table',type:'table',x:66,y:12,w:8,h:2.5,rot:90}
  ]}};
  const restored=restoreSharedTent(t);
  assert.equal(normalizedInterior(restored).objects[0].x,66);
  assert.equal(normalizedInterior(restored).objects[0].y,12);
});
test('legacy portrait project data is converted exactly once when shared',()=>{
  const t={width:20,length:40,interior:{
    objects:[{id:'chair',x:5,y:30,w:1,h:1,rot:0}]}};
  const shared=makeSharedTent(t);
  assert.equal(shared.interior.orientation,'landscape-v1');
  assert.equal(shared.interior.objects[0].x,30);
  assert.equal(shared.interior.objects[0].y,15);
  assert.equal(normalizedInterior(shared).objects[0].x,30);
});

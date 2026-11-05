import test from 'node:test';
import assert from 'node:assert/strict';
import {exteriorPose,walkStart,walkEye,walkTarget,dragLook,WALK_FOV,PERSPECTIVE_FOV} from '../src/threeDCamera.js';

test('perspective opens centered on the tent and respects mobile aspect ratio',()=>{
  const desktop=exteriorPose(80,40,7,1.6);
  const mobile=exteriorPose(80,40,7,.62);
  assert.deepEqual(desktop.target,{x:0,y:3.8500000000000005,z:0});
  assert.equal(mobile.target.x,0);assert.equal(mobile.target.z,0);
  assert.ok(mobile.distance>desktop.distance);
  assert.ok(desktop.position.z>0);
});
test('walkthrough begins inside tent footprint and looks along its long axis',()=>{
  const p=walkStart(80,40,7);
  const t=walkTarget(p,0,0);
  assert.ok(p.x>-40&&p.x<40&&p.z>-20&&p.z<20);
  assert.ok(t.x>p.x);assert.equal(t.y,p.y);
});
test('walkthrough can look up and down without changing eye height',()=>{
  const eye=walkEye({x:0,y:999,z:0},40,20,7);
  const up=walkTarget(eye,0,.95),down=walkTarget(eye,0,-.95);
  assert.ok(up.y>eye.y);
  assert.ok(down.y<eye.y);
  assert.equal(eye.y,5.5);
});
test('drag look is gentle and limits pitch but does not clamp yaw',()=>{
  const one=dragLook({yaw:0,pitch:0},100,100);
  assert.ok(Math.abs(one.yaw)<.4);
  assert.ok(Math.abs(one.pitch)<.4);
  assert.equal(dragLook(one,0,-10000).pitch,1.4);
  assert.equal(dragLook(one,0,10000).pitch,-1.4);
});

test('walk-through uses a narrower, stable head-height perspective',()=>{
  assert.equal(WALK_FOV,60);
  assert.equal(PERSPECTIVE_FOV,48);
  const eye=walkEye({x:0,y:0,z:0},80,40,7);
  assert.ok(walkTarget(eye,0,.4).y>eye.y);
  assert.ok(Math.abs(dragLook({yaw:0,pitch:0},100,0).yaw)<.25);
});

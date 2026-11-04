import test from 'node:test';
import assert from 'node:assert/strict';
import {tentDimensions,normalizedInterior,getWallSegments,objectPosition} from '../src/tent3DMath.js';

test('tent 3D geometry follows saved width and length',()=>{
  assert.deepEqual(tentDimensions({width:30,length:60}),{length:60,width:30});
  assert.deepEqual(tentDimensions({width:-1,length:10000}),{length:250,width:2});
});
test('landscape interiors position furniture and doors directly',()=>{
  const interior=normalizedInterior({
    length:60,width:30,interior:{orientation:'landscape-v1',
      objects:[{id:'chair',x:10,y:5,rot:45}],
      doors:[{wall:'top',at:20,width:6}],
      sidewalls:{top:true}
    }
  });
  assert.equal(interior.objects[0].x,10);
  assert.equal(interior.objects[0].y,5);
  assert.equal(interior.doors[0].wall,'top');
  assert.equal(interior.sidewalls.top,true);
  assert.equal(interior.sidewalls.left,false);
  assert.deepEqual(objectPosition(interior.objects[0],60,30),{x:-20,z:-10,rotation:Math.PI/4});
});
test('legacy portrait interiors rotate furniture and map walls without mutating originals',()=>{
  const original={width:20,length:40,interior:{
    objects:[{id:'table',x:6,y:14,rot:0}],
    doors:[{wall:'right',at:12,width:5}],
    sidewalls:{right:true}
  }};
  const converted=normalizedInterior(original);
  assert.deepEqual([converted.objects[0].x,converted.objects[0].y,converted.objects[0].rot],[14,14,270]);
  assert.deepEqual([converted.doors[0].wall,converted.doors[0].at],['top',12]);
  assert.equal(converted.sidewalls.top,true);
  assert.equal(original.interior.objects[0].x,6);
});
test('3D sidewalls have actual gaps at saved door locations',()=>{
  const {segments,openings,span}=getWallSegments('top',[
    {wall:'top',at:10,width:6},{wall:'top',at:25,width:4},
    {wall:'right',at:6,width:7}
  ],40,20);
  assert.equal(span,40);
  assert.deepEqual(segments,[
    {start:0,end:7},{start:13,end:23},{start:27,end:40}
  ]);
  assert.deepEqual(openings,[{start:7,end:13},{start:23,end:27}]);
});
test('overlapping doorway openings never produce negative wall pieces',()=>{
  const {segments}=getWallSegments('left',[
    {wall:'left',at:2,width:8},{wall:'left',at:6,width:5}
  ],40,20);
  assert.deepEqual(segments,[{start:8.5,end:20}]);
});

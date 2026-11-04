import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedPoint,photoAnnotationsValid} from '../src/photoUtils.js';

test('annotation positions are relative to the photo view',()=>{
  const p=normalizedPoint(175,250,{left:75,top:50,width:400,height:400});
  assert.deepEqual(p,{x:.25,y:.5});
});
test('annotation clicks outside image are clamped to the visible image',()=>{
  const p=normalizedPoint(999,-3,{left:10,top:10,width:400,height:300});
  assert.deepEqual(p,{x:1,y:0});
});
test('validate arrows, notes, boxes and markers before saving or showing',()=>{
  assert.equal(photoAnnotationsValid([
    {type:'pin',x:.2,y:.3},
    {type:'text',x:.1,y:.6},
    {type:'box',x:.2,y:.3,x2:.8,y2:.5},
    {type:'arrow',x:0,y:0,x2:1,y2:1}
  ]),true);
  assert.equal(photoAnnotationsValid([{type:'arrow',x:.2,y:.3}]),false);
  assert.equal(photoAnnotationsValid([{type:'pin',x:1.2,y:.4}]),false);
});

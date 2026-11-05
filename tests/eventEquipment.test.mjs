import test from 'node:test';
import assert from 'node:assert/strict';
import {pipeDrapeBays,trash32Dimensions} from '../src/eventEquipment.js';
test('one 10-ft pipe & drape bay has two uprights',()=>{
 const a=pipeDrapeBays(10,8);
 assert.equal(a.count,1);assert.deepEqual(a.uprights,[-5,5]);
 assert.equal(a.height,8);
});
test('runs longer than 10 ft split into shorter connected sections',()=>{
 const a=pipeDrapeBays(23.5,7.25);
 assert.equal(a.count,3);assert.equal(a.uprights.length,4);
 assert.ok(a.bays.every(b=>b.span>0&&b.span<=10));
 assert.equal(a.bays.reduce((v,b)=>v+b.span,0),23.5);
 assert.equal(a.height,7.25);
});
test('drape heights never exceed 8 feet',()=>{
 assert.equal(pipeDrapeBays(15,30).height,8);
 assert.equal(pipeDrapeBays(15,-4).height,8);
});
test('32-gallon can has realistic nominal dimensions',()=>{
 assert.equal(trash32Dimensions.capacityGallons,32);
 assert.ok(trash32Dimensions.diameterFeet>1.5&&trash32Dimensions.heightFeet<3);
});

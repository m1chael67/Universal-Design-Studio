import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendSeating} from '../src/layoutOptimizer.js';

const empty=()=>({objects:[],doors:[]});
const settings={tableKey:'auto',mode:'replace',chairKey:'folding'};
test('compares three comfort levels and produces usable chairs',()=>{
  const results=recommendSeating(empty(),20,40,settings);
  assert.equal(results.length,3);
  assert.deepEqual(results.map(x=>x.key),['comfortable','balanced','maximum']);
  for(const r of results){
    assert.equal(r.totalSeats,r.newObjects.filter(o=>o.type==='chair').length);
    assert.equal(r.tableCount,r.newObjects.filter(o=>['round','table'].includes(o.type)).length);
    assert.ok(Number.isFinite(r.totalSeats));
  }
});
test('respects previously placed stage and dance floor',()=>{
  const fixture={id:'stage-1',catalog:'stage',type:'stage',x:20,y:10,w:12,h:8,rot:0};
  const result=recommendSeating({objects:[fixture],doors:[]},20,40,settings);
  for(const r of result){
    assert.ok(r.baseObjects.some(x=>x.id==='stage-1'));
    assert.ok(!r.newObjects.some(x=>x.id==='stage-1'));
  }
});
test('fill mode keeps existing seating and reports the combined number of chairs',()=>{
  const chair={id:'seat-1',catalog:'folding',type:'chair',x:2,y:2,w:1.65,h:1.65,rot:0};
  const r=recommendSeating({objects:[chair],doors:[]},20,40,{...settings,mode:'fill'});
  for(const x of r){
    assert.ok(x.baseObjects.includes(chair));
    assert.equal(x.totalSeats,x.newChairs+1);
  }
});
test('seating alternatives stay in numeric tent coordinates',()=>{
  const r=recommendSeating(empty(),20,40,settings);
  for(const x of r)for(const o of x.newObjects){
    assert.ok(Number.isFinite(o.x)&&Number.isFinite(o.y));
    assert.ok(o.x>=0 && o.x<=40 && o.y>=0 && o.y<=20);
    assert.ok(o.w>0&&o.h>0);
  }
});

test('custom table counts add the requested optional end chairs',()=>{
  const opts={...settings,tableKey:'rect6',seatCounts:{rect6:8},maxTables:2};
  const result=recommendSeating(empty(),30,50,opts);
  for(const r of result){
    assert.equal(r.seatsPerTable,8);
    assert.equal(r.newChairs,r.tableCount*8);
    assert.ok(r.tableCount<=2);
    const seats=r.newObjects.filter(o=>o.type==='chair');
    assert.ok(seats.every(o=>o.w===1.45&&o.h===1.45));
  }
});
test('regular 6-foot tables use six chairs and 60-inch rounds use eight',()=>{
  for(const [table,expected] of [['rect6',6],['round5',8]]){
    const result=recommendSeating(empty(),30,50,{...settings,tableKey:table});
    for(const r of result){
      assert.equal(r.seatsPerTable,expected);
      assert.equal(r.newChairs,r.tableCount*expected);
    }
  }
});
test('denser 60-inch rounds allow ten chairs',()=>{
  const result=recommendSeating(empty(),30,50,{...settings,tableKey:'round5',seatCounts:{round5:10}});
  for(const r of result){
    assert.equal(r.seatsPerTable,10);
    assert.equal(r.newChairs,r.tableCount*10);
  }
});
test('wall spacing and table maximum are configurable',()=>{
  const r=recommendSeating(empty(),25,60,{...settings,tableKey:'rect8',maxTables:3,spacingOffset:2,wallBuffer:2});
  assert.equal(r.length,3);
  for(const x of r) {
    assert.ok(x.tableCount<=3);
    assert.ok(x.aisleEstimate>=3.5);
  }
});
test('stage stairs remain fixed while generating table seating',()=>{
  const stairs={id:'stairs',catalog:'stairs',type:'stairs',x:8,y:8,w:3,h:4,rot:0};
  const r=recommendSeating({objects:[stairs],doors:[]},30,45,{...settings,tableKey:'rect6'});
  for(const x of r)assert.ok(x.baseObjects.some(o=>o.id===stairs.id));
});

test('chairs-only optimizer places only chairs, oriented toward chosen side',()=>{
  for(const [direction,rotation] of [['top',180],['right',270],['bottom',0],['left',90]]){
    const r=recommendSeating(empty(),30,60,{tableKey:'chairsOnly',mode:'replace',
      chairDirection:direction,maxChairs:80,chairAisleFeet:4});
    assert.equal(r.length,3);
    for(const plan of r){
      assert.equal(plan.tableCount,0);
      assert.ok(plan.newChairs>0&&plan.newChairs<=80);
      assert.ok(plan.newObjects.every(o=>o.type==='chair'&&o.rot===rotation));
    }
  }
});
test('chairs-only retains stages and avoids the specified center aisle',()=>{
  const stage={id:'stage',type:'stage',x:25,y:3,w:12,h:6,rot:0};
  const r=recommendSeating({objects:[stage],doors:[]},30,50,{
    tableKey:'chairsOnly',chairDirection:'top',chairAisleFeet:6,maxChairs:180});
  for(const plan of r){
    assert.ok(plan.baseObjects.includes(stage));
    assert.ok(plan.newObjects.every(o=>Math.abs(o.x-25)>=6/2+1.45/2));
    assert.ok(plan.newObjects.every(o=>Math.abs(o.x-stage.x)>stage.w/2+.7||Math.abs(o.y-stage.y)>stage.h/2+.7));
  }
});
test('chairs-only fill mode preserves existing tables',()=>{
  const table={id:'tbl',type:'table',catalog:'rect8',x:20,y:10,w:8,h:2.5,rot:0};
  const r=recommendSeating({objects:[table],doors:[]},20,40,{
    tableKey:'chairsOnly',mode:'fill',chairDirection:'right',maxChairs:50});
  assert.ok(r.every(plan=>plan.baseObjects.includes(table)));
});

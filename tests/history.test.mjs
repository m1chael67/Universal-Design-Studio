import test from 'node:test';
import assert from 'node:assert/strict';
import {nextHistory,HISTORY_LIMIT,HISTORY_WINDOW_MS} from '../src/useProjectHistory.js';

const fresh=()=>({past:[],future:[],lastGroup:null,lastAt:0});
test('records a reversible snapshot for first edit',()=>{
  const previous={tents:[]};
  const h=nextHistory(fresh(),previous,1000,'tent');
  assert.deepEqual(h.past,[previous]);
  assert.deepEqual(h.future,[]);
});
test('combines fast pointer updates within a single gesture',()=>{
  const h1=nextHistory(fresh(),{id:'before'},1000,'drag');
  const h2=nextHistory(h1,{id:'during'},1000+HISTORY_WINDOW_MS-1,'drag');
  assert.equal(h2.past.length,1);
  assert.equal(h2.past[0].id,'before');
});
test('keeps an individual undo step after pause or a different edit type',()=>{
  const first=nextHistory(fresh(),{id:1},1000,'drag');
  const second=nextHistory(first,{id:2},1001,'delete');
  assert.equal(second.past.length,2);
  const third=nextHistory(second,{id:3},1001+HISTORY_WINDOW_MS+1,'delete');
  assert.equal(third.past.length,3);
});
test('clears redo branch after a new edit',()=>{
  const h=nextHistory({...fresh(),future:[{id:'redo'}]}, {id:1},1000,'edit');
  assert.deepEqual(h.future,[]);
});
test('bounds the history stack to prevent unbounded memory growth',()=>{
  let h=fresh();
  for(let i=0;i<HISTORY_LIMIT+30;i++)h=nextHistory(h,{i},i*(HISTORY_WINDOW_MS+1),'operation');
  assert.equal(h.past.length,HISTORY_LIMIT);
  assert.equal(h.past[0].i,30);
});

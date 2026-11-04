import test from 'node:test';
import assert from 'node:assert/strict';
import {LOGISTICS_TYPES,logisticsType,siteFeet,routeFeet,makeCircle,siteLogisticsGeoJSON} from '../src/siteLogistics.js';

const point=[-90.21,38.65];
const east=[point[0]+.0001,point[1]];
const north=[point[0],point[1]+.0001];
test('site route categories include parking, truck unloading and grass-safe paths',()=>{
  for(const id of ['parking','unload','staging','no-go','vehicle','grass','foot','emergency','entrance','service']){
    assert.ok(LOGISTICS_TYPES.some(c=>c.id===id),id+' category absent');
  }
  assert.equal(logisticsType('vehicle').kind,'route');
});
test('route mileage uses real coordinates and is monotonic',()=>{
  const direct=siteFeet(point,east);
  assert.ok(direct>20&&direct<40);
  const total=routeFeet([point,east,north]);
  assert.ok(total>direct);
  assert.equal(routeFeet([]),0);
});
test('circle generates closed area with target radius',()=>{
  const ring=makeCircle(point,east);
  assert.equal(ring.length,41);
  assert.deepEqual(ring[0],ring[ring.length-1]);
  const radius=siteFeet(point,ring[0]);
  assert.ok(Math.abs(radius-siteFeet(point,east))<.5);
});
test('parking polygon, delivery route and pin appear as different geometries',()=>{
  const items=[
    {id:'a',type:'parking',shape:'polygon',label:'Guest parking',points:[point,east,north]},
    {id:'b',type:'grass',shape:'route',label:'Grass mats',points:[point,east,north]},
    {id:'c',type:'entrance',shape:'pin',label:'Gate',points:[point]}
  ];
  const out=siteLogisticsGeoJSON(items);
  assert.equal(out.area.features.length,1);
  assert.equal(out.border.features.length,1);
  assert.equal(out.route.features.length,1);
  assert.equal(out.pins.features.length,3);
  assert.equal(out.labels.features.length,3);
  assert.ok(out.route.features[0].properties.color.startsWith('#'));
});
test('circle is an area, while hidden marks do not render',()=>{
  const out=siteLogisticsGeoJSON([
    {id:'circle',type:'unload',shape:'circle',points:[point,east]},
    {id:'hidden',type:'no-go',shape:'polygon',hidden:true,points:[point,east,north]}
  ],null,null,'circle');
  assert.equal(out.area.features.length,1);
  assert.equal(out.border.features.length,1);
  assert.equal(out.area.features[0].properties.selected,1);
});
test('route preview and vertex pins persist during drafting',()=>{
  const out=siteLogisticsGeoJSON([],{type:'vehicle',shape:'route',points:[point,east]},north);
  assert.equal(out.draft.features.length,1);
  assert.equal(out.draft.features[0].geometry.coordinates.length,3);
  assert.equal(out.draftPoints.features.length,2);
});

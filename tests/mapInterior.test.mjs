import test from 'node:test';
import assert from 'node:assert/strict';
import {mapLocalPoint,rotatedCorners,interiorGeoJSON} from '../src/mapInterior.js';

const tent={id:'t1',lng:-90,lat:38.6,width:20,length:40,rotation:0,showInteriorOnMap:true};
const close=(a,b,tolerance=.000001)=>assert.ok(Math.abs(a-b)<tolerance, `${a} != ${b}`);

test('interior center maps to its parent tent center',()=>{
  const [lng,lat]=mapLocalPoint(tent,20,10);
  close(lng,tent.lng);close(lat,tent.lat);
});
test('length and width orientation follow landscape axes',()=>{
  const start=mapLocalPoint(tent,0,10),end=mapLocalPoint(tent,40,10);
  assert.ok(start[1]<tent.lat&&end[1]>tent.lat);
  const west=mapLocalPoint(tent,20,0),east=mapLocalPoint(tent,20,20);
  assert.ok(west[0]<tent.lng&&east[0]>tent.lng);
});
test('length reverse mirrors content without changing site footprint',()=>{
  const a=mapLocalPoint(tent,5,8);
  const b=mapLocalPoint({...tent,siteFlipLength:true},35,8);
  close(a[0],b[0]);close(a[1],b[1]);
});
test('width reverse mirrors content without changing site footprint',()=>{
  const a=mapLocalPoint(tent,5,8);
  const b=mapLocalPoint({...tent,siteFlipWidth:true},5,12);
  close(a[0],b[0]);close(a[1],b[1]);
});
test('rotating a tent by 90 degrees rotates its interior too',()=>{
  const base=mapLocalPoint(tent,30,10),turned=mapLocalPoint({...tent,rotation:90},30,10);
  assert.ok(base[1]>tent.lat);
  assert.ok(turned[0]>tent.lng);
  close(turned[1],tent.lat);
});
test('rotated furniture produces correctly closed polygon and directions',()=>{
  const obj={id:'o1',type:'stage',label:'Stage',x:20,y:10,w:8,h:4,rot:45};
  const points=rotatedCorners(obj);assert.equal(points.length,4);
  const result=interiorGeoJSON([{...tent,interior:{objects:[obj],doors:[{wall:'top',at:20,width:4}]}}]);
  assert.equal(result.polygons.features.length,1);
  assert.equal(result.polygons.features[0].geometry.coordinates[0].length,5);
  assert.equal(result.labels.features.length,2);
  assert.equal(result.directions.features.length,2);
});
test('hidden and disabled layout layers produce no map geometry',()=>{
  assert.equal(interiorGeoJSON([{...tent,hidden:true}]).polygons.features.length,0);
  assert.equal(interiorGeoJSON([{...tent,showInteriorOnMap:false}]).directions.features.length,0);
});

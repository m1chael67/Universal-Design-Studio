// Georeference the interior editor's landscape coordinates on the satellite plan.
// Interior: x increases along tent LENGTH, y increases across tent WIDTH.
// Tent site rotation rotates both tent footprint and all interior geometry.
const RAD=Math.PI/180;
const R=3.280839895;
const COLORS={round:'#72d5cb',table:'#72d5cb',chair:'#b9c8ec',stage:'#f8c078',
  dance:'#e4b7e5',bar:'#afd990',stairs:'#e8ad86'};
const featureCollection=features=>({type:'FeatureCollection',features});
const safe=v=>Number.isFinite(Number(v))?Number(v):0;

export function mapLocalPoint(tent,x,y){
  const width=safe(tent.width),length=safe(tent.length);
  // In the unrotated site geometry width runs east/west, length north/south.
  let ix=x,iy=y;
  if(tent.siteFlipLength)ix=length-ix;
  if(tent.siteFlipWidth)iy=width-iy;
  const east=(iy-width/2)/R,north=(ix-length/2)/R;
  const angle=safe(tent.rotation)*RAD;
  const re=east*Math.cos(angle)+north*Math.sin(angle);
  const rn=-east*Math.sin(angle)+north*Math.cos(angle);
  const lng=safe(tent.lng)+re/(111319.49*Math.max(.1,Math.cos(safe(tent.lat)*RAD)));
  const lat=safe(tent.lat)+rn/111132.92;
  return [lng,lat];
}

export function rotatedCorners(obj){
  const w=safe(obj.w),h=safe(obj.h),angle=safe(obj.rot)*RAD,c=Math.cos(angle),s=Math.sin(angle);
  return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>[
    safe(obj.x)+x*c-y*s,safe(obj.y)+x*s+y*c
  ]);
}
export function interiorGeoJSON(tents){
  const polys=[],points=[],directions=[];
  for(const t of tents||[]){
    if(t.hidden||!t.showInteriorOnMap)continue;
    const interior=t.interior||{};
    const objects=Array.isArray(interior.objects)?interior.objects:[];
    for(const o of objects){
      if(!Number.isFinite(Number(o.x))||!Number.isFinite(Number(o.y)))continue;
      const type=o.type||'object';
      const shape=rotatedCorners(o).map(p=>mapLocalPoint(t,p[0],p[1]));
      const label=type==='chair'?'':type==='round'?((Math.round(safe(o.w)*12))+'″'):
        type==='stage'?'STAGE':type==='dance'?'DANCE':
        type==='stairs'?'STAIRS':type==='bar'?'BAR':o.label||type.toUpperCase();
      const properties={id:o.id,tentId:t.id,type,label,fill:COLORS[type]||'#f1f0d1'};
      polys.push({type:'Feature',properties,geometry:{type:'Polygon',coordinates:[[...shape,shape[0]]]}});
      if(label)points.push({type:'Feature',properties,geometry:{type:'Point',coordinates:mapLocalPoint(t,safe(o.x),safe(o.y))}});
    }
    const doors=Array.isArray(interior.doors)?interior.doors:[];
    for(const d of doors){
      const side=d.wall||'top',at=safe(d.at);
      const x=side==='top'?at:side==='bottom'?at:side==='left'?0:safe(t.length);
      const y=side==='left'?at:side==='right'?at:side==='top'?0:safe(t.width);
      points.push({type:'Feature',properties:{type:'door',label:'DOOR',fill:'#ffda9d',tentId:t.id},geometry:{type:'Point',coordinates:mapLocalPoint(t,x,y)}});
    }
    // Two explicit end markers make a reversed length orientation easy to spot.
    const endpoints=[{x:safe(t.length)*.08,tag:'LENGTH START'},{x:safe(t.length)*.92,tag:'LENGTH END'}];
    for(const end of endpoints)directions.push({type:'Feature',properties:{label:end.tag,tentId:t.id},geometry:{
      type:'Point',coordinates:mapLocalPoint(t,end.x,safe(t.width)/2)
    }});
  }
  return {polygons:featureCollection(polys),labels:featureCollection(points),directions:featureCollection(directions)};
}

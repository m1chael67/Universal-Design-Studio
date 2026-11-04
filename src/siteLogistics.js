// Site Logistics: browser-only geometry helpers for private project plans.
// These shapes are conceptual annotations, not verified routing or driveability.
const RAD=Math.PI/180;
const metersPerFoot=0.3048;
const single=type=>({type:'FeatureCollection',features:[]});
export const LOGISTICS_TYPES=[
  {id:'parking',name:'Crew / guest parking',kind:'area',color:'#78d6ef'},
  {id:'unload',name:'Truck unloading',kind:'area',color:'#ffcb73'},
  {id:'staging',name:'Equipment staging',kind:'area',color:'#9bd69a'},
  {id:'no-go',name:'No-go / fragile turf',kind:'area',color:'#fa8588'},
  {id:'protected',name:'Ground protection / mats',kind:'area',color:'#a2a2ef'},
  {id:'utilities',name:'Utility hazard / overhead lines',kind:'area',color:'#f6a5bf'},
  {id:'turnaround',name:'Truck turnaround',kind:'area',color:'#dfbf8e'},
  {id:'vehicle',name:'Truck / equipment route',kind:'route',color:'#ffc15d'},
  {id:'grass',name:'Grass-safe cart route',kind:'route',color:'#66e6c3'},
  {id:'foot',name:'Crew / guest walking path',kind:'route',color:'#7acaff'},
  {id:'emergency',name:'Emergency access',kind:'route',color:'#f88888'},
  {id:'entrance',name:'Vehicle entry / gate',kind:'pin',color:'#f4eea4'},
  {id:'service',name:'Power / water connection',kind:'pin',color:'#ddade4'},
  {id:'note',name:'Site instruction / hazard note',kind:'pin',color:'#eef0ff'}
];
export const logisticsType=id=>LOGISTICS_TYPES.find(t=>t.id===id)||LOGISTICS_TYPES[0];
const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const closeLine=pts=>[...pts,pts[0]];
const feature=(kind,coordinates,properties)=>({type:'Feature',properties,geometry:{type:kind,coordinates}});
const toRadians=d=>d*RAD;
export function siteFeet(a,b){
  if(!validPoint(a)||!validPoint(b))return 0;
  const earth=6371000;
  const dLat=toRadians(b[1]-a[1]),dLon=toRadians(b[0]-a[0]);
  const v=Math.sin(dLat/2)**2+Math.cos(toRadians(a[1]))*Math.cos(toRadians(b[1]))*Math.sin(dLon/2)**2;
  return (earth*2*Math.asin(Math.min(1,Math.sqrt(v))))/metersPerFoot;
}
export function routeFeet(points){
  if(!Array.isArray(points))return 0;
  return points.slice(1).reduce((sum,p,i)=>sum+siteFeet(points[i],p),0);
}
export function makeCircle(center,edge,steps=40){
  if(!validPoint(center)||!validPoint(edge))return [];
  const distance=siteFeet(center,edge);
  const n=Math.max(16,Math.min(96,Math.floor(steps)));
  const phi=center[1]*RAD;
  const lngFt=364567*Math.max(.1,Math.cos(phi)),latFt=364000;
  const coords=Array.from({length:n},(_,i)=>{
    const theta=2*Math.PI*i/n;
    return [center[0]+distance*Math.cos(theta)/lngFt,center[1]+distance*Math.sin(theta)/latFt];
  });
  return closeLine(coords);
}
function centroid(points){
  if(!points.length)return null;
  const lng=points.reduce((sum,p)=>sum+p[0],0)/points.length;
  const lat=points.reduce((sum,p)=>sum+p[1],0)/points.length;
  return [lng,lat];
}
export function siteLogisticsGeoJSON(items=[],draft=null,hover=null,selectedId=null){
  const layers={area:[],border:[],route:[],pins:[],labels:[],draft:[],draftPoints:[]};
  const list=Array.isArray(items)?items:[];
  for(const item of list){
    if(!item||item.hidden)continue;
    const category=logisticsType(item.type);
    const points=Array.isArray(item.points)?item.points.filter(validPoint):[];
    const props={id:item.id,type:item.type,label:String(item.label||category.name).slice(0,70),
      color:category.color,selected:item.id===selectedId?1:0};
    let middle=null;
    if(item.shape==='circle'&&points.length>=2){
      const ring=makeCircle(points[0],points[1]);
      if(ring.length>3){
        layers.area.push(feature('Polygon',[ring],props));
        layers.border.push(feature('LineString',ring,props));
        middle=points[0];
      }
    }else if(category.kind==='area'&&points.length>=3){
      const ring=closeLine(points);
      layers.area.push(feature('Polygon',[ring],props));
      layers.border.push(feature('LineString',ring,props));
      middle=centroid(points);
    }else if(category.kind==='route'&&points.length>=2){
      layers.route.push(feature('LineString',points,props));
      middle=points[Math.floor(points.length/2)];
      layers.pins.push(feature('Point',points[0],{...props,label:'START',endpoint:1}));
      layers.pins.push(feature('Point',points[points.length-1],{...props,label:'END',endpoint:1}));
    }else if(category.kind==='pin'&&points.length){
      middle=points[0];
      layers.pins.push(feature('Point',middle,props));
    }
    if(middle)layers.labels.push(feature('Point',middle,props));
  }
  if(draft&&Array.isArray(draft.points)&&draft.points.length){
    const pts=draft.points.filter(validPoint);
    const cat=logisticsType(draft.type);
    const combined=hover&&validPoint(hover)?[...pts,hover]:pts;
    const properties={color:cat.color,label:'PREVIEW'};
    if(draft.shape==='circle'&&combined.length>=2){
      const circle=makeCircle(combined[0],combined[1]);
      if(circle.length)layers.draft.push(feature('LineString',circle,properties));
    }else if(combined.length>=2){
      layers.draft.push(feature('LineString',combined,properties));
    }
    for(const p of pts)layers.draftPoints.push(feature('Point',p,properties));
  }
  return Object.fromEntries(Object.entries(layers).map(([k,v])=>[k,{type:'FeatureCollection',features:v}]));
}

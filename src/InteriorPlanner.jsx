import React, {useEffect, useMemo, useRef, useState} from 'react';
import './interior.css';
import {recommendSeating,SEATING_TABLE_OPTIONS,SEAT_COUNT_CHOICES} from './layoutOptimizer.js';

const CATALOG = [
  {key:'round5',title:'60″ round table',type:'round',w:5,h:5,color:'#68c5ba'},
  {key:'round6',title:'72″ round table',type:'round',w:6,h:6,color:'#68c5ba'},
  {key:'rect6',title:'6 ft banquet table',type:'table',w:6,h:2.5,color:'#68c5ba'},
  {key:'rect8',title:'8 ft banquet table',type:'table',w:8,h:2.5,color:'#68c5ba'},
  {key:'cocktail',title:'Cocktail table',type:'round',w:2.5,h:2.5,color:'#68c5ba'},
  {key:'folding',title:'Folding chair',type:'chair',w:1.45,h:1.45,color:'#9aaddc'},
  {key:'chiavari',title:'Chiavari chair',type:'chair',w:1.45,h:1.45,color:'#9aaddc'},
  {key:'stage',title:'Bil-Jax stage (4 ft sections)',type:'stage',w:4,h:4,color:'#e7b66c'},
  {key:'dance',title:'Dance floor (3 ft panels)',type:'dance',w:12,h:12,color:'#d7a6cb'},
  {key:'bar6',title:'Bar 6 ft',type:'bar',w:6,h:2.5,color:'#a4c782'},
  {key:'bar7',title:'Bar 7 ft',type:'bar',w:7,h:2.5,color:'#a4c782'},
  {key:'stairs',title:'Stage stairs 3 × 4 ft',type:'stairs',w:3,h:4,color:'#e3a97e'},
  // No buffet table preset; regular tables can be repurposed manually.
];
const WALLS=['top','right','bottom','left'];
const uid=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'p-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const cap=(v,a,b)=>Math.max(a,Math.min(b,v));
const round=(v,step)=>Math.round(v/step)*step;
const fmt=n=>Number(n).toFixed(2);
function exceedsTent(o,w,h){
  const a=(Number(o.rot)||0)*Math.PI/180, dx=(Math.abs(Math.cos(a))*o.w+Math.abs(Math.sin(a))*o.h)/2,
    dy=(Math.abs(Math.sin(a))*o.w+Math.abs(Math.cos(a))*o.h)/2;
  return o.x-dx<-.01||o.x+dx>w+.01||o.y-dy<-.01||o.y+dy>h+.01;
}
const norm=(layout)=>({
  orientation:layout?.orientation||null,
  chairSizing:layout?.chairSizing||null,
  objects:Array.isArray(layout?.objects)?layout.objects:[],
  doors:Array.isArray(layout?.doors)?layout.doors:[],
  measurements:Array.isArray(layout?.measurements)?layout.measurements:[],
  sidewalls:{top:false,right:false,bottom:false,left:false,...(layout?.sidewalls||{})}
});
// Existing floor plans were vertical. Rotate their saved geometry clockwise once,
// rather than losing positions or simply swapping labels on the new landscape view.
function landscape(layout,tentWidth){
  const old=norm(layout);
  if(old.orientation==='landscape-v1')return old;
  const p=point=>({x:Number(point.y)||0,y:tentWidth-(Number(point.x)||0)});
  const turn=angle=>(((Number(angle)||0)-90)%360+360)%360;
  const doorMap={top:'left',right:'top',bottom:'right',left:'bottom'};
  return {
    ...old,orientation:'landscape-v1',
    objects:old.objects.map(o=>({...o,...p(o),rot:turn(o.rot)})),
    doors:old.doors.map(d=>({...d,wall:doorMap[d.wall]||'left',
      at:d.wall==='top'||d.wall==='bottom'?tentWidth-(Number(d.at)||0):(Number(d.at)||0)})),
    measurements:old.measurements.map(m=>({...m,a:p(m.a),b:p(m.b)})),
    sidewalls:{top:old.sidewalls.right,right:old.sidewalls.bottom,bottom:old.sidewalls.left,left:old.sidewalls.top}
  };
}
function itemDescription(o){
  if(!o)return '';
  const fmtSize=n=>Number(n)%1===0?String(n):Number(n).toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
  if(o.type==='round')return o.catalog==='cocktail'?'Cocktail table ('+fmtSize(o.w)+' ft)':
    (Math.round(Number(o.w)*12)+'″ round table');
  if(o.type==='table')return fmtSize(o.w)+' ft rectangular table';
  if(o.type==='stage')return 'Bil-Jax stage '+fmtSize(o.w)+' × '+fmtSize(o.h)+' ft';
  if(o.type==='dance')return 'Dance floor '+fmtSize(o.w)+' × '+fmtSize(o.h)+' ft';
  if(o.type==='chair')return o.catalog==='chiavari'?'Chiavari chair':'Folding chair';
  if(o.type==='stairs')return 'Stage stairs '+fmtSize(o.w)+' × '+fmtSize(o.h)+' ft';
  if(o.type==='bar')return 'Bar '+fmtSize(o.w)+' ft';
  return o.label||o.type;
}
function XYField({label,value,min=0,max=2000,step=0.25,onCommit}){
  const [raw,setRaw]=useState(String(value));
  const ref=useRef(null);
  useEffect(()=>{if(document.activeElement!==ref.current)setRaw(String(value));},[value]);
  function commit(){
    const n=Number(raw),v=raw.trim()===''||!Number.isFinite(n)?value:cap(n,min,max);
    onCommit(v);setRaw(String(v));
  }
  return <label className="ip-field">{label}<input ref={ref} type="number" step={step} min={min} max={max} value={raw} onChange={e=>setRaw(e.target.value)} onBlur={commit} onKeyDown={e=>e.key==='Enter'&&e.currentTarget.blur()}/></label>;
}
function ItemShape({item,selected,press,outside,showHandle=true}){
  const {w,h,type}=item,clr=(CATALOG.find(c=>c.key===item.catalog)?.color)||'#b2c0c9';
  const rounded=type==='round';
  const outline=outside?'#ff796d':selected?'#ffda8b':'#e8f5f8';
  const number=n=>Number.isInteger(Number(n))?String(n):Number(n).toFixed(1);
  const caption=type==='chair'?'':type==='round'?(item.catalog==='cocktail'?'Cocktail':(Math.round(w*12)+'″ round')):
    type==='stage'?'STAGE':type==='dance'?'DANCE FLOOR':type==='stairs'?'STAIRS':type==='bar'?'BAR':number(w)+' ft TABLE';
  const fontSize=Math.max(.5,Math.min(1.05,w/5,h/2.6));
  return <g transform={`translate(${item.x},${item.y}) rotate(${item.rot||0})`}
    onPointerDown={e=>press(e,'move',item)} onClick={e=>e.stopPropagation()} className="ip-item" aria-label={itemDescription(item)}>
    <title>{itemDescription(item)}</title>
    {rounded?<ellipse rx={w/2} ry={h/2} fill={clr} fillOpacity=".83" stroke={outline} strokeWidth={selected?0.2:0.08}/>:
      <rect x={-w/2} y={-h/2} width={w} height={h} rx={type==='chair'?0.24:0.12} fill={clr} fillOpacity=".85" stroke={outline} strokeWidth={selected?0.2:0.08}/>}
    {type==='chair'&&<path d={`M ${-w*.3} ${-h*.22} L ${w*.3} ${-h*.22}`} stroke="#263a54" strokeWidth=".18" strokeLinecap="round"/>}
    {type==='stage'&&<><path d={`M ${-w/2} ${-h/2} L ${w/2} ${h/2} M ${w/2} ${-h/2} L ${-w/2} ${h/2}`} stroke="#866039" strokeWidth=".08" strokeOpacity=".6"/></>}
    {type==='dance'&&<><path d={`M ${-w/2} 0 H ${w/2} M 0 ${-h/2} V ${h/2}`} stroke="#806180" strokeWidth=".1" strokeDasharray=".7,.4"/></>}
    {caption&&<g pointerEvents="none">
      <text textAnchor="middle" y={-Math.min(h*.14,.6)} dominantBaseline="central" fontWeight="700" fontSize={fontSize} fill="#183038">{caption}</text>
      {['stage','dance','stairs','bar'].includes(type)&&<text textAnchor="middle" y={Math.min(h*.21,1)} dominantBaseline="central" fontWeight="700" fontSize={Math.min(.9,fontSize*.78)} fill="#183038">{number(w)} × {number(h)} ft</text>}
    </g>}
    {selected&&showHandle&&<>
      <line x1="0" y1={-h/2} x2="0" y2={-h/2-1.6} stroke="#ffdd92" strokeWidth=".16"/>
      <circle cx="0" cy={-h/2-1.6} r=".68" fill="#ffd078" stroke="#25343d" strokeWidth=".16"
        className="ip-rotation-handle" onPointerDown={e=>{e.stopPropagation();press(e,'rotate',item);}}/>
    </>}
  </g>;
}
function wallLine(wall,w,h){
  if(wall==='top')return [0,0,w,0];
  if(wall==='right')return [w,0,w,h];
  if(wall==='bottom')return [0,h,w,h];
  return [0,0,0,h];
}
function doorPosition(d,w,h){
  const wall=d.wall||'top';
  const len=(wall==='top'||wall==='bottom')?w:h;
  const at=cap(Number(d.at)||0,0,len);
  return wall==='top'?[at,0]:wall==='bottom'?[at,h]:wall==='right'?[w,at]:[0,at];
}
function FoldSection({title,open,onToggle,children,count}){
  return <section className="ip-fold">
    <button type="button" className="ip-fold-trigger" aria-expanded={open} onClick={onToggle}>
      <span>{title}{count!=null?<small> ({count})</small>:null}</span><span aria-hidden="true">{open?'−':'+'}</span>
    </button>
    {open&&<div className="ip-fold-content">{children}</div>}
  </section>;
}
export default function InteriorPlanner({tent,onChange,onClose}){
  // Present the tent with its LENGTH across the top and its WIDTH on the side.
  const w=Number(tent.length)||40,h=Number(tent.width)||20;
  const layout=landscape(tent.interior,h);
  const [selected,setSelected]=useState(null);
  const [selectedIds,setSelectedIds]=useState([]);
  const [marquee,setMarquee]=useState(null);
  const [panels,setPanels]=useState({catalog:true,access:false,tools:false,annotations:false,counts:false});
  const panelRef=useRef(null);
  const [mode,setMode]=useState('select');
  const [zoom,setZoom]=useState(1);
  const [gridStep,setGridStep]=useState(0.5);
  const [snap,setSnap]=useState(true);
  const [optimizerOpen,setOptimizerOpen]=useState(false);
  const [optimizeMode,setOptimizeMode]=useState('replace');
  const [optimizeTable,setOptimizeTable]=useState('auto');
  const [optimizeChair,setOptimizeChair]=useState('folding');
  const [seatCounts,setSeatCounts]=useState({round5:8,round6:10,rect6:6,rect8:8});
  const [spacingOffset,setSpacingOffset]=useState(0);
  const [wallBuffer,setWallBuffer]=useState(0);
  const [maxTables,setMaxTables]=useState(80);
  const [optimizerPreview,setOptimizerPreview]=useState(null);
  const [measureStart,setMeasureStart]=useState(null);
  const [measureHover,setMeasureHover]=useState(null);
  const [viewport,setViewport]=useState({width:800,height:600});
  const frameRef=useRef(null),svgRef=useRef(null),dragRef=useRef(null);
  useEffect(()=>{
    const el=frameRef.current;if(!el)return;
    const resize=()=>setViewport({width:el.clientWidth||800,height:el.clientHeight||600});
    resize();const obs=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;obs?.observe(el);
    return ()=>obs?.disconnect();
  },[]);
  useEffect(()=>{
    setSelected(null);setSelectedIds([]);setMode('select');setMeasureStart(null);setZoom(1);
    setMarquee(null);setOptimizerPreview(null);
  },[tent.id]);
  useEffect(()=>{if(selected||selectedIds.length)panelRef.current?.scrollTo({top:0,behavior:'smooth'});},[selected,selectedIds.join(',')]);
  useEffect(()=>{
    if(tent.interior?.orientation!=='landscape-v1'||tent.interior?.chairSizing!=='compact-v1'){
      const converted=landscape(tent.interior,Number(tent.width)||20);
      onChange({...converted,chairSizing:'compact-v1',
        objects:converted.objects.map(o=>o.type==='chair'&&Math.abs(o.w-1.65)<.01&&Math.abs(o.h-1.65)<.01?
          {...o,w:1.45,h:1.45}:o)});
    }
  },[tent.id,tent.interior?.orientation,tent.interior?.chairSizing]);
  const chosen=layout.objects.find(o=>o.id===selected);
  const selectedMeasurement=layout.measurements.find(m=>'measure:'+m.id===selected);
  const alignmentGuide=chosen?(()=>{
    const angle=((chosen.rot||0)%360+360)%360;
    const candidates=[{angle:0,source:'Tent walls'},{angle:90,source:'Tent walls'},
      ...layout.objects.filter(o=>o.id!==chosen.id).flatMap(o=>([
        {angle:(o.rot||0),source:'Another item'},
        {angle:(o.rot||0)+90,source:'Another item'}
      ]))];
    const hit=candidates.find(c=>{
      const delta=Math.abs(((angle-c.angle+180)%180+180)%180);
      return Math.min(delta,180-delta)<.9;
    });
    return hit?{angle,source:hit.source}:null;
  })():null;
  const chosenDoor=layout.doors.find(o=>'door:'+o.id===selected);
  const selectedObjects=layout.objects.filter(o=>selectedIds.includes(o.id));
  const pad=3.5;
  const fit=Math.max(2,Math.min((viewport.width-50)/(w+2*pad),(viewport.height-48)/(h+2*pad)));
  const pixelsPerFoot=fit*zoom;
  const svgWidth=(w+2*pad)*pixelsPerFoot,svgHeight=(h+2*pad)*pixelsPerFoot;
  const totalChairs=layout.objects.filter(o=>o.type==='chair').length;
  const outOfBounds=layout.objects.filter(o=>exceedsTent(o,w,h));
  const seatingIdeas=useMemo(()=>optimizerOpen?recommendSeating(layout,h,w,{
    tableKey:optimizeTable,mode:optimizeMode,chairKey:optimizeChair,
    seatCounts,spacingOffset,wallBuffer,maxTables
  }):[],[optimizerOpen,tent.interior,h,w,optimizeTable,optimizeMode,optimizeChair,seatCounts,spacingOffset,wallBuffer,maxTables]);
  const counts=useMemo(()=>{
    const entries={};
    for(const o of layout.objects){const name=o.label||o.type;entries[name]=(entries[name]||0)+1;}
    return Object.entries(entries).sort((a,b)=>a[0].localeCompare(b[0]));
  },[tent.interior]);
  const grid=[];
  for(let x=0;x<=w && grid.length<500;x+=5)grid.push({axis:'x',v:x});
  for(let y=0;y<=h && grid.length<1000;y+=5)grid.push({axis:'y',v:y});
  function commit(patch){setOptimizerPreview(null);onChange({...layout,...patch});}
  function applySeatingIdea(idea){
    if(!idea||!idea.newObjects.length)return;
    const hasSeating=layout.objects.some(o=>o.type==='chair'||((o.type==='round'||o.type==='table')&&o.catalog!=='cocktail'));
    if(idea.mode==='replace'&&hasSeating&&!window.confirm('Replace existing tables and chairs? Stages, dance floors, bars, cocktail tables, doors, and walls will be kept.'))return;
    commit({objects:[...idea.baseObjects,...idea.newObjects]});
    setSelected(null);setSelectedIds([]);setMode('select');setOptimizerOpen(false);
  }
  function updateObject(id,patch){
    commit({objects:layout.objects.map(o=>o.id===id?{...o,...patch}:o)});
  }
  function updateModuleSize(item,field,value){
    const size=item.type==='stage'?4:item.type==='dance'&&!item.customSize?3:0.25;
    const n=Number.isFinite(Number(value))?Number(value):item[field];
    const corrected=Math.max(size,Math.round(n/size)*size);
    updateObject(item.id,{[field]:Number(corrected.toFixed(2))});
  }
  function alignRotation(angle,item){
    let target=Number(angle);
    if(!snap)return Math.round(target);
    const angles=[0,90,180,270,360,
      ...layout.objects.filter(o=>o.id!==item.id).flatMap(o=>[o.rot||0,(o.rot||0)+90,(o.rot||0)+180,(o.rot||0)+270])];
    let best=null,distance=Infinity;
    for(const a of angles){
      const diff=Math.abs((target-a+540)%360-180);
      if(diff<distance){distance=diff;best=a;}
    }
    if(distance<=2.5)return ((best%360)+360)%360;
    return (Math.round(target/5)*5)%360;
  }
  function updateDoor(id,patch){
    commit({doors:layout.doors.map(d=>d.id===id?{...d,...patch}:d)});
  }
  function selectEntity(id){
    setSelected(id);setSelectedIds(id&&!id.startsWith('door:')&&!id.startsWith('measure:')?[id]:[]);
    setMode('select');
  }
  function addObject(cat){
    const n=layout.objects.length;
    const obj={id:uid(),catalog:cat.key,type:cat.type,label:cat.title,x:cap(w/2+(n%4)*.75,0,w),
      y:cap(h/2+(n%3)*.75,0,h),w:cat.w,h:cat.h,rot:0};
    commit({objects:[...layout.objects,obj]});
    selectEntity(obj.id);setPanels(p=>({...p,catalog:false}));
  }
  function addDoor(){
    const wall='top',d={id:uid(),wall,at:w/2,width:Math.min(4,Math.max(1,w/2))};
    commit({doors:[...layout.doors,d],sidewalls:{...layout.sidewalls,top:true}});
    selectEntity('door:'+d.id);setPanels(p=>({...p,access:false}));
  }
  function removeSelected(){
    if(!selected&&!selectedIds.length)return;
    const count=selectedIds.length||1;
    if(!window.confirm('Remove '+count+' selected item'+(count===1?'':'s')+' from this tent layout?'))return;
    if(selected?.startsWith('door:'))commit({doors:layout.doors.filter(d=>'door:'+d.id!==selected)});
    else if(selected?.startsWith('measure:'))commit({measurements:layout.measurements.filter(m=>'measure:'+m.id!==selected)});
    else commit({objects:layout.objects.filter(o=>!selectedIds.includes(o.id)&&o.id!==selected)});
    setSelected(null);setSelectedIds([]);
  }
  function centerSelected(){
    if(!selectedIds.length)return;
    const set=layout.objects.filter(o=>selectedIds.includes(o.id));if(!set.length)return;
    const minX=Math.min(...set.map(o=>o.x-o.w/2)),maxX=Math.max(...set.map(o=>o.x+o.w/2));
    const minY=Math.min(...set.map(o=>o.y-o.h/2)),maxY=Math.max(...set.map(o=>o.y+o.h/2));
    const dx=w/2-(minX+maxX)/2,dy=h/2-(minY+maxY)/2;
    const ids=new Set(set.map(o=>o.id));
    commit({objects:layout.objects.map(o=>ids.has(o.id)?{...o,x:Number((o.x+dx).toFixed(3)),y:Number((o.y+dy).toFixed(3))}:o)});
  }
  function clearMeasurements(){
    if(!layout.measurements.length||!window.confirm('Delete all '+layout.measurements.length+' interior measurements?'))return;
    commit({measurements:[]});setSelected(null);setSelectedIds([]);
  }
  function updateMeasurement(id,patch){
    commit({measurements:layout.measurements.map(m=>m.id===id?{...m,...patch}:m)});
  }
  function duplicateSelected(){
    if(!chosen)return;
    const o={...chosen,id:uid(),x:cap(chosen.x+2,0,w),y:cap(chosen.y+2,0,h)};
    commit({objects:[...layout.objects,o]});selectEntity(o.id);
  }
  function seatingCount(o){
    if(!o||!['round','table'].includes(o.type)||['cocktail','buffet'].includes(o.catalog))return 0;
    if(o.type==='round')return o.w>=5.75?seatCounts.round6:seatCounts.round5;
    return o.w>=7?seatCounts.rect8:seatCounts.rect6;
  }
  function addChairsAround(){
    if(!chosen)return;
    const count=seatingCount(chosen);if(!count)return;
    const angle=(chosen.rot||0)*Math.PI/180;
    const rotate=(x,y)=>({x:chosen.x+x*Math.cos(angle)-y*Math.sin(angle),y:chosen.y+x*Math.sin(angle)+y*Math.cos(angle)});
    const chairCat=CATALOG.find(c=>c.key==='folding');
    const chairs=[];
    const insert=(x,y,rot)=>{
      const pos=rotate(x,y);
      chairs.push({id:uid(),catalog:chairCat.key,type:'chair',label:chairCat.title,
        x:Number(pos.x.toFixed(3)),y:Number(pos.y.toFixed(3)),w:chairCat.w,h:chairCat.h,rot:(rot+360)%360});
    };
    if(chosen.type==='round'){
      const radius=Math.max(chosen.w,chosen.h)/2+1.1;
      for(let i=0;i<count;i++){
        const theta=-Math.PI/2+2*Math.PI*i/count;
        insert(radius*Math.cos(theta),radius*Math.sin(theta),(chosen.rot||0)+theta*180/Math.PI+90);
      }
    }else{
      const normal=chosen.w>=7?8:6,extras=count>normal?2:0,each=(count-extras)/2;
      for(let i=0;i<each;i++){
        const x=-chosen.w/2+(i+1)*chosen.w/(each+1),offset=chosen.h/2+1.05;
        insert(x,-offset,chosen.rot||0);
        insert(x,offset,(chosen.rot||0)+180);
      }
      if(extras){
        insert(-chosen.w/2-1.1,0,(chosen.rot||0)+270);
        insert(chosen.w/2+1.1,0,(chosen.rot||0)+90);
      }
    }
    commit({objects:[...layout.objects,...chairs]});
  }
  function toPoint(e){
    const svg=svgRef.current;if(!svg)return null;
    const rect=svg.getBoundingClientRect();
    const x=(e.clientX-rect.left)/rect.width*(w+pad*2)-pad;
    const y=(e.clientY-rect.top)/rect.height*(h+pad*2)-pad;
    return {x,y};
  }
  function startMarquee(e){
    if(mode!=='select'||e.button!==0||dragRef.current)return;
    if(e.target.closest?.('.ip-item, .ip-door, .ip-measure-line'))return;
    e.preventDefault();svgRef.current?.setPointerCapture(e.pointerId);
    const start=toPoint(e);
    dragRef.current={action:'marquee',start,additive:e.shiftKey};
    setMarquee({start,end:start});
  }
  function beginDrag(e,action,item){
    if(mode!=='select'||e.button!==0)return;
    e.stopPropagation();e.preventDefault();
    if(e.shiftKey&&action==='move'){
      const ids=selectedIds.includes(item.id)?selectedIds.filter(x=>x!==item.id):[...selectedIds,item.id];
      setSelectedIds(ids);setSelected(ids.length===1?ids[0]:null);
      return;
    }
    const ids=action==='move'&&selectedIds.includes(item.id)&&selectedIds.length>1?selectedIds:[item.id];
    setSelectedIds(ids);setSelected(ids.length===1?item.id:null);
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current={action,id:item.id,start:toPoint(e),original:item,
      originals:layout.objects.filter(o=>ids.includes(o.id))};
  }
  function beginMeasureDrag(e,m,part){
    if(mode!=='select'||e.button!==0)return;
    e.stopPropagation();e.preventDefault();svgRef.current?.setPointerCapture(e.pointerId);
    setSelected('measure:'+m.id);setSelectedIds([]);
    dragRef.current={action:'measure',id:m.id,start:toPoint(e),original:m,part};
  }
  function moveGroup(d,p){
    const orig=d.originals;
    if(!orig?.length)return;
    const xs=orig.map(o=>o.x),ys=orig.map(o=>o.y);
    const requestedX=snap?round(p.x-d.start.x,gridStep):p.x-d.start.x;
    const requestedY=snap?round(p.y-d.start.y,gridStep):p.y-d.start.y;
    const dx=cap(requestedX,-Math.min(...xs),w-Math.max(...xs));
    const dy=cap(requestedY,-Math.min(...ys),h-Math.max(...ys));
    const moved=new Map(orig.map(o=>[o.id,{x:Number((o.x+dx).toFixed(3)),y:Number((o.y+dy).toFixed(3))}]));
    commit({objects:layout.objects.map(o=>moved.has(o.id)?{...o,...moved.get(o.id)}:o)});
  }
  function onMove(e){
    const p=toPoint(e);if(!p)return;
    if(dragRef.current){
      const d=dragRef.current;
      if(d.action==='marquee'){
        setMarquee({start:d.start,end:p});
      }else if(d.action==='move')moveGroup(d,p);
      else if(d.action==='rotate'){
        const degrees=(Math.atan2(p.y-d.original.y,p.x-d.original.x)*180/Math.PI+90+360)%360;
        updateObject(d.id,{rot:alignRotation(degrees,d.original)});
      }else if(d.action==='door'){
        const wall=d.original.wall;
        const along=wall==='top'||wall==='bottom'?p.x:p.y;
        const len=wall==='top'||wall==='bottom'?w:h;
        updateDoor(d.id,{at:cap(snap?round(along,gridStep):along,0,len)});
      }else if(d.action==='measure'){
        const rawX=p.x-d.start.x,rawY=p.y-d.start.y;
        const dx=snap?round(rawX,gridStep):rawX,dy=snap?round(rawY,gridStep):rawY;
        const point=v=>({x:Number(cap(v.x+dx,0,w).toFixed(3)),y:Number(cap(v.y+dy,0,h).toFixed(3))});
        updateMeasurement(d.id,d.part==='a'?{a:point(d.original.a)}:
          d.part==='b'?{b:point(d.original.b)}:{a:point(d.original.a),b:point(d.original.b)});
      }
      return;
    }
    if(mode==='measure'&&measureStart)setMeasureHover({x:cap(p.x,0,w),y:cap(p.y,0,h)});
  }
  function endDrag(e){
    const d=dragRef.current;
    if(d?.action==='marquee'){
      const p=toPoint(e)||d.start;
      const left=Math.min(d.start.x,p.x),right=Math.max(d.start.x,p.x);
      const top=Math.min(d.start.y,p.y),bottom=Math.max(d.start.y,p.y);
      if(Math.hypot(right-left,bottom-top)>.25){
        const found=layout.objects.filter(o=>{
          const rad=(o.rot||0)*Math.PI/180;
          const halfW=(Math.abs(Math.cos(rad))*o.w+Math.abs(Math.sin(rad))*o.h)/2;
          const halfH=(Math.abs(Math.sin(rad))*o.w+Math.abs(Math.cos(rad))*o.h)/2;
          return o.x+halfW>=left&&o.x-halfW<=right&&o.y+halfH>=top&&o.y-halfH<=bottom;
        }).map(o=>o.id);
        const ids=d.additive?[...new Set([...selectedIds,...found])]:found;
        setSelectedIds(ids);setSelected(ids.length===1?ids[0]:null);
      }else if(!d.additive){setSelected(null);setSelectedIds([]);}
      setMarquee(null);
    }
    dragRef.current=null;
    try{svgRef.current?.releasePointerCapture(e.pointerId);}catch{}
  }
  function canvasClick(e){
    if(mode!=='measure')return;
    const p=toPoint(e);if(!p)return;
    const point={x:cap(snap?round(p.x,gridStep):p.x,0,w),y:cap(snap?round(p.y,gridStep):p.y,0,h)};
    if(!measureStart){setMeasureStart(point);setMeasureHover(point);return;}
    const m={id:uid(),a:measureStart,b:point};
    if(Math.hypot(m.a.x-m.b.x,m.a.y-m.b.y)>.01)commit({measurements:[...layout.measurements,m]});
    setMeasureStart(null);setMeasureHover(null);
  }
  const measureLine=(a,b,id,temporary=false)=>{
    const d=Math.hypot(a.x-b.x,a.y-b.y);
    const active=selected==='measure:'+id;
    const m=layout.measurements.find(m=>m.id===id);
    return <g key={id} className={temporary?'':'ip-measure-line'} pointerEvents={temporary?'none':undefined}>
      {!temporary&&m&&<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="1.5"
        onPointerDown={e=>beginMeasureDrag(e,m,'all')}/>}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active?'#ffd58a':temporary?'#ffda8c':'#ecf4f5'}
        strokeWidth={active?'.23':'.17'} strokeDasharray=".55,.25" pointerEvents="none"/>
      <circle cx={a.x} cy={a.y} r={active?'.55':'.36'} fill={active?'#ffd58a':'#ffd57e'}
        onPointerDown={temporary?undefined:e=>beginMeasureDrag(e,m,'a')}/>
      <circle cx={b.x} cy={b.y} r={active?'.55':'.36'} fill={active?'#ffd58a':'#ffd57e'}
        onPointerDown={temporary?undefined:e=>beginMeasureDrag(e,m,'b')}/>
      <text x={(a.x+b.x)/2} y={(a.y+b.y)/2-.65} fontSize=".83" textAnchor="middle" paintOrder="stroke" stroke="#21303e"
        strokeWidth=".55" fill="#fff" pointerEvents="none">{fmt(d)} ft</text>
    </g>;
  };
  function serializedDrawing(){
    const svg=svgRef.current;if(!svg)return '';
    const clone=svg.cloneNode(true);
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.removeAttribute('style');
    const exportScale=Math.min(50,2400/(w+pad*2),2400/(h+pad*2));
    clone.setAttribute('width',String(Math.max(1,Math.round((w+pad*2)*exportScale))));
    clone.setAttribute('height',String(Math.max(1,Math.round((h+pad*2)*exportScale))));
    return new XMLSerializer().serializeToString(clone);
  }
  function downloadBlob(blob,extension){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=(tent.name||'Tent').replace(/[^a-z0-9_-]+/gi,'-')+'-floor-plan.'+extension;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportSvg(){
    const drawing=serializedDrawing();if(!drawing)return;
    downloadBlob(new Blob([drawing],{type:'image/svg+xml'}),'svg');
  }
  async function exportBitmap(type){
    const drawing=serializedDrawing();if(!drawing)return;
    const file=new Blob([drawing],{type:'image/svg+xml'}),url=URL.createObjectURL(file);
    try{
      const img=new Image();
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
      const scale=Math.min(50,2400/(w+pad*2),2400/(h+pad*2));
      const output=document.createElement('canvas');
      output.width=Math.max(1,Math.round((w+pad*2)*scale));
      output.height=Math.max(1,Math.round((h+pad*2)*scale));
      const ctx=output.getContext('2d');
      ctx.fillStyle='#1b2d38';ctx.fillRect(0,0,output.width,output.height);
      ctx.drawImage(img,0,0,output.width,output.height);
      const mime=type==='jpg'?'image/jpeg':'image/png';
      const blob=await new Promise(resolve=>output.toBlob(resolve,mime,.94));
      if(blob)downloadBlob(blob,type);
    }catch(err){window.alert('Image export failed: '+err.message);}
    finally{URL.revokeObjectURL(url);}
  }
  return <div className="ip-shell" role="dialog" aria-modal="true" aria-label="Tent interior floor planner">
    <header className="ip-header">
      <button className="ip-back" onClick={onClose}>← Back to site</button>
      <div className="ip-heading"><strong>{tent.name?.trim()||'Tent interior'}</strong><span>Width {h} ft (side) × Length {w} ft (top) · {fmt(w*h)} sq ft</span></div>
      <div className="ip-zoom">
        <button onClick={()=>setZoom(z=>cap(z/1.25,.25,12))} title="Zoom out">−</button>
        <span>{Math.round(zoom*100)}%</span>
        <button onClick={()=>setZoom(z=>cap(z*1.25,.25,12))} title="Zoom in">+</button>
        <button onClick={()=>setZoom(1)}>Fit</button>
        <input aria-label="Floor plan zoom" type="range" min="0.25" max="12" step="0.25" value={Math.round(zoom*4)/4} onChange={e=>setZoom(Number(e.target.value))}/>
      </div>
      <div className="ip-exports"><button onClick={()=>exportBitmap('png')}>PNG</button><button onClick={()=>exportBitmap('jpg')}>JPG</button><button onClick={exportSvg}>SVG</button></div>
    </header>
    <div className="ip-workspace">
      <aside className="ip-panel" ref={panelRef}>
        <div className="ip-quick-bar">
          <button onClick={()=>{setSelected(null);setSelectedIds([]);setPanels(p=>({...p,catalog:true}));setOptimizerOpen(false);panelRef.current?.scrollTo({top:0,behavior:'smooth'});}}>+ Equipment</button>
          <button className={mode==='select'?'selected':''} onClick={()=>{setMode('select');setMeasureStart(null);}}>Select</button>
          <button className={mode==='measure'?'selected':''} onClick={()=>{setMode('measure');setSelected(null);setSelectedIds([]);setOptimizerPreview(null);}}>Measure</button>
          <button className={optimizerOpen?'selected':''} onClick={()=>{setSelected(null);setSelectedIds([]);setOptimizerOpen(x=>!x);setPanels(p=>({...p,catalog:false}));panelRef.current?.scrollTo({top:0,behavior:'smooth'});}}>Optimize</button>
        </div>
        <section className="ip-inspector"><h3>Selection</h3>
          {selectedIds.length>1?<div className="ip-fields">
            <strong>{selectedIds.length} objects selected</strong>
            <p className="ip-help">Drag any highlighted object to move the whole selection. Shift-click to add or remove an object.</p>
            <div className="ip-tool-row">
              <button onClick={centerSelected}>Center group in tent</button>
              <button className="ip-danger" onClick={removeSelected}>Delete group</button>
            </div>
            <button className="ip-wide" onClick={()=>{setSelected(null);setSelectedIds([]);}}>Clear selection</button>
          </div>:chosen?<div className="ip-fields">
            <strong>{itemDescription(chosen)}</strong>
            <div className="ip-field-grid">
              <XYField key={chosen.id+'x'} label="X position (ft)" value={Number(chosen.x.toFixed(2))} onCommit={x=>updateObject(chosen.id,{x})} max={w}/>
              <XYField key={chosen.id+'y'} label="Y position (ft)" value={Number(chosen.y.toFixed(2))} onCommit={y=>updateObject(chosen.id,{y})} max={h}/>
              <XYField key={chosen.id+'w'} label={chosen.type==='stage'?'Width (4 ft increments)':chosen.type==='dance'&&!chosen.customSize?'Width (3 ft increments)':'Width (ft)'}
                value={chosen.w} min={chosen.type==='stage'?4:chosen.type==='dance'&&!chosen.customSize?3:.25}
                step={chosen.type==='stage'?4:chosen.type==='dance'&&!chosen.customSize?3:.25}
                onCommit={val=>['stage','dance'].includes(chosen.type)?updateModuleSize(chosen,'w',val):updateObject(chosen.id,{w:val})}/>
              <XYField key={chosen.id+'h'} label={chosen.type==='stage'?'Depth (4 ft increments)':chosen.type==='dance'&&!chosen.customSize?'Depth (3 ft increments)':'Depth (ft)'}
                value={chosen.h} min={chosen.type==='stage'?4:chosen.type==='dance'&&!chosen.customSize?3:.25}
                step={chosen.type==='stage'?4:chosen.type==='dance'&&!chosen.customSize?3:.25}
                onCommit={val=>['stage','dance'].includes(chosen.type)?updateModuleSize(chosen,'h',val):updateObject(chosen.id,{h:val})}/>
              <XYField key={chosen.id+'r'} label="Angle (°)" value={chosen.rot||0} step={1} max={359} onCommit={val=>updateObject(chosen.id,{rot:val})}/>
            </div>
            {chosen.type==='stage'&&<p className="ip-help">Bil-Jax: stage width and depth are made from 4 × 4 ft modules. The size fields round to 4-foot increments.</p>}
            {chosen.type==='dance'&&<label className="ip-check ip-custom-dance">
              <input type="checkbox" checked={Boolean(chosen.customSize)} onChange={e=>updateObject(chosen.id,{
                customSize:e.target.checked,
                ...(e.target.checked?{}:{w:Math.max(3,Math.round(chosen.w/3)*3),h:Math.max(3,Math.round(chosen.h/3)*3)})
              })}/>Allow custom dance-floor sizes (otherwise 3 × 3 ft modules)
            </label>}
            {alignmentGuide&&<p className="ip-align-readout">Aligned: parallel/perpendicular to {alignmentGuide.source.toLowerCase()}</p>}
            {seatingCount(chosen)>0&&<button className="ip-wide ip-seating-button" onClick={addChairsAround}>+ Add {seatingCount(chosen)} chairs around table</button>}
            <div className="ip-tool-row"><button onClick={duplicateSelected}>Duplicate</button><button onClick={centerSelected}>Center in tent</button></div>
            <button className="ip-wide ip-danger" onClick={removeSelected}>Delete selected item</button>
          </div>:chosenDoor?<div className="ip-fields">
            <strong>Door / entrance</strong>
            <label className="ip-field">Tent side<select value={chosenDoor.wall} onChange={e=>{const wall=e.target.value;const len=wall==='top'||wall==='bottom'?w:h;commit({doors:layout.doors.map(d=>d.id===chosenDoor.id?{...d,wall,at:len/2}:d),sidewalls:{...layout.sidewalls,[wall]:true}});}}>
              {WALLS.map(w=><option key={w} value={w}>{w}</option>)}
            </select></label>
            <XYField key={chosenDoor.id+'dw'} label="Door width (ft)" value={chosenDoor.width} min={1} max={Math.max(w,h)} onCommit={val=>updateDoor(chosenDoor.id,{width:val})}/>
            <XYField key={chosenDoor.id+'da'} label="Position along wall (ft)" value={chosenDoor.at} max={chosenDoor.wall==='top'||chosenDoor.wall==='bottom'?w:h} onCommit={val=>updateDoor(chosenDoor.id,{at:val})}/>
            <p className="ip-help">Drag the door marker on the wall, or adjust its position here.</p>
            <button className="ip-danger ip-wide" onClick={removeSelected}>Delete door</button>
          </div>:selectedMeasurement?<div className="ip-fields">
            <strong>Measurement — {fmt(Math.hypot(selectedMeasurement.a.x-selectedMeasurement.b.x,selectedMeasurement.a.y-selectedMeasurement.b.y))} ft</strong>
            <p className="ip-help">Drag the line to move it, or drag either pin to change the measurement.</p>
            <div className="ip-field-grid">
              <XYField key={selectedMeasurement.id+'ax'} label="Start X (ft)" value={Number(selectedMeasurement.a.x.toFixed(2))}
                max={w} onCommit={x=>updateMeasurement(selectedMeasurement.id,{a:{...selectedMeasurement.a,x}})}/>
              <XYField key={selectedMeasurement.id+'ay'} label="Start Y (ft)" value={Number(selectedMeasurement.a.y.toFixed(2))}
                max={h} onCommit={y=>updateMeasurement(selectedMeasurement.id,{a:{...selectedMeasurement.a,y}})}/>
              <XYField key={selectedMeasurement.id+'bx'} label="End X (ft)" value={Number(selectedMeasurement.b.x.toFixed(2))}
                max={w} onCommit={x=>updateMeasurement(selectedMeasurement.id,{b:{...selectedMeasurement.b,x}})}/>
              <XYField key={selectedMeasurement.id+'by'} label="End Y (ft)" value={Number(selectedMeasurement.b.y.toFixed(2))}
                max={h} onCommit={y=>updateMeasurement(selectedMeasurement.id,{b:{...selectedMeasurement.b,y}})}/>
            </div>
            <button className="ip-danger ip-wide" onClick={removeSelected}>Delete measurement</button>
          </div>:<div>
            <p className="ip-help">Click an item to edit it, or drag over empty floor space to select several items. Doors and measurements can be selected directly or from their list below.</p>
            {!!layout.objects.length&&<button className="ip-wide" onClick={()=>{setMode('select');setSelected(null);setSelectedIds(layout.objects.map(o=>o.id));}}>Select all {layout.objects.length} objects</button>}
          </div>}
        </section>
        <section className="ip-optimizer-section"><button type="button" className="ip-section-toggle" onClick={()=>{setOptimizerOpen(v=>!v);setOptimizerPreview(null);}}>
          <span>Seating Layout Optimizer</span><span>{optimizerOpen?'−':'+'}</span>
        </button>
        {optimizerOpen&&<>
          <p className="ip-help">Compare estimated seating layouts around existing stages, dance floors, doors and other obstacles. These are planning suggestions, not fire-code or occupancy approval.</p>
          <label className="ip-field">Existing tables and chairs
            <select value={optimizeMode} onChange={e=>{setOptimizeMode(e.target.value);setOptimizerPreview(null);}}>
              <option value="replace">Regenerate seating (keep stages, dance floors, etc.)</option>
              <option value="fill">Fill unused space (keep everything placed)</option>
            </select>
          </label>
          <label className="ip-field">Table style
            <select value={optimizeTable} onChange={e=>{setOptimizeTable(e.target.value);setOptimizerPreview(null);}}>
              <option value="auto">Automatically choose the highest seat count</option>
              {SEATING_TABLE_OPTIONS.map(t=><option key={t.key} value={t.key}>{t.name} — {seatCounts[t.key]} chairs</option>)}
            </select>
          </label>
          <label className="ip-field">Chair style
            <select value={optimizeChair} onChange={e=>{setOptimizeChair(e.target.value);setOptimizerPreview(null);}}>
              <option value="folding">Folding chairs</option><option value="chiavari">Chiavari chairs</option>
            </select>
          </label>
          <div className="ip-seating-options">
            <strong>Seats per table</strong>
            <div className="ip-seat-settings">
              {SEATING_TABLE_OPTIONS.map(t=><label className="ip-field" key={t.key}>{t.name}
                <select value={seatCounts[t.key]} onChange={e=>{setSeatCounts(p=>({...p,[t.key]:Number(e.target.value)}));setOptimizerPreview(null);}}>
                  {SEAT_COUNT_CHOICES[t.key].map(n=><option key={n} value={n}>{n} seats{n>t.seats?' (denser)':''}</option>)}
                </select>
              </label>)}
            </div>
            <div className="ip-field-grid">
              <label className="ip-field">Additional table gap (ft)
                <select value={spacingOffset} onChange={e=>{setSpacingOffset(Number(e.target.value));setOptimizerPreview(null);}}>
                  {[-1,0,1,2,3,4,6].map(n=><option key={n} value={n}>{n>0?'+':''}{n} ft</option>)}
                </select>
              </label>
              <label className="ip-field">Additional wall clearance
                <select value={wallBuffer} onChange={e=>{setWallBuffer(Number(e.target.value));setOptimizerPreview(null);}}>
                  {[0,1,2,3,4,5,6,8].map(n=><option key={n} value={n}>{n} ft</option>)}
                </select>
              </label>
              <label className="ip-field">Maximum new tables
                <input type="number" min="1" max="80" value={maxTables} onChange={e=>{setMaxTables(Math.max(1,Math.min(80,Number(e.target.value)||1)));setOptimizerPreview(null);}}/>
              </label>
            </div>
          </div>
          <div className="ip-optimizer-cards">
            {seatingIdeas.map(idea=><div key={idea.key} className={'ip-opt-card '+(optimizerPreview?.key===idea.key?'ip-opt-active':'')}>
              <div className="ip-opt-head"><strong>{idea.name}</strong><span>{idea.totalSeats} seats</span></div>
              <p>{idea.description}</p>
              <p><strong>{idea.tableCount}</strong> new {idea.tableName} tables • <strong>{idea.newChairs}</strong> chairs ({idea.seatsPerTable} per table)</p>
              <p>Target between-group gap: <strong>{fmt(idea.aisleEstimate)} ft</strong> (not a verified aisle width)</p>
              <p>Estimated efficiency: <strong>{(100*idea.totalSeats/Math.max(1,w*h)).toFixed(1)}</strong> seats / 100 sq ft • clusters occupy about <strong>{idea.estimatedUsage}%</strong> of tent area</p>
              {idea.tableAngle===90&&<p>Tables rotated 90° for a more efficient fit.</p>}
              <div className="ip-tool-row">
                <button onClick={()=>{setOptimizerPreview(idea);setMode('select');setSelected(null);}}>Preview</button>
                <button className="ip-apply" disabled={!idea.newObjects.length} onClick={()=>applySeatingIdea(idea)}>Apply</button>
              </div>
            </div>)}
          </div>
          {optimizerPreview&&<div className="ip-opt-preview-note">Preview: {optimizerPreview.name} • {optimizerPreview.totalSeats} planned seats.
            <button onClick={()=>setOptimizerPreview(null)}>Clear preview</button>
            <button className="ip-apply" onClick={()=>applySeatingIdea(optimizerPreview)}>Apply preview</button>
          </div>}
          <p className="ip-help">Roomy, balanced and maximum use different estimated gaps. Door buffer zones and existing objects are accounted for conservatively, but human circulation, accessibility, tent poles, anchoring, and exit requirements still need review.</p>
        </>}
        </section>
        <FoldSection title="Add equipment" open={panels.catalog} onToggle={()=>setPanels(p=>({...p,catalog:!p.catalog}))}><div className="ip-catalog">
          {CATALOG.map(cat=><button key={cat.key} onClick={()=>addObject(cat)} title={cat.title}><span className={'ip-swatch ip-'+cat.type}/><span>{cat.title}</span></button>)}
        </div></FoldSection>
        <FoldSection title="Doors & sidewalls" open={panels.access} onToggle={()=>setPanels(p=>({...p,access:!p.access}))} count={layout.doors.length}>
          <button className="ip-wide" onClick={addDoor}>+ Add door / entrance</button>
          <p className="ip-help">Toggle each wall. Select a door below to choose its wall, width and position.</p>
          <div className="ip-wall-grid">{WALLS.map(wall=><label key={wall}><input type="checkbox" checked={Boolean(layout.sidewalls[wall])} onChange={e=>commit({sidewalls:{...layout.sidewalls,[wall]:e.target.checked}})}/>{wall}</label>)}</div>
        </FoldSection>
        <FoldSection title="Doors & measurements" open={panels.annotations} count={layout.doors.length+layout.measurements.length} onToggle={()=>setPanels(p=>({...p,annotations:!p.annotations}))}>
          <strong className="ip-list-heading">Doors</strong>
          {layout.doors.map((d,i)=><button type="button" key={d.id} className="ip-annotation-row"
            onClick={()=>selectEntity('door:'+d.id)}>Door {i+1} — {d.wall}, {fmt(d.width)} ft</button>)}
          {!layout.doors.length&&<p className="ip-help">No doors placed yet.</p>}
          <strong className="ip-list-heading">Measurements</strong>
          {layout.measurements.map((m,i)=><button type="button" key={m.id} className="ip-annotation-row"
            onClick={()=>selectEntity('measure:'+m.id)}>Measurement {i+1} — {fmt(Math.hypot(m.a.x-m.b.x,m.a.y-m.b.y))} ft</button>)}
          {!layout.measurements.length&&<p className="ip-help">No measurements yet.</p>}
          {!!layout.measurements.length&&<button className="ip-wide ip-danger" onClick={clearMeasurements}>Delete all measurements</button>}
        </FoldSection>
        <FoldSection title="Grid & measurement tools" open={panels.tools} onToggle={()=>setPanels(p=>({...p,tools:!p.tools}))}>
          <div className="ip-tool-row"><button className={mode==='select'?'selected':''} onClick={()=>{setMode('select');setMeasureStart(null);}}>Select / move</button><button className={mode==='measure'?'selected':''} onClick={()=>{setMode('measure');setSelected(null);}}>Measure</button></div>
          <label className="ip-check"><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/>Snap to grid</label>
          <label className="ip-field">Grid step <select value={gridStep} onChange={e=>setGridStep(+e.target.value)}>
            <option value=".25">3 in</option><option value=".5">6 in</option><option value="1">1 ft</option><option value="2">2 ft</option>
            <option value="3">3 ft</option><option value="4">4 ft</option><option value="5">5 ft</option><option value="10">10 ft</option>
          </select></label>
          <p className="ip-help">{mode==='measure'?'Click the first point, move for a live distance, then click a second point.':'Drag items to move them. Select an item and drag its gold handle to rotate.'}</p>
        </FoldSection>
        <FoldSection title="Equipment counts" open={panels.counts} onToggle={()=>setPanels(p=>({...p,counts:!p.counts}))} count={layout.objects.length}>
          <div className="ip-count"><span>Actual chairs placed</span><strong>{totalChairs}</strong></div>
          <div className="ip-count"><span>Doors</span><strong>{layout.doors.length}</strong></div>
          {outOfBounds.length>0&&<p className="ip-outside-warning">{outOfBounds.length} item{outOfBounds.length>1?'s':''} extend beyond the tent boundary (red outline). Check fit before installing.</p>}
          {counts.map(([name,count])=><div className="ip-count" key={name}><span>{name}</span><strong>{count}</strong></div>)}
          <p className="ip-help">Counts reflect objects added to this layout, not your Booqable inventory. Verify aisle and exit clearances with the authority having jurisdiction.</p>
        </FoldSection>
      </aside>
      <div className="ip-stage" ref={frameRef}>
        <div className="ip-stage-caption">{mode==='measure'?'MEASURE — click two points':selectedIds.length>1?selectedIds.length+' ITEMS SELECTED — drag any highlighted item to move the group':'DRAG TO MOVE • DRAG EMPTY SPACE TO BOX-SELECT • SHIFT+CLICK TO ADD'}</div>
        <div className="ip-scroll-area">
          <svg ref={svgRef} className={'ip-svg '+(mode==='measure'?'ip-measuring':'')}
            style={{width:svgWidth,height:svgHeight,flex:'none'}} viewBox={`${-pad} ${-pad} ${w+pad*2} ${h+pad*2}`}
            onPointerDown={startMarquee} onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}
            onClick={canvasClick} role="img" aria-label={`Scaled layout of ${w} by ${h} foot tent`}>
            <rect x={-pad} y={-pad} width={w+pad*2} height={h+pad*2} fill="#1b2d38"/>
            <rect x="0" y="0" width={w} height={h} fill="#2c4350"/>
            {grid.map((a,i)=><line key={i} x1={a.axis==='x'?a.v:0} y1={a.axis==='x'?0:a.v}
              x2={a.axis==='x'?a.v:w} y2={a.axis==='x'?h:a.v}
              stroke="#708590" strokeOpacity=".22" strokeWidth=".06"/>)}
            {WALLS.map(wall=>{
              const [x1,y1,x2,y2]=wallLine(wall,w,h);
              return <line key={wall} x1={x1} y1={y1} x2={x2} y2={y2} stroke={layout.sidewalls[wall]?'#f0f3f4':'#a9c2c9'}
                strokeWidth={layout.sidewalls[wall]?.25:.17} strokeDasharray={layout.sidewalls[wall]?undefined:'.6,.4'}/>;
            })}
            <g pointerEvents="none">
              <text x={w/2} y={-1.25} textAnchor="middle" fontSize="1" fill="#e3f0f0">{fmt(w)} ft</text>
              <text x={-1.7} y={h/2} transform={`rotate(-90 ${-1.7} ${h/2})`} textAnchor="middle" fontSize="1" fill="#e3f0f0">{fmt(h)} ft</text>
            </g>
            {layout.doors.map(d=>{
              const [x,y]=doorPosition(d,w,h);
              const vertical=d.wall==='left'||d.wall==='right';
              const length=vertical?h:w;
              const half=cap(Number(d.width)||4,1,length)/2;
              return <g key={d.id} className="ip-door" onPointerDown={e=>{
                if(mode!=='select')return;
                e.stopPropagation();e.preventDefault();
                setSelected('door:'+d.id);setSelectedIds([]);svgRef.current?.setPointerCapture(e.pointerId);
                dragRef.current={action:'door',id:d.id,original:d,start:toPoint(e)};
              }} onClick={e=>e.stopPropagation()}>
                <line x1={vertical?x:x-half} y1={vertical?y-half:y} x2={vertical?x:x+half} y2={vertical?y+half:y}
                  stroke="#2c4350" strokeWidth=".58"/>
                <line x1={vertical?x:x-half} y1={vertical?y-half:y} x2={vertical?x:x+half} y2={vertical?y+half:y}
                  stroke={selected==='door:'+d.id?'#ffd078':'#f5d490'} strokeWidth=".17" strokeDasharray=".5,.3"/>
                <circle cx={x} cy={y} r=".38" fill="#f5d490" stroke="#102732" strokeWidth=".1"/>
              </g>;
            })}
            {alignmentGuide&&chosen&&mode==='select'&&<g transform={`translate(${chosen.x} ${chosen.y}) rotate(${alignmentGuide.angle})`} pointerEvents="none" className="ip-align-guides">
              <line x1={-Math.max(w,h)} y1="0" x2={Math.max(w,h)} y2="0" stroke="#f0d8a1" strokeWidth=".09" strokeDasharray=".65,.6" opacity=".48"/>
              <line x1="0" y1={-Math.max(w,h)} x2="0" y2={Math.max(w,h)} stroke="#f0d8a1" strokeWidth=".09" strokeDasharray=".65,.6" opacity=".36"/>
            </g>}
            {layout.objects.map(item=><ItemShape key={item.id} item={item}
              selected={selectedIds.includes(item.id)||selected===item.id}
              outside={exceedsTent(item,w,h)} showHandle={selectedIds.length<=1} press={beginDrag}/>)}
            {marquee&&<rect x={Math.min(marquee.start.x,marquee.end.x)} y={Math.min(marquee.start.y,marquee.end.y)}
              width={Math.abs(marquee.end.x-marquee.start.x)} height={Math.abs(marquee.end.y-marquee.start.y)}
              stroke="#9ef5e8" strokeWidth=".14" strokeDasharray=".45,.3" fill="#4cd5c2" fillOpacity=".18" pointerEvents="none"/>}
            {chosen&&mode==='select'&&<g pointerEvents="none" className="ip-selected-label">
              <text x={chosen.x} y={Math.max(-1.1,chosen.y-chosen.h/2-2.8)} textAnchor="middle" fill="#fff3d8" fontWeight="700" fontSize=".94"
                stroke="#152b36" strokeWidth=".7" paintOrder="stroke">{itemDescription(chosen)}</text>
            </g>}
            {optimizerPreview&&<g pointerEvents="none" opacity=".55" aria-label="Suggested seating preview">
              {optimizerPreview.newObjects.map(item=><ItemShape key={item.id} item={item} selected={false} outside={exceedsTent(item,w,h)} press={()=>{}}/>)}
            </g>}
            {layout.measurements.map(m=>measureLine(m.a,m.b,m.id))}
            {measureStart&&measureHover&&measureLine(measureStart,measureHover,'preview',true)}
          </svg>
        </div>
        <div className="ip-stage-footer"><span>Origin: upper-left corner · Dimensions in feet</span><span>Zoom: {Math.round(zoom*100)}% · Snap {snap?'on':'off'}</span></div>
      </div>
    </div>
  </div>;
}

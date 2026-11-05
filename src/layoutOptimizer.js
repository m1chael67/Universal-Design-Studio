// Advisory seating-layout search. Dimensions are feet; no occupancy or code certification.
const TABLES=[
  {key:'round5',name:'60″ round',type:'round',w:5,h:5,seats:8},
  {key:'round6',name:'72″ round',type:'round',w:6,h:6,seats:10},
  {key:'rect6',name:'6 ft rectangular',type:'table',w:6,h:2.5,seats:6},
  {key:'rect8',name:'8 ft rectangular',type:'table',w:8,h:2.5,seats:8}
];
const LEVELS=[
  {key:'comfortable',name:'Comfortable',gap:5,edge:2.5,description:'Generous spacing between occupied tables'},
  {key:'balanced',name:'Balanced',gap:3.5,edge:1.5,description:'Practical compromise between seats and circulation'},
  {key:'maximum',name:'Maximum capacity',gap:1.5,edge:0.75,description:'Tight conceptual fit; check aisles, exits and local occupancy rules'}
];
// Seats per table can be overridden; optional extras go at rectangular table ends.
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const id=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():('gen-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const rect=(x,y,w,h)=>({left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2});
const overlaps=(a,b,pad=0)=>a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad;
const bbox=o=>{
  const a=(Number(o.rot)||0)*Math.PI/180,cos=Math.abs(Math.cos(a)),sin=Math.abs(Math.sin(a));
  return rect(o.x,o.y,cos*(o.w||1)+sin*(o.h||1),sin*(o.w||1)+cos*(o.h||1));
};
const isSeating=o=>o.type==='chair'||((o.type==='round'||o.type==='table')&&o.catalog!=='cocktail');
const clusterSize=t=>t.type==='round'?{w:t.w+4.3,h:t.h+4.3}:{w:t.w+(t.seats>(t.w===6?6:8)?3.4:1.4),h:t.h+4.1};
const normObjects=o=>(Array.isArray(o)?o:[]).filter(x=>Number.isFinite(x.x)&&Number.isFinite(x.y)&&Number.isFinite(x.w)&&Number.isFinite(x.h));
function doorReservation(d,width,length){
  const vertical=d.wall==='left'||d.wall==='right',wallLen=vertical?width:length;
  const at=clamp(Number(d.at)||0,0,wallLen),door=clamp(Number(d.width)||4,1,wallLen);
  if(d.wall==='top')return rect(at,2.25,door+3,4.5);
  if(d.wall==='bottom')return rect(at,width-2.25,door+3,4.5);
  if(d.wall==='left')return rect(2.25,at,4.5,door+3);
  return rect(length-2.25,at,4.5,door+3);
}
function fixtureClearance(o,level){
  // Fixtures such as stages and dance floors are kept in place.
  // An intentionally conservative AABB is used for rotated items.
  return bbox(o);
}
function buildCluster(t,x,y,chairKey,tableRotation=0){
  const tag=id(),rot=tableRotation*Math.PI/180;
  const turn=(dx,dy)=>({x:x+dx*Math.cos(rot)-dy*Math.sin(rot),y:y+dx*Math.sin(rot)+dy*Math.cos(rot)});
  const table={id:tag,catalog:t.key,type:t.type,label:t.name,x,y,w:t.w,h:t.h,rot:tableRotation,generatedBy:'optimizer'};
  const objects=[table];
  function chair(dx,dy,rotation){
    const p=turn(dx,dy);
    objects.push({id:id(),catalog:chairKey,type:'chair',
      label:chairKey==='chiavari'?'Chiavari chair':'Folding chair',
      x:Number(p.x.toFixed(3)),y:Number(p.y.toFixed(3)),w:1.45,h:1.45,
      rot:((rotation+tableRotation)%360+360)%360,generatedBy:'optimizer'});
  }
  if(t.type==='round'){
    const radius=t.w/2+1.1;
    for(let i=0;i<t.seats;i++){
      const theta=-Math.PI/2+(2*Math.PI*i)/t.seats;
      chair(radius*Math.cos(theta),radius*Math.sin(theta),theta*180/Math.PI+90);
    }
  }else{
    const regular=t.w<=6?6:8,extras=t.seats>regular?2:0,each=(t.seats-extras)/2,offset=t.h/2+1;
    for(let i=0;i<each;i++){
      const tx=-t.w/2+(i+1)*t.w/(each+1);
      chair(tx,-offset,0);chair(tx,offset,180);
    }
    if(extras){
      chair(-t.w/2-1.1,0,270);
      chair(t.w/2+1.1,0,90);
    }
  }
  return objects;
}
function tryTable(t,level,layout,width,length,chairKey,mode,opts){
  const old=normObjects(layout.objects),base=mode==='replace'?old.filter(o=>!isSeating(o)):old;
  const obstacleRects=base.map(o=>fixtureClearance(o,level));
  for(const door of layout.doors||[])obstacleRects.push(doorReservation(door,width,length));
  const gap=Math.max(0,level.gap+opts.spacingOffset);
  const edge=Math.max(0,level.edge+opts.wallBuffer);
  let best={centers:[],angle:0,dims:clusterSize(t)};
  for(const angle of t.type==='table'?[0,90]:[0]){
    const raw=clusterSize(t),dims=angle===90?{w:raw.h,h:raw.w}:raw;
    const stepX=dims.w+gap,stepY=dims.h+gap;
    const xStart=edge+dims.w/2,yStart=edge+dims.h/2;
    for(const stagger of [false,true]){
      for(const xPhase of [0,.25,.5]){
        for(const yPhase of [0,.25,.5]){
          const found=[],bounds=[];
          for(let y=yStart+yPhase*stepY,row=0;y<=width-edge-dims.h/2+.0001;y+=stepY,row++){
            for(let x=xStart+xPhase*stepX+(stagger&&row%2?stepX/2:0);x<=length-edge-dims.w/2+.0001;x+=stepX){
              const r=rect(x,y,dims.w,dims.h);
              if(obstacleRects.some(b=>overlaps(r,b,gap/3)))continue;
              if(bounds.some(b=>overlaps(r,b,gap-.01)))continue;
              bounds.push(r);found.push([x,y]);
              if(found.length>=opts.maxTables)break;
            }
            if(found.length>=opts.maxTables)break;
          }
          if(found.length>best.centers.length)best={centers:found,angle,dims};
        }
      }
    }
  }
  const created=best.centers.flatMap(([x,y])=>buildCluster(t,x,y,chairKey,best.angle));
  const newChairs=created.filter(o=>o.type==='chair').length;
  const existingChairs=base.filter(o=>o.type==='chair').length;
  const seatArea=best.centers.length*best.dims.w*best.dims.h;
  return {
    key:level.key,name:level.name,description:level.description,tableName:t.name,
    aisleEstimate:gap,tableKey:t.key,tableCount:best.centers.length,seatsPerTable:t.seats,
    newChairs,existingChairs,totalSeats:existingChairs+newChairs,
    tableAngle:best.angle,
    estimatedUsage:Math.round(Math.min(100,seatArea/Math.max(1,width*length)*100)),
    baseObjects:base,newObjects:created,mode
  };
}
function chairOnlyLayout(level,layout,width,length,chairKey,mode,opts){
  const previous=normObjects(layout.objects);
  const base=mode==='replace'?previous.filter(o=>!isSeating(o)):previous;
  const obstacles=base.map(o=>fixtureClearance(o,level));
  for(const door of layout.doors||[])obstacles.push(doorReservation(door,width,length));
  const chairW=1.45,chairH=1.45;
  const direction=opts.chairDirection||'top';
  const rotations={top:180,right:270,bottom:0,left:90};
  const frontToBack=direction==='top'||direction==='bottom';
  const chairRotation=rotations[direction]??180;
  // Auditorium-style straight rows, all facing the same direction.
  // Conservative wider spacing for the comfortable alternative.
  const sideStep=Math.max(1.72,(level.key==='comfortable'?2.75:level.key==='balanced'?2.3:1.85)+opts.spacingOffset*.18);
  const rowStep=Math.max(2.05,(level.key==='comfortable'?3.8:level.key==='balanced'?3.2:2.55)+opts.spacingOffset*.28);
  const edge=Math.max(chairW/2+0.5,level.edge+opts.wallBuffer);
  const bounds={x0:edge,x1:length-edge,y0:edge,y1:width-edge};
  const max=opts.maxChairs,chairs=[];
  const rows=[],columns=[];
  function sequence(low,high,step,reverse=false){
    const values=[];
    for(let v=low;v<=high+.001;v+=step)values.push(Number(v.toFixed(3)));
    return reverse?values.reverse():values;
  }
  if(frontToBack){
    rows.push(...sequence(bounds.y0,bounds.y1,rowStep,direction==='bottom'));
    columns.push(...sequence(bounds.x0,bounds.x1,sideStep));
  }else{
    rows.push(...sequence(bounds.x0,bounds.x1,rowStep,direction==='right'));
    columns.push(...sequence(bounds.y0,bounds.y1,sideStep));
  }
  const aisle=Math.max(0,opts.chairAisleFeet);
  const accepted=[];
  rowLoop:for(const row of rows){
    for(const column of columns){
      const x=frontToBack?column:row,y=frontToBack?row:column;
      const across=frontToBack?x:y,span=frontToBack?length:width;
      if(aisle>0&&Math.abs(across-span/2)<(aisle/2+chairW/2))continue;
      const box=rect(x,y,chairW,chairH);
      if(obstacles.some(o=>overlaps(box,o,.35)))continue;
      if(accepted.some(o=>overlaps(box,o,.10)))continue;
      const object={id:id(),catalog:chairKey,type:'chair',
        label:chairKey==='chiavari'?'Chiavari chair':'Folding chair',
        x,y,w:chairW,h:chairH,rot:chairRotation,generatedBy:'optimizer'};
      accepted.push(box);chairs.push(object);
      if(chairs.length>=max)break rowLoop;
    }
  }
  const existingChairs=base.filter(o=>o.type==='chair').length;
  return {key:level.key,name:level.name,description:level.description,
    chairOnly:true,chairDirection:direction,tableName:'No tables',
    aisleEstimate:rowStep-chairH,tableCount:0,seatsPerTable:0,
    newChairs:chairs.length,existingChairs,totalSeats:chairs.length+existingChairs,
    estimatedUsage:Math.round(Math.min(100,chairs.length*sideStep*rowStep/Math.max(1,width*length)*100)),
    baseObjects:base,newObjects:chairs,mode};
}

export function recommendSeating(layout,width,length,{tableKey='auto',mode='replace',chairKey='folding',
  seatCounts={},spacingOffset=0,wallBuffer=0,maxTables=80,maxChairs=300,
  chairDirection='top',chairAisleFeet=0}={}){
  const opts={
    spacingOffset:clamp(Number(spacingOffset)||0,-1,12),
    wallBuffer:clamp(Number(wallBuffer)||0,0,10),
    maxTables:Math.max(1,Math.min(80,Math.floor(Number(maxTables)||80))),
    maxChairs:Math.max(1,Math.min(300,Math.floor(Number(maxChairs)||300))),
    chairDirection:['top','right','bottom','left'].includes(chairDirection)?chairDirection:'top',
    chairAisleFeet:clamp(Number(chairAisleFeet)||0,0,15)
  };
  if(tableKey==='chairsOnly'){
    if(!Number.isFinite(width)||!Number.isFinite(length))return [];
    return LEVELS.map(level=>chairOnlyLayout(level,layout,width,length,chairKey,mode,opts));
  }
  const seatChoices={round5:[8,10],round6:[10,12],rect6:[6,8],rect8:[8,10]};
  const requested=TABLES.filter(t=>tableKey==='auto'||t.key===tableKey).map(t=>({
    ...t,seats:seatChoices[t.key].includes(Number(seatCounts[t.key]))?Number(seatCounts[t.key]):t.seats
  }));
  if(!requested.length||!Number.isFinite(width)||!Number.isFinite(length))return [];
  return LEVELS.map(level=>{
    const candidates=requested.map(t=>tryTable(t,level,layout,width,length,chairKey,mode,opts));
    candidates.sort((a,b)=>b.totalSeats-a.totalSeats||b.tableCount-a.tableCount||a.estimatedUsage-b.estimatedUsage);
    return candidates[0];
  });
}
export const SEATING_TABLE_OPTIONS=TABLES.map(({key,name,seats})=>({key,name,seats}));
export const SEAT_COUNT_CHOICES={round5:[8,10],round6:[10,12],rect6:[6,8],rect8:[8,10]};

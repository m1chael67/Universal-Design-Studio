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
const seatTypes=new Set(['chair','round','table']);
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const id=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():('gen-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const rect=(x,y,w,h)=>({left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2});
const overlaps=(a,b,pad=0)=>a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad;
const bbox=o=>{
  const a=(Number(o.rot)||0)*Math.PI/180,cos=Math.abs(Math.cos(a)),sin=Math.abs(Math.sin(a));
  return rect(o.x,o.y,cos*(o.w||1)+sin*(o.h||1),sin*(o.w||1)+cos*(o.h||1));
};
const isSeating=o=>o.type==='chair'||((o.type==='round'||o.type==='table')&&o.catalog!=='cocktail');
const clusterSize=t=>t.type==='round'?{w:t.w+3.9,h:t.h+3.9}:{w:t.w+0.8,h:t.h+3.8};
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
function buildCluster(t,x,y,chairKey){
  const tag=id();
  const table={id:tag,catalog:t.key,type:t.type,label:t.name,x,y,w:t.w,h:t.h,rot:0,generatedBy:'optimizer'};
  const objects=[table];
  function chair(cx,cy,rotation){
    objects.push({id:id(),catalog:chairKey,type:'chair',
      label:chairKey==='chiavari'?'Chiavari chair':'Folding chair',
      x:Number(cx.toFixed(3)),y:Number(cy.toFixed(3)),w:1.65,h:1.65,
      rot:((rotation%360)+360)%360,generatedBy:'optimizer'});
  }
  if(t.type==='round'){
    const radius=t.w/2+1.1;
    for(let i=0;i<t.seats;i++){
      const angle=-Math.PI/2+(2*Math.PI*i)/t.seats;
      chair(x+radius*Math.cos(angle),y+radius*Math.sin(angle),angle*180/Math.PI+90);
    }
  }else{
    const each=t.seats/2,offset=t.h/2+1.05;
    for(let i=0;i<each;i++){
      const tx=x-t.w/2+(i+1)*t.w/(each+1);
      chair(tx,y-offset,0);chair(tx,y+offset,180);
    }
  }
  return objects;
}
function tryTable(t,level,layout,width,length,chairKey,mode){
  const old=normObjects(layout.objects),base=mode==='replace'?old.filter(o=>!isSeating(o)):old;
  const obstacleRects=base.map(o=>fixtureClearance(o,level));
  for(const door of layout.doors||[])obstacleRects.push(doorReservation(door,width,length));
  const dims=clusterSize(t),stepX=dims.w+level.gap,stepY=dims.h+level.gap;
  const xStart=level.edge+dims.w/2,yStart=level.edge+dims.h/2;
  let best=[];
  for(const stagger of [false,true]){
    for(const xPhase of [0,.25,.5]){
      for(const yPhase of [0,.25,.5]){
        const found=[],bounds=[];
        for(let y=yStart+yPhase*stepY,row=0;y<=width-level.edge-dims.h/2+.0001;y+=stepY,row++){
          for(let x=xStart+xPhase*stepX+(stagger&&row%2?stepX/2:0);x<=length-level.edge-dims.w/2+.0001;x+=stepX){
            const r=rect(x,y,dims.w,dims.h);
            if(obstacleRects.some(b=>overlaps(r,b,level.gap/3)))continue;
            if(bounds.some(b=>overlaps(r,b,level.gap-.01)))continue;
            bounds.push(r);found.push([x,y]);
            if(found.length>=80)break;
          }
          if(found.length>=80)break;
        }
        if(found.length>best.length)best=found;
      }
    }
  }
  const created=best.flatMap(([x,y])=>buildCluster(t,x,y,chairKey));
  const newChairs=created.filter(o=>o.type==='chair').length;
  const existingChairs=base.filter(o=>o.type==='chair').length;
  const seatArea=newChairs*dims.w*dims.h/Math.max(1,t.seats);
  return {
    key:level.key,name:level.name,description:level.description,tableName:t.name,
    aisleEstimate:level.gap,tableKey:t.key,tableCount:best.length,
    newChairs,existingChairs,totalSeats:existingChairs+newChairs,
    estimatedUsage:Math.round(Math.min(100,seatArea/Math.max(1,width*length)*100)),
    baseObjects:base,newObjects:created,mode
  };
}
export function recommendSeating(layout,width,length,{tableKey='auto',mode='replace',chairKey='folding'}={}){
  const requested=TABLES.filter(t=>tableKey==='auto'||t.key===tableKey);
  if(!requested.length||!Number.isFinite(width)||!Number.isFinite(length))return [];
  return LEVELS.map(level=>{
    const candidates=requested.map(t=>tryTable(t,level,layout,width,length,chairKey,mode));
    candidates.sort((a,b)=>b.totalSeats-a.totalSeats||b.tableCount-a.tableCount||a.estimatedUsage-b.estimatedUsage);
    return candidates[0];
  });
}
export const SEATING_TABLE_OPTIONS=TABLES.map(({key,name,seats})=>({key,name,seats}));

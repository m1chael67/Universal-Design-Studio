import * as THREE from 'three';
import {westCoastProfile} from './westCoastProfile.js';
import {resolveStairHeights} from './stageMatching.js';
import {addTentDimensions,addStageDimension} from './threeDDimensions.js';
import {clamp,normalizedInterior,tentDimensions,getWallSegments,objectPosition,sitePlacements,siteRadius} from './tent3DMath.js';

const STEEL=0x86969b;
const WHITE=0xf1f0e9;
const TEAL=0x67bab2;
const blue=0x9da6ce;
const mats=new Map();
const material=(color,opacity=1)=>{
  const key=color+'/'+opacity;
  if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({
    color,roughness:.76,metalness:color===STEEL?.47:.04,side:THREE.DoubleSide,
    transparent:opacity<1,opacity,depthWrite:opacity>=1
  }));
  return mats.get(key);
};
function cube(root,w,h,d,x,y,z,color,opacity=1){
  const m=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.03,w),Math.max(.03,h),Math.max(.03,d)),material(color,opacity));
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
}
function post(root,start,end,radius=.055,color=STEEL){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),delta=b.clone().sub(a);
  if(delta.length()<.001)return;
  const obj=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),8),material(color));
  obj.position.copy(a.add(b).multiplyScalar(.5));
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  obj.castShadow=true;root.add(obj);return obj;
}
function roofPanel(root,length,depth,eave,ridge,opacity){
  const vertices=[
    -length/2,eave,-depth/2, length/2,eave,-depth/2, length/2,ridge,0,
    -length/2,eave,-depth/2, length/2,ridge,0, -length/2,ridge,0,
    -length/2,ridge,0, length/2,ridge,0, length/2,eave,depth/2,
    -length/2,ridge,0, length/2,eave,depth/2, -length/2,eave,depth/2
  ];
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  const cover=new THREE.Mesh(geometry,material(WHITE,opacity));
  cover.castShadow=true;cover.receiveShadow=true;root.add(cover);
}
function addStructure(root,{length,width,eave,ridge,bays,roofMode,frameVisible}){
  const xAt=i=>-length/2+(length*i/bays);
  const coverOpacity=roofMode==='xray'?.24:.88;
  if(roofMode!=='hidden')roofPanel(root,length,width,eave,ridge,coverOpacity);
  if(!frameVisible)return;
  // Perimeter rails, ridge and purlins are shown even when roof panels are hidden.
  for(const z of [-width/2,width/2]){
    post(root,[-length/2,eave,z],[length/2,eave,z],.085);
    post(root,[-length/2,0,z],[-length/2,eave,z],.08);
    post(root,[length/2,0,z],[length/2,eave,z],.08);
  }
  if(ridge>eave+.01){
    post(root,[-length/2,ridge,0],[length/2,ridge,0],.085);
    for(const z of [-width/4,width/4]){
      const y=eave+(ridge-eave)*(1-Math.abs(z)/(width/2));
      post(root,[-length/2,y,z],[length/2,y,z],.06);
    }
  }else{
    post(root,[-length/2,eave,0],[length/2,eave,0],.08);
  }
  for(let i=0;i<=bays;i++){
    const x=xAt(i);
    for(const z of [-width/2,width/2])post(root,[x,0,z],[x,eave,z],.09);
    post(root,[x,eave,-width/2],[x,ridge,0],.075);
    post(root,[x,ridge,0],[x,eave,width/2],.075);
    // A low cross-tie gives the user a clear visual reference for the bay structure.
    if(i===0||i===bays)post(root,[x,eave,-width/2],[x,eave,width/2],.055);
  }
  // Roof seams follow each bay boundary, separate from the stronger structural frame.
  if(roofMode!=='hidden')for(let i=1;i<bays;i++){
    const x=xAt(i)+.018;
    post(root,[x,eave+.03,-width/2],[x,ridge+.03,0],.019,0xb9c0bc);
    post(root,[x,ridge+.03,0],[x,eave+.03,width/2],.019,0xb9c0bc);
  }
}

// West Coast frame: four sloped hip corners, short ridge, intermediate ridge
// crowns and perimeter tees. The four roof planes are triangulated separately.
function westCoastRoof(root,p,opacity){
  const {length,width,eave,ridge,left,right}=p;
  const a=-length/2,b=length/2,d=width/2;
  const triangles=[
    // two long trapezoidal roof slopes
    [a,eave,-d,b,eave,-d,right,ridge,0],
    [a,eave,-d,right,ridge,0,left,ridge,0],
    [a,eave,d,left,ridge,0,right,ridge,0],
    [a,eave,d,right,ridge,0,b,eave,d],
    // hipped end caps
    [a,eave,-d,left,ridge,0,a,eave,d],
    [b,eave,-d,b,eave,d,right,ridge,0]
  ];
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(triangles.flat(),3));
  geometry.computeVertexNormals();
  const canopy=new THREE.Mesh(geometry,material(WHITE,opacity));
  canopy.castShadow=true;canopy.receiveShadow=true;root.add(canopy);
}
// Render a double-tube rafter/hip with a lower structural tube; not a tube cut list.
function frameRafter(root,start,end,doubleTube){
  post(root,start,end,.077);
  if(doubleTube){
    post(root,[start[0],start[1]-.22,start[2]],[end[0],end[1]-.22,end[2]],.047,0x69787c);
  }
}
function frameFitting(root,x,y,z,corner=false){
  const obj=new THREE.Mesh(new THREE.SphereGeometry(corner?.14:.105,10,7),material(STEEL));
  obj.position.set(x,y,z);root.add(obj);
}
function addWestCoastStructure(root,{length,width,eave,roofMode,frameVisible}){
  const p=westCoastProfile(length,width,eave);
  const d=width/2,a=-length/2,b=length/2;
  if(roofMode!=='hidden')westCoastRoof(root,p,roofMode==='xray'?.23:.88);
  if(!frameVisible)return p;
  // Long-side / end-wall spreaders. Each bay corresponds to actual Celina
  // spacing (10 ft for 20/40 wide, 15 ft or mixed 15/10 for 30 wide).
  for(const z of [-d,d]){
    for(let i=0;i<p.xs.length-1;i++){
      post(root,[p.xs[i],eave,z],[p.xs[i+1],eave,z],.085);
    }
    for(const x of p.legXs){
      post(root,[x,0,z],[x,eave,z],.087);
      cube(root,.48,.07,.48,x,.035,z,STEEL);
      frameFitting(root,x,eave,z,x===a||x===b);
    }
  }
  const endZs=[-d,...p.endLegZs,d].sort((x,y)=>x-y);
  for(const x of [a,b]){
    for(let i=0;i<endZs.length-1;i++)post(root,[x,eave,endZs[i]],[x,eave,endZs[i+1]],.085);
    for(const z of p.endLegZs){
      post(root,[x,0,z],[x,eave,z],.087);
      cube(root,.48,.07,.48,x,.035,z,STEEL);
      frameFitting(root,x,eave,z);
    }
  }
  // Ridge spreaders and alternating 6-way / intermediate ridge crowns.
  for(let i=0;i<p.ridgeXs.length-1;i++)
    post(root,[p.ridgeXs[i],p.ridge,0],[p.ridgeXs[i+1],p.ridge,0],.084);
  for(const x of p.ridgeXs)frameFitting(root,x,p.ridge,0,x===p.left||x===p.right);
  // Main transverse rafters and the head/end-wall rafters (both are necessary
  // to reproduce the Celina 20x40 count of eight roof rafters).
  for(const x of p.ridgeXs){
    for(const z of [-d,d])frameRafter(root,[x,p.ridge,0],[x,eave,z],p.doubleTube);
  }
  if(p.endLegZs.includes(0)||p.familyWidth===40){
    for(const [x,crownX] of [[a,p.left],[b,p.right]]){
      frameRafter(root,[crownX,p.ridge,0],[x,eave,0],p.doubleTube);
    }
  }
  if(p.familyWidth===40){
    // ETS 40-wide quarter sections: each four-way diagonal hip has a 6-way
    // joint connected to the corner and the adjacent end/side tee fittings.
    for(const joint of p.hipJoints){
      const leftEnd=joint.x<0;
      const endX=leftEnd?a:b;
      const crownX=leftEnd?p.left:p.right;
      const sign=Math.sign(joint.z),j=[joint.x,joint.y,joint.z];
      frameRafter(root,[crownX,p.ridge,0],j,true);
      frameRafter(root,j,[endX,eave,sign*d],true);
      frameRafter(root,j,[endX,eave,sign*10],true);
      frameRafter(root,j,[joint.x,eave,sign*d],true);
      frameFitting(root,...j,true);
    }
  }else{
    // Classic single hip rafter directly between each crown and corner.
    for(const x of [a,b])for(const z of [-d,d]){
      const crownX=x===a?p.left:p.right;
      frameRafter(root,[crownX,p.ridge,0],[x,eave,z],p.doubleTube);
    }
  }
  if(p.doubleTube){
    // Under-ridge braces / 4-point cable layout. Simplified visual members
    // based on Celina's 30- and 40-wide diagrams; do not calculate loads.
    for(const x of p.ridgeXs){
      const y=eave+p.rise*.45,reach=d*.6;
      post(root,[x,y,-reach],[x,y,reach],.043,0x66777b);
      for(const z of [-d,d]){
        const attach=reach*Math.sign(z);
        post(root,[x,y,attach],[x,eave+.35,z],.019,0x7c8d96);
        post(root,[x,y,attach],[x,p.ridge-.35,0],.019,0x7c8d96);
      }
    }
  }
  if(roofMode!=='hidden'){
    for(const x of p.ridgeXs){
      if(x<=p.left+.01||x>=p.right-.01)continue;
      for(const z of [-d,d])post(root,[x,eave+.024,z],[x,p.ridge+.024,0],.018,0xb6bdbb);
    }
  }
  return p;
}

function addWall(root,wall,interior,length,width,eave){
  const {segments,openings,span}=getWallSegments(wall,interior.doors,length,width);
  const wallThickness=.045;
  const middle=(start,end)=>{
    const loc=(start+end)/2-span/2;
    if(wall==='top')return [loc,-width/2,end-start,wallThickness];
    if(wall==='bottom')return [loc,width/2,end-start,wallThickness];
    if(wall==='left')return [-length/2,loc,wallThickness,end-start];
    return [length/2,loc,wallThickness,end-start];
  };
  for(const {start,end} of segments){
    const [x,z,w,d]=middle(start,end);
    cube(root,w,eave,d,x,eave/2,z,0xe4e8e5,.72);
  }
  for(const {start,end} of openings){
    const [x,z,w,d]=middle(start,end);
    // A walk-through gap is actually cut out of the wall, rather than drawn over it.
    const head=Math.min(7,eave-.35),topHeight=Math.max(0,eave-head);
    if(topHeight>.03)cube(root,w,topHeight,d,x,head+topHeight/2,z,0xe1e7e6,.72);
    const edge=(at)=>{
      const p=middle(at,at),ex=p[0],ez=p[1];
      post(root,[ex,0,ez],[ex,head,ez],.055,0x718a8e);
    };
    edge(start);edge(end);
    if(wall==='top'||wall==='bottom')post(root,[x-w/2,head,z],[x+w/2,head,z],.06,0x718a8e);
    else post(root,[x,head,z-d/2],[x,head,z+d/2],.06,0x718a8e);
  }
  return openings.length;
}
function addSidewalls(root,layout,length,width,eave){
  let rendered=0,doors=0;
  for(const wall of ['top','right','bottom','left']){
    if(!layout.sidewalls[wall])continue;
    rendered++;doors+=addWall(root,wall,layout,length,width,eave);
  }
  return {rendered,doors};
}
function legs(group,w,h,y,count=4){
  const x=w*.37,z=h*.33;
  for(const px of [-x,x])for(const pz of [-z,z])
    cube(group,.09,Math.max(.1,y),.09,px,Math.max(.1,y)/2,pz,STEEL);
}
function addFurniture(root,layout,length,width,showDimensions=false){
  const pickables=[];
  for(const o of resolveStairHeights(layout.objects)){
    const position=objectPosition(o,length,width);
    const w=clamp(Number(o.w)||2,.35,50),d=clamp(Number(o.h)||2,.35,50);
    const group=new THREE.Group();
    group.position.set(position.x,0,position.z);group.rotation.y=-position.rotation;
    const title=String(o.label||o.catalog||o.type||'Furniture').slice(0,80);
    group.userData.item={title,type:o.type||'table',width:w,depth:d,
      heightInches:Number(o.heightInches)||undefined,attachedStageId:o.attachedStageId||null};
    root.add(group);
    const type=o.type||'table';
    if(type==='round'){
      const cocktail=o.catalog==='cocktail',height=cocktail?3.5:2.5;
      const disk=new THREE.Mesh(new THREE.CylinderGeometry(w/2,w/2,.13,24),material(TEAL));
      disk.position.y=height;disk.castShadow=true;group.add(disk);
      post(group,[0,0,0],[0,height-.06,0],.085,STEEL);
      cube(group,Math.min(w,1.1),.09,Math.min(d,1.1),0,.05,0,STEEL);
    }else if(type==='chair'){
      // Chairs get a true seat, backrest and legs rather than an upright block.
      cube(group,w*.86,.14,d*.83,0,1.42,0,blue);
      cube(group,w*.84,1.15,.13,0,2.05,-d*.35,blue);
      legs(group,w*.86,d*.83,1.35);
    }else if(type==='dance'){
      const columns=Math.max(1,Math.min(20,Math.ceil(w/3))),rows=Math.max(1,Math.min(20,Math.ceil(d/3)));
      for(let ix=0;ix<columns;ix++)for(let iz=0;iz<rows;iz++)
        cube(group,w/columns-.025,.12,d/rows-.025,-w/2+w*(ix+.5)/columns,.1,-d/2+d*(iz+.5)/rows,
          (ix+iz)%2?0xddd3d4:0xb39faf);
    }else if(type==='stage'){
      // Modular 4 × 4 ft black stage decks; the saved height is deck-top height.
      const deckHeight=clamp((Number(o.heightInches)||16)/12,.333,6);
      const deckThickness=.12;
      const columns=Math.max(1,Math.round(w/4)),rows=Math.max(1,Math.round(d/4));
      for(let ix=0;ix<columns;ix++)for(let iz=0;iz<rows;iz++){
        const cw=w/columns,cd=d/rows;
        const cx=-w/2+(ix+.5)*cw,cz=-d/2+(iz+.5)*cd;
        cube(group,cw-.025,deckThickness,cd-.025,cx,deckHeight-deckThickness/2,cz,0x17191d);
        // Separate under-deck frame and support legs on every module.
        for(const zz of [-cd*.38,cd*.38]){
          cube(group,cw*.88,.055,.065,cx,deckHeight-.18,cz+zz,0x555b60);
        }
        for(const xx of [-cw*.39,cw*.39])for(const zz of [-cd*.39,cd*.39]){
          cube(group,.075,Math.max(.1,deckHeight-.17),.075,cx+xx,(deckHeight-.17)/2,cz+zz,0x6b7073);
        }
      }
      if(showDimensions)addStageDimension(group,deckHeight);
    }else if(type==='stairs'){
      // The near (-Z) edge is the HIGH end, matching the TOP / STAGE marker in 2D.
      const topHeight=clamp((Number(o.heightInches)||16)/12,.333,6);
      const stepCount=Math.max(2,Math.ceil(topHeight/.58));
      const treadRun=d/stepCount;
      for(let i=0;i<stepCount;i++){
        const stepHeight=topHeight*(stepCount-i)/stepCount;
        cube(group,w-.05,stepHeight,treadRun-.02,0,stepHeight/2,-d/2+(i+.5)*treadRun,0x393b3e);
        cube(group,w-.05,.06,treadRun-.02,0,stepHeight,-d/2+(i+.5)*treadRun,0x17191c);
      }
    }else if(type==='bar'){
      cube(group,w,.24,d,0,3.4,0,0x90a971);
      cube(group,w*.88,3.25,.15,0,1.63,-d*.32,0x728866);
      for(const px of [-w*.4,w*.4])cube(group,.13,3.3,.13,px,1.65,d*.25,STEEL);
    }else{
      cube(group,w,.16,d,0,2.45,0,TEAL);
      legs(group,w,d,2.36);
    }
    pickables.push(group);
  }
  return pickables;
}
export function buildTentScene(scene,tent,options={}){
  const {length,width}=tentDimensions(tent);
  const layout=normalizedInterior(tent);
  const legHeight=clamp(Number(options.legHeight)||7,7,16);
  const roofStyle=options.roofStyle||'westcoast';
  const frameProfile=roofStyle==='westcoast'?westCoastProfile(length,width,legHeight):null;
  const ridge=frameProfile?frameProfile.ridge:legHeight+(roofStyle==='flat'?0:Math.min(18,width*(roofStyle==='highpeak'?.48:.27)));
  const bays=frameProfile?frameProfile.bayCount:Math.max(1,Math.ceil(length/clamp(Number(options.baySpacing)||20,8,30)));
  const root=new THREE.Group();scene.add(root);
  if(frameProfile)addWestCoastStructure(root,{length,width,eave:legHeight,
    roofMode:options.roofMode||'solid',frameVisible:options.frameVisible!==false});
  else addStructure(root,{length,width,eave:legHeight,ridge,bays,roofMode:options.roofMode||'solid',
    frameVisible:options.frameVisible!==false});
  if(options.showDimensions)addTentDimensions(root,{length,width,eave:legHeight,ridge});
  const walls=options.wallVisible===false?{rendered:0,doors:0}:addSidewalls(root,layout,length,width,legHeight);
  const pickables=options.furnitureVisible===false?[]:addFurniture(root,layout,length,width,options.showDimensions===true);
  return {length,width,eave:legHeight,ridge,bays,walls,pickables,visibleObjects:pickables.length,frameProfile,root};
}

export function buildSiteScene(scene,tents,options={}){
  const placements=sitePlacements(tents);
  const pickables=[];
  let visibleObjects=0,bays=0;
  for(const p of placements){
    const anchor=new THREE.Group();
    anchor.position.set(p.x,0,p.z);
    anchor.rotation.y=p.theta;
    scene.add(anchor);
    const part=buildTentScene(anchor,p.tent,options);
    for(const group of part.pickables){
      if(group.userData?.item){
        group.userData.item={...group.userData.item,
          title:(p.tent.name||p.tent.width+' × '+p.tent.length+' tent')+' · '+group.userData.item.title};
      }
      pickables.push(group);
    }
    visibleObjects+=part.visibleObjects;
    bays+=part.bays;
  }
  return {pickables,visibleObjects,bays,radius:siteRadius(tents),tents:placements.length,root:scene};
}

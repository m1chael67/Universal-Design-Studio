import * as THREE from 'three';
import {westCoastProfile,fortyWideCrownRafters} from './westCoastProfile.js';
import {resolveStairHeights} from './stageMatching.js';
import {addTentDimensions,addStageDimension} from './threeDDimensions.js';
import {stage3DGeometry,stair3DGeometry} from './stage3DGeometry.js';
import {pipeDrapeBays,trash32Dimensions} from './eventEquipment.js';
import {clamp,normalizedInterior,tentDimensions,getWallSegments,objectPosition,sitePlacements,siteRadius} from './tent3DMath.js';

const STEEL=0x86969b;
const WHITE=0xf1f0e9;
const TEAL=0x67bab2;
const blue=0x9da6ce;
const mats=new Map();
const material=(color,opacity=1)=>{
  const key=color+'/'+opacity;
  if(!mats.has(key)){
    const shared=new THREE.MeshStandardMaterial({
      color,roughness:.76,metalness:color===STEEL?.47:.04,side:THREE.DoubleSide,
      transparent:opacity<1,opacity,depthWrite:opacity>=1
    });
    shared.userData.sharedMaterial=true;
    mats.set(key,shared);
  }
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
// Draw single stock-tube rafters. Optional structural braces are separate members.
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
  // A 40-wide six-way crown has exactly five roof branches plus one ridge tube.
  const sixWay40=p.familyWidth===40&&p.right-p.left>.01;
  for(const x of p.ridgeXs){
    if(sixWay40&&(x===p.left||x===p.right))continue;
    for(const z of [-d,d])frameRafter(root,[x,p.ridge,0],[x,eave,z],p.doubleTube);
  }
  if(sixWay40){
    for(const end of ['left','right']){
      const crownX=end==='left'?p.left:p.right;
      for(const target of fortyWideCrownRafters(p,end))
        frameRafter(root,[crownX,p.ridge,0],target,false);
    }
  }else if(p.endLegZs.includes(0)||p.familyWidth===40){
    for(const [x,crownX] of [[a,p.left],[b,p.right]]){
      frameRafter(root,[crownX,p.ridge,0],[x,eave,0],p.doubleTube);
    }
  }
  if(p.familyWidth===40){
    // Single-tube 40-wide roof with six-way perimeter side tees and extra
    // roof rafters. The 40-wide scheme is a visual reference, not a BOM.
    // Four 6-way tees at the side near the hipped ends, two on end walls.
    for(const tee of p.sideSixWayTees){
      frameFitting(root,tee.x,eave,tee.z,true);
      // The fitting is wider than an ordinary tee: visible extra angled ports.
      // Render short sockets rather than unsupported full-length members.
      const end=tee.x===a||tee.x===b;
      const dir=end?(tee.x===a?1:-1):0;
      for(const side of [-1,1]){
        const vx=end?dir*.42:side*.32;
        const vz=end?side*.32:-Math.sign(tee.z)*.42;
        post(root,[tee.x,eave,tee.z],[tee.x+vx,eave+.22,tee.z+vz],.095);
      }
    }
    // ETS 40-wide quarter sections: each four-way diagonal hip has a 6-way
    // joint connected to the corner and the adjacent end/side tee fittings.
    for(const joint of p.hipJoints){
      const leftEnd=joint.x<0;
      const endX=leftEnd?a:b;
      const crownX=leftEnd?p.left:p.right;
      const sign=Math.sign(joint.z),j=[joint.x,joint.y,joint.z];
      if(!sixWay40)frameRafter(root,[crownX,p.ridge,0],j,false);
      frameRafter(root,j,[endX,eave,sign*d],false);
      frameRafter(root,j,[endX,eave,sign*10],false);
      frameRafter(root,j,[joint.x,eave,sign*d],false);
      frameFitting(root,...j,true);
    }
  }else{
    // Classic single hip rafter directly between each crown and corner.
    for(const x of [a,b])for(const z of [-d,d]){
      const crownX=x===a?p.left:p.right;
      frameRafter(root,[crownX,p.ridge,0],[x,eave,z],p.doubleTube);
    }
  }
  if(p.familyWidth===20&&p.ridgeXs.length>=3){
    // Celina 20-wide long frames have a 20-ft cable assembly at each
    // transverse ridge station; show these as fine tension members.
    for(const x of p.ridgeXs){
      post(root,[x,eave+.24,-d],[x,eave+.24,d],.014,0x829498);
    }
  }
  if(p.familyWidth===40){
    // Separate rafter braces and tension lines; these are NOT duplicate
    // parallel rafter tubes. Simplified visual members
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
    const w=clamp(Number(o.w)||2,.35,o.type==='pipeDrape'?200:50),d=clamp(Number(o.h)||2,.35,50);
    const group=new THREE.Group();
    group.position.set(position.x,0,position.z);group.rotation.y=-position.rotation;
    const title=String(o.type==='chair'&&['chiavari','resin'].includes(o.catalog)?'Resin chair':(o.label||o.catalog||o.type||'Furniture')).slice(0,80);
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
      const chairColor=['resin','chiavari'].includes(o.catalog)?0xf0efea:blue;
      cube(group,w*.86,.14,d*.83,0,1.42,0,chairColor);
      cube(group,w*.84,1.15,.13,0,2.05,-d*.35,chairColor);
      legs(group,w*.86,d*.83,1.35);
    }else if(type==='dance'){
      const columns=Math.max(1,Math.min(20,Math.ceil(w/3))),rows=Math.max(1,Math.min(20,Math.ceil(d/3)));
      for(let ix=0;ix<columns;ix++)for(let iz=0;iz<rows;iz++)
        cube(group,w/columns-.025,.12,d/rows-.025,-w/2+w*(ix+.5)/columns,.1,-d/2+d*(iz+.5)/rows,
          (ix+iz)%2?0xddd3d4:0xb39faf);
    }else if(type==='stage'){
      const deck=stage3DGeometry(w,d,o.heightInches);
      // One black top per 4-by-4-foot Bil-Jax panel with an actual seam
      // between panels, supported by its own aluminum frame.
      for(const panel of deck.panels){
        const {x,z,width:pw,depth:pd}=panel;
        cube(group,pw-.055,deck.thicknessFeet,pd-.055,
          x,deck.topFeet-deck.thicknessFeet/2,z,0x131619);
        // The bright metal outline is BELOW the top: the visible deck is
        // black, and the slim sections can be counted from a distance.
        const frameY=deck.topFeet-deck.thicknessFeet-.055;
        for(const edge of [-1,1]){
          cube(group,pw-.07,.075,.08,x,frameY,z+edge*(pd/2-.10),0x69727a);
          cube(group,.08,.075,pd-.07,x+edge*(pw/2-.10),frameY,z,0x69727a);
        }
      }
      // A single leg at EVERY grid corner/intersection, rather than four
      // inset legs on each section (which were duplicated at each seam).
      for(const point of deck.legPoints){
        const legHeight=deck.supportTopFeet;
        cube(group,.11,legHeight,.11,point.x,legHeight/2,point.z,0x8d949a);
        cube(group,.22,.045,.22,point.x,.025,point.z,0x686f75);
        cube(group,.18,.065,.18,point.x,legHeight-.03,point.z,0x9ba2a7);
      }
      if(showDimensions)addStageDimension(group,deck.topFeet,w,d);
      group.userData.item.heightInches=Math.round(deck.topFeet*12);
      group.userData.item.sections=deck.columns+' × '+deck.rows;
      group.userData.item.legCount=deck.legPoints.length;
    }else if(type==='stairs'){
      // 2D yellow TOP/STAGE line is on local -Y; mapped 3D high edge is
      // local -Z. Rotate the whole staircase exactly like the planner.
      const stairs=stair3DGeometry(d,o.heightInches);
      for(const tread of stairs.treads){
        const {z,heightFeet,runFeet}=tread;
        cube(group,w-.04,Math.max(.04,heightFeet-.065),runFeet-.018,
          0,(heightFeet-.065)/2,z,0x44494d);
        cube(group,w-.04,.065,runFeet-.018,
          0,heightFeet-.0325,z,0x202327);
      }
      // The yellow marker sits ON the highest tread at the stage-facing
      // edge, in the same local direction as its 2D counterpart.
      cube(group,w-.1,.018,.08,0,stairs.topFeet+.013,
        stairs.topEdgeZ+.065,0xf6d45e);
      group.userData.item.heightInches=Math.round(stairs.topFeet*12);
    }else if(type==='pipeDrape'){
      const drape=pipeDrapeBays(w,o.heightFeet);
      // Pipe-and-drape posts are shared at joints. Each crossbar is <=10 ft.
      for(const x of drape.uprights){
        post(group,[x,0,0],[x,drape.height,0],.045,STEEL);
        cube(group,.48,.055,.48,x,.028,0,0x78878e);
      }
      for(const bay of drape.bays){
        post(group,[bay.start,drape.height,0],[bay.end,drape.height,0],.042,STEEL);
        cube(group,Math.max(.08,bay.span-.10),Math.max(.4,drape.height-.24),.065,
          bay.center,(drape.height-.24)/2+.03,0,0x34364f,.93);
        // Fine vertical curtain pleats communicate fabric, rather than a wall.
        const folds=Math.max(2,Math.floor(bay.span/.75));
        for(let n=1;n<folds;n++){
          const fx=bay.start+bay.span*n/folds;
          cube(group,.025,Math.max(.3,drape.height-.35),.083,fx,(drape.height-.35)/2+.03,0,0x53536d,.88);
        }
      }
      group.userData.item.heightFeet=drape.height;
      group.userData.item.sections=drape.count;
    }else if(type==='trash'){
      const {diameterFeet,heightFeet}=trash32Dimensions;
      const radius=diameterFeet/2;
      const body=new THREE.Mesh(new THREE.CylinderGeometry(radius*.91,radius*.79,heightFeet-.12,20),material(0x44494c));
      body.position.y=(heightFeet-.12)/2;body.castShadow=true;group.add(body);
      const lid=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius*.96,.13,20),material(0x25292c));
      lid.position.y=heightFeet-.07;group.add(lid);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(radius*.94,.036,8,24),material(0x8b9295));
      rim.rotation.x=Math.PI/2;rim.position.y=heightFeet-.1;group.add(rim);
      group.userData.item.capacityGallons=32;
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

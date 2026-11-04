import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import './threeD.css';

const num=(n,d=0)=>Number.isFinite(Number(n))?Number(n):d;
const colorFor={round:0x58aeb0,table:0x58aeb0,chair:0x8f9ed1,stage:0xb88c50,dance:0xd4a3c9,bar:0x88a96a,stairs:0xb1a48c};
const material=(c,opacity=1)=>new THREE.MeshStandardMaterial({color:c,roughness:.8,transparent:opacity<1,opacity,side:THREE.DoubleSide});
function box(scene,w,h,d,x,y,z,col,rot=0){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(col));
  mesh.position.set(x,y,z);mesh.rotation.y=-rot*Math.PI/180;mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
function addTent(scene,tent,{roof,sidewalls,showFurniture,roofStyle='gable',legHeight=9,baySpacing=20}){
  const width=Math.max(2,Math.min(250,num(tent.length,40))),depth=Math.max(2,Math.min(250,num(tent.width,20)));
  const eave=Math.max(6,Math.min(16,num(legHeight,9)));
  const ridge=eave+(roofStyle==='flat'?0:Math.min(18,depth*(roofStyle==='highpeak'?.5:.28)));
  const bays=Math.max(1,Math.ceil(width/Math.max(5,num(baySpacing,20))));
  const white=0xe7e9e6;
  for(let bay=0;bay<=bays;bay++){
    const x=-width/2+width*bay/bays;
    for(const z of [-depth/2,depth/2])box(scene,.18,eave,.18,x,eave/2,z,0x87989c);
    if(roofStyle!=='flat'){
      const rafter=new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x,eave,-depth/2),new THREE.Vector3(x,ridge,0),new THREE.Vector3(x,eave,depth/2)
      ]);
      const lines=new THREE.Line(rafter,new THREE.LineBasicMaterial({color:0x82989c}));
      scene.add(lines);
    }
  }
  const geometry=new THREE.BufferGeometry();
  const vertices=[
    -width/2,eave,-depth/2, width/2,eave,-depth/2, width/2,ridge,0,
    -width/2,eave,-depth/2,width/2,ridge,0,-width/2,ridge,0,
    -width/2,ridge,0,width/2,ridge,0,width/2,eave,depth/2,
    -width/2,ridge,0,width/2,eave,depth/2,-width/2,eave,depth/2
  ];
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  const roofMesh=new THREE.Mesh(geometry,material(white,roof?.opacity??.88));
  roofMesh.visible=roof?.visible!==false;roofMesh.castShadow=true;scene.add(roofMesh);
  box(scene,width,.12,.12,0,ridge,0,0xb3bfc2);
  if(sidewalls){
    const sides=tent.interior?.sidewalls||{};
    const wallMat=material(0xf2f4f1,.6);
    const walls=[
      ['top',0,-depth/2,width,eave],
      ['bottom',0,depth/2,width,eave],
      ['left',-width/2,0,depth,eave],
      ['right',width/2,0,depth,eave]
    ];
    for(const [key,x,z,len,height] of walls){
      if(sides[key]===false)continue;
      const wall=new THREE.Mesh(new THREE.PlaneGeometry(len,height),wallMat);
      wall.position.set(x,height/2,z);
      if(key==='left'||key==='right')wall.rotation.y=Math.PI/2;
      scene.add(wall);
    }
  }
  if(showFurniture){
    const objects=Array.isArray(tent.interior?.objects)?tent.interior.objects.slice(0,500):[];
    const sourceWidth=num(tent.interior?.width,width),sourceHeight=num(tent.interior?.height,depth);
    const swap=Math.abs(sourceWidth-depth)<.01&&Math.abs(sourceHeight-width)<.01;
    for(const o of objects){
      const ow=Math.max(.3,Math.min(40,num(o.w,2))),oh=Math.max(.3,Math.min(40,num(o.h,2)));
      const ox=num(o.x,width/2),oy=num(o.y,depth/2);
      const x=(swap?oy:ox)-width/2,z=(swap?ox:oy)-depth/2;
      const t=o.type||'table',col=colorFor[t]||0x8da7a4;
      const level=t==='stage'?.7:t==='dance'?.09:t==='chair'?.9:t==='bar'?3:2.4;
      if(t==='round'){
        const top=new THREE.Mesh(new THREE.CylinderGeometry(ow/2,ow/2,.14,24),material(col));
        top.position.set(x,level,z);scene.add(top);
        box(scene,.13,level,.13,x,level/2,z,0x8b9a9b);
      }else{
        const thick=t==='chair'?.2:t==='stage'?.7:t==='dance'?.12:.22;
        box(scene,ow,thick,oh,x,level,z,col,num(o.rot));
        if(['table','bar','chair'].includes(t)){
          box(scene,.13,Math.max(.1,level-thick),.13,x,Math.max(.1,(level-thick)/2),z,0x84918f);
        }
      }
    }
  }
  return {width,depth,eave,ridge};
}
export default function ThreeDViewer({tents,onClose}){
  const mount=useRef(null),renderRef=useRef(null);
  const [index,setIndex]=useState(0),[roofVisible,setRoofVisible]=useState(true),[wallVisible,setWallVisible]=useState(true),
    [furnitureVisible,setFurnitureVisible]=useState(true),[roofStyle,setRoofStyle]=useState('gable'),
    [legHeight,setLegHeight]=useState(9),[baySpacing,setBaySpacing]=useState(20),[error,setError]=useState('');
  const choices=(tents||[]).filter(t=>!t.hidden);
  const tent=choices[Math.min(index,Math.max(0,choices.length-1))];
  useEffect(()=>{
    if(!tent||!mount.current)return;
    const host=mount.current;
    let renderer,controls,observer,frame=0,scene;
    try{
      scene=new THREE.Scene();scene.background=new THREE.Color(0x1c303a);
      const width=Math.max(2,Math.min(250,num(tent.length,40))),depth=Math.max(2,Math.min(250,num(tent.width,20)));
      const camera=new THREE.PerspectiveCamera(48,1,.1,1500);
      const radius=Math.max(width,depth);
      camera.position.set(radius*.9,radius*.65,radius*.85);
      renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
      renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      host.appendChild(renderer.domElement);
      controls=new OrbitControls(camera,renderer.domElement);
      controls.target.set(0,Math.max(3,depth*.25),0);
      controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.49;
      controls.minDistance=4;controls.maxDistance=radius*5;
      scene.add(new THREE.HemisphereLight(0xf1fbff,0x6e8181,2.2));
      const sun=new THREE.DirectionalLight(0xffffff,2.4);
      sun.position.set(-radius*.6,radius,radius*.4);sun.castShadow=true;
      sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-radius;sun.shadow.camera.right=radius;
      sun.shadow.camera.top=radius;sun.shadow.camera.bottom=-radius;scene.add(sun);
      const ground=new THREE.Mesh(new THREE.PlaneGeometry(radius*3,radius*3),material(0x466558));
      ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
      const grid=new THREE.GridHelper(radius*2,Math.max(10,Math.min(100,Math.round(radius))),0x7b9a92,0x567468);
      grid.position.y=.025;scene.add(grid);
      addTent(scene,tent,{roof:{visible:roofVisible,opacity:.9},sidewalls:wallVisible,showFurniture:furnitureVisible,roofStyle,legHeight,baySpacing});
      const resize=()=>{const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
      observer=new ResizeObserver(resize);observer.observe(host);resize();
      const animate=()=>{frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);};
      animate();
      renderRef.current=()=>{try{const a=document.createElement('a');a.href=renderer.domElement.toDataURL('image/png');a.download='tent-3d-preview.png';a.click();}catch(e){setError('Unable to export 3D image: '+e.message);}};
      setError('');
    }catch(e){setError('3D rendering is unavailable on this device: '+(e.message||e));}
    return ()=>{cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();scene?.traverse(obj=>{obj.geometry?.dispose();if(obj.material){const mats=Array.isArray(obj.material)?obj.material:[obj.material];mats.forEach(m=>m.dispose());}});renderer?.dispose();renderer?.domElement?.remove();renderRef.current=null;};
  },[tent,roofVisible,wallVisible,furnitureVisible,roofStyle,legHeight,baySpacing]);
  useEffect(()=>{const onKey=e=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey);},[onClose]);
  return <div className="three-d-backdrop" role="dialog" aria-modal="true" aria-label="Interactive 3D tent preview">
    <div className="three-d-shell">
      <header><div><strong>3D Tent Viewer</strong><small>Interactive concept preview · drag to orbit · scroll to zoom</small></div><button onClick={onClose}>Close ×</button></header>
      <div className="three-d-tools">
        <label>Tent<select value={Math.min(index,choices.length-1)} onChange={e=>setIndex(Number(e.target.value))}>
          {choices.map((t,i)=><option key={t.id||i} value={i}>{t.name||'Tent '+(i+1)} · {t.width} × {t.length} ft</option>)}
        </select></label>
        <label>Roof shape<select value={roofStyle} onChange={e=>setRoofStyle(e.target.value)}>
          <option value="gable">Standard gable</option><option value="highpeak">High peak</option><option value="flat">Flat canopy</option>
        </select></label>
        <label>Leg height<select value={legHeight} onChange={e=>setLegHeight(Number(e.target.value))}>
          <option value="8">8 ft</option><option value="9">9 ft</option><option value="10">10 ft</option><option value="12">12 ft</option>
        </select></label>
        <label>Frame spacing<select value={baySpacing} onChange={e=>setBaySpacing(Number(e.target.value))}>
          <option value="10">10 ft</option><option value="15">15 ft</option><option value="20">20 ft</option>
        </select></label>
        <label><input type="checkbox" checked={roofVisible} onChange={e=>setRoofVisible(e.target.checked)}/> Roof</label>
        <label><input type="checkbox" checked={wallVisible} onChange={e=>setWallVisible(e.target.checked)}/> Sidewalls</label>
        <label><input type="checkbox" checked={furnitureVisible} onChange={e=>setFurnitureVisible(e.target.checked)}/> Furniture</label>
        <button disabled={!tent} onClick={()=>renderRef.current?.()}>Export 3D PNG</button>
      </div>
      <div className="three-d-viewport" ref={mount}>
        {!tent&&<p>No visible tents yet. Add a tent to the satellite plan first.</p>}
      </div>
      <footer>{error&&<p role="alert">{error}</p>}<p>Concept visualization only: roof pitch, pole heights, sidewalls and furniture are approximate, not manufacturer specifications or engineering drawings.</p></footer>
    </div>
  </div>;
}

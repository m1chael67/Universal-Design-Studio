import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildTentScene,buildSiteScene} from './threeDModel.js';
import {tentDimensions,siteRadius} from './tent3DMath.js';
import './threeD.css';

const presets=['Perspective','Top-down','Walk-through'];
export default function ThreeDViewer({tents,onClose}){
  const mount=useRef(null),renderRef=useRef(null),controlsRef=useRef(null);
  const cameraPose=useRef(null),activeId=useRef(null);
  const [index,setIndex]=useState(0),[siteMode,setSiteMode]=useState(false),[roofMode,setRoofMode]=useState('solid'),
    [wallVisible,setWallVisible]=useState(true),[frameVisible,setFrameVisible]=useState(true),
    [furnitureVisible,setFurnitureVisible]=useState(true),[roofStyle,setRoofStyle]=useState('gable'),
    [legHeight,setLegHeight]=useState(7),[baySpacing,setBaySpacing]=useState(20),
    [view,setView]=useState('Perspective'),[selectedItem,setSelectedItem]=useState(null),
    [summary,setSummary]=useState(null),[error,setError]=useState('');
  const choices=(tents||[]).filter(t=>!t.hidden);
  const tent=choices[Math.min(index,Math.max(0,choices.length-1))];
  const size=tent?tentDimensions(tent):null;

  // A view button moves the live camera without rebuilding the scene.
  function chooseView(next){
    setView(next);
    const state=controlsRef.current;
    if(!state)return;
    const {camera,controls,radius,dimension}=state;
    const {length,width,legHeight:eave}=dimension;
    const target=new THREE.Vector3(0,Math.min(eave*.65,5),0);
    if(next==='Top-down'){
      camera.position.set(0,Math.max(20,radius*1.65),.001);
      target.set(0,0,0);
    }else if(next==='Walk-through'){
      camera.position.set(-length*.3,Math.min(5.3,eave-.5),width*.13);
      target.set(length*.23,Math.min(5.3,eave-.5),0);
    }else{
      camera.position.set(radius*.94,radius*.67,radius*.9);
    }
    controls.target.copy(target);controls.update();
    cameraPose.current=null;
  }
  function switchTent(next){
    cameraPose.current=null;setSelectedItem(null);setView('Perspective');
    if(next==='all'){setSiteMode(true);}else{setSiteMode(false);setIndex(Number(next));}
  }
  useEffect(()=>{
    if(!tent||!mount.current)return;
    const host=mount.current,id=siteMode?'all-site':String(tent.id||index);
    let scene,renderer,camera,controls,observer,animation=0,model,down=null;
        const onDown=e=>{down={x:e.clientX,y:e.clientY};};
    const onUp=e=>{
      if(!down||!renderer||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){down=null;return;}
      down=null;
      const rect=renderer.domElement.getBoundingClientRect();
      if(rect.width<1||rect.height<1)return;
      const pt=new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
      const raycaster=new THREE.Raycaster();raycaster.setFromCamera(pt,camera);
      const hits=raycaster.intersectObjects(model.pickables,true);
      const selected=hits[0]?.object;
      let group=selected;
      while(group&&!group.userData.item)group=group.parent;
      setSelectedItem(group?.userData?.item||null);
    };
    try{
      const {length,width}=tentDimensions(tent);
      const radius=siteMode?siteRadius(choices):Math.max(length,width,20);
      scene=new THREE.Scene();scene.background=new THREE.Color(0x1c303a);
      camera=new THREE.PerspectiveCamera(48,1,.1,Math.max(1500,radius*10));
      camera.position.set(radius*.94,radius*.67,radius*.9);
      renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});
      renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      host.appendChild(renderer.domElement);
      controls=new OrbitControls(camera,renderer.domElement);
      controls.target.set(0,Math.min(legHeight*.65,5),0);
      controls.enableDamping=true;controls.dampingFactor=.11;
      controls.maxPolarAngle=Math.PI*.495;controls.minPolarAngle=.02;
      controls.minDistance=2;controls.maxDistance=radius*6;
      controls.enablePan=true;
      scene.add(new THREE.HemisphereLight(0xf1fbff,0x6e8181,2.2));
      const sun=new THREE.DirectionalLight(0xffffff,2.5);
      sun.position.set(-radius*.5,radius,radius*.55);sun.castShadow=true;
      sun.shadow.mapSize.set(1024,1024);
      sun.shadow.camera.left=-radius;sun.shadow.camera.right=radius;
      sun.shadow.camera.top=radius;sun.shadow.camera.bottom=-radius;
      sun.shadow.camera.near=.5;sun.shadow.camera.far=radius*4;scene.add(sun);
      const ground=new THREE.Mesh(
        new THREE.PlaneGeometry(radius*3,radius*3),
        new THREE.MeshStandardMaterial({color:0x466558,roughness:1})
      );
      ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
      const grid=new THREE.GridHelper(radius*2,Math.min(80,Math.max(10,Math.round(radius))),0x8ca69a,0x557366);
      grid.position.y=.025;scene.add(grid);
      const options={roofMode,wallVisible,frameVisible,furnitureVisible,roofStyle,legHeight,baySpacing};
      model=siteMode?buildSiteScene(scene,choices,options):buildTentScene(scene,tent,options);
      setSummary({bays:model.bays,walls:model.walls?.rendered||0,doors:model.walls?.doors||0,items:model.visibleObjects});
      if(cameraPose.current?.id===id){
        camera.position.fromArray(cameraPose.current.position);
        controls.target.fromArray(cameraPose.current.target);
      }else if(view==='Top-down'){
        camera.position.set(0,radius*1.65,.001);controls.target.set(0,0,0);
      }else if(view==='Walk-through'){
        camera.position.set(-length*.3,Math.min(5.3,legHeight-.5),width*.13);
        controls.target.set(length*.23,Math.min(5.3,legHeight-.5),0);
      }
      controls.update();
      activeId.current=id;
      controlsRef.current={camera,controls,radius,dimension:{length,width,legHeight}};
      const resize=()=>{
        if(!renderer||!camera)return;
        const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
        camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
      };
      if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(resize);observer.observe(host);}
      else window.addEventListener('resize',resize);
      resize();
      renderer.domElement.addEventListener('pointerdown',onDown);
      renderer.domElement.addEventListener('pointerup',onUp);
      const tick=()=>{
        animation=requestAnimationFrame(tick);
        controls.update();renderer.render(scene,camera);
      };
      tick();
      renderRef.current=()=>{
        try{
          renderer.render(scene,camera);
          const a=document.createElement('a');
          a.href=renderer.domElement.toDataURL('image/png');
          a.download=(siteMode?'entire-site':String(tent.name||'tent').replace(/[^\w-]+/g,'-').slice(0,55))+'-3d.png';
          document.body.appendChild(a);a.click();a.remove();
        }catch(err){setError('Unable to export this 3D image: '+err.message);}
      };
      setError('');
    }catch(err){setError('3D rendering is unavailable: '+(err.message||err));}
    return ()=>{
      if(camera&&controls)cameraPose.current={
        id,position:camera.position.toArray(),target:controls.target.toArray()
      };
      cancelAnimationFrame(animation);
      observer?.disconnect();
      window.removeEventListener('resize',()=>{});
      renderer?.domElement?.removeEventListener('pointerdown',onDown);
      renderer?.domElement?.removeEventListener('pointerup',onUp);
      controls?.dispose();
      scene?.traverse(obj=>{
        obj.geometry?.dispose();
        if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>m.dispose());
      });
      renderer?.dispose();renderer?.domElement?.remove();
      controlsRef.current=null;renderRef.current=null;
    };
  },[tent,index,siteMode,roofMode,wallVisible,frameVisible,furnitureVisible,roofStyle,legHeight,baySpacing]);
  useEffect(()=>{
    const onKey=e=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[onClose]);
  return <div className="three-d-backdrop" role="dialog" aria-modal="true" aria-label="Interactive 3D tent preview">
    <div className="three-d-shell">
      <header><div><strong>3D Tent Viewer</strong><small>Concept model · drag to orbit · scroll/pinch to zoom · tap furniture for details</small></div>
        <button type="button" onClick={onClose}>Close ×</button>
      </header>
      <div className="three-d-tools">
        <label>View tents<select value={siteMode?'all':Math.min(index,Math.max(0,choices.length-1))} onChange={e=>switchTent(e.target.value)}>
          {choices.length>1&&<option value="all">Entire site · all tents</option>}
          {choices.map((t,i)=><option key={t.id||i} value={i}>{t.name||'Tent '+(i+1)} · {t.width} × {t.length} ft</option>)}
        </select></label>
        <label>Roof profile<select value={roofStyle} onChange={e=>setRoofStyle(e.target.value)}>
          <option value="gable">Gable</option><option value="highpeak">High gable</option><option value="flat">Flat</option>
        </select></label>
        <label>Leg height<select value={legHeight} onChange={e=>setLegHeight(Number(e.target.value))}>
          <option value={7}>7 ft</option><option value={8}>8 ft</option><option value={9}>9 ft</option>
          <option value={10}>10 ft</option><option value={12}>12 ft</option>
        </select></label>
        <label>Bay size<select value={baySpacing} onChange={e=>setBaySpacing(Number(e.target.value))}>
          <option value={10}>10 ft</option><option value={15}>15 ft</option><option value={20}>20 ft</option>
        </select></label>
        <label>Roof<select value={roofMode} onChange={e=>setRoofMode(e.target.value)}>
          <option value="solid">Canvas</option><option value="xray">Transparent</option><option value="hidden">Hidden</option>
        </select></label>
        <label className="three-d-check"><input type="checkbox" checked={wallVisible} onChange={e=>setWallVisible(e.target.checked)}/> Sidewalls</label>
        <label className="three-d-check"><input type="checkbox" checked={frameVisible} onChange={e=>setFrameVisible(e.target.checked)}/> Frame</label>
        <label className="three-d-check"><input type="checkbox" checked={furnitureVisible} onChange={e=>setFurnitureVisible(e.target.checked)}/> Furniture</label>
      </div>
      <nav className="three-d-actions" aria-label="3D camera and export controls">
        {presets.map(p=><button type="button" key={p} aria-pressed={view===p} className={view===p?'active':''} onClick={()=>chooseView(p)}>{p}</button>)}
        <button type="button" disabled={!tent} onClick={()=>renderRef.current?.()}>Export 3D image</button>
      </nav>
      <div className="three-d-viewport" ref={mount}>
        {!tent&&<p>No visible tents yet. Add a tent to the satellite plan first.</p>}
        {size&&<div className="three-d-metrics" aria-label="Tent dimensions">
          <strong>{siteMode?'Entire site · '+choices.length+' tents':size.width+' × '+size.length+' ft'}</strong><span>{legHeight} ft legs</span>
          {summary&&<span>{summary.bays} bays · {summary.items} furniture items</span>}
        </div>}
        {selectedItem&&<div className="three-d-selected"><div><strong>{selectedItem.title}</strong>
          <span>{selectedItem.width.toFixed(1)} × {selectedItem.depth.toFixed(1)} ft · {selectedItem.type}</span></div>
          <button type="button" aria-label="Dismiss selected furniture" onClick={()=>setSelectedItem(null)}>×</button></div>}
      </div>
      <footer>{error&&<p role="alert">{error}</p>}
        <p>Uses saved interiors and door openings. Entire-site view positions tents using project coordinates on a flat illustrative surface, not surveyed terrain. Confirm manufacturer specifications and site requirements.</p>
      </footer>
    </div>
  </div>;
}

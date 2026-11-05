import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildTentScene,buildSiteScene} from './threeDModel.js';
import {tentDimensions,siteRadius} from './tent3DMath.js';
import {exteriorPose,walkStart,walkEye,walkTarget,dragLook,WALK_FOV,PERSPECTIVE_FOV} from './threeDCamera.js';
import './threeD.css';

const presets=['Perspective','Walk-through'];
export default function ThreeDViewer({tents,onClose,customerPreview=false}){
  const mount=useRef(null),renderRef=useRef(null),controlsRef=useRef(null);
  const cameraPose=useRef(null),walkRef=useRef(false),walkLook=useRef({yaw:0,pitch:0});
  const [index,setIndex]=useState(0),[siteMode,setSiteMode]=useState(false),[roofMode,setRoofMode]=useState('solid'),
    [wallVisible,setWallVisible]=useState(true),[frameVisible,setFrameVisible]=useState(true),
    [furnitureVisible,setFurnitureVisible]=useState(true),[roofStyle,setRoofStyle]=useState('westcoast'),
    [legHeight,setLegHeight]=useState(7),[baySpacing,setBaySpacing]=useState(20),
    [showDimensions,setShowDimensions]=useState(false),
    [view,setView]=useState('Perspective'),[selectedItem,setSelectedItem]=useState(null),
    [summary,setSummary]=useState(null),[error,setError]=useState('');
  const choices=(tents||[]).filter(t=>!t.hidden);
  const tent=choices[Math.min(index,Math.max(0,choices.length-1))];
  const size=tent?tentDimensions(tent):null;

  function chooseView(next){
    setView(next);
    if(next==='Walk-through'&&siteMode){
      cameraPose.current=null;setSiteMode(false);walkRef.current=true;return;
    }
    const state=controlsRef.current;
    if(!state)return;
    const {camera,controls,radius,dimension:{length,width,legHeight:eave}}=state;
    walkRef.current=next==='Walk-through';
    if(next==='Walk-through'){
      walkLook.current={yaw:0,pitch:0};
      controls.enabled=false;camera.fov=WALK_FOV;camera.updateProjectionMatrix();
      const p=walkStart(length,width,eave);
      camera.position.set(p.x,p.y,p.z);
      const t=walkTarget(p,0,0);controls.target.set(t.x,t.y,t.z);
      camera.lookAt(controls.target);
    }else{
      controls.enabled=true;camera.fov=PERSPECTIVE_FOV;camera.updateProjectionMatrix();
      const p=exteriorPose(length,width,eave,camera.aspect,siteMode?radius:0);
      camera.position.set(p.position.x,p.position.y,p.position.z);
      controls.target.set(p.target.x,p.target.y,p.target.z);
      controls.minDistance=Math.max(3,p.distance*.52);
      controls.maxDistance=p.distance*2.7;controls.update();
    }
    cameraPose.current=null;
  }
  function switchTent(next){
    cameraPose.current=null;walkRef.current=false;walkLook.current={yaw:0,pitch:0};
    setSelectedItem(null);setView('Perspective');
    if(next==='all')setSiteMode(true);
    else {setSiteMode(false);setIndex(Number(next));}
  }
  function moveWalk(direction){
    const state=controlsRef.current;
    if(!state||!walkRef.current)return;
    const {camera,controls,dimension:{length,width,legHeight:eave}}=state;
    const yaw=walkLook.current.yaw;
    const f=new THREE.Vector3(Math.cos(yaw),0,Math.sin(yaw));
    const r=new THREE.Vector3(-Math.sin(yaw),0,Math.cos(yaw));
    const delta=(direction==='forward'?f:direction==='back'?f.clone().negate():
      direction==='right'?r:r.negate()).multiplyScalar(2);
    const p=walkEye(camera.position.clone().add(delta),length,width,eave);
    camera.position.set(p.x,p.y,p.z);
    const t=walkTarget(p,walkLook.current.yaw,walkLook.current.pitch);
    controls.target.set(t.x,t.y,t.z);camera.lookAt(controls.target);
  }
  useEffect(()=>{
    if(!tent||!mount.current)return;
    const host=mount.current,id=siteMode?'all-site':String(tent.id||index);
    let scene,renderer,camera,controls,observer,animation=0,model,down=null,handleResize=null;
    let gesture=null;
    const onDown=e=>{
      down={x:e.clientX,y:e.clientY};
      if(!walkRef.current||e.button!==0)return;
      gesture={id:e.pointerId,x:e.clientX,y:e.clientY};
      renderer?.domElement?.setPointerCapture?.(e.pointerId);
    };
    const onMove=e=>{
      if(!walkRef.current||!gesture||gesture.id!==e.pointerId)return;
      const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
      gesture.x=e.clientX;gesture.y=e.clientY;
      walkLook.current=dragLook(walkLook.current,dx,dy);
      if(camera&&controls){
        const t=walkTarget(camera.position,walkLook.current.yaw,walkLook.current.pitch);
        controls.target.set(t.x,t.y,t.z);camera.lookAt(controls.target);
      }
    };
    // Mac trackpad precision-scroll pans the scene; pinch and mouse wheel still zoom.
    const onWheel=e=>{
      if(!camera||!controls||walkRef.current||e.ctrlKey||e.metaKey||e.altKey)return;
      const precise=e.deltaMode===0&&(Math.abs(e.deltaX)>.1||
        (Math.abs(e.deltaY)>.01&&Math.abs(e.deltaY)<85));
      if(!precise)return;
      e.preventDefault();e.stopImmediatePropagation();
      camera.updateMatrixWorld();
      const distance=camera.position.distanceTo(controls.target);
      const scale=2*distance*Math.tan(camera.fov*Math.PI/360)/
        Math.max(200,renderer.domElement.clientHeight);
      const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).setY(0).normalize();
      const forward=controls.target.clone().sub(camera.position).setY(0).normalize();
      const delta=right.multiplyScalar(e.deltaX*scale).add(forward.multiplyScalar(e.deltaY*scale));
      camera.position.add(delta);controls.target.add(delta);controls.update();
    };
    const onUp=e=>{
      if(gesture?.id===e.pointerId){
        if(renderer?.domElement?.hasPointerCapture?.(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
        gesture=null;
      }
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
      camera=new THREE.PerspectiveCamera(view==='Walk-through'?WALK_FOV:PERSPECTIVE_FOV,1,.08,Math.max(1500,radius*10));
      renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});
      renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      host.appendChild(renderer.domElement);
      controls=new OrbitControls(camera,renderer.domElement);
      controls.target.set(0,Math.min(legHeight*.55,5),0);
      controls.enableDamping=true;controls.dampingFactor=.075;
      controls.rotateSpeed=.28;controls.zoomSpeed=.65;
      controls.maxPolarAngle=Math.PI*.58;controls.minPolarAngle=.10;
      controls.enablePan=true;controls.enableZoom=true;controls.screenSpacePanning=false;
      controls.enabled=view!=='Walk-through';
      walkRef.current=view==='Walk-through';
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
      const options={roofMode,wallVisible,frameVisible,furnitureVisible,roofStyle,legHeight,baySpacing,showDimensions,customerPreview};
      model=siteMode?buildSiteScene(scene,choices,options):buildTentScene(scene,tent,options);
      setSummary({bays:model.bays,walls:model.walls?.rendered||0,doors:model.walls?.doors||0,
        items:model.visibleObjects,ridge:model.ridge,frameProfile:model.frameProfile});
      handleResize=()=>{
        if(!renderer||!camera)return;
        const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);
        camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
      };
      handleResize();
      const defaultPose=exteriorPose(length,width,legHeight,camera.aspect,siteMode?radius:0);
      controls.minDistance=Math.max(3,defaultPose.distance*.52);
      controls.maxDistance=defaultPose.distance*2.7;
      if(view==='Walk-through'&&!siteMode){
        controls.enabled=false;
        const p=walkStart(length,width,legHeight);walkLook.current={yaw:0,pitch:0};
        camera.position.set(p.x,p.y,p.z);
        const t=walkTarget(p,0,0);controls.target.set(t.x,t.y,t.z);
        camera.lookAt(controls.target);
      }else if(cameraPose.current?.id===id&&cameraPose.current.mode==='Perspective'){
        camera.position.fromArray(cameraPose.current.position);
        controls.target.fromArray(cameraPose.current.target);controls.update();
      }else{
        camera.position.set(defaultPose.position.x,defaultPose.position.y,defaultPose.position.z);
        controls.target.set(defaultPose.target.x,defaultPose.target.y,defaultPose.target.z);
        controls.update();
      }
      controlsRef.current={camera,controls,radius,dimension:{length,width,legHeight}};
      if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(handleResize);observer.observe(host);}
      else window.addEventListener('resize',handleResize);
      handleResize();
      renderer.domElement.addEventListener('pointerdown',onDown);
      renderer.domElement.addEventListener('pointermove',onMove);
      renderer.domElement.addEventListener('pointerup',onUp);
      renderer.domElement.addEventListener('pointercancel',onUp);
      renderer.domElement.addEventListener('wheel',onWheel,{capture:true,passive:false});
      const tick=()=>{
        animation=requestAnimationFrame(tick);
        if(walkRef.current&&!siteMode){
          const eye=walkEye(camera.position,length,width,legHeight);
          camera.position.set(eye.x,eye.y,eye.z);
          const t=walkTarget(eye,walkLook.current.yaw,walkLook.current.pitch);
          controls.target.set(t.x,t.y,t.z);camera.lookAt(controls.target);
        }else controls.update();
        renderer.render(scene,camera);
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
        id,mode:walkRef.current?'Walk-through':'Perspective',position:camera.position.toArray(),target:controls.target.toArray()
      };
      cancelAnimationFrame(animation);
      observer?.disconnect();
      if(handleResize)window.removeEventListener('resize',handleResize);
      renderer?.domElement?.removeEventListener('pointerdown',onDown);
      renderer?.domElement?.removeEventListener('pointermove',onMove);
      renderer?.domElement?.removeEventListener('pointerup',onUp);
      renderer?.domElement?.removeEventListener('pointercancel',onUp);
      renderer?.domElement?.removeEventListener('wheel',onWheel,true);
      controls?.dispose();
      scene?.traverse(obj=>{
        obj.geometry?.dispose();
        if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>{
          if(m.userData?.sharedMaterial)return;
          m.map?.dispose();m.dispose();
        });
      });
      renderer?.dispose();renderer?.domElement?.remove();
      controlsRef.current=null;renderRef.current=null;
    };
  },[tent,index,siteMode,roofMode,wallVisible,frameVisible,furnitureVisible,roofStyle,legHeight,baySpacing,showDimensions,customerPreview]);
  useEffect(()=>{
    const onKey=e=>{
      if(e.key==='Escape'){onClose();return;}
      if(!walkRef.current||e.target?.closest?.('input,select,textarea,[contenteditable="true"]'))return;
      const directions={w:'forward',W:'forward',ArrowUp:'forward',
        s:'back',S:'back',ArrowDown:'back',a:'left',A:'left',ArrowLeft:'left',
        d:'right',D:'right',ArrowRight:'right'};
      if(directions[e.key]){e.preventDefault();moveWalk(directions[e.key]);}
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[onClose]);
  return <div className="three-d-backdrop" role="dialog" aria-modal="true" aria-label="Interactive 3D tent preview">
    <div className="three-d-shell">
      <header><div><strong>3D Tent Viewer</strong><small>Perspective: orbit or two-finger pan · Walk-through: eye-level free look</small></div>
        <button type="button" onClick={onClose}>Close ×</button>
      </header>
      <div className="three-d-tools">
        <label>View tents<select value={siteMode?'all':Math.min(index,Math.max(0,choices.length-1))} onChange={e=>switchTent(e.target.value)}>
          {choices.length>1&&<option value="all">Entire site · all tents</option>}
          {choices.map((t,i)=><option key={t.id||i} value={i}>{t.name||'Tent '+(i+1)} · {t.width} × {t.length} ft</option>)}
        </select></label>
        <label>Roof profile<select value={roofStyle} onChange={e=>setRoofStyle(e.target.value)}>
          <option value="westcoast">West Coast frame · hip roof</option><option value="gable">Gable</option><option value="highpeak">High gable</option><option value="flat">Flat</option>
        </select></label>
        <label>Leg height<select value={legHeight} onChange={e=>setLegHeight(Number(e.target.value))}>
          <option value={7}>7 ft</option><option value={8}>8 ft</option><option value={9}>9 ft</option>
          <option value={10}>10 ft</option>
        </select></label>
        {roofStyle==='westcoast'?<span className="three-d-auto-bay" title="West Coast side-tee spacing follows the selected Celina tent family">Celina frame spacing · automatic</span>:<label>Bay size<select value={baySpacing} onChange={e=>setBaySpacing(Number(e.target.value))}>
          <option value={10}>10 ft</option><option value={15}>15 ft</option><option value={20}>20 ft</option>
        </select></label>}
        <label>Roof<select value={roofMode} onChange={e=>setRoofMode(e.target.value)}>
          <option value="solid">Canvas</option><option value="xray">Transparent</option><option value="hidden">Hidden</option>
        </select></label>
        <label className="three-d-check"><input type="checkbox" checked={wallVisible} onChange={e=>setWallVisible(e.target.checked)}/> Sidewalls</label>
        <label className="three-d-check"><input type="checkbox" checked={frameVisible} onChange={e=>setFrameVisible(e.target.checked)}/> Frame</label>
        <label className="three-d-check"><input type="checkbox" checked={furnitureVisible} onChange={e=>setFurnitureVisible(e.target.checked)}/> Furniture</label>
        <label className="three-d-check"><input type="checkbox" checked={showDimensions} onChange={e=>setShowDimensions(e.target.checked)}/> Show dimensions</label>
      </div>
      <nav className="three-d-actions" aria-label="3D camera and export controls">
        {presets.map(p=><button type="button" key={p} aria-pressed={view===p} className={view===p?'active':''} onClick={()=>chooseView(p)}>{p}</button>)}
        <button type="button" className={roofMode==='hidden'&&frameVisible?'active':''}
          aria-pressed={roofMode==='hidden'&&frameVisible}
          onClick={()=>{setRoofMode(mode=>mode==='hidden'?'solid':'hidden');setFrameVisible(true);}}>Frame-only view</button>
        <button type="button" disabled={!tent} onClick={()=>renderRef.current?.()}>Export 3D image</button>
        <button type="button" className="three-d-jump" onClick={()=>mount.current?.scrollIntoView({block:'center',behavior:'smooth'})}>↓ View 3D</button>
      </nav>
      {view==='Walk-through'&&!siteMode&&<div className="three-d-walk" aria-label="Walk-through navigation">
        <button type="button" onClick={()=>moveWalk('forward')}>↑ Forward 2 ft</button>
        <button type="button" onClick={()=>moveWalk('left')}>← Left</button>
        <button type="button" onClick={()=>moveWalk('right')}>Right →</button>
        <button type="button" onClick={()=>moveWalk('back')}>↓ Back 2 ft</button>
        <small>Drag or swipe to turn your head; W/A/S/D or arrow keys to walk. Eye height stays fixed.</small>
      </div>}
      <div className="three-d-viewport" ref={mount}>
        {!tent&&<p>No visible tents yet. Add a tent to the satellite plan first.</p>}
        {size&&<div className="three-d-metrics" aria-label="Tent dimensions">
          <strong>{siteMode?'Entire site · '+choices.length+' tents':size.width+' × '+size.length+' ft'}</strong><span>{legHeight} ft legs</span>
          {summary&&<span>{summary.bays} bays · {summary.items} furniture items</span>}
          {summary?.ridge!=null&&<span>Ridge {summary.ridge.toFixed(1)} ft</span>}
          {!siteMode&&summary?.frameProfile&&<span>{summary.frameProfile.verifiedFamily?summary.frameProfile.family+' reference':'Custom size · approximate frame'} · {summary.frameProfile.legCount} perimeter legs</span>}
        </div>}
        {selectedItem&&<div className="three-d-selected"><div><strong>{selectedItem.title}</strong>
          <span>{selectedItem.width.toFixed(1)} × {selectedItem.depth.toFixed(1)} ft · {selectedItem.type}{selectedItem.heightInches!=null?' · '+selectedItem.heightInches+'″ high':''}</span></div>
          <button type="button" aria-label="Dismiss selected furniture" onClick={()=>setSelectedItem(null)}>×</button></div>}
      </div>
      <footer>{error&&<p role="alert">{error}</p>}
        {customerPreview&&<p>Customer preview: when no sidewalls are selected, an enclosed tent is shown for illustration. Set sidewalls in the interior planner for an exact proposal.</p>}
        <p>Uses saved interiors and door openings. Entire-site view positions tents using project coordinates on a flat illustrative surface, not surveyed terrain. Celina-based West Coast frames are visual approximations, not pipe cut lists or engineering; confirm manufacturer specifications and site requirements.</p>
      </footer>
    </div>
  </div>;
}

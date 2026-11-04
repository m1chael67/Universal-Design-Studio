import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './style.css';
import InteriorPlanner from './InteriorPlanner.jsx';

const FEET = 3.280839895;
const MAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  hybrid: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets: 'mapbox://styles/mapbox/streets-v12'
};
const radians = deg => deg * Math.PI / 180;
const clamp = (v,min,max,fallback) => { const n=typeof v==='string'&&v.trim()===''?NaN:Number(v); return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback; };
const cleanedFilename = name => (name || 'site-plan').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').slice(0,64) || 'site-plan';
const distance = (a,b) => {
  const R=6371008.8, dLat=radians(b[1]-a[1]), dLon=radians(b[0]-a[0]);
  const h=Math.sin(dLat/2)**2+Math.cos(radians(a[1]))*Math.cos(radians(b[1]))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))*FEET;
};
function corners(t,extra=0){
  const x=(t.width/2+extra)/FEET, y=(t.length/2+extra)/FEET, angle=radians(t.rotation);
  return [[-x,-y],[x,-y],[x,y],[-x,y],[-x,-y]].map(([east,north])=>{
    const e=east*Math.cos(angle)+north*Math.sin(angle), n=-east*Math.sin(angle)+north*Math.cos(angle);
    return [t.lng+e/(111319.49*Math.max(.1,Math.cos(radians(t.lat)))),t.lat+n/111132.92];
  });
}
const fc = features => ({type:'FeatureCollection',features});
function RotationDial({angle,onChange}){
  const ref=useRef(null);
  function update(e){
    const rect=ref.current.getBoundingClientRect();
    const x=e.clientX-rect.left-rect.width/2, y=e.clientY-rect.top-rect.height/2;
    onChange(Math.round((Math.atan2(x,-y)*180/Math.PI+360)%360));
  }
  return <div className="rotation-wrap"><div
    ref={ref} className="rotation-dial" role="slider" tabIndex={0}
    aria-label="Drag to rotate selected tent" aria-valuemin={0} aria-valuemax={359} aria-valuenow={Math.round(angle)}
    onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);update(e);}}
    onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))update(e);}}
    onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
    onPointerCancel={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
    onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowUp'){e.preventDefault();onChange((angle+1)%360);}else if(e.key==='ArrowLeft'||e.key==='ArrowDown'){e.preventDefault();onChange((angle+359)%360);}}}>
    <span className="dial-n">N</span><div className="dial-indicator" style={{transform:`rotate(${angle}deg)`}}><span/></div><span className="dial-center">{Math.round(angle)}°</span>
  </div><span className="dial-help">Drag the handle to turn the tent</span></div>;
}
const polygonLayer = (tents,clearance=false) => fc(tents.map(t=>({type:'Feature',properties:{id:t.id,label:t.width+' × '+t.length+' ft'},geometry:{type:'Polygon',coordinates:[corners(t,clearance?t.clearance:0)]}})));
// Show one label for repeated edge lengths (within 0.03 ft).
function uniqueSegmentLabels(segments,kind){
  const seen=[];
  return fc(segments.flatMap(([a,b,value])=>{
    const feet=Number.isFinite(value)?value:distance(a,b);
    if(feet<0.03||seen.some(n=>Math.abs(n-feet)<=0.03))return [];
    seen.push(feet);
    return [{type:'Feature',properties:{label:feet.toFixed(2)+' ft',kind},geometry:{type:'Point',coordinates:[(a[0]+b[0])/2,(a[1]+b[1])/2]}}];
  }));
}
function tentDimensionLabels(tents){
  return fc(tents.flatMap(t=>{
    const p=corners(t);
    return uniqueSegmentLabels([[p[0],p[1],Number(t.width)],[p[1],p[2],Number(t.length)],[p[2],p[3],Number(t.width)],[p[3],p[0],Number(t.length)]],'tent').features;
  }));
}
function measurementPath(points,closed){
  if(points.length<2)return fc([]);
  const coords=closed&&points.length>=3?[...points,points[0]]:points;
  return fc([{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}}]);
}
function measurementLabels(points,cursor,closed){
  if(!points.length)return fc([]);
  const path=closed&&points.length>=3?[...points,points[0]]:points;
  const segments=[];
  for(let i=1;i<path.length;i++)segments.push([path[i-1],path[i]]);
  if(cursor&&!closed)segments.push([points[points.length-1],cursor]);
  return uniqueSegmentLabels(segments,'measure');
}
function measurementPins(points,nearStart=false){
  return fc(points.map((p,i)=>({type:'Feature',properties:{start:i===0?1:0,snap:i===0&&nearStart?1:0},geometry:{type:'Point',coordinates:p}})));
}
function snapToStart(map,screenPoint,points){
  if(points.length<3)return false;
  const p=map.project(points[0]);
  return Math.hypot(p.x-screenPoint.x,p.y-screenPoint.y)<=17;
}
function totalMeasuredFeet(points,closed){
  if(points.length<2)return 0;
  let total=0;
  for(let i=1;i<points.length;i++)total+=distance(points[i-1],points[i]);
  if(closed&&points.length>=3)total+=distance(points[points.length-1],points[0]);
  return total;
}
function fromStore(key,defaultValue){try{const value=localStorage.getItem(key);return value?JSON.parse(value):defaultValue;}catch{return defaultValue;}}
function App(){
  const [project,setProject]=useState(()=>fromStore('uds-project',{name:'New site plan',center:[-90.1994,38.627],zoom:17,tents:[]}));
  const [tokenText,setTokenText]=useState(()=>localStorage.getItem('uds-mapbox-token')||'');
  const [token,setToken]=useState(()=>{
    try{const saved=localStorage.getItem('uds-mapbox-token')||'';return saved.startsWith('pk.')?saved:'';}catch{return '';}
  });
  const [mapStyle,setMapStyle]=useState('satellite');
  const [status,setStatus]=useState('Enter a Mapbox public token to begin.');
  const [imageryAccess,setImageryAccess]=useState('unknown');
  const [address,setAddress]=useState('');
  const [matches,setMatches]=useState([]);
  const [tool,setTool]=useState('select');
  const [points,setPoints]=useState([]);
  const [measureCursor,setMeasureCursor]=useState(null);
  const [measureClosed,setMeasureClosed]=useState(false);
  const [nearStart,setNearStart]=useState(false);
  const [selected,setSelected]=useState(null);
  const [interiorId,setInteriorId]=useState(null);
  const [pendingTent,setPendingTent]=useState(null);
  const [widthDraft,setWidthDraft]=useState('20');
  const [lengthDraft,setLengthDraft]=useState('40');
  const [rotationDraft,setRotationDraft]=useState('0');
  const [clearanceDraft,setClearanceDraft]=useState('4');
  const [width,setWidth]=useState('20'),[length,setLength]=useState('40'),[rotation,setRotation]=useState('0'),[clearance,setClearance]=useState('4');
  const mapDiv=useRef(null),mapRef=useRef(null),ready=useRef(false),drag=useRef(null),live=useRef({});
  const addSectionRef=useRef(null),editorRef=useRef(null);
  const tents=Array.isArray(project.tents)?project.tents:[];
  const chosen=tents.find(t=>t.id===selected);
  const interiorTent=tents.find(t=>t.id===interiorId);
  live.current={tool,tents,points,measureCursor,measureClosed,nearStart,selected,width,length,rotation,clearance,pendingTent};
  // Do not overwrite a field while the user is editing it or while the dial moves.
  useEffect(()=>{
    if(chosen){
      setWidthDraft(String(chosen.width));
      setLengthDraft(String(chosen.length));
      setRotationDraft(String(chosen.rotation));
      setClearanceDraft(String(chosen.clearance));
    }
  },[selected]);
  useEffect(()=>{try{localStorage.setItem('uds-project',JSON.stringify(project));}catch{}},[project]);
  useEffect(()=>{
    if(!selected)return;
    const frame=requestAnimationFrame(()=>editorRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'}));
    return ()=>cancelAnimationFrame(frame);
  },[selected]);
  // The raster satellite tileset is unavailable on some Mapbox Demo accounts,
  // even when vector-based street styles work. Check the actual tileset response
  // so the UI does not incorrectly suggest switching styles will solve it.
  useEffect(()=>{
    if(!token)return;
    let cancelled=false;
    setImageryAccess('unknown');
    (async()=>{
      try{
        const response=await fetch('https://api.mapbox.com/v4/mapbox.satellite.json?access_token='+encodeURIComponent(token));
        if(cancelled)return;
        if(response.status===401||response.status===403)setImageryAccess('blocked');
        else if(response.ok)setImageryAccess('available');
      }catch{
        // Not conclusive: some browsers or networks can block diagnostic calls.
      }
    })();
    return ()=>{cancelled=true;};
  },[token]);
  useEffect(()=>{
    if(!token||!mapDiv.current)return;
    mapboxgl.accessToken=token;
    let m;
    try{m=new mapboxgl.Map({container:mapDiv.current,style:MAP_STYLES[mapStyle],center:project.center||[-90.1994,38.627],zoom:project.zoom||17,maxZoom:24,preserveDrawingBuffer:true});
    }catch(err){setStatus('Map failed: '+err.message);return;}
    mapRef.current=m;ready.current=false;setStatus('Loading satellite imagery…');
    m.addControl(new mapboxgl.NavigationControl(),'top-right');
    // On the Satellite setting, use Mapbox's dedicated imagery-only style.
    // Unlike street styles it has a raster imagery layer as its entire basemap.
    m.on('error',ev=>{
      if(!ev.error?.message)return;
      const message=String(ev.error.message);
      if(/mapbox\.satellite|satellite-v9|raster/i.test(message)&&/401|403|unauthorized|forbidden/i.test(message)){
        setImageryAccess('blocked');
      }
      setStatus('Map error: '+message);
    });
    m.on('load',()=>{
      ready.current=true;
      m.addSource('clearance',{type:'geojson',data:fc([])});
      m.addSource('tents',{type:'geojson',data:fc([])});
      m.addSource('selected-tent',{type:'geojson',data:fc([])});
      m.addSource('measure',{type:'geojson',data:fc([])});
      m.addSource('measure-preview',{type:'geojson',data:fc([])});
      m.addSource('measure-pins',{type:'geojson',data:fc([])});
      m.addSource('measure-labels',{type:'geojson',data:fc([])});
      m.addSource('tent-dimensions',{type:'geojson',data:fc([])});
      m.addSource('preview-tent',{type:'geojson',data:fc([])});
      m.addSource('preview-clearance',{type:'geojson',data:fc([])});
      m.addLayer({id:'clearance-fill',source:'clearance',type:'fill',paint:{'fill-color':'#ffc46b','fill-opacity':.15}});
      m.addLayer({id:'clearance-line',source:'clearance',type:'line',paint:{'line-color':'#ffc46b','line-width':1.25,'line-dasharray':[3,2]}});
      m.addLayer({id:'tent-fill',source:'tents',type:'fill',paint:{'fill-color':'#46dccb','fill-opacity':.38}});
      m.addLayer({id:'tent-outline',source:'tents',type:'line',paint:{'line-color':'#d8fff9','line-width':1.5}});
      m.addLayer({id:'selected-tent-fill',source:'selected-tent',type:'fill',paint:{'fill-color':'#ffce7d','fill-opacity':0.22}});
      m.addLayer({id:'selected-tent-border',source:'selected-tent',type:'line',paint:{'line-color':'#ffd078','line-width':3}});
      m.addLayer({id:'measure-line',source:'measure',type:'line',paint:{'line-color':'#ffffff','line-width':2,'line-dasharray':[3,1]}});
      m.addLayer({id:'measure-preview-line',source:'measure-preview',type:'line',paint:{'line-color':'#ffffff','line-width':2,'line-dasharray':[1,1]}});
      m.addLayer({id:'measure-pin-circles',source:'measure-pins',type:'circle',paint:{
        'circle-color':['case',['==',['get','start'],1],'#28d1bb','#ffffff'],
        'circle-radius':['case',['==',['get','snap'],1],10,['==',['get','start'],1],6,4],
        'circle-stroke-color':'#11252f','circle-stroke-width':2
      }});
      m.addLayer({id:'measure-distance-labels',source:'measure-labels',type:'symbol',layout:{
        'text-field':['get','label'],'text-size':13,'text-font':['Open Sans Semibold','Arial Unicode MS Regular'],
        'text-allow-overlap':true,'text-offset':[0,-0.9]
      },paint:{'text-color':'#ffffff','text-halo-color':'#13272f','text-halo-width':2.5}});
      m.addLayer({id:'tent-side-labels',source:'tent-dimensions',type:'symbol',layout:{
        'text-field':['get','label'],'text-size':12,'text-font':['Open Sans Semibold','Arial Unicode MS Regular'],
        'text-allow-overlap':true,'text-offset':[0,-0.8]
      },paint:{'text-color':'#effff9','text-halo-color':'#153b3a','text-halo-width':2.5}});
      m.addLayer({id:'preview-clearance-line',source:'preview-clearance',type:'line',paint:{'line-color':'#ffcf79','line-width':1.25,'line-dasharray':[2,2]}});
      m.addLayer({id:'preview-tent-fill',source:'preview-tent',type:'fill',paint:{'fill-color':'#ffc46b','fill-opacity':.28}});
      m.addLayer({id:'preview-tent-outline',source:'preview-tent',type:'line',paint:{'line-color':'#ffe6a0','line-width':1.75,'line-dasharray':[3,1]}});
      sync();setStatus(mapStyle==='satellite'?'Satellite imagery ready':mapStyle==='hybrid'?'Satellite + streets ready':'Street map ready');
    });
    function sync(){
      if(!ready.current)return;
      const current=live.current;
      const visibleTents=current.tents.filter(t=>!t.hidden);
      m.getSource('tents')?.setData(polygonLayer(visibleTents));
      m.getSource('clearance')?.setData(polygonLayer(visibleTents,true));
      m.getSource('selected-tent')?.setData(polygonLayer(visibleTents.filter(t=>t.id===current.selected)));
      m.getSource('tent-dimensions')?.setData(tentDimensionLabels(visibleTents));
      m.getSource('measure')?.setData(measurementPath(current.points,current.measureClosed));
      const last=current.points[current.points.length-1];
      const hover=current.measureCursor;
      m.getSource('measure-preview')?.setData(
        last&&hover&&!current.measureClosed?fc([{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[last,hover]}}]):fc([])
      );
      m.getSource('measure-pins')?.setData(measurementPins(current.points,current.nearStart));
      m.getSource('measure-labels')?.setData(measurementLabels(current.points,hover,current.measureClosed));
      m.getSource('preview-tent')?.setData(polygonLayer(current.pendingTent?[current.pendingTent]:[]));
      m.getSource('preview-clearance')?.setData(polygonLayer(current.pendingTent?[current.pendingTent]:[],true));
    }
    m.on('click',e=>{
      if(drag.current)return;
      const st=live.current;
      if(st.tool==='measure'){
        const point=e.lngLat.toArray();
        if(st.measureClosed){
          setPoints([point]);setMeasureClosed(false);setMeasureCursor(point);setNearStart(false);
        }else if(snapToStart(m,e.point,st.points)){
          setMeasureClosed(true);setMeasureCursor(null);setNearStart(false);
        }else{
          setPoints(p=>[...p,point]);setMeasureCursor(point);setNearStart(false);
        }
        return;
      }
      if(st.tool==='place'){
        const t={id:crypto.randomUUID(),lng:e.lngLat.lng,lat:e.lngLat.lat,width:clamp(st.width,1,2000,20),length:clamp(st.length,1,2000,40),rotation:clamp(st.rotation,0,359,0),clearance:clamp(st.clearance,0,200,4),name:''};
        setProject(p=>({...p,tents:[...(p.tents||[]),t]}));
        setPendingTent(null);setSelected(t.id);setTool('select');
        setStatus('Tent placed. Select its layer to edit the size, angle, and clearance.');
        return;
      }
      const hit=m.queryRenderedFeatures(e.point,{layers:['tent-fill']})[0];
      setSelected(hit?.properties?.id||null);
    });
    m.on('mouseenter','tent-fill',e=>{
      if(live.current.tool!=='select')return;
      const id=e.features?.[0]?.properties?.id;
      const t=live.current.tents.find(x=>x.id===id);
      m.getCanvas().style.cursor=t?.locked?'pointer':'move';
    });
    m.on('mouseleave','tent-fill',()=>{m.getCanvas().style.cursor=live.current.tool==='select'?'default':'crosshair';});
    m.on('mousedown','tent-fill',e=>{
      if(live.current.tool!=='select')return;
      const id=e.features?.[0]?.properties?.id,t=live.current.tents.find(t=>t.id===id);
      if(!t||t.locked)return;
      drag.current={id,start:e.lngLat.toArray(),lng:t.lng,lat:t.lat};
      setSelected(id);m.dragPan.disable();
    });
    m.on('mousemove',e=>{
      if(drag.current){
        const d=drag.current;
        const lng=d.lng+e.lngLat.lng-d.start[0],lat=d.lat+e.lngLat.lat-d.start[1];
        setProject(p=>({...p,tents:(p.tents||[]).map(t=>t.id===d.id?{...t,lng,lat}:t)}));
        return;
      }
      const st=live.current;
      if(st.tool==='measure'&&st.points.length&&!st.measureClosed){
        const close=snapToStart(m,e.point,st.points);
        setNearStart(close);
        setMeasureCursor(close?st.points[0]:e.lngLat.toArray());
      }
    });
    function endDrag(){if(drag.current){drag.current=null;m.dragPan.enable();}}
    m.on('mouseup',endDrag);m.on('mouseout',()=>{endDrag();setMeasureCursor(null);setNearStart(false);});
    m.on('moveend',()=>{const c=m.getCenter();setProject(p=>({...p,center:[c.lng,c.lat],zoom:m.getZoom()}));});
    // Refresh sources when React state changes (see next effect).
    m.__udsSync=sync;
    return ()=>{ready.current=false;mapRef.current=null;m.remove();};
  },[token,mapStyle]);
  useEffect(()=>{
    const m=mapRef.current;
    m?.__udsSync?.();
    if(m) m.getCanvas().style.cursor=tool==='select'?'default':'crosshair';
  },[project.tents,points,measureCursor,measureClosed,nearStart,selected,tool,pendingTent]);
  function startMap(){if(!tokenText.trim().startsWith('pk.')){setStatus('Enter your public Mapbox token (starts with pk.).');return;}localStorage.setItem('uds-mapbox-token',tokenText.trim());setToken(tokenText.trim());}
  async function search(e){
    e.preventDefault();if(!token||!address.trim())return;
    try{
      const url='https://api.mapbox.com/search/geocode/v6/forward?q='+encodeURIComponent(address)+'&country=us&limit=5&access_token='+encodeURIComponent(token);
      const r=await fetch(url);if(!r.ok)throw Error('Search returned '+r.status);
      const data=await r.json();setMatches((data.features||[]).map(f=>({name:f.properties?.full_address||f.properties?.name||'Location',coords:f.geometry.coordinates})));
    }catch(err){setStatus('Address search failed: '+err.message);}
  }
  function editTent(patch){setProject(p=>({...p,tents:(p.tents||[]).map(t=>t.id===selected?{...t,...patch}:t)}));}
  function saveInterior(next){setProject(p=>({...p,tents:(p.tents||[]).map(t=>t.id===interiorId?{...t,interior:next}:t)}));}
  function changeSelectedDimension(field,raw){
    const setters={width:setWidthDraft,length:setLengthDraft,rotation:setRotationDraft,clearance:setClearanceDraft};
    setters[field](raw);
    const max=field==='rotation'?359:field==='clearance'?200:2000;
    const min=field==='clearance'||field==='rotation'?0:1;
    const n=Number(raw);
    if(raw.trim()!==''&&Number.isFinite(n)&&n>=min&&n<=max){
      editTent({[field]:n});
    }
  }
  function finishSelectedDimension(field,raw){
    if(!chosen)return;
    const max=field==='rotation'?359:field==='clearance'?200:2000;
    const min=field==='clearance'||field==='rotation'?0:1;
    const n=clamp(raw,min,max,chosen[field]);
    editTent({[field]:n});
    const setters={width:setWidthDraft,length:setLengthDraft,rotation:setRotationDraft,clearance:setClearanceDraft};
    setters[field](String(n));
  }
  function beginAddTent(){
    setTool('place');setPendingTent(null);setMeasureCursor(null);
    // Keep the Add Tent panel reachable even when the selected-tent editor is expanded.
    addSectionRef.current?.scrollIntoView({block:'start',behavior:'smooth'});
  }
  function confirmTent(){
    if(!pendingTent)return;
    const id=pendingTent.id;
    setProject(p=>({...p,tents:[...(p.tents||[]),pendingTent]}));
    setSelected(id);setPendingTent(null);setTool('select');
    setStatus('Tent added. Select it to drag or adjust its rotation.');
  }
  function cancelTent(){setPendingTent(null);setTool('select');}
  function toggleTentFlag(id,flag){
    setProject(p=>({...p,tents:(p.tents||[]).map(t=>t.id===id?{...t,[flag]:!t[flag]}:t)}));
  }
  function duplicateTent(t){
    if(!t)return;
    const offset=18/(111319.49*Math.max(.1,Math.cos(radians(t.lat))));
    const copy={...t,id:crypto.randomUUID(),lng:t.lng+offset,name:t.name?.trim()?t.name.trim()+' copy':''};
    setProject(p=>({...p,tents:[...(p.tents||[]),copy]}));
    setSelected(copy.id);setTool('select');
    setStatus('Tent duplicated. Drag the new layer to the correct position.');
  }
  function deleteTent(t){
    if(!window.confirm('Delete this '+t.width+' × '+t.length+' ft tent from the site plan?'))return;
    setProject(p=>({...p,tents:(p.tents||[]).filter(item=>item.id!==t.id)}));
    if(selected===t.id)setSelected(null);
  }
  async function exportImage(ext){
    const map=mapRef.current;
    if(!map||!ready.current){setStatus('Open the map before exporting an image.');return;}
    if(pendingTent){setStatus('Confirm or cancel the tent preview before exporting.');return;}
    if(!map.loaded()){setStatus('Map imagery is still loading. Try exporting after it finishes.');return;}
    try{
      const source=map.getCanvas(), scale=source.width/Math.max(1,source.clientWidth);
      const footer=Math.ceil(70*scale),canvas=document.createElement('canvas');
      canvas.width=source.width;canvas.height=source.height+footer;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(source,0,0);
      ctx.fillStyle='#15232d';ctx.fillRect(0,source.height,canvas.width,footer);
      ctx.fillStyle='#ffffff';ctx.font='bold '+Math.round(16*scale)+'px sans-serif';
      ctx.fillText((project.name||'Site plan').slice(0,55),14*scale,source.height+25*scale,canvas.width-28*scale);
      const credits=(map.getContainer().querySelector('.mapboxgl-ctrl-attrib-inner')?.textContent||'© Mapbox © OpenStreetMap')
        .replace(/Improve this map/gi,'').replace(/\s+/g,' ').trim();
      ctx.font=Math.round(11*scale)+'px sans-serif';ctx.fillStyle='#d4e0e5';
      ctx.fillText((credits+' • Planning concept; verify on site').slice(0,180),14*scale,source.height+50*scale,canvas.width-28*scale);
      // Include the official Mapbox logo asset if the browser exposes it through the control CSS.
      const logo=map.getContainer().querySelector('.mapboxgl-ctrl-logo');
      if(logo){
        try{
          const bg=window.getComputedStyle(logo).backgroundImage;
          const value=bg.startsWith('url(') ? bg.slice(4,-1).replace(/^["']|["']$/g,'') : '';
          if(value){
            const logoImage=new Image();logoImage.crossOrigin='anonymous';
            await new Promise((resolve,reject)=>{logoImage.onload=resolve;logoImage.onerror=reject;logoImage.src=value;});
            const box=window.getComputedStyle(logo);
            const w=Math.max(1,parseFloat(box.width)||88), h=Math.max(1,parseFloat(box.height)||23);
            ctx.drawImage(logoImage,canvas.width-(w+12)*scale,source.height+9*scale,w*scale,h*scale);
          }
        }catch{ /* Credit text remains even if the logo asset cannot be captured. */ }
      }
      const mime=ext==='jpg'?'image/jpeg':'image/png';
      canvas.toBlob(blob=>{
        if(!blob){setStatus('Image export failed.');return;}
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download=cleanedFilename(project.name)+'-site-plan.'+ext;
        document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
        setStatus(ext.toUpperCase()+' image exported. Keep Mapbox credits visible when sharing.');
      },mime,0.93);
    }catch(err){setStatus('Image export failed: '+err.message);}
  }
  function exportFile(){
    const blob=new Blob([JSON.stringify({...project,measurement:{points,closed:measureClosed},format:'uds-v0.1'},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=cleanedFilename(project.name)+'.json';a.click();URL.revokeObjectURL(url);
  }
  async function importFile(e){
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    try{
      if(file.size>1000000)throw Error('File too large');
      const p=JSON.parse(await file.text());if(p.format!=='uds-v0.1'||!Array.isArray(p.tents))throw Error('Not a Universal Design Studio project');
      const valid=p.tents.filter(t=>Number.isFinite(t.lng)&&Number.isFinite(t.lat)&&t.width>0&&t.length>0).slice(0,150);
      setProject({name:String(p.name||'Imported plan'),center:p.center||[-90.1994,38.627],zoom:p.zoom||17,tents:valid});
      setSelected(null);setPendingTent(null);setTool('select');
      setPoints(Array.isArray(p.measurement?.points)?p.measurement.points.filter(a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)).slice(0,100):[]);
      setMeasureClosed(Boolean(p.measurement?.closed));setMeasureCursor(null);setNearStart(false);
      if(p.center)mapRef.current?.jumpTo({center:p.center,zoom:p.zoom||17});
    }catch(err){setStatus('Import failed: '+err.message);}
  }
  return <div className="layout">
    <aside className="sidebar">
      <div className="brand"><img className="crew-brand-logo" src="https://raw.githubusercontent.com/m1chael67/universal-crew-app/main/logo_resized.png" alt="Universal Rentals & Events logo"/><div><strong>Universal Design Studio</strong><small>SATELLITE SITE PLANNER · V0.5</small></div></div>
      <div className="quick-actions"><button className="primary" onClick={beginAddTent} disabled={!token}>+ Add tent</button></div>
      <section><h3>Map imagery</h3><div className="style-choices"><button type="button" className={mapStyle==='satellite'?'active':''} onClick={()=>setMapStyle('satellite')}>Satellite</button><button type="button" className={mapStyle==='hybrid'?'active':''} onClick={()=>setMapStyle('hybrid')}>Hybrid</button><button type="button" className={mapStyle==='streets'?'active':''} onClick={()=>setMapStyle('streets')}>Streets</button></div>{!token?<><label>Mapbox public token<input value={tokenText} onChange={e=>setTokenText(e.target.value)} type="password" placeholder="pk.eyJ…"/></label><button className="primary" onClick={startMap}>Open satellite map</button></>:<form onSubmit={search}><label>Find an address<input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Enter a property address"/></label><button type="submit">Search address</button>{matches.map((r,i)=><button type="button" key={i} className="search-result" onClick={()=>{mapRef.current?.flyTo({center:r.coords,zoom:18});setAddress(r.name);setMatches([]);}}>{r.name}</button>)}</form>}<p className="status">{status}</p>{imageryAccess==='blocked'&&<div className="imagery-warning" role="alert"><strong>Satellite imagery is blocked by Mapbox.</strong><p>The street map can load while the raster imagery is unavailable. If your Mapbox account is still on Demo, add a payment method to switch to Standard and unlock raster tiles. Standard has no upfront fee but usage can become billable.</p><a href="https://account.mapbox.com/" target="_blank" rel="noreferrer">Open Mapbox account settings</a></div>}</section>
      <section><h3>Tools</h3>
        <div className="grid">
          <button className={tool==='select'?'active':''} disabled={!token} onClick={()=>{setTool('select');setPendingTent(null);setMeasureCursor(null);}}>Select / drag</button>
          <button className={tool==='measure'?'active':''} disabled={!token} onClick={()=>{setTool('measure');setPendingTent(null);setPoints([]);setMeasureCursor(null);setMeasureClosed(false);setNearStart(false);}}>New measurement</button>
        </div>
        <p className="hint">{tool==='measure'?(measureClosed?'Outline closed. Start a new measurement to draw again.':nearStart?'Click the highlighted starting pin to close your outline.':points.length===0?'Click once to drop your starting pin, then move the mouse to measure.':'Click to add corners; return to the starting pin to finish.'):'Select a tent to adjust its dimensions and clearance, or drag it to reposition.'}</p>
        {points.length>0&&<div className="measure-summary">
          <div><strong>{measureClosed?'Measured outline':'Measuring…'}</strong><span>{points.length} pinned {points.length===1?'point':'points'}</span></div>
          <div>Measured distance: <b>{totalMeasuredFeet(points,measureClosed).toFixed(2)} ft</b></div>
          {tool==='measure'&&!measureClosed&&measureCursor&&<div>Live segment: <b>{distance(points[points.length-1],measureCursor).toFixed(2)} ft</b></div>}
          <div className="measure-actions">
            {!measureClosed&&points.length>=3&&<button onClick={()=>{setMeasureClosed(true);setMeasureCursor(null);setNearStart(false);}}>Close outline</button>}
            <button onClick={()=>{setPoints([]);setMeasureCursor(null);setMeasureClosed(false);setNearStart(false);}}>Clear</button>
          </div>
          <p className="hint">Side labels show feet to two decimals. Repeated side lengths within 0.03 ft are labeled only once.</p>
        </div>}
      </section>
      <section className="layer-section">
        <h3>Layers — Tents ({tents.length})</h3>
        {tents.length===0&&<p className="hint">No tents yet. Use + Add tent, then click the map once.</p>}
        {tents.map((t,i)=><div key={t.id} className={'tent-list-row '+(selected===t.id?'selected-row':'')+(t.hidden?' hidden-layer':'')}>
          <button type="button" className={'listitem layer-tab '+(selected===t.id?'active':'')} aria-pressed={selected===t.id}
            onClick={()=>{
              setTool('select');setSelected(t.id);setPendingTent(null);
              mapRef.current?.flyTo({center:[t.lng,t.lat],zoom:Math.max(mapRef.current.getZoom(),17)});
              requestAnimationFrame(()=>editorRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'}));
            }}>
            <span className="layer-title">{t.name?.trim()||'Tent '+(i+1)}</span>
            <small>{t.width} × {t.length} ft{t.hidden?' · Hidden':''}{t.locked?' · Position locked':''}</small>
          </button>
          <button type="button" className="layer-tool" title={t.hidden?'Show tent':'Hide tent'} aria-label={t.hidden?'Show tent '+(i+1):'Hide tent '+(i+1)}
            onClick={()=>toggleTentFlag(t.id,'hidden')}>{t.hidden?'◌':'◉'}</button>
          <button type="button" className="layer-tool" title={t.locked?'Unlock position':'Lock position'} aria-label={t.locked?'Unlock tent '+(i+1):'Lock tent '+(i+1)}
            onClick={()=>toggleTentFlag(t.id,'locked')}>{t.locked?'🔒':'🔓'}</button>
          <button type="button" className="tent-remove" aria-label={'Delete tent '+(i+1)} title="Delete tent"
            onClick={()=>deleteTent(t)}>×</button>
        </div>)}
        {chosen&&<div className="chosen layer-editor" ref={editorRef}>
          <h4><span className="active-indicator"/>Editing: {chosen.name?.trim()||'Tent '+(tents.findIndex(t=>t.id===chosen.id)+1)}</h4>
          <label>Layer name<input type="text" value={chosen.name||''} onChange={e=>editTent({name:e.target.value})} placeholder="e.g. Ceremony tent" maxLength={65}/></label>
          {chosen.hidden&&<p className="editing-note">This layer is hidden. Use the ◌ control beside its name to show it.</p>}
          {chosen.locked&&<p className="editing-note">Position locked. Unlock using the 🔒 control beside its name before dragging.</p>}
          <div className="grid">
            <label>Width (ft)<input type="number" min="1" max="2000" value={widthDraft} onChange={e=>changeSelectedDimension('width',e.target.value)} onBlur={()=>finishSelectedDimension('width',widthDraft)}/></label>
            <label>Length (ft)<input type="number" min="1" max="2000" value={lengthDraft} onChange={e=>changeSelectedDimension('length',e.target.value)} onBlur={()=>finishSelectedDimension('length',lengthDraft)}/></label>
          </div>
          <RotationDial angle={chosen.rotation} onChange={value=>{editTent({rotation:value});setRotationDraft(String(value));}}/>
          <div className="grid">
            <label>Rotation (°)<input type="number" min="0" max="359" value={rotationDraft} onChange={e=>changeSelectedDimension('rotation',e.target.value)} onBlur={()=>finishSelectedDimension('rotation',rotationDraft)}/></label>
            <label>Clearance (ft per side)<input type="number" min="0" max="200" step="0.01" value={clearanceDraft} onChange={e=>changeSelectedDimension('clearance',e.target.value)} onBlur={()=>finishSelectedDimension('clearance',clearanceDraft)}/></label>
          </div>
          <p className="hint">Changes update this highlighted tent directly. The dashed perimeter represents the additional clearance.</p>
          <button className="primary" style={{width:'100%',margin:'5px 0 12px'}} onClick={()=>setInteriorId(chosen.id)}>Edit Interior — Tables, Chairs & Stage</button>
          <div className="grid">
            <button onClick={()=>{const angle=(chosen.rotation+15)%360;editTent({rotation:angle});setRotationDraft(String(angle));}}>Rotate +15°</button>
            <button onClick={()=>duplicateTent(chosen)}>Duplicate tent</button>
          </div>
        </div>}
      </section>
      <section ref={addSectionRef} className="add-tent-section"><h3>New tent settings</h3><div className="grid"><label>Width (ft)<input type="number" min="1" value={width} onChange={e=>setWidth(e.target.value)}/></label><label>Length (ft)<input type="number" min="1" value={length} onChange={e=>setLength(e.target.value)}/></label><label>Rotation (°)<input type="number" value={rotation} onChange={e=>setRotation(e.target.value)}/></label><label>Clearance (ft)<input type="number" min="0" value={clearance} onChange={e=>setClearance(e.target.value)}/></label></div><button className="primary" disabled={!token} onClick={beginAddTent}>Place a new tent</button>{tool==='place'&&<div className="placement-controls"><strong>Placement mode is active</strong><p>Click once on the map to add your tent. You'll immediately be able to edit its layer.</p><button onClick={cancelTent}>Cancel placement</button></div>}</section>
      <section><h3>Project</h3><label>Project name<input value={project.name||''} onChange={e=>setProject(p=>({...p,name:e.target.value}))}/></label><button onClick={exportFile}>Save editable project (.json)</button><label className="filebutton">Open editable project (.json)<input type="file" accept=".json" onChange={importFile}/></label><div className="grid image-exports"><button disabled={!token} onClick={()=>exportImage('png')}>Export PNG</button><button disabled={!token} onClick={()=>exportImage('jpg')}>Export JPG</button></div><p className="hint">JSON saves editable tent geometry for reopening. PNG/JPG are flat pictures of the map. Projects are saved in this browser; Appwrite cloud saving comes later.</p></section>
    </aside>
    <main className="map-panel"><div className="map-top"><strong>{project.name||'New site plan'}</strong><span>{tents.length} tents · {tents.reduce((sum,t)=>sum+t.width*t.length,0).toLocaleString()} sq ft</span></div><div className="map" ref={mapDiv}/>{tool==='place'&&token&&<div className="map-mode-banner">Click on the map to place your tent. Press Cancel placement to exit.</div>}{!token&&<div className="empty-map"><h2>Plan events directly on satellite imagery.</h2><p>Enter your Mapbox public token on the left to start measuring sites and placing accurately scaled tents.</p></div>}<div className="disclaimer">Concept planning only. Check property dimensions, terrain, utilities, access, and anchoring on-site. Map imagery © Mapbox and contributors.</div></main>
    {interiorTent&&<InteriorPlanner tent={interiorTent} onChange={saveInterior} onClose={()=>{setInteriorId(null);requestAnimationFrame(()=>mapRef.current?.resize());}}/>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);

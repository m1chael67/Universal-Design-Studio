import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './style.css';

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
const measureLayer = points => fc(points.length===2?[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:points}}]:[]);
function fromStore(key,defaultValue){try{const value=localStorage.getItem(key);return value?JSON.parse(value):defaultValue;}catch{return defaultValue;}}
function App(){
  const [project,setProject]=useState(()=>fromStore('uds-project',{name:'New site plan',center:[-90.1994,38.627],zoom:17,tents:[]}));
  const [tokenText,setTokenText]=useState(()=>localStorage.getItem('uds-mapbox-token')||'');
  const [token,setToken]=useState('');
  const [mapStyle,setMapStyle]=useState('satellite');
  const [status,setStatus]=useState('Enter a Mapbox public token to begin.');
  const [imageryAccess,setImageryAccess]=useState('unknown');
  const [address,setAddress]=useState('');
  const [matches,setMatches]=useState([]);
  const [tool,setTool]=useState('select');
  const [points,setPoints]=useState([]);
  const [selected,setSelected]=useState(null);
  const [pendingTent,setPendingTent]=useState(null);
  const [rotationDraft,setRotationDraft]=useState('0');
  const [clearanceDraft,setClearanceDraft]=useState('4');
  const [width,setWidth]=useState('20'),[length,setLength]=useState('40'),[rotation,setRotation]=useState('0'),[clearance,setClearance]=useState('4');
  const mapDiv=useRef(null),mapRef=useRef(null),ready=useRef(false),drag=useRef(null),live=useRef({});
  const tents=Array.isArray(project.tents)?project.tents:[];
  const chosen=tents.find(t=>t.id===selected);
  live.current={tool,tents,points,selected,width,length,rotation,clearance,pendingTent};
  useEffect(()=>{
    if(chosen){setRotationDraft(String(chosen.rotation));setClearanceDraft(String(chosen.clearance));}
  },[selected,chosen?.rotation,chosen?.clearance]);
  useEffect(()=>{try{localStorage.setItem('uds-project',JSON.stringify(project));}catch{}},[project]);
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
    try{m=new mapboxgl.Map({container:mapDiv.current,style:MAP_STYLES[mapStyle],center:project.center||[-90.1994,38.627],zoom:project.zoom||17,preserveDrawingBuffer:true});
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
      m.addSource('measure',{type:'geojson',data:fc([])});
      m.addSource('preview-tent',{type:'geojson',data:fc([])});
      m.addSource('preview-clearance',{type:'geojson',data:fc([])});
      m.addLayer({id:'clearance-fill',source:'clearance',type:'fill',paint:{'fill-color':'#ffc46b','fill-opacity':.15}});
      m.addLayer({id:'clearance-line',source:'clearance',type:'line',paint:{'line-color':'#ffc46b','line-width':2,'line-dasharray':[3,2]}});
      m.addLayer({id:'tent-fill',source:'tents',type:'fill',paint:{'fill-color':'#46dccb','fill-opacity':.38}});
      m.addLayer({id:'tent-outline',source:'tents',type:'line',paint:{'line-color':'#d8fff9','line-width':3}});
      m.addLayer({id:'measure-line',source:'measure',type:'line',paint:{'line-color':'#ffffff','line-width':3,'line-dasharray':[2,1]}});
      m.addLayer({id:'preview-clearance-line',source:'preview-clearance',type:'line',paint:{'line-color':'#ffcf79','line-width':3,'line-dasharray':[2,2]}});
      m.addLayer({id:'preview-tent-fill',source:'preview-tent',type:'fill',paint:{'fill-color':'#ffc46b','fill-opacity':.28}});
      m.addLayer({id:'preview-tent-outline',source:'preview-tent',type:'line',paint:{'line-color':'#ffe6a0','line-width':3,'line-dasharray':[3,1]}});
      sync();setStatus(mapStyle==='satellite'?'Satellite imagery ready':mapStyle==='hybrid'?'Satellite + streets ready':'Street map ready');
    });
    function sync(){
      if(!ready.current)return;
      const current=live.current;
      m.getSource('tents')?.setData(polygonLayer(current.tents));
      m.getSource('clearance')?.setData(polygonLayer(current.tents,true));
      m.getSource('measure')?.setData(measureLayer(current.points));
      m.getSource('preview-tent')?.setData(polygonLayer(current.pendingTent?[current.pendingTent]:[]));
      m.getSource('preview-clearance')?.setData(polygonLayer(current.pendingTent?[current.pendingTent]:[],true));
    }
    m.on('click',e=>{
      if(drag.current)return;
      const st=live.current;
      if(st.tool==='measure'){setPoints(p=>p.length>=2?[e.lngLat.toArray()]:[...p,e.lngLat.toArray()]);return;}
      if(st.tool==='place'){
        const t={id:crypto.randomUUID(),lng:e.lngLat.lng,lat:e.lngLat.lat,width:clamp(st.width,1,2000,20),length:clamp(st.length,1,2000,40),rotation:clamp(st.rotation,0,359,0),clearance:clamp(st.clearance,0,200,4)};
        setPendingTent(t);return;
      }
      const hit=m.queryRenderedFeatures(e.point,{layers:['tent-fill']})[0];
      setSelected(hit?.properties?.id||null);
    });
    m.on('mouseenter','tent-fill',()=>{if(live.current.tool==='select')m.getCanvas().style.cursor='move';});
    m.on('mouseleave','tent-fill',()=>{m.getCanvas().style.cursor=live.current.tool==='select'?'default':'crosshair';});
    m.on('mousedown','tent-fill',e=>{
      if(live.current.tool!=='select')return;
      const id=e.features?.[0]?.properties?.id,t=live.current.tents.find(t=>t.id===id);
      if(!t)return;
      drag.current={id,start:e.lngLat.toArray(),lng:t.lng,lat:t.lat};
      setSelected(id);m.dragPan.disable();
    });
    m.on('mousemove',e=>{
      if(!drag.current)return;
      const d=drag.current;
      const lng=d.lng+e.lngLat.lng-d.start[0],lat=d.lat+e.lngLat.lat-d.start[1];
      setProject(p=>({...p,tents:(p.tents||[]).map(t=>t.id===d.id?{...t,lng,lat}:t)}));
    });
    function endDrag(){if(drag.current){drag.current=null;m.dragPan.enable();}}
    m.on('mouseup',endDrag);m.on('mouseout',endDrag);
    m.on('moveend',()=>{const c=m.getCenter();setProject(p=>({...p,center:[c.lng,c.lat],zoom:m.getZoom()}));});
    // Refresh sources when React state changes (see next effect).
    m.__udsSync=sync;
    return ()=>{ready.current=false;mapRef.current=null;m.remove();};
  },[token,mapStyle]);
  useEffect(()=>{
    const m=mapRef.current;
    m?.__udsSync?.();
    if(m) m.getCanvas().style.cursor=tool==='select'?'default':'crosshair';
  },[project.tents,points,selected,tool,pendingTent]);
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
  function exportFile(){
    const blob=new Blob([JSON.stringify({...project,format:'uds-v0.1'},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='universal-design-site-plan.json';a.click();URL.revokeObjectURL(url);
  }
  async function importFile(e){
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    try{
      if(file.size>1000000)throw Error('File too large');
      const p=JSON.parse(await file.text());if(p.format!=='uds-v0.1'||!Array.isArray(p.tents))throw Error('Not a Universal Design Studio project');
      const valid=p.tents.filter(t=>Number.isFinite(t.lng)&&Number.isFinite(t.lat)&&t.width>0&&t.length>0).slice(0,150);
      setProject({name:String(p.name||'Imported plan'),center:p.center||[-90.1994,38.627],zoom:p.zoom||17,tents:valid});
      setSelected(null);setPoints([]);if(p.center)mapRef.current?.jumpTo({center:p.center,zoom:p.zoom||17});
    }catch(err){setStatus('Import failed: '+err.message);}
  }
  return <div className="layout">
    <aside className="sidebar">
      <div className="brand"><span className="mark">U</span><div><strong>Universal Design Studio</strong><small>SATELLITE SITE PLANNER · V0.1</small></div></div>
      <section><h3>Map imagery</h3><div className="style-choices"><button type="button" className={mapStyle==='satellite'?'active':''} onClick={()=>setMapStyle('satellite')}>Satellite</button><button type="button" className={mapStyle==='hybrid'?'active':''} onClick={()=>setMapStyle('hybrid')}>Hybrid</button><button type="button" className={mapStyle==='streets'?'active':''} onClick={()=>setMapStyle('streets')}>Streets</button></div>{!token?<><label>Mapbox public token<input value={tokenText} onChange={e=>setTokenText(e.target.value)} type="password" placeholder="pk.eyJ…"/></label><button className="primary" onClick={startMap}>Open satellite map</button></>:<form onSubmit={search}><label>Find an address<input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Enter a property address"/></label><button type="submit">Search address</button>{matches.map((r,i)=><button type="button" key={i} className="search-result" onClick={()=>{mapRef.current?.flyTo({center:r.coords,zoom:18});setAddress(r.name);setMatches([]);}}>{r.name}</button>)}</form>}<p className="status">{status}</p>{imageryAccess==='blocked'&&<div className="imagery-warning" role="alert"><strong>Satellite imagery is blocked by Mapbox.</strong><p>The street map can load while the raster imagery is unavailable. If your Mapbox account is still on Demo, add a payment method to switch to Standard and unlock raster tiles. Standard has no upfront fee but usage can become billable.</p><a href="https://account.mapbox.com/" target="_blank" rel="noreferrer">Open Mapbox account settings</a></div>}</section>
      <section><h3>Tools</h3><div className="grid">{[['select','Select / drag'],['place','Place tent'],['measure','Measure']].map(([id,label])=><button key={id} className={tool===id?'active':''} disabled={!token} onClick={()=>{setTool(id);if(id==='measure')setPoints([]);}}>{label}</button>)}</div><p className="hint">{tool==='measure'?'Click two points on the map to measure a distance.':tool==='place'?'Click on the satellite map to position a tent.':'Click to select a tent; drag it to reposition.'}</p>{points.length===2&&<div className="measurement">Distance: {distance(points[0],points[1]).toFixed(1)} ft</div>}</section>
      <section><h3>New tent</h3><div className="grid"><label>Width (ft)<input type="number" min="1" value={width} onChange={e=>setWidth(+e.target.value)}/></label><label>Length (ft)<input type="number" min="1" value={length} onChange={e=>setLength(+e.target.value)}/></label><label>Rotation (°)<input type="number" value={rotation} onChange={e=>setRotation(+e.target.value)}/></label><label>Clearance (ft)<input type="number" min="0" value={clearance} onChange={e=>setClearance(+e.target.value)}/></label></div><button className="primary" disabled={!token} onClick={()=>setTool('place')}>Place {width} × {length} tent</button></section>
      <section><h3>Placed tents ({tents.length})</h3>{tents.map((t,i)=><button key={t.id} className={'listitem '+(selected===t.id?'active':'')} onClick={()=>{setSelected(t.id);mapRef.current?.flyTo({center:[t.lng,t.lat],zoom:Math.max(mapRef.current.getZoom(),17)});}}>{'Tent '+(i+1)+' — '+t.width+'×'+t.length+' ft'}</button>)}{chosen&&<div className="chosen"><h4>Selected tent</h4><label>Rotation (degrees)<input type="number" value={chosen.rotation} onChange={e=>editTent({rotation:clamp(e.target.value,0,359,0)})}/></label><label>Clearance (feet per side)<input type="number" value={chosen.clearance} onChange={e=>editTent({clearance:clamp(e.target.value,0,200,0)})}/></label><button onClick={()=>editTent({rotation:(chosen.rotation+15)%360})}>Rotate +15°</button><button onClick={()=>{setProject(p=>({...p,tents:p.tents.filter(t=>t.id!==selected)}));setSelected(null);}}>Delete tent</button></div>}</section>
      <section><h3>Project</h3><label>Project name<input value={project.name||''} onChange={e=>setProject(p=>({...p,name:e.target.value}))}/></label><button onClick={exportFile}>Export project JSON</button><label className="filebutton">Import project JSON<input type="file" accept=".json" onChange={importFile}/></label><p className="hint">Saved in this browser only. Appwrite cloud storage comes later.</p></section>
    </aside>
    <main className="map-panel"><div className="map-top"><strong>{project.name||'New site plan'}</strong><span>{tents.length} tents · {tents.reduce((sum,t)=>sum+t.width*t.length,0).toLocaleString()} sq ft</span></div><div className="map" ref={mapDiv}/>{!token&&<div className="empty-map"><h2>Plan events directly on satellite imagery.</h2><p>Enter your Mapbox public token on the left to start measuring sites and placing accurately scaled tents.</p></div>}<div className="disclaimer">Concept planning only. Check property dimensions, terrain, utilities, access, and anchoring on-site. Map imagery © Mapbox and contributors.</div></main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);

import React,{useEffect,useMemo,useRef,useState} from 'react';
import mapboxgl from 'mapbox-gl';
import {interiorGeoJSON} from './mapInterior.js';
import './adminViewer.css';

const styleUrl='mapbox://styles/mapbox/satellite-streets-v12';
const feet=3.280839895,rad=Math.PI/180;
function footprint(t){
  const angle=Number(t.rotation||0)*rad;
  const x=Number(t.width||0)/(2*feet),y=Number(t.length||0)/(2*feet);
  return [[-x,-y],[x,-y],[x,y],[-x,y]].map(([east,north])=>{
    const e=east*Math.cos(angle)+north*Math.sin(angle);
    const n=-east*Math.sin(angle)+north*Math.cos(angle);
    return [Number(t.lng)+e/(111319.49*Math.max(.1,Math.cos(Number(t.lat)*rad))),
      Number(t.lat)+n/111132.92];
  });
}
const collection=features=>({type:'FeatureCollection',features});
const download=(data,name)=>{
  const blob=new Blob([JSON.stringify({...data,format:'uds-v0.1'},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=(name||'plan').replace(/[^a-z0-9_-]+/gi,'-')+'-admin-copy.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
export default function AdminProjectViewer({record,owner,onClose}){
  const mapRef=useRef(null),container=useRef(null);
  const [selected,setSelected]=useState(null);
  const [showInterior,setShowInterior]=useState(true);
  const [status,setStatus]=useState('');
  const plan=record.plan||{};
  const tents=useMemo(()=>Array.isArray(plan.tents)?plan.tents.filter(t=>
    Number.isFinite(Number(t.lng))&&Number.isFinite(Number(t.lat))&&Number(t.width)>0&&Number(t.length)>0):[],[record]);
  const selectedTent=tents.find(t=>t.id===selected);
  const pinToken=import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN||
    (typeof localStorage!=='undefined'?localStorage.getItem('uds-mapbox-token'):'');
  useEffect(()=>{
    const onKey=e=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[onClose]);
  useEffect(()=>{
    if(!pinToken||!container.current){setStatus('Mapbox Site token not set. Tent details remain available below.');return;}
    mapboxgl.accessToken=pinToken;
    const center=Array.isArray(plan.center)&&plan.center.length===2?plan.center:[-90.1994,38.627];
    let m;
    try{
      m=new mapboxgl.Map({container:container.current,style:styleUrl,center,zoom:Number(plan.zoom)||16,maxZoom:24,
        attributionControl:true});
      mapRef.current=m;
      m.addControl(new mapboxgl.NavigationControl({showCompass:true}),'top-right');
      m.on('error',e=>setStatus('Map failed to load: '+(e.error?.message||'Mapbox imagery error')));
      m.on('load',()=>{
        m.addSource('admin-tents',{type:'geojson',data:collection([])});
        m.addSource('admin-inside',{type:'geojson',data:collection([])});
        m.addSource('admin-inside-labels',{type:'geojson',data:collection([])});
        m.addLayer({id:'admin-tent-fill',type:'fill',source:'admin-tents',
          paint:{'fill-color':'#2dc6b4','fill-opacity':.25}});
        m.addLayer({id:'admin-tent-line',type:'line',source:'admin-tents',
          paint:{'line-color':'#eafff5','line-width':2}});
        m.addLayer({id:'admin-inside-fill',type:'fill',source:'admin-inside',
          paint:{'fill-color':['get','fill'],'fill-opacity':.8}});
        m.addLayer({id:'admin-inside-line',type:'line',source:'admin-inside',
          paint:{'line-color':'#1d3b3d','line-width':1}});
        m.addLayer({id:'admin-inside-symbol',type:'symbol',source:'admin-inside-labels',
          layout:{'text-field':['get','label'],'text-size':11,'text-allow-overlap':false},
          paint:{'text-color':'#f5fff9','text-halo-color':'#203d40','text-halo-width':2}});
        updateLayers();
        if(tents.length){
          const bounds=new mapboxgl.LngLatBounds();
          tents.forEach(t=>footprint(t).forEach(pos=>bounds.extend(pos)));
          m.fitBounds(bounds,{padding:80,maxZoom:20,duration:0});
        }
      });
    }catch(err){setStatus('Unable to start map: '+err.message);}
    function updateLayers(){
      if(!m||!m.getSource('admin-tents'))return;
      const features=tents.filter(t=>!t.hidden).map(t=>({
        type:'Feature',properties:{id:t.id},
        geometry:{type:'Polygon',coordinates:[[...footprint(t),footprint(t)[0]]]}
      }));
      m.getSource('admin-tents').setData(collection(features));
      const overlay=interiorGeoJSON(tents.filter(t=>!t.hidden).map(t=>({...t,showInteriorOnMap:true})));
      m.getSource('admin-inside').setData(showInterior?overlay.polygons:collection([]));
      m.getSource('admin-inside-labels').setData(showInterior?overlay.labels:collection([]));
    }
    return ()=>{mapRef.current=null;m?.remove();};
  },[record]);
  useEffect(()=>{
    const m=mapRef.current;
    if(!m?.getSource('admin-inside'))return;
    const overlay=interiorGeoJSON(tents.filter(t=>!t.hidden).map(t=>({...t,showInteriorOnMap:true})));
    m.getSource('admin-inside').setData(showInterior?overlay.polygons:collection([]));
    m.getSource('admin-inside-labels').setData(showInterior?overlay.labels:collection([]));
  },[showInterior,record]);
  function zoomTo(t){
    setSelected(t.id);
    const m=mapRef.current;if(!m)return;
    const bounds=new mapboxgl.LngLatBounds();
    footprint(t).forEach(p=>bounds.extend(p));
    m.fitBounds(bounds,{padding:110,maxZoom:21});
  }
  return <div className="admin-preview-backdrop" role="dialog" aria-modal="true" aria-label={'Preview of '+record.name}>
    <div className="admin-preview-shell">
      <header className="admin-preview-header">
        <div><strong>{record.name}</strong><span>Owner: {owner||record.ownerId} · Last updated {new Date(record.updatedAt).toLocaleString()}</span></div>
        <div className="admin-preview-actions">
          <button onClick={()=>download(plan,record.name)} title="Download a copy without changing the original">Download JSON copy</button>
          <button onClick={onClose}>Close preview ×</button>
        </div>
      </header>
      <div className="admin-preview-main">
        <div className="admin-preview-map" ref={container}>
          {status&&<div className="admin-preview-status">{status}</div>}
          <label className="admin-preview-overlay"><input type="checkbox" checked={showInterior} onChange={e=>setShowInterior(e.target.checked)}/>Show furniture</label>
        </div>
        <aside className="admin-preview-sidebar">
          <h3>Site plan · {tents.length} tents</h3>
          <p>This is a **read-only** preview. Editing and saving remain with the owner.</p>
          {tents.map((t,i)=><div className={'admin-preview-tent '+(selected===t.id?'chosen':'')} key={t.id||i}>
            <button onClick={()=>zoomTo(t)}><strong>{t.name||'Tent '+(i+1)}</strong><span>{t.width} × {t.length} ft · {Math.round(Number(t.rotation||0))}°</span></button>
            <div className="admin-preview-details">
              <span>Clearance: {t.clearance||0} ft</span>
              <span>Furniture: {t.interior?.objects?.length||0} objects</span>
              <span>Doors: {t.interior?.doors?.length||0}</span>
              <span>{t.siteFlipLength?'Length flipped · ':''}{t.siteFlipWidth?'Width flipped':''}</span>
            </div>
          </div>)}
          {!tents.length&&<p>No tents in this project.</p>}
        </aside>
      </div>
    </div>
  </div>;
}

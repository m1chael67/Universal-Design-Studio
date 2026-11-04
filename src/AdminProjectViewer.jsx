import React,{useEffect,useMemo,useRef,useState} from 'react';
import mapboxgl from 'mapbox-gl';
import {interiorGeoJSON} from './mapInterior.js';
import {siteLogisticsGeoJSON,logisticsType,routeFeet,LOGISTICS_CHECKS} from './siteLogistics.js';
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
  const [showSiteLogistics,setShowSiteLogistics]=useState(true);
  const [status,setStatus]=useState('');
  const plan=record.plan||{};
  const tents=useMemo(()=>Array.isArray(plan.tents)?plan.tents.filter(t=>
    Number.isFinite(Number(t.lng))&&Number.isFinite(Number(t.lat))&&Number(t.width)>0&&Number(t.length)>0):[],[record]);
  const selectedTent=tents.find(t=>t.id===selected);
  const marks=Array.isArray(plan.logistics)?plan.logistics:[];
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
        for(const name of ['area','border','route','corridor','pins','labels'])
          m.addSource('admin-logistics-'+name,{type:'geojson',data:collection([])});
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
        m.addLayer({id:'admin-logistics-fill',type:'fill',source:'admin-logistics-area',
          paint:{'fill-color':['get','color'],'fill-opacity':.25}});
        m.addLayer({id:'admin-logistics-border',type:'line',source:'admin-logistics-border',
          paint:{'line-color':['get','color'],'line-width':2}});
        m.addLayer({id:'admin-logistics-corridor',type:'fill',source:'admin-logistics-corridor',
          paint:{'fill-color':['get','color'],'fill-opacity':.19}});
        m.addLayer({id:'admin-logistics-route',type:'line',source:'admin-logistics-route',
          paint:{'line-color':['get','color'],'line-width':4,'line-dasharray':[3,1]}});
        m.addLayer({id:'admin-logistics-pins',type:'circle',source:'admin-logistics-pins',
          paint:{'circle-radius':7,'circle-color':['get','color'],
            'circle-stroke-color':'#12282f','circle-stroke-width':2}});
        m.addLayer({id:'admin-logistics-labels',type:'symbol',source:'admin-logistics-labels',
          layout:{'text-field':['get','label'],'text-size':11,'text-offset':[0,-1]},
          paint:{'text-color':'#fffdf1','text-halo-color':'#142b30','text-halo-width':2}});
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
      const zone=siteLogisticsGeoJSON(marks);
      for(const name of ['area','border','route','corridor','pins','labels'])
        m.getSource('admin-logistics-'+name)?.setData(showSiteLogistics?zone[name]:collection([]));
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
  useEffect(()=>{
    const m=mapRef.current;
    if(!m?.getSource('admin-logistics-area'))return;
    const zone=siteLogisticsGeoJSON(marks);
    for(const name of ['area','border','route','corridor','pins','labels'])
      m.getSource('admin-logistics-'+name)?.setData(showSiteLogistics?zone[name]:collection([]));
  },[showSiteLogistics,record]);
  function zoomToMark(item){
    const pts=Array.isArray(item.points)?item.points:[];
    if(!pts.length||!mapRef.current)return;
    const m=mapRef.current;
    if(pts.length===1)m.flyTo({center:pts[0],zoom:Math.max(m.getZoom(),18)});
    else{
      const bounds=new mapboxgl.LngLatBounds();
      pts.forEach(p=>bounds.extend(p));
      m.fitBounds(bounds,{padding:100,maxZoom:20});
    }
  }
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
          <div className="admin-preview-overlays">
            <label><input type="checkbox" checked={showInterior} onChange={e=>setShowInterior(e.target.checked)}/>Show furniture</label>
            <label><input type="checkbox" checked={showSiteLogistics} onChange={e=>setShowSiteLogistics(e.target.checked)}/>Show logistics routes & zones</label>
          </div>
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
          <h3 className="admin-preview-logistics-heading">Site logistics · {marks.length}</h3>
          <details className="admin-preview-checklist">
            <summary>Site checks: {LOGISTICS_CHECKS.filter(c=>plan.siteChecklist?.[c.id]).length}/{LOGISTICS_CHECKS.length} verified</summary>
            {LOGISTICS_CHECKS.map(c=><p key={c.id}>{plan.siteChecklist?.[c.id]?'✓':'○'} {c.name}</p>)}
          </details>
          {marks.map((m,i)=><button className="admin-preview-mark" onClick={()=>zoomToMark(m)} key={m.id||i}>
            <span className="site-logistics-dot" style={{background:logisticsType(m.type).color}}/>
            <span><strong>{m.label||logisticsType(m.type).name}</strong>
              <small>{logisticsType(m.type).kind==='route'?routeFeet(m.points).toFixed(1)+' ft':logisticsType(m.type).name}
                {m.notes?' · '+m.notes:''}</small>
            </span>
          </button>)}
        </aside>
      </div>
    </div>
  </div>;
}

import React,{useEffect,useRef,useState} from 'react';
import mapboxgl from 'mapbox-gl';
import {Client,TablesDB} from 'appwrite';
import ThreeDViewer from './ThreeDViewer.jsx';
import {interiorGeoJSON} from './mapInterior.js';
import {restoreSharedTent} from './shareSnapshot.js';
import './share.css';
const client=new Client().setEndpoint('https://nyc.cloud.appwrite.io/v1').setProject('6aea8c410001e8aed9b1');
const db=new TablesDB(client);
const databaseId='6aeb3dfa001293738040',tableId='6aeb3e0500094b2a9ae4';
const token=import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN||'';
const rad=Math.PI/180;
function corners(t){
  const width=Number(t.width)||20,length=Number(t.length)||40,a=(Number(t.rotation)||0)*rad;
  return [[-width/2,-length/2],[width/2,-length/2],[width/2,length/2],[-width/2,length/2]].map(([e,n])=>{
    const east=(e*Math.cos(a)+n*Math.sin(a))/3.280839895;
    const north=(-e*Math.sin(a)+n*Math.cos(a))/3.280839895;
    return [Number(t.lng)+east/(111319.49*Math.max(.1,Math.cos(Number(t.lat)*rad))),Number(t.lat)+north/111132.92];
  });
}
const fc=features=>({type:'FeatureCollection',features});
export default function CustomerShare({id}){
  const [project,setProject]=useState(null),[error,setError]=useState(''),[show3D,setShow3D]=useState(false);
  const mapNode=useRef(null);
  useEffect(()=>{
    let cancelled=false;
    db.getRow({databaseId,tableId,rowId:id}).then(row=>{
      if(cancelled)return;
      if(!row.name?.startsWith('[PUBLIC VIEW] '))throw new Error('This is not a public customer view.');
      const data=JSON.parse(row.payload);
      if(!Array.isArray(data.tents))throw new Error('Invalid customer view.');
      setProject({...data,tents:data.tents.map(restoreSharedTent)});
    }).catch(()=>{if(!cancelled)setError('This customer link is unavailable or has been revoked.');});
    return ()=>{cancelled=true;};
  },[id]);
  useEffect(()=>{
    if(!project||!mapNode.current)return;
    if(!token){setError('Satellite map configuration is unavailable.');return;}
    mapboxgl.accessToken=token;
    const tents=project.tents.filter(t=>Number.isFinite(Number(t.lat))&&Number.isFinite(Number(t.lng)));
    const map=new mapboxgl.Map({container:mapNode.current,style:'mapbox://styles/mapbox/satellite-streets-v12',
      center:project.center||[tents[0]?.lng||-90.2,tents[0]?.lat||38.63],zoom:project.zoom||17});
    map.addControl(new mapboxgl.NavigationControl(),'top-right');
    map.on('load',()=>{
      const polygons=fc(tents.map(t=>{const c=corners(t);return {type:'Feature',properties:{name:t.name||t.width+' × '+t.length+' ft'},geometry:{type:'Polygon',coordinates:[[...c,c[0]]]}};}));
      map.addSource('tent-footprints',{type:'geojson',data:polygons});
      map.addLayer({id:'tent-fill',type:'fill',source:'tent-footprints',paint:{'fill-color':'#72bdb0','fill-opacity':.2}});
      map.addLayer({id:'tent-lines',type:'line',source:'tent-footprints',paint:{'line-color':'#f9d790','line-width':3}});
      const interior=interiorGeoJSON(tents.map(t=>({...t,showInteriorOnMap:true})));
      map.addSource('interior',{type:'geojson',data:interior.polygons});
      map.addLayer({id:'interior-fill',type:'fill',source:'interior',paint:{'fill-color':['get','fill'],'fill-opacity':.85,'fill-outline-color':'#283b43'}});
      map.addSource('interior-labels',{type:'geojson',data:interior.labels});
      map.addLayer({id:'interior-text',type:'symbol',source:'interior-labels',
        layout:{'text-field':['get','label'],'text-size':11,'text-allow-overlap':false},
        paint:{'text-color':'#12292d','text-halo-color':'#fff','text-halo-width':1}});
      if(tents.length){
        const bounds=new mapboxgl.LngLatBounds();
        tents.forEach(t=>corners(t).forEach(c=>bounds.extend(c)));
        map.fitBounds(bounds,{padding:45,maxZoom:20,duration:0});
      }
    });
    return ()=>map.remove();
  },[project]);
  return <div className="uds-public-share">
    <header><img src="/universal-crew-logo.jpg" alt="Universal Rentals & Events"/><div><strong>{project?.name||'Customer design'}</strong><small>VIEW-ONLY SITE PLAN</small></div>
      {project?.tents?.length>0&&<button onClick={()=>setShow3D(true)}>Explore interactive 3D</button>}</header>
    {error?<p role="alert" className="share-error">{error}</p>:!project?<p className="share-loading">Loading shared design…</p>:
      <><div className="share-map" ref={mapNode}/><p className="share-caption">Read-only design snapshot · Satellite imagery © Mapbox and contributors · Concept layout, not a field survey or engineering plan.</p></>}
    {show3D&&<ThreeDViewer tents={project.tents} onClose={()=>setShow3D(false)}/>}
  </div>;
}

import React,{useEffect,useRef,useState} from 'react';
import {prepareSitePhoto,normalizedPoint} from './photoUtils.js';
import './photoMarkup.css';

const COLORS={
  arrow:'#ffe083',pin:'#ef7778',box:'#56dcca',text:'#ffffff'
};
const TYPES=[
  {id:'pin',title:'Drop marker'},
  {id:'arrow',title:'Draw direction arrow'},
  {id:'box',title:'Outline an area'},
  {id:'text',title:'Add label'}
];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const cleanName=s=>String(s||'site-photo').replace(/[^a-z0-9_-]+/gi,'-').slice(0,55)||'site-photo';
const pct=x=>(x*100).toFixed(2)+'%';
const downloadBlob=(blob,filename)=>{
  if(!blob)return;
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};

function Overlay({annotation,active,onSelect}){
  const a=annotation,style={cursor:'pointer'};
  if(a.type==='box')return <g onPointerDown={e=>{e.stopPropagation();onSelect(a.id);}} style={style}>
    <rect x={Math.min(a.x,a.x2)*1000} y={Math.min(a.y,a.y2)*1000}
      width={Math.abs(a.x2-a.x)*1000} height={Math.abs(a.y2-a.y)*1000}
      fill="rgba(37,203,182,.17)" stroke={active?'#ffffff':a.color||COLORS.box} strokeWidth={active?6:4}
      strokeDasharray="12 8"/>
  </g>;
  if(a.type==='arrow')return <g onPointerDown={e=>{e.stopPropagation();onSelect(a.id);}} style={style}>
    <line x1={a.x*1000} y1={a.y*1000} x2={a.x2*1000} y2={a.y2*1000}
      stroke="#123037" strokeWidth="13" strokeLinecap="round"/>
    <line x1={a.x*1000} y1={a.y*1000} x2={a.x2*1000} y2={a.y2*1000}
      stroke={active?'#ffffff':a.color||COLORS.arrow} strokeWidth="8" strokeLinecap="round"
      markerEnd="url(#uds-photo-arrow)"/>
  </g>;
  const x=a.x*1000,y=a.y*1000;
  return <g onPointerDown={e=>{e.stopPropagation();onSelect(a.id);}} style={style}>
    {a.type==='pin'&&<><circle cx={x} cy={y} r="22" fill={a.color||COLORS.pin} stroke="#173038" strokeWidth="7"/>
      <circle cx={x} cy={y} r={active?11:6} fill="#fff"/></>}
    <text x={x+25} y={y-25} fill="#fff" stroke="#173038" strokeWidth="7" paintOrder="stroke"
      fontSize="35" fontFamily="Arial,sans-serif" fontWeight="700">{a.text||'Mark'}</text>
  </g>;
}

export default function PhotoMarkup({value,onChange,projectName}){
  const [open,setOpen]=useState(false);
  const [tool,setTool]=useState('pin');
  const [annotationText,setAnnotationText]=useState('Unloading / entrance');
  const [color,setColor]=useState(COLORS.pin);
  const [active,setActive]=useState(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [preview,setPreview]=useState(null);
  const [pending,setPending]=useState(null);
  const svgRef=useRef(null);
  const data=value&&typeof value==='object'?value:{};
  const annotations=Array.isArray(data.annotations)?data.annotations:[];
  const photo=data.photo;
  const selected=annotations.find(a=>a.id===active);

  useEffect(()=>{setColor(COLORS[tool]);},[tool]);
  const patch=(update)=>onChange({
    ...data, ...update,
    annotations:update.annotations??annotations
  });
  async function upload(e){
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    if(photo&&!window.confirm('Replace the current photo? Its annotations will be cleared. Download the marked image first if you need it.'))return;
    setLoading(true);setError('');
    try{
      const compressed=await prepareSitePhoto(file);
      patch({photo:compressed,annotations:[]});
      setActive(null);setPending(null);setOpen(true);
    }catch(err){setError(String(err.message||err));}
    finally{setLoading(false);}
  }
  function pointFromEvent(e){
    const box=svgRef.current?.getBoundingClientRect();
    if(!box||!box.width||!box.height)return null;
    return normalizedPoint(e.clientX,e.clientY,box);
  }
  function addAnnotation(a){
    if(annotations.length>=120){setError('Maximum 120 annotations per site photo.');return;}
    const item={id:crypto.randomUUID(),type:tool,color,text:annotationText.trim().slice(0,100),...a};
    patch({annotations:[...annotations,item]});setActive(item.id);
  }
  function pointerDown(e){
    if(!photo||e.button!==0)return;
    const p=pointFromEvent(e);
    if(!p)return;
    if(tool==='pin'||tool==='text'){addAnnotation(p);return;}
    e.currentTarget.setPointerCapture(e.pointerId);
    setPending({start:p,end:p});
  }
  function pointerMove(e){
    if(!pending)return;
    const point=pointFromEvent(e);
    if(point)setPending(prev=>prev?{...prev,end:point}:prev);
  }
  function pointerUp(e){
    if(!pending)return;
    const p=pointFromEvent(e)||pending.end;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    const start=pending.start;
    setPending(null);
    if(Math.hypot(start.x-p.x,start.y-p.y)<.01){setError('Drag farther to create an arrow or marked zone.');return;}
    addAnnotation({...start,x2:p.x,y2:p.y});
  }
  function updateSelected(changes){
    patch({annotations:annotations.map(a=>a.id===active?{...a,...changes}:a)});
  }
  async function exportImage(){
    if(!photo)return;
    setError('');setLoading(true);
    try{
      const image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=photo.dataUrl;});
      const canvas=document.createElement('canvas');
      canvas.width=photo.width;canvas.height=photo.height;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const scale=canvas.width/1000;
      ctx.lineCap='round';ctx.lineJoin='round';
      for(const a of annotations){
        const col=a.color||COLORS[a.type],x=a.x*canvas.width,y=a.y*canvas.height;
        if(a.type==='box'){
          ctx.fillStyle='rgba(35,210,184,.20)';ctx.strokeStyle=col;ctx.lineWidth=4*scale;
          const w=(a.x2-a.x)*canvas.width,h=(a.y2-a.y)*canvas.height;
          ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
        }else if(a.type==='arrow'){
          const tx=a.x2*canvas.width,ty=a.y2*canvas.height;
          const ang=Math.atan2(ty-y,tx-x),head=23*scale;
          ctx.strokeStyle='#153039';ctx.lineWidth=11*scale;
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();
          ctx.strokeStyle=col;ctx.lineWidth=6*scale;
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();
          ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(tx,ty);
          ctx.lineTo(tx-head*Math.cos(ang-.5),ty-head*Math.sin(ang-.5));
          ctx.lineTo(tx-head*Math.cos(ang+.5),ty-head*Math.sin(ang+.5));ctx.closePath();ctx.fill();
        }else if(a.type==='pin'){
          ctx.fillStyle=col;ctx.strokeStyle='#153039';ctx.lineWidth=6*scale;
          ctx.beginPath();ctx.arc(x,y,16*scale,0,Math.PI*2);ctx.fill();ctx.stroke();
        }
        if(a.type==='pin'||a.type==='text'){
          ctx.font='bold '+Math.max(14,27*scale)+'px Arial';
          ctx.lineWidth=5*scale;ctx.strokeStyle='#142a32';ctx.fillStyle='#ffffff';
          ctx.strokeText(a.text||'Mark',x+21*scale,y-20*scale);
          ctx.fillText(a.text||'Mark',x+21*scale,y-20*scale);
        }
      }
      // No satellite base imagery is composited: only the user's uploaded photo.
      const footer=Math.max(38,Math.round(48*scale));
      const output=document.createElement('canvas');
      output.width=canvas.width;output.height=canvas.height+footer;
      const out=output.getContext('2d');
      out.fillStyle='#152831';out.fillRect(0,0,output.width,output.height);
      out.drawImage(canvas,0,0);
      out.fillStyle='#fff';out.font='bold '+Math.max(12,22*scale)+'px Arial';
      out.fillText((projectName||'Site photo').slice(0,70)+' · Universal Rentals & Events',12*scale,output.height-footer*.4,output.width-20*scale);
      output.toBlob(blob=>downloadBlob(blob,cleanName(projectName)+'-site-photo.png'),'image/png');
    }catch(e){setError('Could not export: '+String(e.message||e));}
    finally{setLoading(false);}
  }
  return <section className="photo-markup-panel">
    <button type="button" className="photo-markup-toggle" onClick={()=>setOpen(v=>!v)}
      aria-expanded={open}><span>Site photo markup {photo?'· Photo saved':''}</span><span>{open?'−':'+'}</span></button>
    {open&&<div className="photo-markup-body">
      <p className="photo-markup-help">Upload a photo of the site, then label truck access, unloading, gates, staging, hazards or setup directions. The compressed photo and markings save with your private cloud project.</p>
      <label className="photo-upload">
        {loading?'Processing photo…':photo?'Replace photo':'Upload JPG / PNG / WebP photo'}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={upload} disabled={loading}/>
      </label>
      {photo&&<>
        <div className="photo-tools" role="group" aria-label="Photo marking tools">
          {TYPES.map(t=><button type="button" key={t.id} className={tool===t.id?'active':''}
            onClick={()=>{setTool(t.id);setPending(null);}}>{t.title}</button>)}
        </div>
        <label>Marker / label text <input type="text" maxLength={100}
          value={annotationText} onChange={e=>setAnnotationText(e.target.value)}/></label>
        <label>Mark color <input className="photo-color" type="color" value={color} onChange={e=>setColor(e.target.value)}/></label>
        <div className="photo-stage" aria-label="Site photograph with annotations">
          <img src={photo.dataUrl} alt="Uploaded site for planning annotations" draggable={false}/>
          <svg ref={svgRef} viewBox="0 0 1000 1000" preserveAspectRatio="none"
            onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
            onPointerCancel={()=>setPending(null)} className="photo-overlay" role="img" aria-label="Draw on site photo">
            <defs><marker id="uds-photo-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0 0 L6 3 L0 6 z" fill="#ffe083"/>
            </marker></defs>
            {annotations.map(a=><Overlay key={a.id} annotation={a} active={active===a.id} onSelect={setActive}/>)}
            {pending&&<g opacity=".8">
              {tool==='arrow'?<line x1={pending.start.x*1000} y1={pending.start.y*1000}
                x2={pending.end.x*1000} y2={pending.end.y*1000} stroke={color} strokeWidth="7" strokeDasharray="15 9"/>:
              <rect x={Math.min(pending.start.x,pending.end.x)*1000}
                y={Math.min(pending.start.y,pending.end.y)*1000}
                width={Math.abs(pending.end.x-pending.start.x)*1000}
                height={Math.abs(pending.end.y-pending.start.y)*1000}
                fill="#56dccb33" stroke={color} strokeWidth="5"/>}
            </g>}
          </svg>
        </div>
        <p className="photo-markup-help">Click to place a marker or label. Drag to draw an arrow or outline. Select an existing annotation below to edit or delete it.</p>
        {selected&&<div className="photo-edit">
          <strong>Selected annotation</strong>
          <label>Label <input type="text" maxLength={100} value={selected.text||''}
            onChange={e=>updateSelected({text:e.target.value})}/></label>
          <button onClick={()=>{patch({annotations:annotations.filter(a=>a.id!==active)});setActive(null);}}>Delete annotation</button>
        </div>}
        {!!annotations.length&&<div className="photo-annotations">
          {annotations.map((a,i)=><button key={a.id} className={active===a.id?'active':''}
            onClick={()=>setActive(a.id)}><span>{i+1}. {a.type}</span> {a.text||'Unlabeled'}</button>)}
        </div>}
        <div className="photo-buttons">
          <button className="primary" disabled={loading} onClick={exportImage}>Export marked photo PNG</button>
          <button disabled={loading} onClick={()=>{
            if(window.confirm('Remove the photo and all its annotations from this project?')){patch({photo:null,annotations:[]});setActive(null);}
          }}>Remove photo</button>
        </div>
        <p className="photo-markup-help">Photo resized to {photo.width} × {photo.height} pixels ({Math.round(photo.bytes/1024)} KB). Cloud saves include this compressed copy; keep the original separately for full-resolution work.</p>
      </>}
      {error&&<p className="photo-error" role="alert">{error}</p>}
    </div>}
  </section>;
}

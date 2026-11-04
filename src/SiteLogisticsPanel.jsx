import React,{useEffect,useState} from 'react';
import {LOGISTICS_TYPES,LOGISTICS_CHECKS,logisticsType,routeFeet,siteFeet,defaultPathWidth} from './siteLogistics.js';
import './siteLogistics.css';

const polygonAreaFt2=points=>{
  if(points.length<3)return 0;
  const cy=points.reduce((v,p)=>v+p[1],0)/points.length;
  const xScale=364567*Math.cos(cy*Math.PI/180),yScale=364000;
  let sum=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    sum+=a[0]*xScale*b[1]*yScale-b[0]*xScale*a[1]*yScale;
  }
  return Math.abs(sum/2);
};
export function logisticsDescription(item){
  if(!item)return '';
  const t=logisticsType(item.type);
  if(t.kind==='route')return routeFeet(item.points||[]).toFixed(1)+' ft route';
  if(item.shape==='circle'&&item.points?.length>=2)return 'Radius '+siteFeet(item.points[0],item.points[1]).toFixed(1)+' ft';
  if(t.kind==='area')return (polygonAreaFt2(item.points||[])).toFixed(0)+' sq ft';
  return 'Map pin';
}
export default function SiteLogisticsPanel({jumpToken,items,draft,selected,checklist={},onChecklistChange,onSelect,onStart,onFinish,onCancel,onBack,onChange,onRemove,onZoom}){
  const [open,setOpen]=useState(true);
  useEffect(()=>{if(jumpToken>0)setOpen(true);},[jumpToken]);
  const [category,setCategory]=useState('unload');
  const [shape,setShape]=useState('polygon');
  const [label,setLabel]=useState('');
  const [notes,setNotes]=useState('');
  const current=items.find(x=>x.id===selected);
  const chosen=logisticsType(category);
  function start(){
    const title=label.trim()||chosen.name;
    onStart({id:crypto.randomUUID(),type:category,label:title,notes:notes.trim(),
      widthFt:chosen.kind==='route'?defaultPathWidth(category):null,
      shape:chosen.kind==='area'?shape:chosen.kind,points:[]});
  }
  return <section className="site-logistics" aria-label="Site logistics and access planning">
    <button type="button" className="site-logistics-toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      <span>Site Logistics & Routes ({items.length})</span><span>{open?'−':'+'}</span>
    </button>
    {open&&<>
      <p className="hint">Mark parking, unloading, grass-safe paths, truck routes, restricted areas, and crew entry. All annotations save with the project.</p>
      {draft?<div className="site-logistics-drawing">
        <strong>Drawing: {draft.label}</strong>
        <p>Click the satellite map to add {draft.shape==='circle'?'a center and edge':logisticsType(draft.type).kind==='pin'?'a pin':'route points or area corners'}.</p>
        <p>Points: <b>{draft.points.length}</b>
          {draft.type==='vehicle'||draft.type==='foot'||draft.type==='grass'||draft.type==='emergency'?
            ' · '+routeFeet(draft.points).toFixed(1)+' ft':''}
        </p>
        <div className="site-logistics-btn-row">
          {draft.shape!=='circle'&&draft.shape!=='pin'&&<button className="primary" disabled={draft.points.length<(logisticsType(draft.type).kind==='route'?2:3)} onClick={onFinish}>Finish {logisticsType(draft.type).kind==='route'?'route':'area'}</button>}
          <button onClick={onBack} disabled={!draft.points.length}>Undo point</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>:<div className="site-logistics-new">
        <label>Mark or route type
          <select value={category} onChange={e=>setCategory(e.target.value)}>
            <optgroup label="Zones">{LOGISTICS_TYPES.filter(t=>t.kind==='area').map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
            <optgroup label="Routes">{LOGISTICS_TYPES.filter(t=>t.kind==='route').map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
            <optgroup label="Markers">{LOGISTICS_TYPES.filter(t=>t.kind==='pin').map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</optgroup>
          </select>
        </label>
        {chosen.kind==='area'&&<div className="site-logistics-btn-row">
          <button className={shape==='polygon'?'active':''} onClick={()=>setShape('polygon')}>Draw outline</button>
          <button className={shape==='circle'?'active':''} onClick={()=>setShape('circle')}>Draw circle</button>
        </div>}
        <label>Name (optional)<input type="text" maxLength={70} placeholder={chosen.name} value={label} onChange={e=>setLabel(e.target.value)}/></label>
        <label>Instructions (optional)<textarea maxLength={450} rows={2}
          placeholder="e.g. Keep the truck off the lawn; use plywood mats"
          value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <button className="primary" onClick={start}>+ Mark this on map</button>
      </div>}
      {items.length>0&&<div className="site-logistics-list">
        <strong className="site-logistics-list-title">Saved site marks</strong>
        {items.map(item=><div key={item.id} className={'site-logistics-entry '+(item.id===selected?'selected':'')}>
          <button type="button" className="site-logistics-list-item"
            onClick={()=>{onSelect(item.id);setOpen(true);}}>
            <span className="site-logistics-dot" style={{background:logisticsType(item.type).color}}/>
            <span><b>{item.label||logisticsType(item.type).name}</b><small>{logisticsDescription(item)}{item.hidden?' · Hidden':''}</small></span>
          </button>
          <button className="site-logistics-eye" title={item.hidden?'Show layer':'Hide layer'} aria-label={item.hidden?'Show mark':'Hide mark'} onClick={()=>onChange(item.id,{hidden:!item.hidden})}>{item.hidden?'◌':'◉'}</button>
          {item.id===selected&&<div className="site-logistics-edit">
            <label>Label<input type="text" value={item.label||''} maxLength={70}
              onChange={e=>onChange(item.id,{label:e.target.value})}/></label>
            <label>Crew notes<textarea rows={2} maxLength={450} value={item.notes||''}
              onChange={e=>onChange(item.id,{notes:e.target.value})}/></label>
            {logisticsType(item.type).kind==='route'&&<label>Approximate route width (feet)
              <input type="number" min="1" max="100" step="1" value={item.widthFt??defaultPathWidth(item.type)}
                onChange={e=>{
                  const raw=e.target.value;if(raw==='')return;
                  const value=Number(raw);if(Number.isFinite(value))
                    onChange(item.id,{widthFt:Math.max(1,Math.min(100,value))});
                }}/>
            </label>}
            <div className="site-logistics-btn-row">
              <button onClick={()=>onZoom(item)}>Find on map</button>
              <button onClick={()=>onStart({...item,points:[]})}>Redraw</button>
              <button className="site-logistics-danger" onClick={()=>onRemove(item.id)}>Delete</button>
            </div>
          </div>}
        </div>)}
      </div>}
      <details className="site-readiness">
        <summary>Site readiness checklist — {LOGISTICS_CHECKS.filter(c=>checklist[c.id]).length}/{LOGISTICS_CHECKS.length} checked</summary>
        <p className="hint">A planning reminder, not proof that a condition is safe. Check each item after verifying it in the field.</p>
        {LOGISTICS_CHECKS.map(c=><label key={c.id} className="site-readiness-row">
          <input type="checkbox" checked={Boolean(checklist[c.id])} onChange={e=>onChecklistChange(c.id,e.target.checked)}/>
          <span>{c.name}</span>
        </label>)}
      </details>
      <p className="hint">Route lengths and zone sizes are satellite-map estimates. Verify road width, slopes, muddy ground, overhead clearance, utility locations, load limits, and emergency access on-site.</p>
    </>}
  </section>;
}

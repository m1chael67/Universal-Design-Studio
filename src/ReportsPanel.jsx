import React,{useState} from 'react';
import './reports.css';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const size=v=>Number.isFinite(Number(v))?Number(v).toFixed(1):'—';
const fmtDate=()=>new Date().toLocaleString();
const nameOf=t=>t.name||'Tent';
const validImage=s=>typeof s==='string'&&/^data:image\/(png|jpeg|webp);base64,/i.test(s)?s:'';
export function buildReportHtml({project,mapImage,kind,notes}){
  const tents=Array.isArray(project.tents)?project.tents.filter(t=>!t.hidden):[];
  const logistics=Array.isArray(project.logistics)?project.logistics:[];
  const photo=validImage(project.sitePhoto?.photo?.dataUrl);
  const checklist=project.siteChecklist||{};
  const map=validImage(mapImage);
  const totalArea=tents.reduce((n,t)=>n+(Number(t.width)||0)*(Number(t.length)||0),0);
  const rows=tents.map((t,i)=>'<tr><td>'+esc(nameOf(t))+'</td><td>'+size(t.width)+' × '+size(t.length)+' ft</td><td>'+Math.round((Number(t.width)||0)*(Number(t.length)||0)).toLocaleString()+' ft²</td><td>'+esc((t.interior?.objects||[]).length)+' furnishings</td></tr>').join('');
  const logisticsRows=logistics.map(l=>'<li><strong>'+esc(l.label||l.type||'Site note')+'</strong> — '+esc(l.notes||l.description||'')+'</li>').join('');
  const annotated=photo?'<section class="page"><h2>Site reference photograph</h2><img class="photo" src="'+photo+'" alt="Site reference photograph"/><p>Photo annotations are preserved in the editable project. Export the marked photo PNG separately to include annotations as a flattened image.</p></section>':'';
  const title=kind==='customer'?'Customer site design proposal':'Crew site setup & logistics';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>'+esc(project.name)+' — '+title+'</title><style>'+
  '@page{size:letter;margin:.65in}*{box-sizing:border-box}body{font:13px Arial,sans-serif;color:#1b2a32;margin:0}header{border-bottom:5px solid #147d76;padding-bottom:16px;margin-bottom:18px;display:flex;align-items:center;gap:18px}header img{width:75px;height:75px;object-fit:contain}h1{font-size:23px;margin:0 0 5px}h2{font-size:17px;color:#145e60;margin:22px 0 10px}p{line-height:1.55}small,.muted{color:#667985}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{padding:9px;border-bottom:1px solid #d5e0e3;text-align:left}th{background:#eaf3f3}img.map{width:100%;max-height:5.7in;object-fit:contain;border:1px solid #c9d5d8}img.photo{width:100%;max-height:8in;object-fit:contain}section.page{break-before:page}ul{padding-left:20px;line-height:1.7}.notice{border-left:4px solid #147d76;background:#eaf3f3;padding:11px;margin:16px 0}.stats{display:flex;gap:25px;font-size:14px}.stats b{font-size:20px;display:block}.print-controls{padding:10px;background:#e5f2f0;text-align:center}@media print{.print-controls{display:none}}'+
  '</style></head><body><div class="print-controls"><button onclick="window.print()">Print / Save as PDF</button> &nbsp; Close this tab when finished</div>'+
  '<header><img src="/universal-crew-logo.jpg" alt="Universal Rentals logo"><div><h1>'+esc(project.name||'Site plan')+'</h1><strong>UNIVERSAL RENTALS & EVENTS</strong><p>'+title+' · '+esc(fmtDate())+'</p></div></header>'+
  '<div class="stats"><div><b>'+tents.length+'</b>visible tents</div><div><b>'+Math.round(totalArea).toLocaleString()+'</b>square feet of tent footprint</div></div>'+
  '<h2>Site overview</h2>'+(map?'<img class="map" src="'+map+'" alt="Site map with tents and logistics"/><p class="muted">Map imagery © Mapbox and contributors. For planning reference only.</p>':'<div class="notice">Map snapshot unavailable. Open and fully load the satellite map, then generate this report again.</div>')+
  '<h2>Tent schedule</h2><table><thead><tr><th>Tent</th><th>Footprint</th><th>Area</th><th>Interior</th></tr></thead><tbody>'+rows+'</tbody></table>'+
  (kind==='crew'?'<section><h2>Access, staging and site logistics</h2><ul>'+(logisticsRows||'<li>No logistics notes recorded.</li>')+'</ul><h2>Pre-setup verification</h2><p>'+Object.entries(checklist).filter(([,v])=>v).length+' site checklist items marked complete.</p></section>':'<p class="notice">Illustrative site layout only; final field measurements and approvals are required.</p>')+
  (notes?.trim()?'<h2>Additional instructions</h2><p>'+esc(notes).replace(/\n/g,'<br>')+'</p>':'')+
  annotated+
  '<section><h2>Field verification required</h2><p>Verify ground conditions, slopes, underground utilities, anchor placement, access width, overhead obstructions, weather conditions, egress and applicable fire/occupancy rules. This design is not a stamped engineering plan or a permit.</p></section>'+
  '</body></html>';
}
export default function ReportsPanel({project,mapRef}){
  const [open,setOpen]=useState(false),[kind,setKind]=useState('crew'),[notes,setNotes]=useState(''),[message,setMessage]=useState('');
  function generate(){
    let mapImage='';
    try{
      const map=mapRef?.current;
      if(map&&map.loaded())mapImage=map.getCanvas().toDataURL('image/png');
    }catch{setMessage('Map could not be captured; report will still contain tent schedule and site notes.');}
    const html=buildReportHtml({project,mapImage,kind,notes});
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const win=window.open(url,'_blank');
    if(!win){setMessage('Pop-up blocked. Allow pop-ups for the Design Studio and retry.');URL.revokeObjectURL(url);return;}
    setMessage('Report opened in a new tab. Choose Print → Save as PDF.');
    setTimeout(()=>URL.revokeObjectURL(url),120000);
  }
  return <details className="sidebar-collapsible" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary>Branded reports & printable PDFs</summary>
    <div className="sidebar-collapsible-body reports-panel">
      <p>Generate a Universal Rentals report with your site plan, tent schedule and field notes. Print or save it as PDF from the new tab.</p>
      <label>Report audience<select value={kind} onChange={e=>setKind(e.target.value)}>
        <option value="crew">Crew setup & logistics</option><option value="customer">Customer proposal</option>
      </select></label>
      <label>Additional instructions<textarea rows={4} maxLength={2500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Parking, contact, access times, special instructions…"/></label>
      <button className="primary" onClick={generate}>Generate printable report</button>
      <p className="hint">Includes the uploaded site photo if present. For a marked photo, export its annotated PNG from Site Photo Markup.</p>
      {message&&<p role="status" className="hint">{message}</p>}
    </div>
  </details>;
}

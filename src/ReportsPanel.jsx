import React,{useState} from 'react';
import './reports.css';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const size=v=>Number.isFinite(Number(v))?Number(v).toFixed(1):'—';
const fmtDate=()=>new Date().toLocaleString();
const nameOf=t=>t.name||'Tent';
const LOGO_DATA='data:image/jpeg;base64,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';
const itemName=o=>({rect6:'6 ft banquet table',rect8:'8 ft banquet table',round5:'60″ round table',round6:'72″ round table',folding:'Folding chair',chiavari:'Chiavari chair',stage:'Stage',stairs:'Stage stairs',dance:'Dance floor',bar6:'6 ft bar',bar7:'7 ft bar'}[o.catalog]||o.label||o.type||'Equipment');
export function itemizedInterior(tents){
  return tents.map(t=>{
    const items=t.interior?.objects||[];
    const grouped=new Map();
    for(const o of items){
      const key=itemName(o)+(o.type==='stage'?' ('+Number(o.w||4)+' × '+Number(o.h||4)+' ft)':'');
      grouped.set(key,(grouped.get(key)||0)+1);
    }
    return {tent:nameOf(t),items:[...grouped].sort((a,b)=>a[0].localeCompare(b[0]))};
  });
}
const validImage=s=>typeof s==='string'&&/^data:image\/(png|jpeg|webp);base64,/i.test(s)?s:'';
export function buildReportHtml({project,mapImage,kind,notes}){
  const tents=Array.isArray(project.tents)?project.tents.filter(t=>!t.hidden):[];
  const logistics=Array.isArray(project.logistics)?project.logistics:[];
  const photo=validImage(project.sitePhoto?.photo?.dataUrl);
  const checklist=project.siteChecklist||{};
  const map=validImage(mapImage);
  const totalArea=tents.reduce((n,t)=>n+(Number(t.width)||0)*(Number(t.length)||0),0);
  const rows=tents.map((t,i)=>'<tr><td>'+esc(nameOf(t))+'</td><td>'+size(t.width)+' × '+size(t.length)+' ft</td><td>'+Math.round((Number(t.width)||0)*(Number(t.length)||0)).toLocaleString()+' ft²</td><td>'+esc((t.interior?.objects||[]).length)+' furnishings</td></tr>').join('');
  const inventory=itemizedInterior(tents);
  const itemRows=inventory.map(group=>'<h3>'+esc(group.tent)+'</h3>'+(group.items.length?'<table class="inventory"><thead><tr><th>Interior equipment</th><th>Quantity</th></tr></thead><tbody>'+group.items.map(([label,qty])=>'<tr><td>'+esc(label)+'</td><td>'+qty+'</td></tr>').join('')+'</tbody></table>':'<p>No interior equipment placed.</p>')).join('');
  const logisticsRows=logistics.map(l=>'<li><strong>'+esc(l.label||l.type||'Site note')+'</strong> — '+esc(l.notes||l.description||'')+'</li>').join('');
  const marks=Array.isArray(project.sitePhoto?.annotations)?project.sitePhoto.annotations.slice(0,120):[];
  const safeN=n=>Math.max(0,Math.min(1000,Number.isFinite(Number(n))?Number(n)*1000:0));
  const markup=marks.map(a=>{
    const x=safeN(a.x),y=safeN(a.y),x2=safeN(a.x2),y2=safeN(a.y2);
    const color=/^#[0-9a-f]{6}$/i.test(a.color||'')?a.color:'#ffe083';
    if(a.type==='box')return '<rect x="'+Math.min(x,x2)+'" y="'+Math.min(y,y2)+'" width="'+Math.abs(x2-x)+'" height="'+Math.abs(y2-y)+'" stroke="'+color+'" stroke-width="6" fill="#56dccb33"/>';
    if(a.type==='arrow')return '<line x1="'+x+'" y1="'+y+'" x2="'+x2+'" y2="'+y2+'" stroke="'+color+'" stroke-width="9"/>';
    return '<g><circle cx="'+x+'" cy="'+y+'" r="15" fill="'+color+'" stroke="#16323c" stroke-width="5"/><text x="'+(x+22)+'" y="'+(y-20)+'" font-size="34" font-weight="700" fill="white" stroke="#16323c" stroke-width="6" paint-order="stroke">'+esc(a.text||'Mark')+'</text></g>';
  }).join('');
  const aspect=(Number(project.sitePhoto?.photo?.width)||1600)/(Number(project.sitePhoto?.photo?.height)||900);
  const annotated=photo?'<section class="page"><h2>Site reference photograph & annotations</h2><div class="photo-stage" style="aspect-ratio:'+Math.max(.2,Math.min(6,aspect))+'"><img class="photo" src="'+photo+'" alt="Site reference photograph"/><svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Site photo annotations">'+markup+'</svg></div><p>Photo and planning marks are included for site reference.</p></section>':'';
  const title=kind==='customer'?'Customer site design proposal':'Crew site setup & logistics';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>'+esc(project.name)+' — '+title+'</title><style>'+
  '@page{size:letter;margin:.55in}*{box-sizing:border-box}html,body{width:100%;max-width:100%;overflow-wrap:break-word}body{font:12px Arial,sans-serif;color:#1b2a32;margin:0;padding:0 12px}header{border-bottom:4px solid #147d76;padding-bottom:12px;margin-bottom:16px;display:flex;align-items:center;gap:16px;break-inside:avoid}header img{width:78px;height:78px;object-fit:contain;flex:none;background:#000;border-radius:8px}h1{font-size:22px;margin:0 0 5px}h2{font-size:16px;color:#145e60;margin:18px 0 8px;break-after:avoid}h3{font-size:13px;margin:12px 0 4px;break-after:avoid}p{line-height:1.45}small,.muted{color:#667985}table{width:100%;border-collapse:collapse;margin:9px 0 14px;table-layout:fixed}td,th{padding:7px;border-bottom:1px solid #d5e0e3;text-align:left;overflow-wrap:anywhere}th{background:#eaf3f3}tr{break-inside:avoid}img.map{display:block;width:100%;max-width:100%;height:auto;max-height:4.9in;object-fit:contain;border:1px solid #c9d5d8}img.photo{width:100%;height:100%;object-fit:contain;display:block}.photo-stage{position:relative;width:100%;max-height:7.5in;overflow:hidden}.photo-stage svg{position:absolute;inset:0;width:100%;height:100%}section.page{break-before:page}section.report-block{break-inside:auto}ul{padding-left:20px;line-height:1.55}.notice{border-left:4px solid #147d76;background:#eaf3f3;padding:10px;margin:14px 0}.stats{display:flex;gap:24px;font-size:13px;break-inside:avoid}.stats b{font-size:19px;display:block}.print-controls{padding:10px;background:#e5f2f0;text-align:center}@media print{body{padding:0}.print-controls{display:none}img.map{max-height:4.5in}}'+
  '</style></head><body><div class="print-controls"><button onclick="window.print()">Print / Save as PDF</button> &nbsp; Close this tab when finished</div>'+
  '<header><img src="'+LOGO_DATA+'" alt="Universal Rentals logo"><div><h1>'+esc(project.name||'Site plan')+'</h1><strong>UNIVERSAL RENTALS & EVENTS</strong><p>'+title+' · '+esc(fmtDate())+'</p></div></header>'+
  '<div class="stats"><div><b>'+tents.length+'</b>visible tents</div><div><b>'+Math.round(totalArea).toLocaleString()+'</b>square feet of tent footprint</div></div>'+
  '<h2>Site overview</h2>'+(map?'<img class="map" src="'+map+'" alt="Site map with tents and logistics"/><p class="muted">Map imagery © Mapbox and contributors. For planning reference only.</p>':'<div class="notice">Map snapshot unavailable. Open and fully load the satellite map, then generate this report again.</div>')+
  '<section class="report-block"><h2>Tent schedule</h2><table><thead><tr><th>Tent</th><th>Footprint</th><th>Area</th><th>Interior</th></tr></thead><tbody>'+rows+'</tbody></table></section>'+
  '<section class="report-block"><h2>Interior equipment breakdown</h2>'+itemRows+'</section>'+ 
  (kind==='crew'?'<section class="report-block"><h2>Access, staging and site logistics</h2><ul>'+(logisticsRows||'<li>No logistics notes recorded.</li>')+'</ul><h2>Pre-setup verification</h2><p>'+Object.entries(checklist).filter(([,v])=>v).length+' site checklist items marked complete.</p></section>':'<p class="notice">Illustrative site layout only; final field measurements and approvals are required.</p>')+
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
      <p className="hint">Includes the uploaded site photo and its markers, arrows and outlined areas when present.</p>
      {message&&<p role="status" className="hint">{message}</p>}
    </div>
  </details>;
}

import React,{useState} from 'react';
import './reports.css';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const size=v=>Number.isFinite(Number(v))?Number(v).toFixed(1):'—';
const fmtDate=()=>new Date().toLocaleString();
const nameOf=t=>t.name||'Tent';
const LOGO_DATA='data:image/png;base64,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';
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
  '@page{size:letter;margin:.55in}*{box-sizing:border-box}html,body{width:100%;max-width:100%;overflow-wrap:break-word}body{font:12px Arial,sans-serif;color:#1b2a32;margin:0;padding:0 12px}header{border-bottom:4px solid #147d76;padding-bottom:12px;margin-bottom:16px;display:flex;align-items:center;gap:16px;break-inside:avoid}header img{width:64px;height:64px;object-fit:contain;flex:none;filter:grayscale(1) brightness(0)}h1{font-size:22px;margin:0 0 5px}h2{font-size:16px;color:#145e60;margin:18px 0 8px;break-after:avoid}h3{font-size:13px;margin:12px 0 4px;break-after:avoid}p{line-height:1.45}small,.muted{color:#667985}table{width:100%;border-collapse:collapse;margin:9px 0 14px;table-layout:fixed}td,th{padding:7px;border-bottom:1px solid #d5e0e3;text-align:left;overflow-wrap:anywhere}th{background:#eaf3f3}tr{break-inside:avoid}img.map{display:block;width:100%;max-width:100%;height:auto;max-height:4.9in;object-fit:contain;border:1px solid #c9d5d8}img.photo{width:100%;height:100%;object-fit:contain;display:block}.photo-stage{position:relative;width:100%;max-height:7.5in;overflow:hidden}.photo-stage svg{position:absolute;inset:0;width:100%;height:100%}section.page{break-before:page}section.report-block{break-inside:auto}ul{padding-left:20px;line-height:1.55}.notice{border-left:4px solid #147d76;background:#eaf3f3;padding:10px;margin:14px 0}.stats{display:flex;gap:24px;font-size:13px;break-inside:avoid}.stats b{font-size:19px;display:block}.print-controls{padding:10px;background:#e5f2f0;text-align:center}@media print{body{padding:0}.print-controls{display:none}img.map{max-height:4.5in}}'+
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

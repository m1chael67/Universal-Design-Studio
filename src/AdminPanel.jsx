import React,{useState} from 'react';
import {Client,Functions,ExecutionMethod} from 'appwrite';
import './admin.css';

const FUNCTION_ID=import.meta.env.VITE_DESIGN_ADMIN_FUNCTION_ID||'6aeb52cf002f8a6dd6a9';
const client=new Client().setEndpoint('https://nyc.cloud.appwrite.io/v1').setProject('6aea8c410001e8aed9b1');
const functions=new Functions(client);

export default function AdminPanel({user}){
  const [opened,setOpened]=useState(false);
  const [loading,setLoading]=useState(false);
  const [response,setResponse]=useState(null);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState('');
  if(user?.email?.toLowerCase()!=='michael@universalrentalstl.com')return null;

  async function refresh(){
    if(!FUNCTION_ID){setError('Admin Function not connected. Open the Appwrite Console links below or complete the one-time server Function setup.');return;}
    setLoading(true);setError('');
    try{
      const execution=await functions.createExecution({
        functionId:FUNCTION_ID,body:'{}',async:false,method:ExecutionMethod.GET
      });
      let data;
      try{data=JSON.parse(execution.responseBody||'{}');}
      catch{throw Error('Admin Function returned non-JSON output. Open its execution logs and verify the deployment entrypoint is src/main.js.');}
      if(execution.responseStatusCode!==200||data.error){
        throw Error(data.error||'Admin Function failed with HTTP '+execution.responseStatusCode+'. Check its Appwrite execution logs.');
      }
      if(!Array.isArray(data.accounts)||!Array.isArray(data.projects)){
        const starter=data?.motto||data?.getInspired||data?.learn;
        if(starter)throw Error('The Admin Function is still running Appwrite starter code. Redeploy the Function from the GitHub repository with root functions/design-admin and entrypoint src/main.js.');
        throw Error('The Admin Function returned different data than expected. Redeploy the Function and check its execution logs. Fields returned: '+Object.keys(data||{}).join(', '));
      }
      setResponse(data);
    }catch(e){setError(String(e?.message||e));}
    finally{setLoading(false);}
  }
  const accountMap=new Map((response?.accounts||[]).map(account=>[account.id,account]));
  const accounts=(response?.accounts||[]).filter(account=>
    [account.email,account.name,account.id].some(s=>String(s||'').toLowerCase().includes(filter.toLowerCase()))||
    (response.projects||[]).some(p=>p.ownerId===account.id&&p.name.toLowerCase().includes(filter.toLowerCase()))
  );
  const orphaned=(response?.projects||[]).filter(p=>!accountMap.has(p.ownerId));

  return <section className="uds-admin-panel">
    <button type="button" className="uds-admin-trigger" onClick={()=>{
      setOpened(v=>!v);if(!opened&&!response&&FUNCTION_ID)refresh();
    }} aria-expanded={opened}>
      <span>Design Studio Admin — Accounts & Projects</span><span>{opened?'−':'+'}</span>
    </button>
    {opened&&<div className="uds-admin-body">
      <p className="cloud-note">Read-only overview. Projects stay private to their owners. Server authorization uses your exact Appwrite account ID and verified account email, not the email shown in the browser alone.</p>
      <div className="uds-admin-quick-links">
        <a href="https://appwrite.io/projects/6aea8c410001e8aed9b1" target="_blank" rel="noreferrer">Open Appwrite Console</a>
        <a href="https://github.com/m1chael67/Universal-Design-Studio/blob/main/ADMIN_SETUP.md" target="_blank" rel="noreferrer">Admin setup</a>
      </div>
      <div className="uds-admin-actions">
        <button onClick={refresh} disabled={loading||!FUNCTION_ID}>{loading?'Loading…':'Refresh accounts & projects'}</button>
        {!FUNCTION_ID&&<p className="cloud-note">The admin dashboard requires a separate Appwrite Function. Your accounts and projects are already visible in the Appwrite Console: Auth → Users and Databases → Projects → Rows.</p>}
      </div>
      {error&&<p className="cloud-error">{error}</p>}
      {response&&<>
        <div className="uds-admin-stats"><span>{response.accounts.length} accounts</span><span>{response.projects.length} cloud projects</span></div>
        {response.truncated&&<p className="cloud-error">The server returned its bounded first 1,000 records. Use the Appwrite Console for the full list.</p>}
        <input className="uds-admin-search" value={filter} onChange={e=>setFilter(e.target.value)}
          placeholder="Search email, account ID, or project name" aria-label="Search accounts and projects"/>
        <div className="uds-admin-account-list">
          {accounts.map(account=>{
            const projects=response.projects.filter(p=>p.ownerId===account.id);
            return <details key={account.id} className="uds-admin-account" open={Boolean(filter)}>
              <summary><strong>{account.email||account.name||account.id}</strong><small>{projects.length} project{projects.length===1?'':'s'}</small></summary>
              <div className="uds-admin-account-detail">
                <small>Created {new Date(account.createdAt).toLocaleDateString()} · ID {account.id}</small>
                {projects.map(p=><div key={p.id} className="uds-admin-project">
                  <strong>{p.name}</strong><small>{p.tents} tents · {p.interiorObjects} interior objects · Updated {new Date(p.updatedAt).toLocaleString()}</small>
                </div>)}
                {!projects.length&&<p className="cloud-note">No saved cloud projects.</p>}
              </div>
            </details>;
          })}
          {!!orphaned.length&&<details className="uds-admin-account"><summary>Projects with missing owner account ({orphaned.length})</summary>
            {orphaned.map(p=><div className="uds-admin-project" key={p.id}>{p.name} — owner {p.ownerId}</div>)}
          </details>}
        </div>
      </>}
    </div>}
  </section>;
}

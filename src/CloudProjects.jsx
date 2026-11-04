import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Account,Client,ID,Permission,Query,Role,TablesDB} from 'appwrite';
import './cloud.css';

// Public Appwrite project details only. Never put an API key into a browser app.
// CLOUD SETUP (console-only): database "design_studio", table "projects",
// columns name (varchar 256), ownerId (varchar 64), payload (mediumtext).
// Table permissions: CREATE to authenticated users only. Row Security ON.
const APPWRITE_ENDPOINT='https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT='6aea8c410001e8aed9b1';
const DATABASE_ID='6aeb3dfa001293738040';
const TABLE_ID='6aeb3e0500094b2a9ae4';
const client=new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT);
const account=new Account(client),tables=new TablesDB(client);

const storageKey=userId=>'uds-cloud-active:'+userId;
const safeName=s=>String(s||'Untitled site plan').trim().slice(0,255)||'Untitled site plan';
const initialProject=()=>({name:'New site plan',center:[-90.1994,38.627],zoom:17,tents:[]});
function parseRow(row){
  const input=JSON.parse(row.payload);
  if(!input||!Array.isArray(input.tents))throw Error('This cloud file is not a valid site plan.');
  return input;
}
function messageFor(error){
  const msg=String(error?.message||error||'Unknown error');
  if(error?.code===404||/database_not_found|table_not_found|collection_not_found/i.test(msg))
    return 'Cloud database/table not configured yet. Follow the one-time Appwrite setup below.';
  if(error?.code===401)return 'Not authorized. Check that row-level permissions are enabled and you are signed in.';
  if(error?.code===403)return 'Permission denied. Check the table CREATE role and private row permissions.';
  if(error?.code===400)return 'Appwrite rejected this save. Confirm the columns name, ownerId and payload are present and have the required types.';
  return msg.length>220?msg.slice(0,220)+'…':msg;
}
function rowPermissions(userId){
  const u=Role.user(userId);
  return [Permission.read(u),Permission.update(u),Permission.delete(u)];
}

export default function CloudProjects({project,measurement,onLoadProject}){
  const [user,setUser]=useState(null);
  const [loading,setLoading]=useState(true);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [signUp,setSignUp]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [tableMissing,setTableMissing]=useState(false);
  const [rows,setRows]=useState([]);
  const [activeId,setActiveId]=useState(null);
  const [saveState,setSaveState]=useState('local');
  const latestPayload=useRef(null),savedHash=useRef(''),remoteRef=useRef(null);
  const pending=useRef(null),activeIdRef=useRef(null),userRef=useRef(null);
  latestPayload.current={...project,measurement:{points:measurement.points,closed:measurement.closed},format:'uds-v0.2'};
  const active=rows.find(x=>x.$id===activeId);
  const linked=Boolean(user&&activeId);
  const hasLocalWork=Boolean(project.tents?.length)||Boolean(measurement.points.length)||
    Boolean(project.name&&project.name!=='New site plan');

  function activate(row,payload,load){
    const hash=JSON.stringify(payload);
    savedHash.current=hash;remoteRef.current=row;
    activeIdRef.current=row.$id;setActiveId(row.$id);
    localStorage.setItem(storageKey(userRef.current.$id),row.$id);
    setSaveState('saved');
    if(load)onLoadProject(payload);
  }
  const refresh=useCallback(async(currentUser)=>{
    const response=await tables.listRows({
      databaseId:DATABASE_ID,tableId:TABLE_ID,
      queries:[Query.limit(100),Query.orderDesc('$updatedAt')]
    });
    const filtered=response.rows.filter(x=>x.ownerId===currentUser.$id);
    setRows(filtered);setTableMissing(false);setError('');
    return filtered;
  },[]);
  async function initialize(currentUser){
    userRef.current=currentUser;setUser(currentUser);setLoading(false);setTableMissing(false);
    try{
      const results=await refresh(currentUser);
      const savedId=localStorage.getItem(storageKey(currentUser.$id));
      const doc=results.find(r=>r.$id===savedId);
      if(doc){
        const browserHash=JSON.stringify(latestPayload.current);
        // After a refresh, resume cloud autosaving if the browser has the
        // exact project version that Appwrite last saved.
        if(browserHash===doc.payload){
          activate(doc,latestPayload.current,false);
        }else if(!hasLocalWork){
          activate(doc,parseRow(doc),true);
        }else{
          setError('Your browser plan differs from the cloud version. Nothing was overwritten. Open the cloud version or save this browser plan as a new cloud project.');
        }
      }else if(results.length===1&&!hasLocalWork){
        activate(results[0],parseRow(results[0]),true);
      }
    }catch(err){
      setError(messageFor(err));
      setTableMissing(err.code===404||/not configured/i.test(messageFor(err)));
    }
  }
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      try{
        const found=await account.get();
        if(!cancelled)await initialize(found);
      }catch{
        if(!cancelled)setLoading(false);
      }
    })();
    return ()=>{cancelled=true;};
  },[]);
  async function authenticate(e){
    e.preventDefault();if(busy||!email.trim()||!password)return;
    setBusy(true);setError('');setSaveState('local');
    try{
      if(signUp)await account.create({userId:ID.unique(),email:email.trim(),password});
      await account.createEmailPasswordSession({email:email.trim(),password});
      setPassword('');
      await initialize(await account.get());
    }catch(err){setError(messageFor(err));}
    finally{setBusy(false);}
  }
  async function signOut(){
    setBusy(true);
    try{
      if(activeIdRef.current&&saveState==='pending')await saveNow();
      await account.deleteSession({sessionId:'current'});
      userRef.current=null;setUser(null);
      activeIdRef.current=null;setActiveId(null);setRows([]);
      remoteRef.current=null;savedHash.current='';setSaveState('local');setError('');
    }catch(err){setError(messageFor(err));}
    finally{setBusy(false);}
  }
  async function saveNow(){
    if(!userRef.current||!activeIdRef.current)return false;
    if(pending.current){
      try{await pending.current;}catch{}
      return saveNow();
    }
    const id=activeIdRef.current,local=latestPayload.current,hash=JSON.stringify(local);
    if(hash===savedHash.current){setSaveState('saved');return true;}
    setSaveState('pending');
    const save=(async()=>{
      // Compare server revision, preventing two computers from silently overwriting.
      const before=await tables.getRow({databaseId:DATABASE_ID,tableId:TABLE_ID,rowId:id});
      if(remoteRef.current?.$updatedAt&&before.$updatedAt!==remoteRef.current.$updatedAt)
        throw Object.assign(new Error('This project was edited on another computer. Cloud save paused to protect the other version. Use “Save as new cloud project” to keep your changes.'),{conflict:true});
      const updated=await tables.updateRow({
        databaseId:DATABASE_ID,tableId:TABLE_ID,rowId:id,
        data:{name:safeName(local.name),payload:hash}
      });
      remoteRef.current=updated;savedHash.current=hash;
      setRows(prev=>prev.map(r=>r.$id===id?updated:r));
      setError('');setSaveState('saved');
      return true;
    })();
    pending.current=save;
    try{return await save;}
    catch(err){setError(messageFor(err));setSaveState(err.conflict?'conflict':'error');return false;}
    finally{pending.current=null;}
  }
  useEffect(()=>{
    if(!linked||saveState==='conflict')return;
    const hash=JSON.stringify(latestPayload.current);
    if(hash===savedHash.current)return;
    setSaveState('pending');
    const timer=setTimeout(()=>saveNow(),1600);
    return ()=>clearTimeout(timer);
  },[project,measurement.points,measurement.closed,activeId,user?.$id]);
  async function createCloudCopy(payload=latestPayload.current){
    if(!user)return false;
    if(pending.current){try{await pending.current;}catch{}}
    setBusy(true);setError('');
    try{
      const value=JSON.stringify(payload);
      const newRow=await tables.createRow({
        databaseId:DATABASE_ID,tableId:TABLE_ID,rowId:ID.unique(),
        data:{name:safeName(payload.name),ownerId:user.$id,payload:value},
        permissions:rowPermissions(user.$id)
      });
      setRows(previous=>[newRow,...previous]);
      activate(newRow,payload,payload!==latestPayload.current);
      setTableMissing(false);return true;
    }catch(err){
      setError(messageFor(err));setTableMissing(err.code===404);return false;
    }finally{setBusy(false);}
  }
  async function openCloud(row){
    if(row.$id===activeIdRef.current)return;
    if(pending.current){try{await pending.current;}catch{}}
    if(activeIdRef.current&&savedHash.current!==JSON.stringify(latestPayload.current)){
      const okay=await saveNow();
      if(!okay){setError('The current plan could not be saved. Resolve the save error or use Save as new cloud project before switching.');return;}
    }else if(!activeIdRef.current&&hasLocalWork&&!window.confirm('Opening this cloud project will replace the plan currently on this screen. The original browser copy remains available as a JSON export, so export it first if you need it. Continue?'))return;
    try{
      const fresh=await tables.getRow({databaseId:DATABASE_ID,tableId:TABLE_ID,rowId:row.$id});
      activate(fresh,parseRow(fresh),true);setError('');
    }catch(err){setError(messageFor(err));}
  }
  async function removeCloud(row){
    if(!window.confirm('Permanently delete “'+row.name+'” from the cloud? Export a JSON backup first if you need it.'))return;
    if(pending.current){try{await pending.current;}catch{}}
    if(activeIdRef.current===row.$id){
      setActiveId(null);activeIdRef.current=null;remoteRef.current=null;savedHash.current='';
      localStorage.removeItem(storageKey(user.$id));setSaveState('local');
    }
    try{
      await tables.deleteRow({databaseId:DATABASE_ID,tableId:TABLE_ID,rowId:row.$id});
      setRows(existing=>existing.filter(x=>x.$id!==row.$id));
      setError('');
    }catch(err){setError(messageFor(err));}
  }
  const backup=()=>{
    const blob=new Blob([JSON.stringify(latestPayload.current,null,2)],{type:'application/json'});
    const u=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=u;a.download='universal-design-studio-backup.json';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),1000);
  };
  return <section className="uds-cloud">
    <h3>Cloud projects</h3>
    {loading?<p className="cloud-note">Checking cloud session…</p>:!user?
      <div className="cloud-login">
        <p className="cloud-note">Sign in to keep designs available on every computer. Your current browser plan stays untouched.</p>
        <form onSubmit={authenticate}>
          <input aria-label="Cloud account email" type="email" autoComplete="email" required placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
          <input aria-label="Cloud account password" type="password" autoComplete={signUp?'new-password':'current-password'} required minLength={8} placeholder="Password (8+ characters)" value={password} onChange={e=>setPassword(e.target.value)}/>
          <button disabled={busy} className="primary" type="submit">{busy?'Working…':signUp?'Create cloud account':'Sign in'}</button>
        </form>
        <button onClick={()=>{setSignUp(v=>!v);setError('');}}>{signUp?'Already have an account? Sign in':'New here? Create cloud account'}</button>
        <p className="cloud-note">This is a separate Design Studio sign-in, not your crew-app PIN.</p>
      </div>:<div>
        <div className="cloud-account"><span title={user.email}>{user.email}</span><button disabled={busy} onClick={signOut}>Sign out</button></div>
        <div className="cloud-sync">
          <span className={'cloud-dot cloud-'+saveState}/>
          {saveState==='saved'?'Cloud saved':saveState==='pending'?'Saving changes…':saveState==='conflict'?'Cloud conflict — save as copy':saveState==='error'?'Cloud save failed':'Current plan is local only'}
        </div>
        <div className="cloud-actions">
          <button className="primary" disabled={busy||tableMissing} onClick={()=>createCloudCopy()}>
            Save current plan as new cloud project
          </button>
          {linked&&<button disabled={busy||saveState==='conflict'} onClick={saveNow}>Save now</button>}
          <button disabled={busy||tableMissing} onClick={()=>createCloudCopy({...initialProject(),name:'New site plan'})}>New blank cloud project</button>
          <button onClick={backup}>Backup JSON</button>
          <button disabled={busy} onClick={async()=>{try{await refresh(user);}catch(err){setError(messageFor(err));}}}>Refresh cloud list</button>
        </div>
        <div className="cloud-list">
          {rows.map(row=><div className={'cloud-row '+(activeId===row.$id?'current':'')} key={row.$id}>
            <button onClick={()=>openCloud(row)} title="Open project">
              <strong>{row.name}</strong><small>{new Date(row.$updatedAt).toLocaleString()}{activeId===row.$id?' · Open':''}</small>
            </button>
            <button className="cloud-delete" onClick={()=>removeCloud(row)} aria-label={'Delete '+row.name} title="Delete cloud project">×</button>
          </div>)}
          {!rows.length&&!tableMissing&&<p className="cloud-note">No cloud projects yet. Save your current browser plan to create the first one.</p>}
        </div>
      </div>}
    {error&&<div className="cloud-error" role="alert">{error}</div>}
    {tableMissing&&<div className="cloud-setup">
      <strong>One-time cloud setup needed</strong>
      <p>In Appwrite's separate Universal Design Studio project, create database <code>design_studio</code>, table <code>projects</code> with row security ON.</p>
      <p>Add required columns <code>name</code> (varchar, 256), <code>ownerId</code> (varchar, 64), and <code>payload</code> (mediumtext). Give the table CREATE permission to authenticated users only; don't grant table READ, UPDATE, or DELETE.</p>
      <a href="https://appwrite.io/projects/6aea8c410001e8aed9b1" target="_blank" rel="noreferrer">Open Appwrite console</a>
      <p className="cloud-note">Then press Refresh cloud list. All cloud rows are private to their account.</p>
    </div>}
  </section>;
}

import {Client,Account,Users,TablesDB,Query} from 'node-appwrite';

// Deploy as a separate Appwrite Node.js Function.
// It MUST be invoked through Appwrite's authenticated Functions SDK.
// Configure secret DESIGN_ADMIN_API_KEY with users.read + rows.read scopes,
// and DESIGN_ADMIN_USER_ID with the exact UID of michael@universalrentalstl.com.
// API key must NEVER be added to the Site or a VITE_* setting.
const ENDPOINT='https://nyc.cloud.appwrite.io/v1';
const PROJECT_ID='6aea8c410001e8aed9b1';
const DATABASE_ID='6aeb3dfa001293738040';
const TABLE_ID='6aeb3e0500094b2a9ae4';
const MAX_PAGES=10;
function response(res,status,body){return res.json(body,status);}
function escapeMeta(s){return String(s||'').slice(0,255);}
function validId(v){return /^[a-zA-Z0-9._-]{1,36}$/.test(String(v||''));}

export default async ({req,res,error})=>{
  const caller=req.headers['x-appwrite-user-id'];
  const jwt=req.headers['x-appwrite-user-jwt'];
  const allowed=process.env.DESIGN_ADMIN_USER_ID;
  const secret=process.env.DESIGN_ADMIN_API_KEY;
  if(!allowed||!validId(allowed)||!secret)return response(res,503,{error:'Admin function not configured'});
  if(!caller||caller!==allowed||!jwt)return response(res,403,{error:'Admin access denied'});
  try{
    // Verify the invoking session against Appwrite itself. A caller-supplied
    // x-appwrite-user-id header alone is NEVER sufficient for admin access.
    const sessionClient=new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setJWT(jwt);
    const verified=await new Account(sessionClient).get();
    if(verified.$id!==allowed||verified.email?.toLowerCase()!=='michael@universalrentalstl.com')
      return response(res,403,{error:'Admin account mismatch'});
    const client=new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(secret);
    const users=new Users(client),tables=new TablesDB(client);

    const allUsers=[],allRows=[];
    let usersTruncated=false,projectsTruncated=false;
    let cursor;
    for(let page=0;page<MAX_PAGES;page++){
      const queries=[Query.limit(100)];
      if(cursor)queries.push(Query.cursorAfter(cursor));
      const batch=await users.list({queries});
      allUsers.push(...batch.users);
      if(batch.users.length<100)break;
      cursor=batch.users[batch.users.length-1].$id;
      if(page===MAX_PAGES-1)usersTruncated=true;
    }
    cursor=undefined;
    for(let page=0;page<MAX_PAGES;page++){
      const queries=[Query.limit(100)];
      if(cursor)queries.push(Query.cursorAfter(cursor));
      const batch=await tables.listRows({databaseId:DATABASE_ID,tableId:TABLE_ID,queries});
      allRows.push(...batch.rows);
      if(batch.rows.length<100)break;
      cursor=batch.rows[batch.rows.length-1].$id;
      if(page===MAX_PAGES-1)projectsTruncated=true;
    }

    const accounts=allUsers.map(u=>({
      id:u.$id,email:escapeMeta(u.email),name:escapeMeta(u.name),
      createdAt:u.$createdAt,verified:Boolean(u.emailVerification),status:Boolean(u.status)
    }));
    const projects=allRows.map(row=>{
      let tents=0,interiorObjects=0;
      try{
        const p=JSON.parse(row.payload||'{}');
        tents=Array.isArray(p.tents)?p.tents.length:0;
        interiorObjects=(p.tents||[]).reduce((n,t)=>n+(Array.isArray(t.interior?.objects)?t.interior.objects.length:0),0);
      }catch{/* Corrupt payload should not break the entire admin list. */}
      return {id:row.$id,ownerId:escapeMeta(row.ownerId),
        name:escapeMeta(row.name),updatedAt:row.$updatedAt,
        tents,interiorObjects};
    });
    return response(res,200,{accounts,projects,truncated:usersTruncated||projectsTruncated});
  }catch(e){
    error(e);
    return response(res,500,{error:'Admin list unavailable. Check server function credentials and scopes.'});
  }
};

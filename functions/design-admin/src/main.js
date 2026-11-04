import {Client,Account,Users,TablesDB,Query} from 'node-appwrite';

const ENDPOINT=process.env.APPWRITE_FUNCTION_API_ENDPOINT||'https://nyc.cloud.appwrite.io/v1';
const PROJECT_ID=process.env.APPWRITE_FUNCTION_PROJECT_ID||'6aea8c410001e8aed9b1';
const DATABASE_ID='6aeb3dfa001293738040';
const TABLE_ID='6aeb3e0500094b2a9ae4';
const ADMIN_EMAIL='michael@universalrentalstl.com';
const PAGE_LIMIT=100;
const MAX_PAGES=10;
const answer=(res,status,data)=>res.json(data,status);

export default async ({req,res,error})=>{
  const authorizedId=process.env.DESIGN_ADMIN_USER_ID;
  const serverKey=process.env.DESIGN_ADMIN_API_KEY;
  if(!authorizedId||!serverKey)return answer(res,503,{error:'Admin Function is missing DESIGN_ADMIN_USER_ID or DESIGN_ADMIN_API_KEY.'});
  const jwt=req.headers['x-appwrite-user-jwt'];
  if(!jwt)return answer(res,401,{error:'Admin requires a signed-in Appwrite account.'});
  try{
    // Verify the actual user's session with Appwrite, not any values from request body.
    const userClient=new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setJWT(jwt);
    const caller=await new Account(userClient).get();
    if(caller.$id!==authorizedId||caller.email?.toLowerCase()!==ADMIN_EMAIL){
      return answer(res,403,{error:'This account is not authorized to view Design Studio administration.'});
    }

    // The server-only API key is used ONLY after the session has been verified.
    const adminClient=new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(serverKey);
    const usersService=new Users(adminClient);
    const db=new TablesDB(adminClient);

    // Read-only project inspection. Never return raw cloud plans in the
    // account-list response; fetch one only after verifying the admin JWT.
    const input=(()=>{
      try{return typeof req.bodyJson==='object'&&req.bodyJson?req.bodyJson:JSON.parse(req.bodyText||req.body||'{}');}
      catch{return {};}
    })();
    if(input.action==='viewProject'){
      const id=String(input.projectId||'');
      if(!/^[a-zA-Z0-9._-]{1,36}$/.test(id))return answer(res,400,{error:'Invalid project ID'});
      const row=await db.getRow({databaseId:DATABASE_ID,tableId:TABLE_ID,rowId:id});
      let plan;
      try{plan=JSON.parse(row.payload);}
      catch{return answer(res,422,{error:'This project has invalid saved data'});}
      if(!plan||!Array.isArray(plan.tents))return answer(res,422,{error:'The selected project is not a valid site plan'});
      // Return the content only to the authenticated admin who requested it.
      return answer(res,200,{project:{id:row.$id,ownerId:row.ownerId,
        name:row.name,updatedAt:row.$updatedAt,plan}});
    }
    if(input.action&&input.action!=='list')return answer(res,400,{error:'Unsupported admin action'});
    const accounts=[];
    let cursor,usersTruncated=false;
    for(let page=0;page<MAX_PAGES;page++){
      const queries=[Query.limit(PAGE_LIMIT)];
      if(cursor)queries.push(Query.cursorAfter(cursor));
      const batch=await usersService.list({queries});
      accounts.push(...batch.users.map(u=>({
        id:u.$id,email:String(u.email||'').slice(0,256),name:String(u.name||'').slice(0,256),
        createdAt:u.$createdAt,verified:Boolean(u.emailVerification),status:Boolean(u.status)
      })));
      if(batch.users.length<PAGE_LIMIT)break;
      cursor=batch.users[batch.users.length-1].$id;
      if(page===MAX_PAGES-1)usersTruncated=true;
    }

    const projects=[];
    cursor=undefined;
    let projectsTruncated=false;
    for(let page=0;page<MAX_PAGES;page++){
      const queries=[Query.limit(PAGE_LIMIT)];
      if(cursor)queries.push(Query.cursorAfter(cursor));
      const batch=await db.listRows({databaseId:DATABASE_ID,tableId:TABLE_ID,queries});
      for(const row of batch.rows){
        let tents=0,interiorObjects=0;
        try{
          const plan=JSON.parse(row.payload||'{}');
          const list=Array.isArray(plan.tents)?plan.tents:[];
          tents=list.length;
          interiorObjects=list.reduce((sum,t)=>sum+(Array.isArray(t.interior?.objects)?t.interior.objects.length:0),0);
        }catch{}
        projects.push({id:row.$id,ownerId:String(row.ownerId||''),name:String(row.name||'Untitled').slice(0,256),
          updatedAt:row.$updatedAt,tents,interiorObjects});
      }
      if(batch.rows.length<PAGE_LIMIT)break;
      cursor=batch.rows[batch.rows.length-1].$id;
      if(page===MAX_PAGES-1)projectsTruncated=true;
    }
    return answer(res,200,{accounts,projects,truncated:usersTruncated||projectsTruncated});
  }catch(err){
    error('Admin error: '+(err?.message||String(err)));
    const message=(err?.code===401||err?.code===403)?
      'Admin API key lacks required users.read / rows.read permissions, or the login session is invalid.':
      'Admin Function could not load accounts and projects. Check its execution logs, credentials and database access.';
    return answer(res,500,{error:message,code:err?.code||null});
  }
};

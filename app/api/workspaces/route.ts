import {env} from 'cloudflare:workers';
import {createAuthContext,type AuthConfig} from '../../../lib/supabase-auth';
import {listWorkspaces,resolveWorkspace,assertAccess,accessPredicate,readPersonal,normalizedEmail} from '../../../lib/organizations';
import {removeHistoryMember} from '../../../lib/history-actors';
import {notifyWorkspace} from '../../../lib/live-updates';
import {readMutation,RequestError} from '../../../lib/request-security';
import {limitAccount} from '../../../lib/rate-limit';
export const dynamic='force-dynamic';

async function handle(request:Request,write:boolean){
 const auth=createAuthContext(request,env as AuthConfig);
 const response=(data:unknown,status=200)=>auth.finish(Response.json(data,{status,headers:{'Cache-Control':'private, no-store',...(status===429?{'Retry-After':'60'}:{})}}));
 try{
  const account=await auth.account();if(!account)throw new RequestError('Sign In To Manage Workspaces.',401);
  if(!env.DB)throw Error('Database unavailable');const db=env.DB;await limitAccount(db,account.storeKey,write);
  if(write){
   const body=await readMutation(request);if(body.accountId!==account.storeKey)throw new RequestError('Your Signed-In Account Changed.',403);
   await listWorkspaces(db,account); // Claim only invitations for this verified identity.
   if(body.action.type==='create-workspace'){
    const name=body.action.name;if(typeof name!=='string'||!name.trim()||name.trim().length>100)throw new RequestError('Enter A Workspace Name.');
    const id=crypto.randomUUID(),at=new Date().toISOString();
    const results=await db.batch([
     db.prepare('INSERT INTO organizations (id,owner_id,owner_email,created_at) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM organizations WHERE owner_id=?)<20').bind(id,account.storeKey,normalizedEmail(account.email),at,account.storeKey),
     db.prepare('INSERT INTO attendance_stores (user_id,data,revision,updated_at) SELECT ?,?,0,? WHERE EXISTS(SELECT 1 FROM organizations WHERE id=? AND owner_id=?)').bind(id,JSON.stringify({rosters:[],events:[],organization:{name:name.trim()}}),at,id,account.storeKey),
    ]);
    if(!results[0].meta.changes)throw new RequestError('Use At Most 20 Owned Workspaces.',409);
    return response({workspaces:await listWorkspaces(db,account),workspaceId:id});
   }
   if(!body.workspaceId)throw new RequestError('Choose A Workspace.');
   const workspace=await resolveWorkspace(db,account,body.workspaceId);if(!workspace)throw new RequestError('Workspace Not Found.',404);await assertAccess(db,workspace,account);
   if(body.action.type==='leave-workspace'){
    if(workspace.admin)throw new RequestError('Transfer Ownership Or Delete This Workspace Before Leaving.',409);
    const removed=await removeHistoryMember(db,workspace.id,workspace.memberId!,accessPredicate(workspace,account));if(!removed)throw new RequestError('Workspace Access Changed.',403);
   }else{
    if(!workspace.admin)throw new RequestError('Only The Owner Can Manage This Workspace.',403);
    if(body.action.type==='delete-workspace'){
     if(body.action.confirmation!=='DELETE')throw new RequestError('Type DELETE To Confirm Permanent Deletion.');
     await readPersonal(db,account); // Preserve private settings migrated from a legacy store.
     const guard='EXISTS(SELECT 1 FROM organizations WHERE id=? AND owner_id=?)';
     const results=await db.batch([
      ...['organization_history_actors','organization_members'].map(table=>db.prepare(`DELETE FROM ${table} WHERE organization_id=? AND ${guard}`).bind(workspace.id,workspace.id,account.storeKey)),
      db.prepare(`DELETE FROM attendance_stores WHERE user_id=? AND ${guard}`).bind(workspace.id,workspace.id,account.storeKey),
      db.prepare('DELETE FROM organizations WHERE id=? AND owner_id=?').bind(workspace.id,account.storeKey),
     ]);
     if(!results[3].meta.changes)throw new RequestError('Workspace Ownership Changed.',403);
    }else if(body.action.type==='transfer-workspace'){
     await readPersonal(db,account); // Migrate any private legacy settings before ownership changes.
     const memberId=body.action.memberId;if(typeof memberId!=='string'||memberId.length>100)throw new RequestError('Choose A Joined Member.');
     const target=await db.prepare('SELECT account_id,email FROM organization_members WHERE id=? AND organization_id=? AND account_id IS NOT NULL AND account_id<>?').bind(memberId,workspace.id,account.storeKey).first<{account_id:string;email:string}>();
     if(!target)throw new RequestError('Choose A Joined Member.',400);
     const guard='EXISTS(SELECT 1 FROM organizations WHERE id=? AND owner_id=?) AND EXISTS(SELECT 1 FROM organization_members WHERE id=? AND organization_id=? AND account_id=?)';
     const guardArgs=[workspace.id,account.storeKey,memberId,workspace.id,target.account_id];
     const results=await db.batch([
      // The old owner stays a member; no data or history moves between stores.
      db.prepare(`INSERT INTO organization_members (id,organization_id,email,account_id,invited_by,created_at) SELECT ?,?,?,?,?,? WHERE ${guard} ON CONFLICT(organization_id,account_id) DO NOTHING`).bind(crypto.randomUUID(),workspace.id,normalizedEmail(account.email),account.storeKey,account.storeKey,new Date().toISOString(),...guardArgs),
      db.prepare(`UPDATE organizations SET owner_id=?,owner_email=? WHERE id=? AND ${guard}`).bind(target.account_id,target.email,workspace.id,...guardArgs),
      db.prepare('DELETE FROM organization_members WHERE id=? AND organization_id=? AND changes()>0 AND EXISTS(SELECT 1 FROM organizations WHERE id=? AND owner_id=?)').bind(memberId,workspace.id,workspace.id,target.account_id),
      db.prepare('UPDATE attendance_stores SET revision=revision+1 WHERE user_id=? AND changes()>0 AND EXISTS(SELECT 1 FROM organizations WHERE id=? AND owner_id=?)').bind(workspace.id,workspace.id,target.account_id),
     ]);
     if(!results[1].meta.changes)throw new RequestError('Workspace Ownership Or Membership Changed.',409);
    }else throw new RequestError('Unknown Workspace Action.');
   }
   notifyWorkspace(db,workspace.id);
  }
  return response({workspaces:await listWorkspaces(db,account)});
 }catch(error){return response({error:error instanceof RequestError?error.message:'Could Not Update Workspaces. Try Again.'},error instanceof RequestError?error.status:503);}
}
export const GET=(request:Request)=>handle(request,false);
export const POST=(request:Request)=>handle(request,true);

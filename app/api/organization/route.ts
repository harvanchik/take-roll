import {removeHistoryMember} from '../../../lib/history-actors';
import {notifyWorkspace} from '../../../lib/live-updates';
import {env} from 'cloudflare:workers';
import {createAuthContext,type AuthConfig} from '../../../lib/supabase-auth';
import {resolveWorkspace,requestedWorkspace,assertAccess,accessPredicate,memberEmail,normalizedEmail} from '../../../lib/organizations';
import {readMutation,RequestError} from '../../../lib/request-security';
import {limitAccount} from '../../../lib/rate-limit';
export const dynamic='force-dynamic';
async function handle(request:Request,write:boolean){
 const auth=createAuthContext(request,env as AuthConfig);
 const response=(data:unknown,status=200)=>auth.finish(Response.json(data,{status,headers:status===429?{'Retry-After':'60'}:{}}));
 try{
  const account=await auth.account();if(!account)throw new RequestError('Sign In To Manage Members.',401);
  if(!env.DB)throw Error('Database unavailable');await limitAccount(env.DB,account.storeKey,write);
  const body=write?await readMutation(request):null;
  const workspace=await resolveWorkspace(env.DB,account,write?body.workspaceId:requestedWorkspace(request));if(!workspace)throw new RequestError('Choose A Workspace.',403);await assertAccess(env.DB,workspace,account);
  if(!workspace.admin)throw new RequestError('Only An Admin Can Manage Members.',403);
  if(write){
   if(body.accountId!==account.storeKey||(body.workspaceId&&body.workspaceId!==workspace.id))throw new RequestError('Organization Access Changed. Reload To Continue.',403);
   if(body.action.type==='invite-member'){
    const email=memberEmail(body.action.email);if(email===normalizedEmail(account.email))throw new RequestError('You Are Already The Organization Admin.');
    const store=await env.DB.prepare('SELECT 1 AS present FROM attendance_stores WHERE user_id=?').bind(workspace.id).first();if(!store)throw new RequestError('Open Your Workspace Before Adding Members.',409);
    const existing=await env.DB.prepare('SELECT 1 AS present FROM organization_members WHERE organization_id=? AND email=?').bind(workspace.id,email).first();if(existing)throw new RequestError('This Email Is Already Added To This Workspace.',409);
    const result=await env.DB.prepare('INSERT INTO organization_members (id,organization_id,email,account_id,invited_by,created_at) SELECT ?,?,?,NULL,?,? WHERE (SELECT COUNT(*) FROM organization_members WHERE organization_id=?)<100 AND EXISTS(SELECT 1 FROM organizations WHERE id=? AND owner_id=?) ON CONFLICT(organization_id,email) DO NOTHING').bind(crypto.randomUUID(),workspace.id,email,account.storeKey,new Date().toISOString(),workspace.id,workspace.id,account.storeKey).run();if(!result.meta.changes)throw new RequestError('Use At Most 100 Members.',409);
   }else if(body.action.type==='remove-member'){
    if(typeof body.action.memberId!=='string'||body.action.memberId.length>100)throw new RequestError('Choose A Member.');
    const removed=await removeHistoryMember(env.DB,workspace.id,body.action.memberId,accessPredicate(workspace,account));if(!removed)throw new RequestError('Member Not Found.',404);
   }else throw new RequestError('Unknown Member Action.');
  }
  if(write)notifyWorkspace(env.DB,workspace.id);
  const members=await env.DB.prepare('SELECT id,email,account_id FROM organization_members WHERE organization_id=? ORDER BY created_at,id').bind(workspace.id).all<{id:string;email:string;account_id:string|null}>();
  await assertAccess(env.DB,workspace,account);
  return response({members:members.results.map(m=>({id:m.id,email:m.email,joined:!!m.account_id})),role:'admin'});
 }catch(error){return response({error:error instanceof RequestError?error.message:'Could Not Update Members. Try Again.'},error instanceof RequestError?error.status:503);}
}
export const GET=(request:Request)=>handle(request,false);
export const POST=(request:Request)=>handle(request,true);

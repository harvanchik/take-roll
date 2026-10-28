import {primeLiveSnapshot} from '../../../lib/live-snapshot';
import {compactSaveReply} from '../../../lib/save-packet';
import {sealSubeventUndo,openSubeventUndo} from '../../../lib/subevent-undo';
import {presentHistoryActors,rememberHistoryActor} from '../../../lib/history-actors';
import {notifyWorkspace} from '../../../lib/live-updates';
import {editFingerprint} from '../../../lib/edit-conflicts';
import {env} from 'cloudflare:workers';
import {ValidationError} from '../../../lib/validation-error';
import {limitAccount} from '../../../lib/rate-limit';
import {readMutation,RequestError,sameOriginMutation} from '../../../lib/request-security';
import {readCurrentStore} from '../../../lib/archive-retention';
import {purgeExpiredArchives,profileName} from '../../../lib/workspace-settings';
import {applyAction,normalizeAttendanceData} from '../../../lib/model';
import {withSlugs} from '../../../lib/navigation';
import {createAuthContext,type AuthConfig} from '../../../lib/supabase-auth';
import {resolveWorkspace,listWorkspaces,requestedWorkspace,assertAccess,accessPredicate,readPersonal,presentWorkspace,sharedData,savePersonal} from '../../../lib/organizations';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const auth=createAuthContext(request,env as AuthConfig);
 let historyWorkspace='';
 const response=async(data:unknown,status=200)=>{if(historyWorkspace&&data&&typeof data==='object'&&'data' in data&&data.data)data={...data,data:await presentHistoryActors(env.DB!,historyWorkspace,data.data as import('../../../lib/model').Data)};return auth.finish(Response.json(data,{status,headers:status===429?{'Retry-After':'60'}:{}}));};
 try{
 const account=await auth.account();if(!account)return response({error:'Sign In To Open Your Attendance Records.'},401);
 if(!env.DB)throw Error('Database unavailable');
 const user=account.storeKey;await limitAccount(env.DB,user,false);
 const workspaces=await listWorkspaces(env.DB,account);
 await env.DB.prepare('INSERT INTO attendance_stores (user_id,data,revision,updated_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM organizations WHERE id=? AND owner_id=?) ON CONFLICT(user_id) DO NOTHING').bind(user,JSON.stringify({rosters:[],events:[]}),0,new Date().toISOString(),user,user).run();
 const workspace=await resolveWorkspace(env.DB,account,requestedWorkspace(request)),personal=await readPersonal(env.DB,account);
 const accountInfo={id:user,email:account.email,...(account.name?{name:account.name}:{}),isOwner:account.isOwner,provider:account.provider,workspaces};
 if(!workspace)return response({data:presentWorkspace({rosters:[],events:[]},personal),revision:0,account:{...accountInfo,organizationRole:'member'}});
 historyWorkspace=workspace.id;
 await rememberHistoryActor(env.DB,workspace.id,account,profileName(personal.profile,account.name||account.email.toLowerCase()));
 const row=await readCurrentStore(env.DB,workspace.id,accessPredicate(workspace,account));if(!row)throw Error('Workspace missing');
 await assertAccess(env.DB,workspace,account);
 return response({data:presentWorkspace(withSlugs(normalizeAttendanceData(JSON.parse(row.data))),personal),revision:row.revision,account:{...accountInfo,workspaceId:workspace.id,organizationRole:workspace.admin?'admin':'member'}});
 }catch(error){return response({error:error instanceof RequestError?error.message:'Could Not Load Attendance Records. Try Again.'},error instanceof RequestError?error.status:500);}
}
export async function POST(request:Request){
 const auth=createAuthContext(request,env as AuthConfig);
 let historyWorkspace='';let committed=false;let compactBase:{data:import('../../../lib/model').Data;revision:number}|undefined;
 const response=async(data:unknown,status=200)=>{
  if(historyWorkspace&&data&&typeof data==='object'&&'data' in data&&data.data)data={...data,data:await presentHistoryActors(env.DB!,historyWorkspace,data.data as import('../../../lib/model').Data)};
  if(status===200&&committed&&historyWorkspace&&data&&typeof data==='object'&&'data' in data&&data.data){const saved=data as {data:import('../../../lib/model').Data;revision:number};primeLiveSnapshot(env.DB!,historyWorkspace,saved.data,saved.revision);notifyWorkspace(env.DB!,historyWorkspace);}
  if(status===200&&compactBase)data=compactSaveReply(data as import('../../../lib/save-packet').SavePacket,compactBase.data,compactBase.revision);
  return auth.finish(Response.json(data,{status,headers:status===429?{'Retry-After':'60'}:{}}));
 };

 let account;try{account=await auth.account();}catch{return response({error:'Could Not Verify Your Sign-In. Try Again.'},503);}
 if(!account)return response({error:'Sign In To Save Attendance.'},401);
 try{sameOriginMutation(request);}catch{return response({error:'Invalid Origin.'},403);}
 if(!env.DB)return response({error:'Database Is Unavailable.'},503);
 try{
 await limitAccount(env.DB,account.storeKey,true);const body=await readMutation(request);
 if(body.accountId!==account.storeKey)return response({error:'Your Signed-In Account Changed. Reload Before Saving.'},403);
 const workspace=await resolveWorkspace(env.DB,account,body.workspaceId);
 if(!workspace){
  if(!['update-profile','update-preferences'].includes(body.action.type))throw new RequestError('Choose A Workspace Before Saving.',403);
  const personal=await readPersonal(env.DB,account),current=presentWorkspace({rosters:[],events:[]},personal);
  if(typeof body.action.expected==='string'&&body.action.expected!==editFingerprint(current,body.action))return response({error:'These Settings Changed On Another Device.',code:'edit_conflict',data:current,revision:0},409);
  const changed=applyAction(current,body.action,new Date().toISOString(),{id:account.storeKey,name:account.name,email:account.email});
  const field=body.action.type==='update-profile'?'profile':'preferences';
  if(!await savePersonal(env.DB,account,field,changed[field],personal))return response({error:'These Settings Changed On Another Device.',code:'edit_conflict',data:presentWorkspace(current,await readPersonal(env.DB,account)),revision:0},409);
  return response({data:presentWorkspace(current,await readPersonal(env.DB,account)),revision:0,savedAt:new Date().toISOString()});
 }
 historyWorkspace=workspace.id;
 if((body.workspaceId&&body.workspaceId!==workspace.id)||(!body.workspaceId&&!workspace.admin))return response({error:'Organization Access Changed. Reload To Continue.',code:'workspace_changed'},403);
 if(['update-organization','update-event-settings','link-roster-person','link-matching-people','link-person-identity','unlink-roster-person'].includes(body.action.type)&&!workspace.admin)throw new RequestError('Only An Admin Can Change Organization Settings Or Link People.',403);
 let subeventRecovery:Awaited<ReturnType<typeof openSubeventUndo>>|undefined;
 if(body.action.type==='restore-subevent'||body.action.type==='delete-subevent'){
  const recovery=await openSubeventUndo(env.DB,workspace.id,account.storeKey,body.action.undoToken);
  if(recovery.restoreId!==body.action.restoreId||(body.action.type==='restore-subevent'?(recovery.event.id!==body.action.subeventId||(recovery.event.parentEventId||recovery.event.id)!==body.action.eventId):recovery.event.id!==body.action.eventId))throw new RequestError('Invalid Subevent Undo.',409);
  subeventRecovery=recovery;if(body.action.type==='restore-subevent')body.action.snapshot=recovery.event;
 }
 const access=accessPredicate(workspace,account);
 const [personal,firstRow]=await Promise.all([readPersonal(env.DB,account),readCurrentStore(env.DB,workspace.id,access)]);
 // Guarded edits can rebase on unrelated changes without another HTTP round trip.
 // The database revision CAS still protects every commit against racing writes.
 for(let attempt=0;attempt<6;attempt++){
 const row=attempt===0?firstRow:await readCurrentStore(env.DB,workspace.id,access);
 if(!row){await assertAccess(env.DB,workspace,account);return response({error:'Reload This Page Before Saving.'},409);}
 const current=presentWorkspace(withSlugs(normalizeAttendanceData(JSON.parse(row.data))),personal);
 compactBase=body.compact===true&&body.revision===row.revision&&body.personalRevision===(personal.personalRevision??0)?{data:current,revision:row.revision}:undefined;
 if(body.mutationId&&current.appliedMutationIds?.includes(body.mutationId))return response({data:current,revision:row.revision,savedAt:new Date().toISOString()});
 if(typeof body.action.expected==='string'&&body.action.expected!==editFingerprint(current,body.action))return response({error:'Someone Else Changed This Field. Your Edit Is Kept Below.',code:'edit_conflict',data:current,revision:row.revision},409);
 if(body.revision!==row.revision&&typeof body.action.expected!=='string')return response({error:'Records Changed In Another Tab. Please Try Again.',data:current,revision:row.revision},409);
 if(body.action.type==='delete-subevent'&&subeventRecovery){
  const prepared={...current,events:current.events.map(e=>e.id===subeventRecovery!.event.id?subeventRecovery!.event:e)};
  if(editFingerprint(prepared,body.action)!==editFingerprint(current,body.action))return response({error:'This Subevent Changed. Review It Before Deleting.',code:'edit_conflict',data:current,revision:row.revision},409);
 }
 if(body.action.type==='prepare-delete-subevent'){
  const target=current.events.find(e=>e.id===body.action.eventId);
  if(!target||target.subeventDeleted)throw new RequestError('Subevent No Longer Exists.',409);
  applyAction(current,{...body.action,type:'delete-subevent'});
  const undoToken=await sealSubeventUndo(env.DB,workspace.id,account.storeKey,target,body.action.restoreId);
  return response({data:current,revision:row.revision,undoToken});
 }
 const at=new Date().toISOString(),clicked=typeof body.occurredAt==='string'?Date.parse(body.occurredAt):NaN;
 const eventTime=Number.isFinite(clicked)&&clicked<=Date.now()+60000&&clicked>=Date.now()-7*86400000?new Date(clicked).toISOString():at;
 const changed=applyAction(current,body.action,eventTime,{id:account.storeKey,name:profileName(personal.profile,account.name),email:account.email});
 if(body.action.type==='update-profile'||body.action.type==='update-preferences'){
  const field=body.action.type==='update-profile'?'profile':'preferences';const saved=await savePersonal(env.DB,account,field,changed[field],personal);if(!saved)return response({error:'These Settings Changed On Another Device. Review Your Draft Before Saving.',code:'edit_conflict',data:presentWorkspace(current,await readPersonal(env.DB,account)),revision:row.revision},409);
  const nextPersonal=await readPersonal(env.DB,account);if(field==='profile'){for(const item of await listWorkspaces(env.DB,account)){await rememberHistoryActor(env.DB,item.id,account,profileName(nextPersonal.profile,account.name||account.email.toLowerCase()),true);notifyWorkspace(env.DB,item.id);}}
  const latest=await readCurrentStore(env.DB,workspace.id,accessPredicate(workspace,account));await assertAccess(env.DB,workspace,account);
  notifyWorkspace(env.DB,workspace.id);
  return response({data:presentWorkspace(latest?withSlugs(normalizeAttendanceData(JSON.parse(latest.data))):current,nextPersonal),revision:latest?.revision??row.revision,savedAt:at});
 }
 const data=purgeExpiredArchives(sharedData(withSlugs(changed)));
 if(body.mutationId)data.appliedMutationIds=[...(current.appliedMutationIds||[]),body.mutationId].slice(-2000);
 const encoded=JSON.stringify(data);if(encoded.length>15000000)return response({error:'Your Records Are Full. Export History Before Adding Events.'},400);
 const result=await env.DB.prepare('UPDATE attendance_stores SET data=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=? AND '+access.sql).bind(encoded,at,workspace.id,row.revision,...access.args).run();
 if(!result.meta.changes){await assertAccess(env.DB,workspace,account);if(typeof body.action.expected==='string'&&attempt<5)continue;const latest=await env.DB.prepare('SELECT data,revision FROM attendance_stores WHERE user_id=?').bind(workspace.id).first<{data:string;revision:number}>();return response({error:'Records Changed In Another Tab.',...(latest?{data:presentWorkspace(withSlugs(normalizeAttendanceData(JSON.parse(latest.data))),personal),revision:latest.revision}:{})},409);}
 committed=true;
 return response({data:presentWorkspace(data,personal),revision:row.revision+1,savedAt:at});
 }
 return response({error:'Records Are Busy. Please Try Again.'},409);
 }catch(error){return response({error:error instanceof RequestError||error instanceof ValidationError?error.message:'Unable To Save. Try Again.'},error instanceof RequestError?error.status:400);}
}

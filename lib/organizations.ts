import type {AttendanceAccount} from './owner-access';
import type {Data} from './model';
import {RequestError} from './request-security';
export type Workspace={id:string;admin:boolean;memberId?:string};
type Personal=Pick<Data,'profile'|'preferences'|'personalRevision'>;
export const normalizedEmail=(email:string)=>email.trim().toLowerCase();
export function memberEmail(value:unknown){if(typeof value!=='string'||value.length>254||!/^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value.trim()))throw new RequestError('Enter A Valid Email Address.');return normalizedEmail(value);}
export type WorkspaceChoice={id:string;name:string;role:'admin'|'member'};
/** Create the original private workspace once; invitations never replace or merge it. */
async function initializeAccount(db:D1Database,account:AttendanceAccount){
 if(await db.prepare('SELECT 1 AS present FROM workspace_accounts WHERE account_id=?').bind(account.storeKey).first())return;
 const email=normalizedEmail(account.email),at=new Date().toISOString();
 await db.batch([
  db.prepare(`INSERT INTO organizations (id,owner_id,owner_email,created_at)
   SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM workspace_accounts WHERE account_id=?)
   AND NOT EXISTS(SELECT 1 FROM organizations WHERE owner_id=?) ON CONFLICT(id) DO NOTHING`).bind(account.storeKey,account.storeKey,email,at,account.storeKey,account.storeKey),
  db.prepare('INSERT INTO workspace_accounts (account_id,created_at) VALUES (?,?) ON CONFLICT(account_id) DO NOTHING').bind(account.storeKey,at),
 ]);
}
export async function listWorkspaces(db:D1Database,account:AttendanceAccount):Promise<WorkspaceChoice[]>{
 await initializeAccount(db,account);
 const email=normalizedEmail(account.email);
 await db.batch([db.prepare('UPDATE organizations SET owner_email=? WHERE owner_id=? AND owner_email<>?').bind(email,account.storeKey,email),db.prepare('UPDATE organization_members SET account_id=? WHERE account_id IS NULL AND email=? AND NOT EXISTS(SELECT 1 FROM organization_members existing WHERE existing.organization_id=organization_members.organization_id AND existing.account_id=?)').bind(account.storeKey,email,account.storeKey)]);
 const rows=await db.prepare(`SELECT o.id,COALESCE(NULLIF(json_extract(s.data,'$.organization.name'),''),'Your Organization') AS name,
 CASE WHEN o.owner_id=? THEN 'admin' ELSE 'member' END AS role
 FROM organizations o LEFT JOIN attendance_stores s ON s.user_id=o.id
 WHERE o.owner_id=? OR EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=o.id AND m.account_id=?)
 ORDER BY o.created_at,o.id`).bind(account.storeKey,account.storeKey,account.storeKey).all<WorkspaceChoice>();
 return rows.results;
}
export function requestedWorkspace(request:Request){return new URL(request.url).searchParams.get('workspace')||undefined;}
export async function resolveWorkspace(db:D1Database,account:AttendanceAccount,requested?:string):Promise<Workspace|null>{
 if(!requested)await initializeAccount(db,account);
 if(requested&&requested.length>600)throw new RequestError('Invalid Workspace.');
 const read=()=>db.prepare(`SELECT o.id,o.owner_id,m.id AS member_id FROM organizations o
 LEFT JOIN organization_members m ON m.organization_id=o.id AND m.account_id=?
 WHERE (o.owner_id=? OR m.id IS NOT NULL) ${requested?'AND o.id=?':''}
 ORDER BY CASE WHEN m.id IS NOT NULL THEN 0 ELSE 1 END,o.created_at,o.id LIMIT 1`)
 .bind(account.storeKey,account.storeKey,...(requested?[requested]:[])).first<{id:string;owner_id:string;member_id:string|null}>();
 let row=await read();
 // Existing selected workspaces need no account-initialization lookup on every edit.
 if(!row&&requested){await initializeAccount(db,account);row=await read();}
 if(!row){if(requested)throw new RequestError('Workspace Access Changed. Choose Another Workspace.',403);return null;}
 return {id:row.id,admin:row.owner_id===account.storeKey,...(row.member_id?{memberId:row.member_id}:{})};
}
export function accessPredicate(workspace:Workspace,account:AttendanceAccount){return workspace.admin?{sql:'EXISTS (SELECT 1 FROM organizations WHERE id=? AND owner_id=?)',args:[workspace.id,account.storeKey]}:{sql:'EXISTS (SELECT 1 FROM organization_members WHERE id=? AND organization_id=? AND account_id=?)',args:[workspace.memberId!,workspace.id,account.storeKey]};}
export async function assertAccess(db:D1Database,workspace:Workspace,account:AttendanceAccount){const access=accessPredicate(workspace,account);const result=await db.prepare('SELECT 1 AS allowed WHERE '+access.sql).bind(...access.args).first();if(!result)throw new RequestError('Organization Access Changed. Reload To Continue.',403);}
export async function readPersonal(db:D1Database,account:AttendanceAccount):Promise<Personal>{
 let row=await db.prepare('SELECT data FROM account_settings WHERE account_id=?').bind(account.storeKey).first<{data:string}>();
 if(!row){const own=await db.prepare('SELECT data FROM attendance_stores WHERE user_id=?').bind(account.storeKey).first<{data:string}>();const data=own?JSON.parse(own.data):{};const personal={...(data.profile?{profile:data.profile}:{}),...(data.preferences?{preferences:data.preferences}:{})};await db.prepare('INSERT INTO account_settings (account_id,data) VALUES (?,?) ON CONFLICT(account_id) DO NOTHING').bind(account.storeKey,JSON.stringify(personal)).run();row=await db.prepare('SELECT data FROM account_settings WHERE account_id=?').bind(account.storeKey).first<{data:string}>();}
 return JSON.parse(row!.data);
}
export function sharedData(data:Data):Data{const {profile:_,preferences:__,personalRevision:___,...shared}=data;return shared;}
export function presentWorkspace(data:Data,personal:Personal):Data{return {...sharedData(data),...personal};}
export async function savePersonal(db:D1Database,account:AttendanceAccount,field:'profile'|'preferences',value:unknown,before?:Personal){const result=await db.prepare('UPDATE account_settings SET data=json_set(data,?,json(?),\'$.personalRevision\',COALESCE(json_extract(data,\'$.personalRevision\'),0)+1) WHERE account_id=?'+(before?' AND json_extract(data,?) IS json_extract(?,?)':'')).bind('$.'+field,JSON.stringify(value),account.storeKey,...(before?['$.'+field,JSON.stringify(before),'$.'+field]:[])).run();return !!result.meta.changes;}

import type {Data,Change} from './model';
import type {AttendanceAccount} from './owner-access';
import {profileName} from './workspace-settings';

// Keep the audit identity stable. Display names are resolved separately from it.
function historyFallbacks(data:Data){
 const names=new Map<string,{name:string;at:string}>();
 const visit=(h:Change)=>{if(!h.actor?.id)return;const name=h.actor.name?.trim()||h.actor.email;if(name&&(!names.has(h.actor.id)||h.at>=names.get(h.actor.id)!.at))names.set(h.actor.id,{name,at:h.at});};
 for(const e of data.events){e.history.forEach(visit);e.participants.forEach(p=>p.history.forEach(visit));}
 return names;
}
export async function rememberHistoryActor(db:D1Database,organizationId:string,account:AttendanceAccount,name:string,notify=false){
 const existing=await db.prepare('SELECT 1 AS present FROM organization_history_actors WHERE organization_id=? AND account_id=?').bind(organizationId,account.storeKey).first();
 const upsert=db.prepare(`INSERT INTO organization_history_actors (organization_id,account_id,display_name)
 SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM organizations WHERE id=? AND owner_id=?)
 OR EXISTS(SELECT 1 FROM organization_members WHERE organization_id=? AND account_id=?)
 ON CONFLICT(organization_id,account_id) DO UPDATE SET display_name=excluded.display_name
 WHERE display_name<>excluded.display_name`)
 .bind(organizationId,account.storeKey,name||account.email,organizationId,account.storeKey,organizationId,account.storeKey);
 await db.batch([upsert,db.prepare('UPDATE attendance_stores SET revision=revision+1 WHERE user_id=? AND changes()>0 AND ?').bind(organizationId,notify||!!existing?1:0)]);
}
export async function presentHistoryActors(db:D1Database,organizationId:string,data:Data):Promise<Data>{
 const rows=await db.prepare(`WITH identities AS (
 SELECT account_id FROM organization_history_actors WHERE organization_id=?
 UNION SELECT account_id FROM organization_members WHERE organization_id=? AND account_id IS NOT NULL
 UNION SELECT owner_id FROM organizations WHERE id=?)
 SELECT i.account_id AS id,h.display_name AS name,a.data AS personal,
 (EXISTS(SELECT 1 FROM organizations WHERE id=? AND owner_id=i.account_id)
 OR EXISTS(SELECT 1 FROM organization_members WHERE organization_id=? AND account_id=i.account_id)) AS active
 FROM identities i LEFT JOIN organization_history_actors h ON h.organization_id=? AND h.account_id=i.account_id
 LEFT JOIN account_settings a ON a.account_id=i.account_id`)
 .bind(organizationId,organizationId,organizationId,organizationId,organizationId,organizationId).all<{id:string;name:string|null;personal:string|null;active:number}>();
 const names=historyFallbacks(data);
 for(const row of rows.results){const fallback=row.name||names.get(row.id)?.name||'';const name=row.active?profileName(row.personal?JSON.parse(row.personal).profile:undefined,fallback):fallback;if(name)names.set(row.id,{name,at:''});}
 const resolve=(h:Change):Change=>{const name=h.actor?.id?names.get(h.actor.id)?.name:undefined;return name&&h.actor?{...h,actor:{...h.actor,name}}:h;};
 return {...data,events:data.events.map(e=>({...e,history:e.history.map(resolve),participants:e.participants.map(p=>({...p,history:p.history.map(resolve)}))}))};
}
/** Snapshot and revoke in one transaction: later profile changes cannot alter this organization's history. */
export async function removeHistoryMember(db:D1Database,organizationId:string,memberId:string,access?:{sql:string;args:string[]}){
 const guard=access?' AND '+access.sql:'';const args=access?.args||[];
 const store=await db.prepare('SELECT data FROM attendance_stores WHERE user_id=?').bind(organizationId).first<{data:string}>();
 const member=await db.prepare('SELECT account_id,email FROM organization_members WHERE id=? AND organization_id=?').bind(memberId,organizationId).first<{account_id:string|null;email:string}>();
 if(!member)return false;
 const fallback=member.account_id&&store?historyFallbacks(JSON.parse(store.data)).get(member.account_id)?.name:undefined;
 const results=await db.batch([
  db.prepare(`INSERT INTO organization_history_actors (organization_id,account_id,display_name)
   SELECT m.organization_id,m.account_id,COALESCE(NULLIF(trim(
    COALESCE(NULLIF(json_extract(a.data,'$.profile.preferredName'),''),json_extract(a.data,'$.profile.firstName'),'')||' '||COALESCE(json_extract(a.data,'$.profile.lastName'),'')),''),h.display_name,?,m.email)
   FROM organization_members m LEFT JOIN account_settings a ON a.account_id=m.account_id
   LEFT JOIN organization_history_actors h ON h.organization_id=m.organization_id AND h.account_id=m.account_id
   WHERE m.id=? AND m.organization_id=? AND m.account_id IS NOT NULL${guard}
   ON CONFLICT(organization_id,account_id) DO UPDATE SET display_name=excluded.display_name`)
   .bind(fallback||null,memberId,organizationId,...args),
  db.prepare('DELETE FROM organization_members WHERE id=? AND organization_id=?'+guard).bind(memberId,organizationId,...args),
  db.prepare('UPDATE attendance_stores SET revision=revision+1 WHERE user_id=? AND changes()>0').bind(organizationId),
 ]);
 return !!results[1].meta.changes;
}

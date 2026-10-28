import type {AttendanceAccount} from './owner-access';
import {normalizeAttendanceData,type Data} from './model';
import {withSlugs} from './navigation';
import {sharedData,presentWorkspace} from './organizations';
import {presentHistoryActors} from './history-actors';
import {purgeExpiredArchives} from './workspace-settings';
import {readCurrentStore} from './archive-retention';
import {withPersonIds} from './person-identity';
type Shared={revision:number;data:Data;bytes:number};
const snapshots=new WeakMap<D1Database,Map<string,Shared>>();
function remember(db:D1Database,workspaceId:string,shared:Shared){
 let cache=snapshots.get(db);if(!cache){cache=new Map();snapshots.set(db,cache);}
 if((cache.get(workspaceId)?.revision??-1)>shared.revision)return;
 while(cache.size&&[...cache.values()].reduce((n,item)=>n+item.bytes,0)+shared.bytes>8_000_000)cache.delete(cache.keys().next().value!);
 if(shared.bytes<=4_000_000)cache.set(workspaceId,shared);
}
/** Warm only committed shared data; every receiver still proves its own access in SQL. */
export function primeLiveSnapshot(db:D1Database,workspaceId:string,data:Data,revision:number){
 const shared=sharedData(data);remember(db,workspaceId,{data:shared,revision,bytes:JSON.stringify(shared).length*4});
}
/** Every delivery proves current membership in SQL; shared content excludes private settings. */
export async function liveSnapshot(db:D1Database,account:AttendanceAccount,workspaceId:string){
 let cache=snapshots.get(db);if(!cache){cache=new Map();snapshots.set(db,cache);}
 const cached=cache.get(workspaceId);
 const row=await db.prepare(`SELECT s.revision,CASE WHEN s.revision=? THEN NULL ELSE s.data END AS data,
  (SELECT data FROM account_settings WHERE account_id=?) AS personal
  FROM attendance_stores s WHERE s.user_id=? AND
  (EXISTS(SELECT 1 FROM organizations WHERE id=s.user_id AND owner_id=?) OR
   EXISTS(SELECT 1 FROM organization_members WHERE organization_id=s.user_id AND account_id=?))`)
 .bind(cached?.revision??-1,account.storeKey,workspaceId,account.storeKey,account.storeKey)
 .first<{revision:number;data:string|null;personal:string|null}>();
 if(!row)return null;
 let parsed=row.data?JSON.parse(row.data):cached?.data;
 if(parsed&&(withPersonIds(parsed)!==parsed||purgeExpiredArchives(parsed)!==parsed)){
  const cleaned=await readCurrentStore(db,workspaceId,{sql:'(EXISTS(SELECT 1 FROM organizations WHERE id=? AND owner_id=?) OR EXISTS(SELECT 1 FROM organization_members WHERE organization_id=? AND account_id=?))',args:[workspaceId,account.storeKey,workspaceId,account.storeKey]});
  if(!cleaned)return null;row.data=cleaned.data;row.revision=cleaned.revision;parsed=JSON.parse(cleaned.data);
 }
 let shared=cached;
 if(!shared||shared.revision!==row.revision){
  if(!row.data)return null;
  shared={revision:row.revision,data:await presentHistoryActors(db,workspaceId,withSlugs(normalizeAttendanceData(parsed))),bytes:row.data.length*4};
  remember(db,workspaceId,shared);
 }
 const personal=row.personal?JSON.parse(row.personal):{};
 return {revision:row.revision,data:presentWorkspace(shared.data,personal),personal:row.personal,sourceBytes:shared.bytes/4+(row.personal?.length||0)};
}
export function releaseLiveSnapshot(db:D1Database,workspaceId:string){snapshots.get(db)?.delete(workspaceId);}

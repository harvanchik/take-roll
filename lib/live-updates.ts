import type {AttendanceAccount} from './owner-access';
import {liveSnapshot,releaseLiveSnapshot} from './live-snapshot';
import {livePatch} from './live-patch';
import type {Data} from './model';
type Version={accountId:string;workspaceId:string;revision:number;settingsVersion:string;organizationRole:'admin'|'member'};
type Room={expires:number;generation:number;loading:boolean;hotUntil:number;versions:Map<string,Version>;listeners:Set<()=>void>;accounts:Map<string,number>};
const rooms=new WeakMap<D1Database,Map<string,Room>>();
function roomFor(db:D1Database,id:string){let roomsForDB=rooms.get(db);if(!roomsForDB){roomsForDB=new Map();rooms.set(db,roomsForDB);}let room=roomsForDB.get(id);if(!room){
 // Only short-lived data is shared between requests, never promises or I/O.
 for(const [key,value] of roomsForDB)if(!value.listeners.size&&value.expires<Date.now())roomsForDB.delete(key);
 room={expires:0,generation:0,loading:false,hotUntil:0,versions:new Map(),listeners:new Set(),accounts:new Map()};roomsForDB.set(id,room);
 }return room;}
export function notifyWorkspace(db:D1Database,id:string){const room=rooms.get(db)?.get(id);if(!room)return;room.expires=0;room.hotUntil=Date.now()+5000;room.generation++;for(const wake of room.listeners)wake();}
async function personalVersion(personal:string|null){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(personal||''));return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
export async function workspaceVersion(db:D1Database,account:AttendanceAccount,requested?:string){
 // The requested workspace is a selector, never an access proof.
 const row=await db.prepare(`SELECT s.user_id AS workspaceId,s.revision,
 CASE WHEN o.owner_id=? THEN 'admin' ELSE 'member' END AS organizationRole,
 (SELECT data FROM account_settings WHERE account_id=?) AS personal
 FROM organizations o JOIN attendance_stores s ON s.user_id=o.id
 LEFT JOIN organization_members m ON m.organization_id=o.id AND m.account_id=?
 WHERE (o.owner_id=? OR m.id IS NOT NULL) ${requested?'AND o.id=?':''}
 ORDER BY CASE WHEN m.id IS NOT NULL THEN 0 ELSE 1 END,o.created_at,o.id LIMIT 1`)
 .bind(account.storeKey,account.storeKey,account.storeKey,account.storeKey,...(requested?[requested]:[]))
 .first<{workspaceId:string;revision:number;personal:string|null;organizationRole:'admin'|'member'}>();
 if(!row)return null;
 return {accountId:account.storeKey,workspaceId:row.workspaceId,revision:row.revision,settingsVersion:await personalVersion(row.personal),organizationRole:row.organizationRole};
}
/** One indexed room snapshot serves all members for 500ms, including access proofs. */
export async function roomVersion(db:D1Database,id:string,account:AttendanceAccount,requested?:string){
 const room=roomFor(db,id);
 // Do not share pending I/O between Worker requests. Other streams can use the
 // previous tiny notice for one tick while this request refreshes the room.
 if(room.loading)return room.versions.get(account.storeKey)??workspaceVersion(db,account,requested);
 if(room.expires<=Date.now()){
  room.loading=true;
  try{
  const generation=room.generation;
  const rows=await db.prepare(`WITH accounts AS (
   SELECT owner_id AS accountId FROM organizations WHERE id=?
   UNION SELECT account_id FROM organization_members WHERE organization_id=? AND account_id IS NOT NULL
  ) SELECT a.accountId,s.user_id AS workspaceId,s.revision,p.data AS personal,CASE WHEN EXISTS(SELECT 1 FROM organizations WHERE id=s.user_id AND owner_id=a.accountId) THEN 'admin' ELSE 'member' END AS organizationRole
  FROM accounts a JOIN attendance_stores s ON s.user_id=? LEFT JOIN account_settings p ON p.account_id=a.accountId
  WHERE a.accountId IN (SELECT value FROM json_each(?))`)
  .bind(id,id,id,JSON.stringify([...new Set([...room.accounts.keys(),account.storeKey])])).all<{accountId:string;workspaceId:string;revision:number;personal:string|null;organizationRole:'admin'|'member'}>();
  const versions=new Map<string,Version>();
  for(const row of rows.results)versions.set(row.accountId,{accountId:row.accountId,workspaceId:row.workspaceId,revision:row.revision,settingsVersion:await personalVersion(row.personal),organizationRole:row.organizationRole});
  if(room.generation===generation){if([...versions].some(([key,v])=>room.versions.has(key)&&room.versions.get(key)!.revision!==v.revision))room.hotUntil=Date.now()+5000;room.versions=versions;room.expires=Date.now()+(room.hotUntil>Date.now()?100:500);}
  }finally{room.loading=false;}
  if(!room.expires)return workspaceVersion(db,account,requested);
 }
 // Removed/reassigned members receive only their newly resolved workspace notice.
 return room.versions.get(account.storeKey)??workspaceVersion(db,account,requested);
}
export function workspaceStream(db:D1Database,account:AttendanceAccount,signal:AbortSignal,snapshotMode=false,authorize?:()=>Promise<boolean>,requested?:string){
 let id:string|undefined;
 let previous:Data|undefined,previousRevision:number|undefined;
 const packet=async(value:unknown)=>{
  const version=value as Version|null;if(!version)return {reload:true};if(!snapshotMode||version.workspaceId!==id)return value;
  const [allowed,snapshot]=await Promise.all([authorize?authorize():Promise.resolve(true),liveSnapshot(db,account,version.workspaceId)]);
  if(!allowed)return {reload:true};
  if(!snapshot){notifyWorkspace(db,version.workspaceId);return null;}
  const metadata={...version,revision:snapshot.revision,settingsVersion:await personalVersion(snapshot.personal)};
  const full={...metadata,data:snapshot.data};const size=snapshot.sourceBytes;
  const patch=previous?{...metadata,baseRevision:previousRevision,patch:livePatch(previous,snapshot.data)}:undefined;
  previous=size<=500_000?snapshot.data:undefined;previousRevision=snapshot.revision;
  return patch&&JSON.stringify(patch).length<size?patch:full;
 };
 return versionStream(async()=>{
  if(!id){const first=await workspaceVersion(db,account,requested);id=first?.workspaceId;return first;}
  return roomVersion(db,id,account,requested);
 },signal,snapshotMode?80:250,snapshotMode?250:80,wake=>{
  // The first authoritative read determines the room; registration happens afterwards.
  if(!id)return ()=>{};const room=roomFor(db,id);room.listeners.add(wake);room.accounts.set(account.storeKey,(room.accounts.get(account.storeKey)||0)+1);room.expires=0;room.generation++;
  return ()=>{room.listeners.delete(wake);const count=(room.accounts.get(account.storeKey)||1)-1;if(count)room.accounts.set(account.storeKey,count);else{room.accounts.delete(account.storeKey);room.versions.delete(account.storeKey);}if(!room.listeners.size){room.expires=0;room.versions.clear();releaseLiveSnapshot(db,id!);}};
 },packet);
}
/** Short streams bound DB queries and reverify the auth session at each reconnect. */
export function versionStream(read:()=>Promise<unknown>,signal:AbortSignal,interval=1000,ticks=20,listen?:(wake:()=>void)=>()=>void,project?:(value:unknown)=>Promise<unknown>){
 const encoder=new TextEncoder();let stopped=false,cancelled=false,timer:ReturnType<typeof setTimeout>|undefined,wake:(()=>void)|undefined;
 let pending=false,unlisten:(()=>void)|undefined,last='',heartbeat=0;
 const changed=()=>{pending=true;wake?.();};
 const stop=()=>{stopped=true;if(timer)clearTimeout(timer);wake?.();};
 const pause=async()=>{await new Promise<void>(resolve=>{wake=resolve;timer=setTimeout(resolve,interval);});clearTimeout(timer);wake=undefined;pending=false;};
 return new ReadableStream<Uint8Array>({
  async start(controller){
   signal.addEventListener('abort',stop,{once:true});if(signal.aborted)stop();
   try{controller.enqueue(encoder.encode('retry: 750\n\n'));
    for(let i=0;i<ticks&&!stopped;i++){
     // A slow reader receives the latest state when it catches up, rather than
     // accumulating a queue of stale snapshots in Worker memory.
     if(last&&(controller.desiredSize??1)<=0){await pause();continue;}
     const version=await read();if(stopped)break;
     const encoded=JSON.stringify(version||{reload:true});
     if(encoded!==last){const packet=project?await project(version):version||{reload:true};if(stopped)break;if(packet){controller.enqueue(encoder.encode('data: '+JSON.stringify(packet)+'\n\n'));last=encoded;heartbeat=Date.now();if(typeof packet==='object'&&'reload' in packet&&packet.reload)break;}}
     else if(Date.now()-heartbeat>=5000){controller.enqueue(encoder.encode('event: ping\ndata: {}\n\n'));heartbeat=Date.now();}
     if(!version)break;
     unlisten??=listen?.(changed);
     if(pending){pending=false;continue;}
     await pause();
    }
   }catch{if(!stopped)controller.enqueue(encoder.encode('event: reconnect\ndata: {}\n\n'));}
   finally{unlisten?.();signal.removeEventListener('abort',stop);if(!cancelled)controller.close();stop();}
  },cancel(){cancelled=true;stop();},
 });
}

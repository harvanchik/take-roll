import {applyAction,normalizeAttendanceData,type Data,type Event} from './model.ts';
import {withSlugs} from './navigation.ts';
import {purgeExpiredArchives,profileName} from './workspace-settings.ts';
import {editFingerprint} from './edit-conflicts.ts';
import type {SaveReply} from './attendance-queue.ts';

export const GUEST_STORE_KEY='take-roll.guest.v1';
type StorageAccess=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Stored={version:1;revision:number;data:Data};
type Mutation={revision:number;action:Record<string,any>;mutationId?:string;occurredAt?:string};
export function guestPath(path:string){const url=new URL(path,'https://guest.local');url.searchParams.delete('workspace');url.searchParams.set('guest','1');return url.pathname+url.search;}

/** The same action model and save queue as hosted workspaces, with no HTTP transport. */
export class GuestStore{
 private recovery=new Map<string,{restoreId:string;event:Event}>();
 constructor(private storage:StorageAccess){}
 read():Stored{
  const raw=this.storage.getItem(GUEST_STORE_KEY);
  if(!raw)return {version:1,revision:0,data:{rosters:[],events:[]}};
  try{
   const value=JSON.parse(raw) as Stored;
   if(value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.data?.rosters)||!Array.isArray(value.data?.events))throw Error();
   return {...value,data:withSlugs(purgeExpiredArchives(normalizeAttendanceData(value.data)))};
  }catch{throw Error('Could Not Read Your Browser Records. Your Stored Data Has Been Kept. Restore Browser Storage Or Use Another Browser.');}
 }
 open(){
  const current=this.read();
  // Fail visibly if storage is blocked or full, instead of claiming edits were saved.
  this.write(current);
  return current;
 }
 private write(value:Stored){try{this.storage.setItem(GUEST_STORE_KEY,JSON.stringify(value));}catch{throw Error('Browser Storage Is Full Or Unavailable. Free Space Or Allow Site Storage, Then Retry.');}}
 async send(body:Mutation):Promise<SaveReply>{
  const current=this.read(),action={...body.action};
  if(body.mutationId&&current.data.appliedMutationIds?.includes(body.mutationId))return {status:200,data:current.data,revision:current.revision};
  if(typeof action.expected==='string'&&action.expected!==editFingerprint(current.data,action))return {status:409,code:'edit_conflict',error:'This Field Changed In Another Browser Tab. Review Your Change.',data:current.data,revision:current.revision};
  if(body.revision!==current.revision&&typeof action.expected!=='string')return {status:409,data:current.data,revision:current.revision};
  if(action.type==='prepare-delete-subevent'){
   applyAction(current.data,{...action,type:'delete-subevent'});
   const event=current.data.events.find(e=>e.id===action.eventId)!;
   const token=crypto.randomUUID();this.recovery.set(token,{restoreId:action.restoreId,event:structuredClone(event)});
   return {status:200,data:current.data,revision:current.revision,undoToken:token};
  }
  if(action.type==='restore-subevent'){
   const saved=this.recovery.get(action.undoToken);
   if(!saved||saved.restoreId!==action.restoreId||saved.event.id!==action.subeventId)throw Error('This Subevent Can No Longer Be Restored.');
   action.snapshot=saved.event;
  }
  const at=body.occurredAt||new Date().toISOString();
  const data=withSlugs(purgeExpiredArchives(applyAction(current.data,action,at,{id:'browser-guest',name:profileName(current.data.profile,'You'),email:''})));
  if(body.mutationId)data.appliedMutationIds=[...(current.data.appliedMutationIds||[]),body.mutationId].slice(-2000);
  const next:Stored={version:1,revision:current.revision+1,data};
  this.write(next);
  return {status:200,data,revision:next.revision,savedAt:new Date().toISOString()};
 }
}

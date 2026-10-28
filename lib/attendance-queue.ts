import {usesRemovedChoice} from './attendance-actions';
import {removedEdit,restoreForEdit} from './removed-edit';
import {guardEdit} from './edit-conflicts';
import {profileName} from './workspace-settings';
import {applyAction,excuseFor,type Data,type ChangeActor} from './model';
export type Action=Record<string,any>;
export type PendingChange={id:string;action:Action;at:string};
export type SaveReply={data?:Data;revision?:number;savedAt?:string;undoToken?:string;error?:string;status:number;code?:string};
export type HistoryMove={eventId:string;forward:Action;backward:Action};
type Move=HistoryMove;
export type QueueSnapshot={data:Data;pending:number;pendingEventIds:string[];saving:boolean;error:string;conflict:boolean;savedAt:string;undoCounts:Record<string,number>;redoCounts:Record<string,number>};
export const BACKGROUND_ACTIONS=new Set(['roster-person-note','set-family-memberships','set-person-field','delete-subevent','restore-subevent','remove-family-person','set-family-membership','rename-roster','rename-subevent','person-flag','clear-person-history','report-settings','reorder-roster','reorder-event','excuse','attendance-state','status','mark-remaining','set-statuses','person-note','event-note','rename-event','remove-event-person','restore-event-person']);
export function attendanceMove(data:Data,action:Action):Move{
 const event=data.events.find(e=>e.id===action.eventId);if(!event)throw Error('Event no longer exists.');
 const person=()=>{const p=event.participants.find(p=>p.id===action.personId);if(!p)throw Error('Person not found.');return p;};
 if(['status','excuse','attendance-state'].includes(action.type))return {eventId:event.id,forward:action,backward:{type:'attendance-state',eventId:event.id,personId:person().id,status:person().status,excuse:excuseFor(person())}};
 if(action.type==='mark-remaining'||action.type==='set-statuses'){
  const changes=action.type==='mark-remaining'?event.participants.filter(p=>!p.removed&&!p.status).map(p=>({personId:p.id,status:action.status??'Absent'})):action.changes;
  const forward={type:'set-statuses',eventId:event.id,changes};
  const backward={type:'set-statuses',eventId:event.id,changes:changes.map((c:any)=>{const p=event.participants.find(p=>p.id===c.personId);if(!p)throw Error('Person not found.');return {personId:c.personId,status:p.status,excuse:excuseFor(p)};})};
  return {eventId:event.id,forward,backward};
 }
 if(action.type==='delete-subevent')return {eventId:event.parentEventId||event.id,forward:action,backward:{type:'restore-subevent',eventId:event.parentEventId||event.id,subeventId:event.id,restoreId:action.restoreId,snapshot:structuredClone(event),undoToken:action.undoToken}};
 if(action.type==='reorder-event')return {eventId:event.id,forward:action,backward:{...action,personIds:event.participants.map(p=>p.id)}};
 if(action.type==='set-family-memberships')return {eventId:event.id,forward:action,backward:{...action,changes:action.changes.map((c:any)=>{const p=data.events.find(e=>e.id===c.eventId)?.participants.find(p=>p.id===c.personId);if(!p)throw Error('Person not found.');return {...c,removed:p.removed};})}};
 if(action.type==='set-person-field')return {eventId:event.id,forward:action,backward:{...action,changes:action.changes.map((c:any)=>{const p=event.participants.find(p=>p.id===c.personId);if(!p)throw Error('Person not found.');return {personId:p.id,value:action.field==='flag'?p.flag??null:action.field==='note'?p.note:p.removed};})}};
 if(action.type==='person-flag')return {eventId:event.id,forward:action,backward:{...action,flag:person().flag??null}};
 if(action.type==='person-note')return {eventId:event.id,forward:action,backward:{...action,note:person().note}};
 if(action.type==='event-note')return {eventId:event.id,forward:action,backward:{...action,note:event.note}};
 if(action.type==='rename-event')return {eventId:event.id,forward:action,backward:{...action,name:event.name}};
 if(action.type==='remove-family-person'){const root=event.parentEventId||event.id;const changes=data.events.filter(e=>e.id===root||e.parentEventId===root).flatMap(e=>{const p=e.participants.find(p=>p.id===action.personId);return p?[{eventId:e.id,removed:!!p.removed}]:[];});return {eventId:event.id,forward:action,backward:{type:'set-family-membership',eventId:event.id,personId:action.personId,changes}};}
 if(action.type==='remove-event-person'||action.type==='restore-event-person')return {eventId:event.id,forward:action,backward:{...action,type:person().removed?'remove-event-person':'restore-event-person'}};
 throw Error('This change cannot be undone.');
}
export class AttendanceQueue{
 private base:Data;private revision:number;private pending:PendingChange[]=[];private working=false;private paused=false;private error='';private conflict=false;private savedAt='';private view:Data;
 private autoSaving=true;private approved=new Set<string>();
 private undoMoves:Move[]=[];private redoMoves:Move[]=[];private waiters:Array<(value:boolean)=>void>=[];
 constructor(data:Data,revision:number,private transport:(body:{revision:number;action:Action;mutationId:string;occurredAt:string})=>Promise<SaveReply>,private changed:(snapshot:QueueSnapshot)=>void,private persist:(pending:PendingChange[])=>void=()=>{},private actor?:ChangeActor){this.base=data;this.view=data;this.revision=revision;this.autoSaving=data.preferences?.autoSave!==false;if(this.actor)this.actor={...this.actor,name:profileName(data.profile,this.actor.name||this.actor.email)};}
 /** Workspace revisions and personal preferences advance independently. A late
  * stream/save reply must never re-enable Auto Save using older preferences. */
 private acceptBase(data:Data,revision:number){
  if(revision<this.revision){data=(data.personalRevision??0)>(this.base.personalRevision??0)?{...this.base,profile:data.profile,preferences:data.preferences,personalRevision:data.personalRevision}:this.base;revision=this.revision;}
  if((data.personalRevision??0)<(this.base.personalRevision??0))data={...data,profile:this.base.profile,preferences:this.base.preferences,personalRevision:this.base.personalRevision};
  this.base=data;this.revision=revision;this.autoSaving=data.preferences?.autoSave!==false;
  const valid=(m:Move)=>!usesRemovedChoice(data,m.forward)&&!usesRemovedChoice(data,m.backward);this.undoMoves=this.undoMoves.filter(valid);this.redoMoves=this.redoMoves.filter(valid);
 }
 get acknowledged(){return {data:this.base,revision:this.revision};}
 get autoSave(){return this.autoSaving;}
 get data(){return this.view;}
 get serverRevision(){return this.revision;}
 snapshot():QueueSnapshot{const counts=(moves:Move[])=>moves.reduce((out,m)=>{const ids=m.forward.type==='delete-subevent'?[m.eventId,...this.view.events.filter(e=>e.parentEventId===m.eventId).map(e=>e.id)]:[m.eventId];for(const id of ids)out[id]=(out[id]||0)+1;return out;},{} as Record<string,number>);return {data:this.view,pending:this.pending.length,pendingEventIds:[...new Set(this.pending.flatMap(p=>[p.action.eventId,...(['set-family-membership','set-family-memberships'].includes(p.action.type)?p.action.changes.map((c:any)=>c.eventId):[])].filter((id):id is string=>typeof id==='string')))],saving:this.working,error:this.error,conflict:this.conflict,savedAt:this.savedAt,undoCounts:counts(this.undoMoves),redoCounts:counts(this.redoMoves)};}
 private emit(){
  const memoryOnly=new Set(this.pending.filter(p=>p.action.type==='restore-subevent').map(p=>p.action.subeventId));
  this.persist(this.pending.filter(p=>p.action.type!=='restore-subevent'&&!memoryOnly.has(p.action.eventId)).map(p=>{const action={...p.action};delete action.snapshot;delete action.undoToken;return {...p,action};}));this.changed(this.snapshot());
 }
 private matches(move:Move,eventId:string){return move.eventId===eventId||move.forward.type==='delete-subevent'&&(this.view.events.find(e=>e.id===eventId)?.parentEventId||eventId)===move.eventId;}
 private rebuild(){if(this.actor)this.actor={...this.actor,name:profileName(this.base.profile,this.actor.name||this.actor.email)};let data=this.base;for(const change of this.pending){if(data.appliedMutationIds?.includes(change.id))continue;try{data=applyAction(data,change.action,change.at,this.actor);}catch{this.paused=true;if(removedEdit(this.base,change.action)){this.conflict=true;this.error="This Person Was Removed. Keep My Change Restores Them And Saves Your Edit.";}else if(this.base.events.some(e=>e.id===change.action.eventId&&e.archivedAt))this.error="This Event Was Archived. Restore It Before Retrying, Or Discard The Waiting Change.";else this.error=usesRemovedChoice(this.base,change.action)?"An Attendance Choice Was Permanently Removed. Discard The Waiting Change To Continue.":"This Event Or Person No Longer Exists. Discard The Waiting Change To Continue.";}}this.view=data;}
 private append(action:Action,move?:Move){action=guardEdit(this.view,action);const change={id:crypto.randomUUID(),action,at:new Date().toISOString()},data=applyAction(this.view,action,change.at,this.actor);if(move){const backward={...move.backward};delete backward.expected;delete backward.before;this.undoMoves.push({...move,forward:action,backward:guardEdit(data,backward)});this.redoMoves=this.redoMoves.filter(m=>m.eventId!==move.eventId&&!(m.forward.type==='delete-subevent'&&m.forward.eventId===move.eventId));}this.pending.push(change);this.view=data;this.emit();void this.pump();}
 enqueue(action:Action):Data{
  // A manual note draft can settle more than once before Save. Keep one final
  // note operation, its original conflict guard, and one undo step.
  const last=this.pending.at(-1),previousMove=this.undoMoves.at(-1);
  if(!this.autoSaving&&last&&!this.approved.has(last.id)&&!removedEdit(this.view,action)&&['person-note','event-note'].includes(action.type)&&last.action.type===action.type&&last.action.eventId===action.eventId&&last.action.personId===action.personId&&previousMove&&previousMove.forward.type===action.type&&previousMove.forward.eventId===action.eventId&&previousMove.forward.personId===action.personId){
   applyAction(this.view,action);
   if(action.note===previousMove.backward.note){this.pending.pop();this.undoMoves.pop();}else{last.action={...last.action,note:action.note};last.at=new Date().toISOString();previousMove.forward={...previousMove.forward,note:action.note};}
   this.redoMoves=this.redoMoves.filter(m=>m.eventId!==action.eventId);this.rebuild();if(action.note!==previousMove.backward.note){const backward={...previousMove.backward};delete backward.expected;delete backward.before;previousMove.backward=guardEdit(this.view,backward);}this.emit();return this.view;
  }
  if(removedEdit(this.view,action)){this.pending.push({id:crypto.randomUUID(),action:guardEdit(this.view,action),at:new Date().toISOString()});this.rebuild();this.emit();return this.view;}if(action.type==='roster-person-note'||action.type==='update-preferences'||action.type==='rename-roster'||action.type==='rename-subevent'||action.type==='clear-person-history'||action.type==='report-settings'||action.type==='reorder-roster'){this.append(action);return this.view;}const move=attendanceMove(this.view,action);this.append(move.forward,move);return this.view;}
 undo(eventId:string){const index=this.undoMoves.findLastIndex(m=>this.matches(m,eventId));if(index<0)return;const move=this.undoMoves[index];applyAction(this.view,{...move.backward,historyIntent:'undo'});this.undoMoves.splice(index,1);this.redoMoves.push(move);this.append({...move.backward,historyIntent:'undo'});return structuredClone(move);}
 redo(eventId:string){const index=this.redoMoves.findLastIndex(m=>this.matches(m,eventId));if(index<0)return;const move=this.redoMoves[index];applyAction(this.view,{...move.forward,historyIntent:'redo'});this.redoMoves.splice(index,1);this.undoMoves.push(move);this.append({...move.forward,historyIntent:'redo'});return structuredClone(move);}
 undoAcross(eventIds:string[]){const ids=new Set(eventIds),move=this.undoMoves.findLast(m=>[...ids].some(id=>this.matches(m,id)));return move?this.undo(move.eventId):undefined;}
 redoAcross(eventIds:string[]){const ids=new Set(eventIds),move=this.redoMoves.findLast(m=>[...ids].some(id=>this.matches(m,id)));return move?this.redo(move.eventId):undefined;}
 restore(pending:PendingChange[]){this.pending=pending.filter(p=>!this.base.appliedMutationIds?.includes(p.id));this.rebuild();this.emit();void this.pump();}
 setBase(data:Data,revision:number){if(revision<this.revision&&(data.personalRevision??0)<=(this.base.personalRevision??0))return;const wasAuto=this.autoSaving;this.acceptBase(data,revision);
  let confirmed=false;
  if(!this.working){const ids=new Set(this.base.appliedMutationIds),first=this.pending[0];confirmed=!!first&&ids.has(first.id);this.pending=this.pending.filter(p=>{if(!ids.has(p.id))return true;this.approved.delete(p.id);return false;});if(confirmed){this.paused=this.conflict=false;this.error='';this.savedAt=new Date().toISOString();}}
  this.rebuild();this.emit();if(confirmed||this.autoSaving&&!wasAuto)void this.pump();}
 keepMine(){if(!this.conflict||this.working||!this.pending.length)return;const action={...this.pending[0].action};delete action.expected;delete action.before;if(action.type==='delete-subevent')delete action.undoToken;this.pending[0].action=guardEdit(this.base,restoreForEdit(this.base,action));this.pending[0].at=new Date().toISOString();this.conflict=false;this.retry();}
 retry(){if(this.conflict)return;this.pending.forEach(p=>this.approved.add(p.id));this.error='';this.paused=false;this.emit();void this.pump();}
 discard(){if(this.working)return;this.pending=[];this.approved.clear();this.conflict=false;this.paused=false;this.error='';this.undoMoves=[];this.redoMoves=[];this.rebuild();this.emit();this.waiters.splice(0).forEach(resolve=>resolve(true));}
 savePending():Promise<boolean>{if(this.conflict)return Promise.resolve(false);this.pending.forEach(p=>this.approved.add(p.id));this.paused=false;this.error='';void this.pump();return this.flush();}
 flush():Promise<boolean>{if(!this.autoSaving&&this.pending.some(p=>!this.approved.has(p.id)))return Promise.resolve(false);if(this.paused)return Promise.resolve(false);if(!this.pending.length&&!this.working)return Promise.resolve(true);return new Promise(resolve=>this.waiters.push(resolve));}
 private async pump(){if(this.working||this.paused||!this.pending.length||!this.autoSaving&&!this.approved.has(this.pending[0].id))return;this.working=true;this.emit();let conflicts=0;
  try{while(this.pending.length&&!this.paused&&(this.autoSaving||this.approved.has(this.pending[0].id))){const item=this.pending[0];let reply:SaveReply;
   try{const wire={...item.action};delete wire.snapshot;
    if(wire.type==='delete-subevent'&&!wire.undoToken){
     const prepared=await this.transport({revision:this.revision,action:{...wire,type:'prepare-delete-subevent'},mutationId:item.id,occurredAt:item.at});
     if(prepared.status===200&&prepared.undoToken){item.action.undoToken=wire.undoToken=prepared.undoToken;
      const snapshot=prepared.data?.events.find(e=>e.id===item.action.eventId);
      if(snapshot){for(const move of [...this.undoMoves,...this.redoMoves])if(move.forward.type==='delete-subevent'&&move.forward.restoreId===wire.restoreId){move.forward={...item.action};move.backward={...move.backward,snapshot:structuredClone(snapshot),undoToken:prepared.undoToken};}
       for(const pending of this.pending)if(pending.action.type==='restore-subevent'&&pending.action.restoreId===wire.restoreId)pending.action={...pending.action,snapshot:structuredClone(snapshot),undoToken:prepared.undoToken};}
      reply=await this.transport({revision:prepared.revision??this.revision,action:wire,mutationId:item.id,occurredAt:item.at});}
     else reply=prepared;
    }else reply=await this.transport({revision:this.revision,action:wire,mutationId:item.id,occurredAt:item.at});}catch(error){if(!this.base.appliedMutationIds?.includes(item.id))throw error;reply={status:200,data:this.base,revision:this.revision};}
   if(reply.code==='edit_conflict'&&reply.data&&typeof reply.revision==='number'){if(reply.revision>=this.revision||(reply.data.personalRevision??0)>(this.base.personalRevision??0)){this.acceptBase(reply.data,reply.revision);}this.conflict=true;this.rebuild();throw Error(reply.error||'Someone Else Changed This Field.');}
   if(reply.status===409&&reply.data&&typeof reply.revision==='number'&&conflicts++<5){if(reply.revision>=this.revision||(reply.data.personalRevision??0)>(this.base.personalRevision??0)){this.acceptBase(reply.data,reply.revision);}this.rebuild();this.emit();continue;}
   if(reply.status<200||reply.status>=300||!reply.data||typeof reply.revision!=='number')throw Error(reply.error||'Save failed. Your changes are still waiting to save.');
   if(reply.revision>=this.revision||(reply.data.personalRevision??0)>(this.base.personalRevision??0)){this.acceptBase(reply.data,reply.revision);}this.savedAt=reply.savedAt||new Date().toISOString();this.approved.delete(item.id);this.pending.shift();conflicts=0;this.error='';this.rebuild();this.emit();
  }}catch(error){this.error=error instanceof Error?error.message:'Connection lost. Changes are waiting to save.';this.paused=true;}
  finally{this.working=false;this.emit();this.waiters.splice(0).forEach(resolve=>resolve(!this.paused));}
 }
}

import {identityGuard,personIdentity} from './person-links.ts';
import {eventSettingsSource} from './event-settings.ts';
import {excuseFor,personFields,rosterRemovalTargets,type Data} from './model.ts';
type Action=Record<string,any>;
/** Only fields this operation replaces participate in conflict detection. */
export function editTarget(data:Data,a:Action):unknown{
 const e=data.events.find(e=>e.id===a.eventId),r=data.rosters.find(r=>r.id===a.rosterId),p=e?.participants.find(p=>p.id===a.personId);
 const attendance=(id:string)=>{const x=e?.participants.find(p=>p.id===id);return x?{id,status:x.status,excuse:excuseFor(x),removed:x.removed}:null;};
 const member=(x:typeof p)=>{if(!x)return null;const {history,updatedAt,...fields}=x;return fields;};
 const value=(v:unknown)=>({exists:!!e,archived:e?.archivedAt??null,value:v??null});
 switch(a.type){
  case 'restore-and-edit-people':return {membership:a.personIds?.map((id:string)=>[id,e?.participants.find(p=>p.id===id)?.removed??null]),target:editTarget(data,a.edit||{})};
  case 'restore-and-edit-person':return {membership:p?.removed??null,target:editTarget(data,a.edit||{})};
  case 'status':case 'excuse':case 'attendance-state':return value(attendance(a.personId));
  case 'person-note':return {...value(p?.note),person:!!p,removed:p?.removed??null};
  case 'person-flag':return {...value(p?.flag),person:!!p,removed:p?.removed??null};
  case 'update-event-settings':return value(e?eventSettingsSource(data,e):null);
  case 'event-note':return value(e?.note);
  case 'rename-event':return value(e?.name);
  case 'prepare-delete-subevent':case 'delete-subevent':{if(!e)return value(null);const {history,updatedAt,subeventDeletions,...target}=e;return value(e.parentEventId?{...target,history:e.history}:target);}
  case 'restore-subevent':return value(e?.subeventDeletions?.[a.subeventId]);
  case 'rename-subevent':return value(e?.subeventName||'Day 1');
  case 'set-statuses':return value(a.changes?.map((c:any)=>attendance(c.personId)));
  case 'set-person-field':return value(a.changes?.map((c:any)=>{const person=e?.participants.find(p=>p.id===c.personId);return a.field==='removed'?member(person):{personId:c.personId,value:person?(a.field==='flag'?person.flag??null:person.note):null,removed:person?.removed??null};}));
  case 'mark-remaining':return value(e?.participants.map(p=>attendance(p.id)));
  case 'reorder-event':return value(e?.participants.map(p=>p.id));
  case 'clear-person-history':return value(p?.history.map(h=>h.id));
  case 'delete-event-person':case 'remove-event-person':case 'restore-event-person':return value(member(p));
  case 'set-family-memberships':return data.events.filter(x=>x.id===(e?.parentEventId||e?.id)||x.parentEventId===(e?.parentEventId||e?.id)).map(x=>({id:x.id,archived:x.archivedAt??null,people:[...new Set<string>((a.changes||[]).map((c:any)=>c.personId))].map(id=>member(x.participants.find(p=>p.id===id)))}));
  case 'remove-family-person':case 'set-family-membership':return data.events.filter(x=>x.id===(e?.parentEventId||e?.id)||x.parentEventId===(e?.parentEventId||e?.id)).map(x=>({id:x.id,archived:x.archivedAt??null,person:member(x.participants.find(p=>p.id===a.personId))}));
  case 'delete-roster':{if(!r)return null;const {updatedAt,...target}=r;return target;}
  case 'link-matching-people':case 'link-person-identity':case 'unlink-roster-person':return identityGuard(data);
  case 'roster-person-note':{const person=r?.people.find(p=>p.id===a.personId);const identity=person?personIdentity(data,person.id,r!.id):null;return {exists:!!r,person:!!person,identity,value:identity?data.personNotes?.[identity]??'':null};}
  case 'rename-roster':return {exists:!!r,value:r?.name??null};
  case 'reorder-roster':return {exists:!!r,value:r?.people.map(p=>p.id)??null};
  case 'edit-person':case 'remove-roster-person':return {exists:!!r,value:r?.people.find(p=>p.id===a.personId)?personFields(r.people.find(p=>p.id===a.personId)!):null};
  case 'remove-person-from-all-rosters':return {exists:!!r,value:rosterRemovalTargets(data,a.rosterId,a.personId).map(t=>({rosterId:t.rosterId,id:t.person.id,fields:personFields(t.person)}))};
  case 'restore-roster-person':case 'delete-roster-person':return {exists:!!r,value:r?.removedPeople?.find(p=>p.id===a.personId)??null,active:r?.people.some(p=>p.id===a.personId)??false};
  case 'replace-roster-csv':return {exists:!!r,value:r?.people??null};
  case 'link-roster-person':return {exists:!!r,people:r?.people.map(p=>p.id),removed:r?.removedPeople?.map(p=>p.id),source:data.personIds?Object.entries(data.personIds).find(([,uid])=>uid===String(a.uid).toUpperCase())??null:null};
  case 'add-roster-people':return {exists:!!r};
  case 'create-event':return {exists:!!r,value:r?.people??null};
  case 'create-subevent':case 'duplicate-event':case 'add-event-people':return value(null);
  case 'archive-event':case 'restore-event':case 'delete-archived-event':return data.events.filter(x=>x.id===(e?.parentEventId||e?.id)||x.parentEventId===(e?.parentEventId||e?.id));
  case 'update-profile':return data.profile??null;
  case 'update-preferences':return data.preferences??null;
  case 'update-organization':return data.organization??null;
  case 'report-settings':return data.reportSettings??null;
  case 'delete-report-preset':return data.reportPresets?.find(p=>p.id===a.presetId)??null;
  case 'save-report-preset':case 'create-roster':return null;
  default:return data;
 }
}
const serialize=(target:unknown)=>JSON.stringify(target,(key,value)=>key==='actor'&&value?.id?{id:value.id}:value);
export const editFingerprint=(data:Data,action:Action)=>serialize(editTarget(data,action));
export function guardEdit(data:Data,action:Action):Action{
 if(typeof action.expected==='string')return action;
 let target=editTarget(data,action);
 // Inline editors retain the value from when typing began, even if a live update arrives.
 if(Object.hasOwn(action,'before')&&target&&typeof target==='object'&&!Array.isArray(target)&&'value' in target)target={...target,value:action.before};
 return {...action,expected:serialize(target)};
}

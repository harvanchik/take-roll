import type {Data} from './model';
export const PERSON_EDITS=new Set(['status','excuse','attendance-state','person-note','person-flag']);
export function removedEdit(data:Data,action:Record<string,any>){
 if(action.type==='set-statuses'||action.type==='set-person-field'&&action.field!=='removed')return !!data.events.find(e=>e.id===action.eventId)?.participants.some(p=>p.removed&&action.changes?.some((c:any)=>c.personId===p.id));
 if(!PERSON_EDITS.has(action.type))return false;
 return !!data.events.find(e=>e.id===action.eventId)?.participants.find(p=>p.id===action.personId)?.removed;
}
export function restoreForEdit(data:Data,action:Record<string,any>){
 if(!removedEdit(data,action))return action;
 const edit={...action};delete edit.expected;delete edit.before;
 if(action.type==='set-statuses'||action.type==='set-person-field'&&action.field!=='removed')return {type:'restore-and-edit-people',eventId:action.eventId,personIds:data.events.find(e=>e.id===action.eventId)!.participants.filter(p=>p.removed&&action.changes.some((c:any)=>c.personId===p.id)).map(p=>p.id),edit};
 return {type:'restore-and-edit-person',eventId:action.eventId,personId:action.personId,edit};
}

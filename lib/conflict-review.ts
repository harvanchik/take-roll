import {editTarget} from './edit-conflicts';
import {applyAction,type Data} from './model';
export type ConflictReview={id:string;title:string;mineAt:string;theirsAt:string;mine:unknown;theirs:unknown};
export function describeConflict(data:Data,action:Record<string,any>,id:string,mineAt:string):ConflictReview{
 const event=data.events.find(e=>e.id===action.eventId),roster=data.rosters.find(r=>r.id===action.rosterId),person=event?.participants.find(p=>p.id===action.personId)||roster?.people.find(p=>p.id===action.personId);
 const clean={...action};delete clean.expected;delete clean.before;
 let mine:unknown;try{mine=editTarget(applyAction(data,clean,mineAt),clean);}catch{mine=Object.fromEntries(Object.entries(clean).filter(([key])=>!['type','eventId','personId','rosterId'].includes(key)));}
 return {id,title:[person?.name,event?.name||roster?.name,action.type.replaceAll('-',' ')].filter(Boolean).join(' · '),mineAt,theirsAt:person?.updatedAt||event?.updatedAt||roster?.updatedAt||'',mine,theirs:editTarget(data,clean)};
}
export function conflictDifferences(mine:unknown,theirs:unknown,path=''):Array<{field:string;mine:string;theirs:string}>{
 const label=(v:unknown)=>v===null||v===undefined?'None':v===''?'Empty':typeof v==='boolean'?v?'Yes':'No':String(v);
 if(JSON.stringify(mine)===JSON.stringify(theirs))return [];
 if(mine&&theirs&&typeof mine==='object'&&typeof theirs==='object')return [...new Set([...Object.keys(mine),...Object.keys(theirs)])].filter(k=>!['exists','archived','person','id','identity','updatedAt','addedAt','createdAt','history'].includes(k)).flatMap(k=>conflictDifferences((mine as any)[k],(theirs as any)[k],k==='value'?path:[path,/^\d+$/.test(k)?String(Number(k)+1):k.replace(/([A-Z])/g,' $1')].filter(Boolean).join(' / ')));
 return [{field:path||'Value',mine:label(mine),theirs:label(theirs)}];
}

import {personFields,type Data,type Person} from './model.ts';
import {ValidationError} from './validation-error.ts';

/** Historical row IDs stay intact. Identity aliases join them without merging attendance rows. */
export function personIdentity(data:Data,id:string,rosterId?:string):string{
 let current=(rosterId&&data.personScopes?.[rosterId]?.[id])||id;const seen=new Set<string>();
 while(data.personLinks?.[current]&&!seen.has(current)){seen.add(current);current=data.personLinks[current];}
 return current;
}
export const samePerson=(data:Data,id:string,other:string,rosterId?:string)=>personIdentity(data,id,rosterId)===personIdentity(data,other);
const clean=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
export function identityName(p:Person):string{
 const f=personFields(p);return f.firstName.trim()&&f.lastName.trim()?JSON.stringify([clean(f.firstName),clean(f.lastName)]):'';
}
const rosterEntries=(data:Data)=>data.rosters.flatMap(r=>[...r.people,...r.removedPeople??[]].map(person=>({rosterId:r.id,person})));
export function identityGuard(data:Data){return {links:data.personLinks??{},scopes:data.personScopes??{},excluded:data.personLinkExcluded??[],notes:data.personNotes??{},rosters:data.rosters.map(r=>({id:r.id,people:[...r.people,...r.removedPeople??[]].map(p=>({id:p.id,...personFields(p)}))})),events:data.events.map(e=>({id:e.id,rosterId:e.rosterId,people:e.participants.map(p=>({id:p.id,...personFields(p)}))}))};}
function conflict(data:Data,ids:Set<string>):string|undefined{
 const notes=new Set([...ids].map(id=>data.personNotes?.[id]).filter(Boolean));if(notes.size>1)return 'Different Person Notes';
 for(const roster of data.rosters)if([...roster.people,...roster.removedPeople??[]].filter(p=>ids.has(personIdentity(data,p.id,roster.id))).length>1)return 'Multiple Matching People In One Roster';
 for(const event of data.events)if(event.participants.filter(p=>ids.has(personIdentity(data,p.id,event.rosterId))).length>1)return 'Separate Attendance Entries In The Same Subevent';
}
export function matchingPeoplePlan(data:Data){
 const entries=rosterEntries(data),groups=new Map<string,typeof entries>(),rootNames=new Map<string,Set<string>>();
 for(const entry of entries){const key=identityName(entry.person);if(!key)continue;groups.set(key,[...groups.get(key)??[],entry]);const root=personIdentity(data,entry.person.id,entry.rosterId);rootNames.set(root,new Set([...(rootNames.get(root)??[]),key]));}
 const links:Array<{name:string;canonical:string;ids:string[]}>=[],skipped:Array<{name:string;reason:string}>=[];
 for(const [key,members] of groups){
  const roots=new Set(members.map(m=>personIdentity(data,m.person.id,m.rosterId))),rosters=new Set(members.map(m=>m.rosterId));
  // Only full, exact structured names can bring otherwise detached historical rows into the group.
  for(const e of data.events)if(rosters.has(e.rosterId))for(const p of e.participants)if(identityName(p)===key)roots.add(personIdentity(data,p.id,e.rosterId));
  if(roots.size<2)continue;
  const name=[personFields(members[0].person).firstName,personFields(members[0].person).lastName].join(' ');
  const preferred=new Set(members.map(m=>clean(personFields(m.person).preferredFirstName)).filter(Boolean));
  const reason=[...roots].some(id=>data.personLinkExcluded?.includes(id))?'Manually Unlinked':[...roots].some(id=>(rootNames.get(id)?.size??0)>1)?'Linked Identity Has Different Names':preferred.size>1?'Different Preferred Names':conflict(data,roots);
  if(reason){skipped.push({name,reason});continue;}
  links.push({name,canonical:personIdentity(data,members[0].person.id,members[0].rosterId),ids:[...roots]});
 }
 return {links,skipped};
}
export function linkMatchingPeople(data:Data,at:string):Data{
 const plan=matchingPeoplePlan(data),personLinks={...data.personLinks},personNotes={...data.personNotes};
 for(const group of plan.links){const note=group.ids.map(id=>personNotes[id]).find(Boolean);if(note)personNotes[group.canonical]=note;for(const id of group.ids)if(id!==group.canonical){personLinks[id]=group.canonical;delete personNotes[id];}}
 return {...data,personLinks,personNotes,personLinkReview:{at,linked:plan.links.length,skipped:plan.skipped}};
}
/** Used only for newly created identities, never to rewrite a matched CSV row or an existing edit. */
export function autoLinkNewPeople(data:Data,rosterId:string,people:Person[]):Person[]{
 const candidates=rosterEntries(data).filter(entry=>entry.rosterId!==rosterId),counts=new Map<string,number>();
 for(const p of people){const key=identityName(p);if(key)counts.set(key,(counts.get(key)??0)+1);}
 return people.map(p=>{
  const key=identityName(p);if(!key)return p;
  const matches=candidates.filter(entry=>identityName(entry.person)===key),roots=new Set(matches.map(m=>personIdentity(data,m.person.id,m.rosterId)));
  if(!roots.size)return p;
  const root=[...roots][0],preferred=clean(personFields(p).preferredFirstName),differentPreferred=matches.some(m=>{const other=clean(personFields(m.person).preferredFirstName);return preferred&&other&&preferred!==other;});
  const roster=data.rosters.find(r=>r.id===rosterId),duplicateHere=(counts.get(key)??0)>1||[...roster?.people??[],...roster?.removedPeople??[]].some(other=>identityName(other)===key||personIdentity(data,other.id,rosterId)===root);
  const reason=duplicateHere?'Duplicate Name In This Roster':roots.size!==1?'Multiple Matching People':data.personLinkExcluded?.includes(root)||personIdentity(data,root,rosterId)!==root?'Manually Unlinked':differentPreferred?'Different Preferred Names':undefined;
  return reason?{...p,identityNote:reason}:{...p,id:root};
 });
}
/** Shared preflight for the dialog and save path; never collapse two attendance identities. */
export function identityLinkBlocker(data:Data,sourceId:string,targetId:string):string|undefined{
 const source=personIdentity(data,sourceId),target=personIdentity(data,targetId);
 if(source===target)return;
 const reason=conflict(data,new Set([source,target]));
 if(reason==='Different Person Notes')return 'Both people have different notes. Resolve the notes before linking so neither is lost.';
 if(reason==='Multiple Matching People In One Roster')return 'These entries are in the same roster. Linking works across different rosters; same-roster entries need separate attendance records.';
 if(reason)return 'Both people have attendance entries in the same subevent. They need separate IDs to keep those records distinct.';
}
export function linkPersonIdentity(data:Data,sourceId:string,targetId:string,at:string):Data{
 const source=personIdentity(data,sourceId),target=personIdentity(data,targetId);if(source===target)return data;
 const reason=identityLinkBlocker(data,source,target);if(reason)throw new ValidationError(reason);
 const personNotes={...data.personNotes};if(personNotes[source]&&!personNotes[target])personNotes[target]=personNotes[source];delete personNotes[source];
 return {...data,personNotes,rosters:data.rosters.map(r=>({...r,people:r.people.map(p=>{if(personIdentity(data,p.id,r.id)!==source)return p;const {identityNote,...person}=p;return person;})})),personLinks:{...data.personLinks,[source]:target},personLinkExcluded:data.personLinkExcluded?.filter(id=>id!==source&&id!==target),personLinkReview:{at,linked:1,skipped:[]}};
}
export function autoLinkEditedPerson(data:Data,rosterId:string,personId:string,previousKey:string,at:string):Data{
 const p=data.rosters.find(r=>r.id===rosterId)?.people.find(p=>p.id===personId);if(!p||!identityName(p)||identityName(p)===previousKey)return data;
 const root=personIdentity(data,p.id,rosterId);if(data.personLinkExcluded?.includes(root))return data;
 const entries=rosterEntries(data).filter(entry=>entry.rosterId!==rosterId),matches=entries.filter(entry=>identityName(entry.person)===identityName(p)),roots=new Set(matches.map(m=>personIdentity(data,m.person.id,m.rosterId)));
 if(!roots.size||roots.size===1&&roots.has(root))return data;
 const preferred=clean(personFields(p).preferredFirstName);
 const reason=roots.size>1?'Multiple Matching People':entries.some(m=>personIdentity(data,m.person.id,m.rosterId)===root)?'Already Linked To Another Roster':data.personLinkExcluded?.includes([...roots][0])?'Manually Unlinked':matches.some(m=>preferred&&clean(personFields(m.person).preferredFirstName)&&preferred!==clean(personFields(m.person).preferredFirstName))?'Different Preferred Names':conflict(data,new Set([root,...roots]));
 if(reason){p.identityNote=reason;return data;}
 return linkPersonIdentity(data,root,[...roots][0],at);
}
export function unlinkRosterIdentity(data:Data,rosterId:string,personId:string,newId:string):Data{
 const roster=data.rosters.find(r=>r.id===rosterId),person=roster?.people.find(p=>p.id===personId);if(!roster||!person)throw new ValidationError('Person No Longer Exists In This Roster.');
 const root=personIdentity(data,person.id,rosterId),sourceIds=new Set<string>([person.id]);
 if(roster.people.filter(p=>personIdentity(data,p.id,rosterId)===root).length>1)throw new ValidationError('Multiple Entries Share This Identity. Review Them Before Unlinking.');
 for(const event of data.events.filter(e=>e.rosterId===rosterId))for(const p of event.participants)if(personIdentity(data,p.id,rosterId)===root)sourceIds.add(p.id);
 const scopes={...data.personScopes?.[rosterId]};for(const id of sourceIds)scopes[id]=newId;
 // All event objects, attendance, notes, flags, timestamps and histories are retained byte-for-byte.
 const personNotes={...data.personNotes};if(personNotes[root])personNotes[newId]=personNotes[root];
 return {...data,personNotes,rosters:data.rosters.map(r=>r.id===rosterId?{...r,people:r.people.map(p=>p.id===personId?{...p,id:newId,identityNote:'Manually Unlinked'}:p)}:r),personScopes:{...data.personScopes,[rosterId]:scopes},personLinkExcluded:[...new Set([...(data.personLinkExcluded??[]),newId])]};
}

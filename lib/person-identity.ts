import {personIdentity} from './person-links.ts';
import type {Data,Person} from './model.ts';

/** A short, workspace-unique public ID; full UUIDs continue to identify stored records. */
export function withPersonIds(data:Data):Data {
 const personIds:Record<string,string>={...data.personIds},used=new Set<string>();
 for(const key of Object.keys(personIds).sort()){
  const code=personIds[key];if(!/^[A-Z0-9]{7}$/.test(code)||used.has(code))delete personIds[key];else used.add(code);
 }
 const ids=new Set<string>();
 for(const roster of data.rosters)for(const person of [...roster.people,...roster.removedPeople??[]])ids.add(person.id);
 for(const event of data.events)for(const person of event.participants)ids.add(person.id);
 for(const id of [...ids].sort()){
  if(Object.hasOwn(personIds,id))continue;
  let hash=0;for(const char of id)hash=(hash*131+char.charCodeAt(0))%78_364_164_096;
  const base=id.replace(/[^a-z0-9]/gi,'').toUpperCase();
  let code=base.length>=7?base.slice(0,7):hash.toString(36).toUpperCase().padStart(7,'0');
  while(used.has(code)){hash=(hash+1)%78_364_164_096;code=hash.toString(36).toUpperCase().padStart(7,'0');}
  personIds[id]=code;used.add(code);
 }
 const keys=Object.keys(personIds);
 if(!keys.length&&!data.personIds||keys.length===Object.keys(data.personIds??{}).length&&keys.every(id=>data.personIds?.[id]===personIds[id]))return data;
 return {...data,personIds};
}

/** Resolve explicit and safely matched aliases while retaining historical row IDs. */
export function workspacePeople(data:Data):Person[]{
 const people=new Map<string,Person>();
 for(const event of data.events.filter(e=>!e.subeventDeleted).slice().sort((a,b)=>(a.updatedAt??'').localeCompare(b.updatedAt??'')))for(const p of event.participants)people.set(personIdentity(data,p.id,event.rosterId),{...p,id:personIdentity(data,p.id,event.rosterId)});
 for(const roster of data.rosters)for(const p of roster.removedPeople??[])people.set(personIdentity(data,p.id,roster.id),{...p,id:personIdentity(data,p.id,roster.id)});
 for(const roster of data.rosters)for(const p of roster.people)people.set(personIdentity(data,p.id,roster.id),{...p,id:personIdentity(data,p.id,roster.id)});
 return [...people.values()];
}
export function personForUid(data:Data,uid:string):Person|undefined{
 const ids=data.personIds??withPersonIds(data).personIds??{};
 const id=Object.keys(ids).find(id=>ids[id]===uid.toUpperCase());
 return id?workspacePeople(data).find(p=>p.id===personIdentity(data,id)):undefined;
}
export const personPath=(uid:string)=>'/person/'+encodeURIComponent(uid);

export const personUid=(data:Data,id:string,rosterId?:string)=>data.personIds?.[personIdentity(data,id,rosterId)];

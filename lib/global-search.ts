import {displayName,type Data,type Person} from './model.ts';
import {eventPath,rosterPath} from './navigation.ts';
import {personIdentity} from './person-links.ts';
import {personPath,personUid} from './person-identity.ts';
import {formatDay} from './dates.ts';
export type SearchItem={key:string;kind:'Person'|'Roster'|'Event'|'Subevent'|'Page';label:string;detail:string;path:string;modified:string;terms:string[];uid?:string;testOnly?:boolean};
const normalize=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim().replace(/\s+/g,' ');
export function searchItems(data:Data):SearchItem[]{
 const items:SearchItem[]=[],people=new Map<string,SearchItem>();
 const addPerson=(p:Person,rosterId:string,context:string,modified:string)=>{
  const identity=personIdentity(data,p.id,rosterId),uid=personUid(data,p.id,rosterId);if(!uid)return;
  const name=displayName(p),previous=people.get(identity),terms=[name,p.name,p.firstName||'',p.lastName||'',p.preferredFirstName||'',p.pronunciation||'',uid];
  if(previous){previous.terms.push(...terms);if(modified>previous.modified)previous.modified=modified;if(context&&!previous.detail.split(' • ').includes(context))previous.detail+=' • '+context;return;}
  people.set(identity,{key:'person:'+identity,kind:'Person',label:name,detail:'Person'+(context?' • '+context:''),uid,path:personPath(uid),modified,terms});
 };
 for(const roster of data.rosters){
  items.push({key:'roster:'+roster.id,kind:'Roster',label:roster.name,detail:'Roster • '+roster.people.length,path:rosterPath(roster),modified:roster.updatedAt,terms:[roster.name]});
  for(const p of roster.people)addPerson(p,roster.id,roster.name,p.updatedAt||p.addedAt||roster.updatedAt);
  for(const p of roster.removedPeople??[])addPerson(p,roster.id,roster.name+' (removed)',p.removedAt);
 }
 for(const root of data.events.filter(e=>!e.parentEventId)){
  const family=data.events.filter(e=>!e.subeventDeleted&&(e.id===root.id||e.parentEventId===root.id)),first=family.find(e=>e.id===root.id)||family[0];if(!first)continue;
  items.push({key:'event:'+root.id,kind:'Event',label:root.name,detail:'Event • '+formatDay(root.date)+(root.archivedAt?' • Archived':''),testOnly:!!root.settings?.testOnly,path:eventPath(first,data),modified:family.reduce((latest,e)=>e.updatedAt>latest?e.updatedAt:latest,root.updatedAt),terms:[root.name,data.rosters.find(roster=>roster.id===root.rosterId)?.name??root.rosterName,root.date,formatDay(root.date)]});
  if(root.settings?.testOnly)continue;
  for(const event of family){
   items.push({key:'subevent:'+event.id,kind:'Subevent',label:event.subeventName||'Day 1',detail:'Subevent • '+root.name+' • '+formatDay(event.date)+(root.archivedAt?' • Archived':''),path:eventPath(event,data),modified:event.updatedAt,terms:[event.subeventName||'Day 1',root.name,event.date,formatDay(event.date)]});
   for(const p of event.participants)addPerson(p,event.rosterId,'',p.updatedAt||p.addedAt||event.updatedAt);
  }
 }
 // Old short IDs remain valid aliases after linking.
 for(const [id,uid] of Object.entries(data.personIds??{}))people.get(personIdentity(data,id))?.terms.push(uid);
 items.push(...people.values());
 for(const [label,path,terms] of [['Events','/events','calendar'],['Rosters','/rosters','people'],['Archive','/archive','archived events'],['Settings','/settings','profile preferences organization theme shortcuts']] as const)items.push({key:'page:'+path,kind:'Page',label,detail:'Page',path,modified:'',terms:[label,terms]});
 return items;
}
export function searchWorkspace(items:SearchItem[],query:string):SearchItem[]{
 const text=normalize(query);if(!text)return [];
 const tokens=text.split(' ');
 return items.map(item=>{const label=normalize(item.label),terms=item.terms.map(normalize),joined=terms.join(' ');if(!tokens.every(token=>joined.includes(token)))return {item,score:0};const score=label===text||item.kind==='Person'&&terms.some(term=>term===text&&/^[a-z0-9]{7}$/.test(term))?100:label.startsWith(text)?90:terms.some(term=>term===text)?85:label.includes(text)?80:terms.some(term=>term.startsWith(text))?75:terms.some(term=>term.includes(text))?60:50;return {item,score};}).filter(result=>result.score>0).sort((a,b)=>b.score-a.score||b.item.modified.localeCompare(a.item.modified)||a.item.label.localeCompare(b.item.label)||a.item.key.localeCompare(b.item.key)).slice(0,5).map(result=>result.item);
}
export const recentSearchKey=(owner:string)=>'take-roll.search-recent.v1.'+encodeURIComponent(owner);
export function readRecentSearches(storage:Pick<Storage,'getItem'>,owner:string):string[]{try{const value=JSON.parse(storage.getItem(recentSearchKey(owner))||'[]');return Array.isArray(value)?[...new Set(value.filter((key:unknown)=>typeof key==='string'&&key.length<250))].slice(0,5):[];}catch{return [];}}

import type {Data} from './model';
import {personForUid} from './person-identity.ts';
import {nearestSubevent} from './subevents.ts';
export function slugify(name:string,fallback='event'):string {
 return name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,70).replace(/^-+|-+$/g,'')||fallback;
}
export function withSlugs(data:Data):Data {
 const normalize=<T extends {id:string;name:string;slug?:string}>(records:T[],fallback:string):T[]=>{
  const taken=new Set(records.filter(r=>r.slug).map(r=>r.slug!));
  return records.map(record=>{if(record.slug)return record;const base=slugify(record.name,fallback);let slug=base;
   if(taken.has(slug))slug=base+'-'+record.id.replace(/[^a-z0-9]/gi,'').slice(0,8).toLowerCase();
   let number=2;const candidate=slug;while(taken.has(slug))slug=candidate+'-'+number++;
   taken.add(slug);return {...record,slug};
  });
 };
 const events=normalize(data.events,'event');
 const used=new Map<string,Set<string>>();
 for(const e of events){const root=e.parentEventId||e.id;if(!used.has(root))used.set(root,new Set());if(e.subeventSlug)used.get(root)!.add(e.subeventSlug);}
 return {...data,events:events.map(e=>{if(e.subeventSlug)return e;const root=e.parentEventId||e.id;const taken=used.get(root)!;const base=slugify(e.subeventName||'Day 1');let slug=base,n=2;while(taken.has(slug))slug=base+'-'+n++;taken.add(slug);return {...e,subeventSlug:slug};}),rosters:normalize(data.rosters,'roster')};
}
export type PageRoute={view:'events'|'rosters'|'archive'|'settings'|'event-settings'|'person';personUid?:string;eventId:string;rosterId:string;missing:boolean};
export function resolvePage(data:Data,path:string,now=new Date()):PageRoute {
 const route:PageRoute={view:'events',eventId:'',rosterId:data.rosters[0]?.id||'',missing:false};
 const clean=path.replace(/\/+$/,'')||'/';
 if(clean==='/'||clean==='/events')return route;
 if(clean==='/settings')return {...route,view:'settings'};
 if(clean==='/archive')return {...route,view:'archive'};
 if(clean==='/rosters')return {...route,view:'rosters'};
 const person=clean.match(/^\/person\/([A-Za-z0-9]{7})$/);
 if(person){const uid=person[1].toUpperCase();return personForUid(data,uid)?{...route,view:'person',personUid:uid}:{...route,missing:true};}
 const settings=clean.match(/^\/event-settings\/([^/]+)$/);
 if(settings){try{const event=data.events.find(e=>!e.parentEventId&&e.slug===decodeURIComponent(settings[1]));return event?{...route,view:'event-settings',eventId:event.id}:{...route,missing:true};}catch{return {...route,missing:true};}}
 const nested=clean.match(/^\/event\/([^/]+)\/([^/]+)$/);
 if(nested){try{const root=data.events.find(e=>!e.parentEventId&&e.slug===decodeURIComponent(nested[1]));const child=root&&data.events.find(e=>!e.subeventDeleted&&(e.id===root.id||e.parentEventId===root.id)&&(e.subeventSlug||slugify(e.subeventName||'Day 1'))===decodeURIComponent(nested[2]));return child?{...route,view:'events',eventId:child.id}:{...route,missing:true};}catch{return {...route,missing:true};}}
 const match=clean.match(/^\/(event|roster)\/([^/]+)$/);
 if(!match)return {...route,missing:true};
 let slug:string;try{slug=decodeURIComponent(match[2]);}catch{return {...route,missing:true};}
 if(match[1]==='event'){const event=data.events.find(e=>e.slug===slug);const active=event&&!event.parentEventId?nearestSubevent(data,event,now):event;return active?{...route,view:'events',eventId:active.id}: {...route,missing:true};}
 const roster=data.rosters.find(r=>r.slug===slug);return roster?{...route,view:'rosters',rosterId:roster.id}:{...route,missing:true};
}
export const eventPath=(event:{id?:string;slug?:string;name:string;parentEventId?:string;subeventSlug?:string;subeventName?:string},data?:Data)=>{const parent=data?.events.find(e=>e.id===(event.parentEventId||event.id));return parent?'/event/'+encodeURIComponent(parent.slug||slugify(parent.name))+'/'+encodeURIComponent(event.subeventSlug||slugify(event.subeventName||'Day 1')):'/event/'+encodeURIComponent(event.slug||slugify(event.name));};
export const rosterPath=(roster:{slug?:string;name:string})=>'/roster/'+encodeURIComponent(roster.slug||slugify(roster.name,'roster'));

export const eventSettingsPath=(event:{slug?:string;name:string})=>'/event-settings/'+encodeURIComponent(event.slug||slugify(event.name));

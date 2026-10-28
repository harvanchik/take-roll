import {displayName,type Change,type Data,type Event,type Person} from './model.ts';
import {eventFamily} from './subevents.ts';
export type EventHistoryRow={key:string;change:Change;person:string;subevent:string;timestamp:number;sequence:number};
/** Read the full saved family, including removed people and hidden subevents. */
export function eventHistoryRows(data:Data,event:Event,name:(person:Person)=>string=person=>displayName(person)){
 const rows:EventHistoryRow[]=[];
 const root=data.events.find(e=>e.id===(event.parentEventId||event.id));
 for(const subevent of [...(root?.subeventDeleted?[root]:[]),...eventFamily(data,event)]){
  const add=(change:Change,subject:string,key:string)=>rows.push({key:subevent.id+':'+key+':'+change.id,change,person:subject,subevent:change.subeventName||subevent.subeventName||'Day 1',timestamp:Number.isFinite(Date.parse(change.at))?Date.parse(change.at):0,sequence:rows.length});
  for(const change of subevent.history)add(change,change.name||'Event','event');
  for(const person of subevent.participants)for(const change of person.history)add(change,name(person),person.id);
 }
 return rows.sort((a,b)=>b.timestamp-a.timestamp||b.sequence-a.sequence);
}

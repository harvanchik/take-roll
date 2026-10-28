import {samePerson} from './person-links.ts';
import {excuseFor,type Data} from './model.ts';
import {effectiveEventSettings} from './event-settings.ts';
import {attendanceSettings,choiceLabel,reasonFromStatus} from './attendance-settings.ts';

export function personAttendance(data:Data,personId:string){
 const rosterNames=new Map(data.rosters.map(roster=>[roster.id,roster.name]));
 return data.events.filter(event=>!event.subeventDeleted).flatMap(event=>{
  const person=event.participants.find(p=>samePerson(data,p.id,personId,event.rosterId));if(!person)return [];
  const root=data.events.find(e=>e.id===(event.parentEventId||event.id))??event;
  if(root.settings?.testOnly)return [];
  const settings=effectiveEventSettings(data,event),config=attendanceSettings(settings),reason=excuseFor(person);
  return [{event,root,person,settings,config,rosterName:rosterNames.get(event.rosterId)??event.rosterName,label:reasonFromStatus(person.status)?config.excusedLabel:choiceLabel(person.status,config),excuse:reason?config.excuses.find(e=>e.id===reason)?.name??(reason==='unspecified'?config.excusedLabel:reason):'',archived:!!(event.archivedAt||root.archivedAt)}];
 }).sort((a,b)=>b.event.date.localeCompare(a.event.date)||a.root.name.localeCompare(b.root.name)||a.event.createdAt.localeCompare(b.event.createdAt));
}
export type PersonAttendanceRow=ReturnType<typeof personAttendance>[number];
/** Roster views include only events created from this roster, even for linked people. */
export function rosterAttendance(data:Data,personId:string,rosterId:string){return personAttendance(data,personId).filter(row=>row.root.rosterId===rosterId);}
/** Count official event families and their remaining days, including archived events. */
export function rosterSummary(data:Data,rosterId:string,rows:PersonAttendanceRow[],people:number){
 const roots=data.events.filter(event=>!event.parentEventId&&event.rosterId===rosterId&&!event.settings?.testOnly);
 const rootIds=new Set(roots.map(event=>event.id));
 const subevents=data.events.filter(event=>!event.subeventDeleted&&rootIds.has(event.parentEventId||event.id)).length;
 const marked=rows.filter(row=>!row.person.removed&&!!row.person.status);
 const totals=personAttendanceTotals(marked);
 const percent=(count:number)=>marked.length?Math.round(count/marked.length*100):null;
 return {events:roots.length,subevents,people,excusedRate:percent(totals.excused),unexcusedRate:percent(totals.absent),attendanceRate:totals.rate};
}
export function rosterAttendanceSortValue(totals:ReturnType<typeof personAttendanceTotals>,key:string,note:string):string|number{
 switch(key){case 'Sessions':return totals.sessions;case 'Attended':return totals.attended;case 'Unexcused Absences':return totals.absent;case 'Excused':return totals.excused;case 'Attendance Rate':return totals.rate??-1;case 'Notes':return note;default:return ''; }
}

export type PersonAttendanceFilter={from:string;to:string;roster:string[];status:string[];excuse:string[];search:string};
export function filterPersonAttendance(rows:PersonAttendanceRow[],filter:PersonAttendanceFilter){
 const search=filter.search.trim().toLocaleLowerCase();
 return rows.filter(row=>(!filter.from||row.event.date>=filter.from)&&(!filter.to||row.event.date<=filter.to)&&(!filter.roster.length||filter.roster.includes(row.event.rosterId))&&(!filter.status.length||filter.status.includes(row.label))&&(!filter.excuse.length||filter.excuse.includes(row.excuse))&&(!search||[row.root.name,row.event.subeventName,row.rosterName,row.person.note].some(value=>value?.toLocaleLowerCase().includes(search))));
}
export function personAttendanceTotals(rows:PersonAttendanceRow[]){
 const official=rows.filter(r=>!r.root.settings?.testOnly),included=official.filter(r=>!r.person.removed),marked=included.filter(r=>!!r.person.status),attended=marked.filter(r=>r.config.statuses.find(s=>s.id===r.person.status)?.attended).length;
 return {sessions:official.length,marked:marked.length,attended,absent:marked.filter(r=>r.config.statuses.find(s=>s.id===r.person.status)?.attended===false&&!excuseFor(r.person)).length,excused:included.filter(r=>!!excuseFor(r.person)).length,unmarked:included.filter(r=>!r.person.status).length,rate:marked.length?Math.round(attended/marked.length*100):null};
}

/** Active membership takes precedence if legacy data contains both forms. */
export function personRosterMemberships(data:Data,personId:string){
 return data.rosters.flatMap(roster=>{if(roster.people.some(p=>samePerson(data,p.id,personId,roster.id)))return [{roster,removedAt:null as string|null}];const removed=(roster.removedPeople??[]).find(p=>samePerson(data,p.id,personId,roster.id));return removed?[{roster,removedAt:removed.removedAt}]:[];});
}

export function personAttendanceSortValue(row:PersonAttendanceRow,key:string){
 return key==='Date'?row.event.date:key==='Event'?[row.root.name,row.event.subeventName??'Day 1']:key==='Note'?row.person.note:key==='Flag'?row.person.flag??'':key==='Attendance'?row.label:key==='Excuse'?row.excuse:key==='Last Changed'?row.person.updatedAt??'':row.event.date;
}

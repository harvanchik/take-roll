import {attendanceSettings,type AttendanceSettings} from './attendance-settings.ts';
import {counts,type Data,type Event,type Participant} from './model.ts';
export function eventFamily(data:Data,event:Event):Event[]{const root=event.parentEventId||event.id;return data.events.filter(e=>!e.subeventDeleted&&(e.id===root||e.parentEventId===root)).sort((a,b)=>a.id===root?-1:b.id===root?1:a.createdAt.localeCompare(b.createdAt));}
/** Compare calendar days, using the viewer's local date rather than the server's timezone. */
export function nearestSubevent(data:Data,event:Event,now=new Date()):Event|undefined{
 const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
 let nearest:Event|undefined,distance=Infinity;
 for(const candidate of eventFamily(data,event)){
  const day=Date.parse(candidate.date+'T00:00:00Z');
  const gap=Math.abs(day-today);
  if(!nearest||gap<distance){nearest=candidate;distance=Number.isFinite(gap)?gap:Infinity;}
 }
 return nearest;
}
export function familySummary(data:Data,event:Event):Event{return {...event,participants:eventFamily(data,event).flatMap(e=>e.participants)};}
export function comparisonRows(events:Event[],config:AttendanceSettings=attendanceSettings(),configFor:(event:Event)=>AttendanceSettings=()=>config){const rows=new Map<string,{person:Participant;cells:Map<string,Participant>;configs:Map<string,AttendanceSettings>;marked:number;present:number;total:number}>();for(const event of events)for(const p of event.participants){if(p.removed)continue;let row=rows.get(p.id);if(!row){row={person:p,cells:new Map(),configs:new Map(),marked:0,present:0,total:0};rows.set(p.id,row);}row.cells.set(event.id,p);row.configs.set(event.id,configFor(event));row.total++;if(p.status)row.marked++;if(configFor(event).statuses.some(s=>s.id===p.status&&s.attended))row.present++;}return [...rows.values()];}

export type ComparisonSelection={scope:'family'|'all';selected:string[]};
export function selectedComparisonEvents(data:Data,parent:Event,selection?:ComparisonSelection){
 const available=selection?.scope==='all'?data.events.filter(e=>!e.subeventDeleted&&!!e.archivedAt===!!parent.archivedAt):eventFamily(data,parent);
 return selection?available.filter(e=>selection.selected.includes(e.id)):available;
}
export function comparisonSummary(data:Data,parent:Event,selection?:ComparisonSelection):Event{
 return {...parent,participants:selectedComparisonEvents(data,parent,selection).flatMap(e=>e.participants)};
}

import {attendanceSettings,excuseStatus,type AttendanceSettings} from './attendance-settings.ts';
import {statusMatches,attendanceFiltersMatch,excuseFor,matchesPersonSearch,type Participant,type ExcuseType} from './model.ts';
import {comparisonRows} from './subevents.ts';
export type ComparisonRow=ReturnType<typeof comparisonRows>[number];
export type ComparisonFilter={search:string;filter:string[];unmarked:boolean;flagFilter:'flagged'|'complete'|null;excuseTypes?:ExcuseType[]};
export function comparisonMatches(row:ComparisonRow,view:ComparisonFilter,config:AttendanceSettings=attendanceSettings(),uidFor?:(person:Participant,eventId:string)=>string|undefined):boolean{
 if(!matchesPersonSearch(row.person,view.search)&&![...row.cells].some(([eventId,person])=>matchesPersonSearch(person,view.search,uidFor?.(person,eventId))))return false;
 const cells=[...row.cells.values()];
 if(view.flagFilter)return cells.some(p=>p.flag===view.flagFilter);
 if(view.unmarked)return cells.some(p=>!p.status);
 return !view.filter.length||[...row.cells].some(([id,p])=>attendanceFiltersMatch(p,view.filter,view.excuseTypes,row.configs?.get(id)||config));
}
export function comparisonFilterCounts(rows:ComparisonRow[],config:AttendanceSettings=attendanceSettings()){
 const any=(match:(p:Participant,c:AttendanceSettings)=>boolean)=>rows.filter(row=>[...row.cells].some(([id,p])=>match(p,row.configs?.get(id)||config))).length;
 const statuses=config.statuses.filter(s=>s.active||rows.some(row=>[...row.cells.values()].some(p=>p.status===s.id)));
 return {statusIds:statuses.map(s=>s.id),excuseCounts:Object.fromEntries([...config.excuses.map(e=>e.id),...(rows.some(row=>[...row.cells.values()].some(p=>excuseFor(p)==='unspecified'))?['unspecified']:[])].map(id=>[id,any(p=>excuseFor(p)===id)])),total:rows.length,unmarked:any(p=>!p.status),counts:[...statuses.map(s=>s.id),'Excused','Unexcused'].map(status=>any((p,c)=>statusMatches(p,status,c)))};
}

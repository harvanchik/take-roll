import {attendanceSettings,type AttendanceSettings} from './attendance-settings.ts';
import {filteredPeople,type Event,type ExcuseType,type Participant} from './model.ts';
export type AttendanceView={key:string;ids:string[]};
// Capture membership when the user changes views; render fresh records in their saved order.
export function captureAttendanceView(event:Event,search:string,filters:string[],unmarked:boolean,previous:AttendanceView|null,epoch=0,flag:"flagged"|"complete"|null=null,excuseTypes:ExcuseType[]=[],config:AttendanceSettings=attendanceSettings(),uidFor?:(person:Participant)=>string|undefined):AttendanceView {
 // Keep status edits in place, but recapture when people are added, removed or restored.
 const membership=event.participants.filter(p=>!p.removed).map(p=>[p.id,uidFor?.(p)??'']).sort((a,b)=>a[0].localeCompare(b[0]));
 const key=JSON.stringify([event.id,search,filters,unmarked,epoch,flag,excuseTypes,config,membership]);
 return previous?.key===key?previous:{key,ids:filteredPeople(event,search,filters,unmarked,excuseTypes,config,uidFor).filter(p=>!flag||p.flag===flag).map(p=>p.id)};
}
export function attendanceViewPeople(event:Event,view:AttendanceView){const ids=new Set(view.ids);return event.participants.filter(p=>!p.removed&&ids.has(p.id));}

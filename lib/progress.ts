import {attendanceSettings,attendanceChoices,choiceColor,choiceLabel,type AttendanceSettings} from './attendance-settings.ts';
import {STATUSES,type Event} from './model.ts';
const labels=['Present','Bit Late','Tardy','Absent','Excused (Work)','Excused (Academic)','Excused (Other)'];
const tones=['present','bit-late','tardy','absent','work','academic','other'];
/** Each marked entry occupies exactly one segment. Attendance takes precedence
 * over an attached excuse; excuse-only statuses retain their own reason color. */
export function attendanceSegments(event:Event,config?:AttendanceSettings){
 if(config){const active=event.participants.filter(p=>!p.removed),ids=[...new Set([...attendanceChoices(config).map(s=>s.id),...active.map(p=>p.status).filter((s):s is string=>!!s)])];return ids.map(status=>{const count=active.filter(p=>p.status===status).length;return {status,label:choiceLabel(status,config),tone:'',color:choiceColor(status,config),count,percent:active.length?count/active.length*100:0};});}
 const active=event.participants.filter(p=>!p.removed),totals=STATUSES.map(()=>0);
 for(const person of active){const index=(STATUSES as readonly string[]).indexOf(person.status!);if(index>=0)totals[index]++;}
 return totals.map((count,index)=>({status:STATUSES[index],label:labels[index],tone:tones[index],color:choiceColor(STATUSES[index],attendanceSettings()),count,percent:active.length?count/active.length*100:0}));
}

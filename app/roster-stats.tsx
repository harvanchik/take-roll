import InfoPopover from './info-popover';
import type {rosterSummary} from '../lib/person-attendance';

export default function RosterStats({summary}:{summary:ReturnType<typeof rosterSummary>}){
 const percent=(value:number|null)=>value===null?'—':value+'%';
 const stats=[['Events',summary.events],['Subevents',summary.subevents],['Rostered People',summary.people],['Excused Rate',percent(summary.excusedRate)],['Unexcused Rate',percent(summary.unexcusedRate)],['Attendance Rate',percent(summary.attendanceRate)]] as const;
 const explanations:Record<string,string>={
  'Excused Rate':'Of all attendance marks, the percentage that have an excuse.',
  'Unexcused Rate':'Of all attendance marks, the percentage not attended without an excuse.',
  'Attendance Rate':'Of all attendance marks, the percentage that count as attended.'
 };
 return <div className="person-attendance-summary" aria-label="Roster Summary">{stats.map(([label,value])=><div key={label}><span className="person-summary-label">{label}{explanations[label]&&<InfoPopover label={'About '+label}>{explanations[label]}</InfoPopover>}</span><strong>{value}</strong></div>)}</div>;
}

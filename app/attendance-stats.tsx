import InfoPopover from './info-popover';
import type {personAttendanceTotals} from '../lib/person-attendance';
export default function AttendanceStats({totals}:{totals:ReturnType<typeof personAttendanceTotals>}){
 const explanations:Record<string,string>={
  'Attended':'How many sessions count as attended, based on their attendance status.',
  'Unexcused Absences':'How many sessions were marked not attended without an excuse.',
  'Excused':'How many sessions have an excuse.',
  'Unmarked':'How many sessions have no attendance marked yet.',
  'Attendance Rate':'Of sessions with attendance marked, the percentage that count as attended.'
 };
 return <div className="person-attendance-summary" aria-label="Attendance Summary">{[['Sessions',totals.sessions],['Attended',totals.attended],['Unexcused Absences',totals.absent],['Excused',totals.excused],['Unmarked',totals.unmarked],['Attendance Rate',totals.rate===null?'—':totals.rate+'%']].map(([label,value])=><div key={label}><span className="person-summary-label">{label}{explanations[String(label)]&&<InfoPopover label={'About '+label}>{explanations[String(label)]}</InfoPopover>}</span><strong>{value}</strong></div>)}</div>;
}

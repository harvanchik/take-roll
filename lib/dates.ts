import type {Preferences} from './workspace-settings';
type DatePreferences=Pick<Preferences,'dateFormat'|'timeFormat'|'timeZone'>;
/** Offset at the supplied instant, including daylight saving and fractional hours. */
export function timeZoneOffset(zone:string,at=new Date()):string {
 const offset=new Intl.DateTimeFormat('en-US',{timeZone:zone==='device'?undefined:zone,timeZoneName:'longOffset'}).formatToParts(at).find(part=>part.type==='timeZoneName')?.value||'GMT';
 return offset==='GMT'?'UTC+00:00':offset.replace('GMT','UTC');
}
function dayParts(year:string,month:string,day:string,prefs:DatePreferences,shortMonth:string){return prefs.dateFormat==='iso'?`${year}-${month}-${day}`:prefs.dateFormat==='mdy'?`${month}/${day}/${year}`:prefs.dateFormat==='dmy'?`${day}/${month}/${year}`:`${Number(day)} ${shortMonth} ${year}`;}
/** Calendar dates never shift with the timestamp display time zone. */
export function formatDay(value:string,prefs:DatePreferences={}):string {
 const [year,month,day]=value.split('-');
 const shortMonth=new Intl.DateTimeFormat('en-GB',{month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 return dayParts(year,month,day,prefs,shortMonth);
}
export function formatTimestamp(value:string,options?:string|DatePreferences):string {
 const prefs:DatePreferences=typeof options==='string'?{timeZone:options}:options??{},zone=prefs.timeZone&&prefs.timeZone!=='device'?prefs.timeZone:undefined,date=new Date(value);
 const parts=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:prefs.timeFormat!=='24h',...(zone?{timeZone:zone}:{})}).formatToParts(date);
 const part=(type:string)=>parts.find(p=>p.type===type)?.value||'';
 const month=new Intl.DateTimeFormat('en-GB',{month:'short',...(zone?{timeZone:zone}:{})}).format(date),day=dayParts(part('year'),part('month'),part('day'),prefs,month);
 return `${day}, ${prefs.timeFormat==='24h'?part('hour'):Number(part('hour'))}:${part('minute')}${prefs.timeFormat==='24h'?'':' '+part('dayPeriod').toUpperCase()}`;
}

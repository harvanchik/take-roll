import {ValidationError} from './validation-error.ts';
import {personFields,displayName,displayPronunciation,attendanceLabel,type Person,type Participant} from './model.ts';
import {lastNameOrder} from './name-order.ts';
import {reasonFromStatus,unexcusedStatus,type AttendanceSettings} from './attendance-settings.ts';
import type {NameDisplay} from './name-format.ts';
export const SORT_CRITERIA=['Date Added','Last Changed','Last Name','First Name','Preferred Name','Full Name','Pronunciation','Notes','Attendance','Flag','#','Attended','Excused','Unexcused'] as const;
export type DefaultSort={key:string;direction:'asc'|'desc'};
export function defaultSort(settings:{defaultSort?:DefaultSort;forceAlphabetical?:boolean}={}):DefaultSort{return settings.defaultSort??{key:settings.forceAlphabetical?'Last Name':'Date Added',direction:'asc'};}
export function validateDefaultSort(value:unknown):DefaultSort{
 const v=value as DefaultSort;
 if(!v||typeof v!=='object'||typeof v.key!=='string'||(!SORT_CRITERIA.includes(v.key as any)&&!/^status:.{1,100}$/.test(v.key))||!['asc','desc'].includes(v.direction))throw new ValidationError('Choose A Valid Default Sort.');
 return {key:v.key,direction:v.direction};
}
/** Missing legacy timestamps retain their stored order before newly added records. */
export function personSortValue(person:Person,key:string,mode:NameDisplay,config:AttendanceSettings):string|number|readonly (string|number)[]{
 const fields=personFields(person),p=person as Partial<Participant>;
 switch(key){
 case 'Last Name':return lastNameOrder(person);
 case 'First Name':return [fields.firstName,fields.lastName];
 case 'Preferred Name':return [fields.preferredFirstName||fields.firstName,fields.lastName];
 case 'Full Name':return displayName(person,mode);
 case 'Pronunciation':return displayPronunciation(person);
 case 'Last Changed':return person.updatedAt||person.addedAt||'';
 case 'Notes':return p.note||'';
 case 'Attendance':return p.history?attendanceLabel(p as Participant,config):'';
 case 'Flag':return p.flag||'';
 case 'Attended':return Number(!!p.status&&!!config.statuses.find(s=>s.id===p.status)?.attended);
 case 'Excused':return Number(!!p.excuse||!!reasonFromStatus(p.status));
 case 'Unexcused':return Number(unexcusedStatus(p.status??null,config)&&!p.excuse&&!reasonFromStatus(p.status));
 default:return key.startsWith('status:')?Number(p.status===key.slice(7)):person.addedAt||'';
 }
}

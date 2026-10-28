import {ValidationError} from './validation-error.ts';

/** Stored IDs never change when a label changes. Removed choices cannot be selected again. */
export type AttendanceChoice={id:string;name:string;color:string;active:boolean;attended:boolean;allowExcuse:boolean};
export type ExcuseChoice={id:string;name:string;code:string;color:string;active:boolean};
export type AttendanceSettings={statuses:AttendanceChoice[];excuses:ExcuseChoice[];excusedLabel:string;comments:boolean;flags:boolean;history:boolean;excuseTypes:boolean;eventNote:boolean;flagColor:string;checkColor:string};
export const ATTENDANCE_PALETTE=[
 {id:'green',name:'Green',value:'var(--green)'},{id:'yellow',name:'Yellow',value:'var(--yellow)'},
 {id:'orange',name:'Orange',value:'var(--orange)'},{id:'red',name:'Red',value:'var(--red)'},
 {id:'purple',name:'Purple',value:'var(--purple)'},{id:'pink',name:'Pink',value:'var(--academic)'},
 {id:'blue',name:'Blue',value:'var(--blue)'},{id:'teal',name:'Teal',value:'#79c9c5'},
 {id:'indigo',name:'Indigo',value:'#a8afe9'},{id:'lime',name:'Lime',value:'#bdd58b'},
 {id:'gray',name:'Gray',value:'var(--gray)'},
 {id:'flag',name:'Signal Red',value:'var(--default-flag-color)'},{id:'check',name:'Signal Green',value:'var(--default-check-color)'}
] as const;
export const DEFAULT_ATTENDANCE:AttendanceSettings={
 statuses:[{id:'Present',name:'Present',color:'green',active:true,attended:true,allowExcuse:false},{id:'Bit Late',name:'Bit Late',color:'yellow',active:true,attended:true,allowExcuse:true},{id:'Tardy',name:'Tardy',color:'orange',active:true,attended:true,allowExcuse:true},{id:'Absent',name:'Absent',color:'red',active:true,attended:false,allowExcuse:true}],
 excuses:[{id:'work',name:'Work',code:'W',color:'purple',active:true},{id:'academic',name:'Academic',code:'A',color:'pink',active:true},{id:'other',name:'Other',code:'O',color:'blue',active:true}],
 excusedLabel:'Excused',comments:true,flags:true,history:true,excuseTypes:true,eventNote:true,flagColor:'flag',checkColor:'check'
};
export function attendanceSettings(org?:{attendance?:AttendanceSettings}):AttendanceSettings{return org?.attendance??DEFAULT_ATTENDANCE;}
export function tone(color?:string){return ATTENDANCE_PALETTE.find(c=>c.id===color)?.value??'var(--gray)';}
export const excuseStatus=(id:string)=>id==='work'?'Excused (work)':id==='academic'?'Excused (Academic)':id==='other'?'Excused (Other)':'excuse:'+id;
export function reasonFromStatus(status:string|null|undefined){return status==='Excused (work)'?'work':status==='Excused (Academic)'?'academic':status==='Excused (Other)'?'other':status?.startsWith('excuse:')?status.slice(7):null;}
export function choiceLabel(id:string|null|undefined,c:AttendanceSettings){const reason=reasonFromStatus(id);return !id?'Unmarked':reason==='unspecified'?c.excusedLabel:reason?`${c.excusedLabel} (${c.excuses.find(e=>e.id===reason)?.code??reason})`:c.statuses.find(s=>s.id===id)?.name??id;}
export function choiceColor(id:string|null|undefined,c:AttendanceSettings){const reason=reasonFromStatus(id);return tone(reason?(reason==='unspecified'?c.excuses.find(e=>e.active)?.color:c.excuses.find(e=>e.id===reason)?.color):c.statuses.find(s=>s.id===id)?.color);}
export function activeStatuses(c:AttendanceSettings){return c.statuses.filter(s=>s.active);}
export function activeExcuses(c:AttendanceSettings){return c.excuseTypes?c.excuses.filter(e=>e.active):[{id:'unspecified',name:c.excusedLabel,code:'',color:c.excuses.find(e=>e.active)?.color??'purple',active:true}];}
export function attendanceChoices(c:AttendanceSettings){return [...activeStatuses(c).map(s=>({id:s.id,name:s.name,color:s.color})),...activeExcuses(c).map(e=>({id:excuseStatus(e.id),name:e.code?`${c.excusedLabel} (${e.code})`:c.excusedLabel,color:e.color}))];}
/** Only saved, active choices are offered in every event. */
export function eventStatuses(c:AttendanceSettings,participants:Array<{status:string|null;removed:boolean}>){return activeStatuses(c);}
export function unexcusedStatus(id:string|null,c:AttendanceSettings){return !!id&&(c.statuses.find(s=>s.id===id)?.allowExcuse??['Bit Late','Tardy','Absent'].includes(id));}
export function validateAttendance(input:unknown):AttendanceSettings{
 if(!input||typeof input!=='object')throw new ValidationError('Choose Valid Attendance Settings.');
 const x=input as AttendanceSettings;
 const name=(v:unknown,max=40)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u001f]/.test(v))throw new ValidationError('Use A Name Up To '+max+' Characters.');return v.trim();};
 const color=(v:unknown)=>{if(typeof v!=='string'||!ATTENDANCE_PALETTE.some(c=>c.id===v))throw new ValidationError('Choose A Preset Color.');return v;};
 const validId=(v:unknown,kind:'status'|'excuse')=>typeof v==='string'&&(kind==='status'?DEFAULT_ATTENDANCE.statuses.some(s=>s.id===v):DEFAULT_ATTENDANCE.excuses.some(e=>e.id===v))||typeof v==='string'&&new RegExp('^'+kind+'-[a-zA-Z0-9-]{1,64}$').test(v);
 if(!Array.isArray(x.statuses)||!Array.isArray(x.excuses)||x.statuses.length>100||x.excuses.length>100)throw new ValidationError('Too Many Attendance Choices.');
 const statuses=x.statuses.map(s=>{if(!s||!validId(s.id,'status')||typeof s.active!=='boolean'||typeof s.attended!=='boolean'||typeof s.allowExcuse!=='boolean')throw new ValidationError('Invalid Attendance Status.');return {id:s.id,name:name(s.name,15),color:color(s.color),active:s.active,attended:s.attended,allowExcuse:s.allowExcuse};});
 const excuses=x.excuses.map(e=>{if(!e||!validId(e.id,'excuse')||typeof e.active!=='boolean')throw new ValidationError('Invalid Excuse Type.');const code=name(e.code,2);if(!/^[\p{L}\p{N}]{1,2}$/u.test(code))throw new ValidationError('Use One Or Two Letters Or Numbers For The Short Label.');return {id:e.id,name:name(e.name,15),code,color:color(e.color),active:e.active};});
 for(const list of [statuses,excuses]){if(new Set(list.map(s=>s.id)).size!==list.length||new Set(list.filter(s=>s.active).map(s=>s.name.toLocaleLowerCase())).size!==list.filter(s=>s.active).length)throw new ValidationError('Use Unique Names And IDs.');if(list.filter(s=>s.active).length>12)throw new ValidationError('Use Up To 12 Active Choices In Each List.');}
 if(!statuses.some(s=>s.active))throw new ValidationError('Keep At Least One Attendance Status.');
 if(new Set(excuses.filter(e=>e.active).map(e=>e.code.toLocaleLowerCase())).size!==excuses.filter(e=>e.active).length)throw new ValidationError('Use Unique Excuse Short Labels.');
 const flags={} as Pick<AttendanceSettings,'comments'|'flags'|'history'|'excuseTypes'|'eventNote'>;
 for(const key of ['comments','flags','history','excuseTypes','eventNote'] as const){if(typeof x[key]!=='boolean')throw new ValidationError('Choose Valid Visibility Settings.');flags[key]=x[key];}
 if(x.excuseTypes&&!excuses.some(e=>e.active))throw new ValidationError('Add An Excuse Type Or Turn Excuse Types Off.');
 return {statuses,excuses,excusedLabel:name(x.excusedLabel,15),...flags,flagColor:color(x.flagColor),checkColor:color(x.checkColor)};
}

/** New rows start valid even when several are added before editing their labels. */
export function newAttendanceChoice<T extends {name:string;code?:string}>(choices:T[],base:string){
 const names=new Set(choices.map(s=>s.name.trim().toLocaleLowerCase())),codes=new Set(choices.map(s=>s.code?.toLocaleLowerCase()));
 const shortCode=(n:number)=>n===1?'N':n<36?'N'+n.toString(36).toUpperCase():n.toString(36).toUpperCase();
 let number=1;while(names.has((base+(number===1?'':' '+number)).toLocaleLowerCase())||codes.has(shortCode(number).toLocaleLowerCase()))number++;
 return {name:base+(number===1?'':' '+number),code:shortCode(number)};
}
export function swipeStatuses(c:AttendanceSettings){const statuses=activeStatuses(c);return {right:statuses.find(s=>s.id==='Present'&&s.attended)??statuses.find(s=>s.attended),left:statuses.find(s=>s.id==='Absent'&&!s.attended)??statuses.find(s=>!s.attended)};}

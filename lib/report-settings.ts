import {attendanceSettings,attendanceChoices,excuseStatus,type AttendanceSettings} from './attendance-settings.ts';
import {renameStatusText} from './status.ts';
import type {Status} from './model';
export const REPORT_GROUPS=['Present','Bit Late','Tardy','Absent','Excused (work)','Excused (Academic)','Excused (Other)','Unmarked'] as const;
export type ReportGroup=Status|'Unmarked';
export type ReportSettings={
 groups:ReportGroup[];scope:'all'|'visible';format:'text'|'markdown';sort:'roster'|'first'|'last';nameStyle:'full'|'preferred'|'given';
 header:boolean;eventDate:boolean;roster:boolean;generatedAt:boolean;eventNote:boolean;summary:boolean;percentages:boolean;names:boolean;notes:boolean;excuses:boolean;pronunciations:boolean;timestamps:boolean;history:boolean;eventHistory:boolean;removed:boolean;emptyGroups:boolean;numbering:boolean;
 historyLimit:4|10|0;title:string;intro:string;footer:string;
};
export const DEFAULT_REPORT_SETTINGS:ReportSettings={groups:[...REPORT_GROUPS],scope:'all',format:'text',sort:'roster',nameStyle:'full',header:true,eventDate:true,roster:true,generatedAt:false,eventNote:true,summary:true,percentages:false,names:true,notes:true,excuses:true,pronunciations:false,timestamps:false,history:false,eventHistory:false,removed:false,emptyGroups:false,numbering:false,historyLimit:4,title:'',intro:'',footer:''};
const FLAGS=['header','eventDate','roster','generatedAt','eventNote','summary','percentages','names','notes','excuses','pronunciations','timestamps','history','eventHistory','removed','emptyGroups','numbering'] as const;
export function reportSettings(input:unknown,config?:AttendanceSettings):ReportSettings {
 const settings=structuredClone(DEFAULT_REPORT_SETTINGS);
 if(config)settings.groups=[...attendanceChoices(config).map(s=>s.id),'Unmarked'];
 if(!input||typeof input!=='object')return settings;const source=input as Record<string,unknown>;
 for(const flag of FLAGS)if(typeof source[flag]==='boolean')settings[flag]=source[flag] as boolean;
 if(Array.isArray(source.groups)){const groups=source.groups.filter((v):v is string=>typeof v==='string'&&v.length<=90).map(renameStatusText);settings.groups=[...new Set(groups.filter(g=>(REPORT_GROUPS as readonly string[]).includes(g)||/^status-[a-zA-Z0-9-]{1,64}$/.test(g)||/^excuse:excuse-[a-zA-Z0-9-]{1,64}$/.test(g)||g==='excuse:unspecified'))].slice(0,100);if(config&&REPORT_GROUPS.every(g=>groups.includes(g)))settings.groups=[...new Set([...settings.groups,...attendanceChoices(config).map(s=>s.id)])];const order=[...(config?attendanceChoices(config).map(s=>s.id):REPORT_GROUPS),...settings.groups];settings.groups=[...new Set(order)].filter(g=>settings.groups.includes(g));}
 if(config){const allowed=new Set([...config.statuses.filter(s=>s.active).map(s=>s.id),...config.excuses.filter(e=>e.active).map(e=>excuseStatus(e.id)),'excuse:unspecified','Unmarked']);settings.groups=settings.groups.filter(g=>allowed.has(g));}
 if(['all','visible'].includes(String(source.scope)))settings.scope=source.scope as ReportSettings['scope'];
 if(['text','markdown'].includes(String(source.format)))settings.format=source.format as ReportSettings['format'];
 if(['roster','first','last'].includes(String(source.sort)))settings.sort=source.sort as ReportSettings['sort'];
 if(['full','preferred','given'].includes(String(source.nameStyle)))settings.nameStyle=source.nameStyle as ReportSettings['nameStyle'];
 if([4,10,0].includes(Number(source.historyLimit)))settings.historyLimit=Number(source.historyLimit) as 4|10|0;
 for(const key of ['title','intro','footer'] as const)if(typeof source[key]==='string')settings[key]=(source[key] as string).slice(0,key==='title'?200:2000);
 return settings;
}
export type ReportPreset={id:string;name:string;settings:ReportSettings};
export function defaultReportPresets():ReportPreset[]{
 return ['Standard','Attendance Only','Detailed','Exceptions'].map((name,index)=>{const settings=reportSettings(undefined);if(index===1){settings.eventNote=false;settings.notes=false;}if(index===2){settings.generatedAt=true;settings.percentages=true;settings.timestamps=true;settings.history=true;settings.eventHistory=true;settings.pronunciations=true;}if(index===3){settings.groups=['Tardy','Absent','Excused (work)','Excused (Academic)','Excused (Other)','Unmarked'];settings.timestamps=true;}return {id:'default-'+index,name,settings};});
}

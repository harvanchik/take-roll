import {defaultSort} from './default-sort.ts';
import {attendanceSettings,validateAttendance,type AttendanceSettings} from './attendance-settings.ts';
import {organizationSettings,validateOrganization,type OrganizationSettings} from './workspace-settings.ts';
import type {Data,Event} from './model.ts';
import {ValidationError} from './validation-error.ts';
export type EventSettingsOverrides=Partial<Pick<OrganizationSettings,'nameDisplay'|'showPronunciation'|'forceAlphabetical'|'defaultSort'|'mobileSwipe'>> & {attendance?:Partial<AttendanceSettings>;useGlobal?:boolean;testOnly?:boolean};
const keys=['nameDisplay','showPronunciation','forceAlphabetical','defaultSort','mobileSwipe'] as const;
export function eventSettingsRoot(data:Pick<Data,'events'>,event:Event){return data.events.find(e=>e.id===(event.parentEventId||event.id))||event;}
export function effectiveEventSettings(data:Pick<Data,'events'|'organization'>,event?:Event):OrganizationSettings{
 return mergeEventSettings(organizationSettings(data.organization),event?eventSettingsRoot(data,event).settings:undefined);
}
export function mergeEventSettings(global:OrganizationSettings,local?:EventSettingsOverrides|null):OrganizationSettings{if(local?.useGlobal===true)local=undefined;return {...global,...local,mobileSwipe:{...global.mobileSwipe,...local?.mobileSwipe},defaultSort:local?.defaultSort??(local?.forceAlphabetical!==undefined?defaultSort(local):defaultSort(global)),attendance:{...attendanceSettings(global),...local?.attendance}};}
export function eventSettingsSource(data:Pick<Data,'events'|'organization'>,event:Event){return {global:organizationSettings(data.organization),overrides:eventSettingsRoot(data,event).settings??null};}
export function validateEventOverrides(input:unknown,global?:OrganizationSettings):EventSettingsOverrides{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new ValidationError('Choose Valid Event Settings.');
 const x=input as EventSettingsOverrides;
 if(Object.keys(x).some(k=>![...keys,'attendance','useGlobal','testOnly'].includes(k as any)))throw new ValidationError('Unknown Event Setting.');
 if(x.testOnly!==undefined&&typeof x.testOnly!=='boolean')throw new ValidationError('Choose A Valid Test Mode.');
 if(x.useGlobal!==undefined&&typeof x.useGlobal!=='boolean')throw new ValidationError('Choose A Valid Settings Mode.');
 const base=organizationSettings(global),validated=validateOrganization({...mergeEventSettings(base,{...x,useGlobal:false}),attendance:validateAttendance({...attendanceSettings(base),...x.attendance})}),out:EventSettingsOverrides={};
 for(const key of keys)if(Object.hasOwn(x,key))(out as any)[key]=validated[key];
 if(x.attendance!==undefined){if(!x.attendance||typeof x.attendance!=='object'||Array.isArray(x.attendance)||Object.keys(x.attendance).some(k=>!Object.hasOwn(attendanceSettings(base),k)))throw new ValidationError('Unknown Attendance Setting.');out.attendance={};for(const key of Object.keys(x.attendance) as Array<keyof AttendanceSettings>)(out.attendance as any)[key]=validated.attendance![key];}
 if(out.attendance?.statuses)out.attendance.statuses=out.attendance.statuses.filter(s=>s.active);
 if(out.attendance?.excuses)out.attendance.excuses=out.attendance.excuses.filter(e=>e.active);
 if(x.useGlobal!==undefined)return {...eventSettingsSnapshot(validated),useGlobal:x.useGlobal,...(x.testOnly!==undefined?{testOnly:x.testOnly}:{})};
 if(x.testOnly!==undefined)out.testOnly=x.testOnly;
 return out;
}
/** A local event owns every roll-call setting, including values equal to today's globals. */
export function eventSettingsSnapshot(value:OrganizationSettings){const attendance=structuredClone(attendanceSettings(value));attendance.statuses=attendance.statuses.filter(s=>s.active);attendance.excuses=attendance.excuses.filter(e=>e.active);return {mobileSwipe:{left:value.mobileSwipe?.left??'',right:value.mobileSwipe?.right??''},nameDisplay:value.nameDisplay,showPronunciation:value.showPronunciation,defaultSort:defaultSort(value),attendance};}
export type EventSettingsDraft={useGlobal:boolean;testOnly:boolean;local:ReturnType<typeof eventSettingsSnapshot>};
export function eventSettingsDraft(source:ReturnType<typeof eventSettingsSource>):EventSettingsDraft{
 return {useGlobal:source.overrides?.useGlobal??!Object.keys(source.overrides??{}).filter(k=>k!=='testOnly').length,testOnly:source.overrides?.testOnly===true,local:eventSettingsSnapshot(mergeEventSettings(source.global,{...source.overrides,useGlobal:false}))};
}
/** Save only differing fields; everything else continues to inherit global changes. */
export function eventSettingsDiff(value:OrganizationSettings,global:OrganizationSettings):EventSettingsOverrides{
 const out:EventSettingsOverrides={};for(const key of keys.filter(k=>k!=='forceAlphabetical')){const current=key==='defaultSort'?defaultSort(value):value[key],baseValue=key==='defaultSort'?defaultSort(global):global[key];if(JSON.stringify(current)!==JSON.stringify(baseValue))(out as any)[key]=current;}
 const base=attendanceSettings(global),current=attendanceSettings(value),attendance:Partial<AttendanceSettings>={};
 for(const key of Object.keys(base) as Array<keyof AttendanceSettings>)if(JSON.stringify(current[key])!==JSON.stringify(base[key]))(attendance as any)[key]=current[key];
 if(Object.keys(attendance).length)out.attendance=attendance;return out;
}

/** Comparison views include custom choices from every selected event. */
export function combinedEventSettings(data:Pick<Data,'events'|'organization'>,events:Event[],baseEvent:Event):OrganizationSettings{
 const base=effectiveEventSettings(data,baseEvent),config=attendanceSettings(base),configs=events.map(e=>attendanceSettings(effectiveEventSettings(data,e)));
 const statuses=[...new Map([...configs.flatMap(c=>c.statuses),...config.statuses].map(s=>[s.id,s])).values()];
 const excuses=[...new Map([...configs.flatMap(c=>c.excuses),...config.excuses].map(e=>[e.id,e])).values()];
 return {...base,attendance:{...config,statuses,excuses}};
}

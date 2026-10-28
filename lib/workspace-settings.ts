import {validateSwipeActions,type SwipeActions} from './mobile-swipe-actions.ts';
import {DEFAULT_SEARCH_SHORTCUT,validSearchShortcut} from './search-shortcut.ts';
import {DEFAULT_THEME} from './theme.ts';
import {defaultSort,validateDefaultSort,type DefaultSort} from './default-sort.ts';
import {validateAttendance,type AttendanceSettings} from './attendance-settings.ts';
import {ValidationError} from './validation-error.ts';
import {validateNameDisplay,type NameDisplay} from './name-format.ts';
export type {NameDisplay} from './name-format.ts';
export type ArchiveRetention='1d'|'7d'|'30d'|'3m'|'6m';
export type OrganizationSettings={mobileSwipe?:SwipeActions;name:string;nameDisplay:NameDisplay;showPronunciation:boolean;forceAlphabetical?:boolean;defaultSort?:DefaultSort;archiveRetention:ArchiveRetention;attendance?:AttendanceSettings};
export type Profile={firstName:string;lastName:string;preferredName:string};
export type Preferences={globalSearchShortcut?:string;theme:'light'|'dark'|'device';haptics:boolean;autoSave?:boolean;tableDensity?:'compact'|'comfortable';defaultEventView?:'roll-call'|'overview';startingPage?:'events'|'rosters'|'last';dateFormat?:'text'|'mdy'|'dmy'|'iso';timeFormat?:'12h'|'24h';timeZone?:string;rememberFilters?:boolean;sidebarBehavior?:'expanded'|'collapsed'|'remember';reduceMotion?:boolean;confirmBulkChanges?:boolean;shortcutHints?:boolean;showPersonIds?:boolean;pinnedEvents?:string[];pinnedRosters?:string[];rosterOrder?:string[]};
export const defaultOrganization:OrganizationSettings={mobileSwipe:{left:'',right:''},name:'',nameDisplay:'quoted',showPronunciation:true,defaultSort:{key:'Date Added',direction:'asc'},archiveRetention:'30d'};
export const defaultPreferences:Required<Preferences>={globalSearchShortcut:DEFAULT_SEARCH_SHORTCUT,theme:DEFAULT_THEME,haptics:true,autoSave:true,tableDensity:'comfortable',defaultEventView:'roll-call',startingPage:'last',dateFormat:'text',timeFormat:'12h',timeZone:'device',rememberFilters:false,sidebarBehavior:'remember',reduceMotion:false,confirmBulkChanges:true,shortcutHints:true,showPersonIds:false,pinnedEvents:[],pinnedRosters:[],rosterOrder:[]};
export function preferenceSettings(input?:Preferences):Required<Preferences>{return {...defaultPreferences,...input};}
const field=(value:unknown)=>{if(typeof value!=='string'||value.length>100)throw new ValidationError('Use up to 100 characters.');return value.trim();};
export function organizationSettings(input:Partial<OrganizationSettings>={}):OrganizationSettings{return {...defaultOrganization,...input,defaultSort:defaultSort(input)};}
export function validateOrganization(input:OrganizationSettings):OrganizationSettings{if(!input||typeof input.showPronunciation!=='boolean'||!['1d','7d','30d','3m','6m'].includes(input.archiveRetention))throw new ValidationError('Choose valid organization settings.');if(input.forceAlphabetical!==undefined&&typeof input.forceAlphabetical!=='boolean')throw new ValidationError('Choose a valid alphabetical sorting setting.');return {name:field(input.name),nameDisplay:validateNameDisplay(input.nameDisplay),showPronunciation:input.showPronunciation,...(input.forceAlphabetical!==undefined?{forceAlphabetical:input.forceAlphabetical}:{}),defaultSort:validateDefaultSort(defaultSort(input)),archiveRetention:input.archiveRetention,...(input.mobileSwipe!==undefined?{mobileSwipe:validateSwipeActions(input.mobileSwipe)}:{}),...(input.attendance!==undefined?{attendance:validateAttendance(input.attendance)}:{})};}
export function validateProfile(input:Profile):Profile{if(!input)throw new ValidationError('Enter your profile.');return {firstName:field(input.firstName),lastName:field(input.lastName),preferredName:field(input.preferredName)};}
export function validatePreferences(input:Preferences):Preferences{
 const invalid=()=>{throw new ValidationError('Choose valid preferences.');};
 if(!input||!['light','dark','device'].includes(input.theme)||typeof input.haptics!=='boolean')return invalid();
 const output:Preferences={theme:input.theme,haptics:input.haptics};
 if(input.globalSearchShortcut!==undefined){if(!validSearchShortcut(input.globalSearchShortcut))invalid();output.globalSearchShortcut=input.globalSearchShortcut;}
 for(const key of ['autoSave','rememberFilters','reduceMotion','confirmBulkChanges','shortcutHints','showPersonIds'] as const){if(input[key]!==undefined){if(typeof input[key]!=='boolean')invalid();output[key]=input[key];}}
 const choices={tableDensity:['compact','comfortable'],defaultEventView:['roll-call','overview'],startingPage:['events','rosters','last'],dateFormat:['text','mdy','dmy','iso'],timeFormat:['12h','24h'],sidebarBehavior:['expanded','collapsed','remember']} as const;
 for(const key of Object.keys(choices) as Array<keyof typeof choices>){if(input[key]!==undefined){if(!(choices[key] as readonly unknown[]).includes(input[key]))invalid();Object.assign(output,{[key]:input[key]});}}
 if(input.timeZone!==undefined){if(typeof input.timeZone!=='string'||input.timeZone.length>100)invalid();if(input.timeZone!=='device')try{new Intl.DateTimeFormat('en',{timeZone:input.timeZone}).format();}catch{invalid();}output.timeZone=input.timeZone;}
 for(const key of ['pinnedEvents','pinnedRosters','rosterOrder'] as const){const ids=input[key];if(ids!==undefined){if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>typeof id!=='string'||!id.trim()||id.length>200))invalid();output[key]=[...new Set(ids)];}}
 return output;
}
export function profileName(profile?:Profile,fallback=''){return profile?[profile.preferredName||profile.firstName,profile.lastName].filter(Boolean).join(' ')||fallback:fallback;}
export function profileInitials(name:string){return name.trim().split(/\s+/u).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]).join('').toLocaleUpperCase()||'U';}
export function archiveExpiresAt(archivedAt:string,retention:ArchiveRetention):Date{
 const date=new Date(archivedAt);if(['1d','7d','30d'].includes(retention))return new Date(date.getTime()+({ '1d':1,'7d':7,'30d':30 }[retention as '1d'|'7d'|'30d'])*86400000);
 const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+(retention==='3m'?3:6));const end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,end));return date;
}
export function purgeExpiredArchives<T extends {events:Array<{id:string;parentEventId?:string;archivedAt?:string|null}>;organization?:Partial<OrganizationSettings>}>(data:T,now=Date.now()):T{
 const retention=organizationSettings(data.organization).archiveRetention;
 const expired=new Set(data.events.filter(e=>!e.parentEventId&&e.archivedAt&&archiveExpiresAt(e.archivedAt,retention).getTime()<=now).map(e=>e.id));
 const events=data.events.filter(e=>!expired.has(e.id)&&!expired.has(e.parentEventId||'')&&!(e.archivedAt&&archiveExpiresAt(e.archivedAt,retention).getTime()<=now));
 return events.length===data.events.length?data:{...data,events};
}

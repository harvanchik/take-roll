import {personIdentity,samePerson,identityName,autoLinkEditedPerson,autoLinkNewPeople,linkMatchingPeople,linkPersonIdentity,unlinkRosterIdentity} from './person-links.ts';
import {withPersonIds,personForUid} from './person-identity.ts';
import {effectiveEventSettings,mergeEventSettings,eventSettingsSnapshot,validateEventOverrides,type EventSettingsOverrides} from './event-settings.ts';
import {validateAttendance,attendanceSettings,reasonFromStatus,excuseStatus,choiceLabel,unexcusedStatus,type AttendanceSettings,DEFAULT_ATTENDANCE} from './attendance-settings.ts';
import {formatCustomName} from './name-format.ts';
import {ValidationError} from './validation-error.ts';
import {organizationSettings,validateOrganization,validateProfile,validatePreferences,type OrganizationSettings,type Profile,type Preferences,type NameDisplay} from './workspace-settings.ts';
import {formatDay,formatTimestamp} from './dates.ts';
import {reportSettings,defaultReportPresets,type ReportPreset,type ReportSettings} from './report-settings.ts';
import {STATUSES,renameStatusText,type Status} from './status.ts';
export {STATUSES,type Status} from './status.ts';
export type PersonFields = {firstName:string;lastName:string;firstPronunciation:string;lastPronunciation:string;preferredFirstName:string};
export type Person = {identityNote?:string;id:string;name:string;pronunciation:string;addedAt?:string;updatedAt?:string|null} & Partial<PersonFields>;
export type ChangeActor = {id?:string;name?:string;email:string};
export type Change = {id:string;at:string;kind:string;from:string;to:string;name?:string;actor?:ChangeActor;statusId?:string|null;excuseId?:string|null;subeventName?:string};
export type Participant = Person & {flag?:'flagged'|'complete'|null;status:Status|null;excuse?:string|null;note:string;updatedAt:string|null;removed:boolean;history:Change[]};
export type RemovedRosterPerson=Person & {removedAt:string;removedIndex?:number};
export type Roster = {id:string;name:string;slug?:string;people:Person[];removedPeople?:RemovedRosterPerson[];createdAt:string;updatedAt:string};
export type Event = {settings?:EventSettingsOverrides;subeventDeleted?:boolean;subeventDeletions?:Record<string,string>;subeventSlug?:string;parentEventId?:string;subeventName?:string;archivedAt?:string|null;id:string;name:string;slug?:string;date:string;rosterId:string;rosterName:string;note:string;participants:Participant[];createdAt:string;updatedAt:string;history:Change[]};
export type Data = {personNotes?:Record<string,string>;personLinks?:Record<string,string>;personScopes?:Record<string,Record<string,string>>;personLinkExcluded?:string[];personLinkReview?:{at:string;linked:number;skipped:Array<{name:string;reason:string}>};personIds?:Record<string,string>;personalRevision?:number;organization?:OrganizationSettings;profile?:Profile;preferences?:Preferences;rosters:Roster[];events:Event[];appliedMutationIds?:string[];reportSettings?:ReportSettings;reportPresets?:ReportPreset[]};
export const id = () => crypto.randomUUID();
export function parseNames(text:string):string[]{return text.split(/[\n,]+/).map(n=>n.trim()).filter(Boolean);}
export const CSV_HEADER = 'First name,Last name,First name pronunciation,Last name pronunciation,Preferred first name';
export function personFields(person:Person):PersonFields {
 return {firstName:person.firstName??person.name,lastName:person.lastName??'',firstPronunciation:person.firstPronunciation??person.pronunciation,lastPronunciation:person.lastPronunciation??'',preferredFirstName:person.preferredFirstName??''};
}
export function personFromFields(fields:PersonFields,personId=id()):Person {
 return {...fields,id:personId,name:[fields.preferredFirstName||fields.firstName,fields.lastName].filter(Boolean).join(' '),pronunciation:[fields.firstPronunciation,fields.lastPronunciation].filter(Boolean).join(' · ')};
}
export function displayName(person:Person,mode:NameDisplay='quoted'):string {
 const f=personFields(person);if(mode.startsWith('custom:')||mode.startsWith('inline:'))return formatCustomName(f,mode);if(mode==='legal')return [f.firstName,f.lastName].filter(Boolean).join(' ');if(mode==='preferred')return [f.preferredFirstName||f.firstName,f.lastName].filter(Boolean).join(' ');return [f.firstName,f.preferredFirstName&&f.preferredFirstName!==f.firstName?`'${f.preferredFirstName}'`:'',f.lastName].filter(Boolean).join(' ');
}
export function displayPronunciation(person:Person):string {
 const f=personFields(person);return [f.firstPronunciation,f.lastPronunciation].filter(Boolean).join(' · ');
}
/** Search helper only. Identity matching uses a separate full structured-name key with ambiguity checks. */
export function rosterPersonKey(person:Person):string{
 const fields=personFields(person);return [fields.firstName,fields.lastName].filter(Boolean).join(' ').normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
}
export function rosterRemovalTargets(data:Data,rosterId:string,personId:string):Array<{rosterId:string;person:Person}>{
 const source=data.rosters.find(r=>r.id===rosterId)?.people.find(p=>p.id===personId);
 if(!source)return [];
 return data.rosters.flatMap(r=>r.people.filter(p=>samePerson(data,p.id,personIdentity(data,source.id,rosterId),r.id)).map(person=>({rosterId:r.id,person})));
}
function removeRosterPeople(roster:Roster,ids:Set<string>,at:string){
 const removed=roster.people.flatMap((person,index)=>ids.has(person.id)?[{...person,removedAt:at,removedIndex:index}]:[]);
 if(!removed.length)return;
 roster.removedPeople=[...(roster.removedPeople??[]).filter(p=>!ids.has(p.id)),...removed];
 roster.people=roster.people.filter(p=>!ids.has(p.id));roster.updatedAt=at;
}
export function displayEvent(data:Data,event:Event):Event {
 const roster=data.rosters.find(r=>r.id===event.rosterId);
 if(!roster)return event;
 return {...event,participants:event.participants.map(p=>{
  if(p.lastName)return p;
  const fields=personFields(p);
  const direct=roster.people.find(other=>other.id===p.id);
  const removed=roster.removedPeople??[],removedDirect=removed.find(other=>other.id===p.id);
  const match=direct||removedDirect;
  return match?{...p,...personFields(match)}:p;
 })};
}
export function statusLabel(status:Status):string {return status==='Excused (work)'?'Excused (W)':status==='Excused (Academic)'?'Excused (A)':status==='Excused (Other)'?'Excused (O)':status;}
export function nextExcused(status:Status|null):Status|null {return status==='Excused (work)'?'Excused (Academic)':status==='Excused (Academic)'?'Excused (Other)':status==='Excused (Other)'?null:'Excused (work)';}
export function rosterSearchName(person:Person):string {
 const f=personFields(person);return [displayName(person),person.name,[f.firstName,f.lastName].filter(Boolean).join(' '),f.preferredFirstName].join(' ');
}
/** Search both the display name and the workspace's short person ID. */
export function matchesPersonSearch(person:Person,search:string,uid?:string):boolean{
 const query=search.toLocaleLowerCase();return rosterSearchName(person).toLocaleLowerCase().includes(query)||!!uid&&uid.toLocaleLowerCase().includes(query);
}
export function hasOtherActiveRoster(data:Data,rosterId:string,personId:string):boolean{
 return rosterRemovalTargets(data,rosterId,personId).some(target=>target.rosterId!==rosterId);
}
export function parseRosterCSV(input:string):PersonFields[] {
 const source=input.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 const rows:{fields:string[];line:number}[]=[];
 let fields:string[]=[],field='',quoted=false,closed=false,line=1,startLine=1;
 const pushField=()=>{fields.push(field.trim());field='';closed=false;};
 const pushRow=()=>{pushField();if(fields.some(v=>v.length))rows.push({fields,line:startLine});fields=[];startLine=line+1;};
 for(let i=0;i<source.length;i++){
  const ch=source[i];
  if(quoted){if(ch==='"'){if(source[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else{field+=ch;if(ch==='\n')line++;}continue;}
  if(ch===','){pushField();continue;}
  if(ch==='\n'){pushRow();line++;continue;}
  if(closed){if(/\s/.test(ch))continue;throw new ValidationError(`Line ${line}: unexpected text after a closing quote.`);}
  if(ch==='"'){if(field.trim())throw new ValidationError(`Line ${line}: put quotes around the whole field.`);field='';quoted=true;continue;}
  field+=ch;
 }
 if(quoted)throw new ValidationError(`Line ${startLine}: a quoted field is missing its closing quote.`);
 if(field.length||fields.length||closed)pushRow();
 const clean=(s:string)=>s.toLowerCase().replace(/[^a-z]/g,'');
 if(rows.length&&['firstname','lastname','firstnamepronunciation','lastnamepronunciation'].every((h,i)=>clean(rows[0].fields[i]||'')===h)&&[4,5].includes(rows[0].fields.length)){
  if(rows[0].fields.length===5&&!['preferredfirstname','preferredfirstnameoptional'].includes(clean(rows[0].fields[4])))throw new ValidationError('The fifth header must be Preferred first name.');
  rows.shift();
 }
 if(rows.length>500)throw new ValidationError('Use at most 500 people per roster.');
 return rows.map(({fields:values,line})=>{
  if(values.length<4||values.length>5)throw new ValidationError(`Line ${line}: expected 4 or 5 columns: first name, last name, first pronunciation, last pronunciation, and optional preferred first name.`);
  if(!values[0])throw new ValidationError(`Line ${line}: first name is required.`);
  if(values.some(v=>v.length>200))throw new ValidationError(`Line ${line}: each field must be 200 characters or fewer.`);
  return {firstName:values[0],lastName:values[1],firstPronunciation:values[2],lastPronunciation:values[3],preferredFirstName:values[4]||''};
 });
}
export function rosterCSV(roster:Roster):string {
 const quote=(v:string)=>{v=spreadsheetCell(v);return /[",\n\r]/.test(v)?'"'+v.replaceAll('"','""')+'"':v;};
 return [CSV_HEADER,...roster.people.map(p=>{const f=personFields(p);return [f.firstName,f.lastName,f.firstPronunciation,f.lastPronunciation,f.preferredFirstName].map(quote).join(',');})].join('\n');
}
export function replaceRosterPeople(people:Person[],rows:PersonFields[],at?:string):Person[] {
 const used=new Set<string>();
 const signature=(p:PersonFields)=>JSON.stringify([p.firstName,p.lastName,p.firstPronunciation,p.lastPronunciation,p.preferredFirstName]);
 return rows.map(fields=>{
  const same=people.find(p=>!used.has(p.id)&&signature(personFields(p))===signature(fields));
  const match=same||people.find(p=>{const f=personFields(p);return !used.has(p.id)&&f.firstName===fields.firstName&&f.lastName===fields.lastName;});
  if(match)used.add(match.id);return {...match,...personFromFields(fields,match?.id),...(at?{addedAt:match?.addedAt??(match?undefined:at),updatedAt:same?match?.updatedAt:at}:{})};
 });
}
export type Excuse=string|null;
export const COMBINABLE_STATUSES=['Bit Late','Tardy','Absent'];
export function excuseFor(p:Participant):Excuse {return reasonFromStatus(p.status)||p.excuse||null;}
export function attendanceLabel(p:Participant,c:AttendanceSettings=attendanceSettings()):string {const reason=excuseFor(p);if(reasonFromStatus(p.status)&&c.excusedLabel==='Excused'&&c.excuses.find(e=>e.id===reason)?.name===DEFAULT_ATTENDANCE.excuses.find(e=>e.id===reason)?.name&&c.excuses.find(e=>e.id===reason)?.code===DEFAULT_ATTENDANCE.excuses.find(e=>e.id===reason)?.code&&reason!=='unspecified'&&DEFAULT_ATTENDANCE.excuses.some(e=>e.id===reason))return p.status!;return p.status&&!reasonFromStatus(p.status)&&reason?`${choiceLabel(p.status,c)} · ${c.excusedLabel}${reason==='unspecified'?'':` (${c.excuses.find(e=>e.id===reason)?.code??reason})`}`:choiceLabel(p.status,c);}
export function statusMatches(p:Participant,status:string,c:AttendanceSettings=attendanceSettings()):boolean {const reason=reasonFromStatus(status);return status==='Excused'?!!excuseFor(p):status==='Unexcused'?unexcusedStatus(p.status,c)&&!excuseFor(p):reason?excuseFor(p)===reason:p.status===status;}
export function attendanceBreakdown(event:Event,status:string){const people=event.participants.filter(p=>!p.removed),matching=people.filter(p=>p.status===status),withExcuse=matching.filter(p=>excuseFor(p)).length;const percent=(n:number)=>people.length?Math.round(n/people.length*100):0;return {withExcuse,withoutExcuse:matching.length-withExcuse,withPercent:percent(withExcuse),withoutPercent:percent(matching.length-withExcuse)};}
function setAttendance(p:Participant,status:Status|null,excuse:Excuse,c:AttendanceSettings,restoring=false){
 const reason=reasonFromStatus(status),choice=c.statuses.find(s=>s.id===status);
 if(status!==null&&!choice&&status!=='excuse:unspecified'&&!c.excuses.some(e=>excuseStatus(e.id)===status))throw new ValidationError('Unknown status.');
 if(excuse!==null&&excuse!=='unspecified'&&!c.excuses.some(e=>e.id===excuse))throw new ValidationError('Unknown excuse.');
 if(choice&&!choice.active)throw new ValidationError('This Attendance Status Was Removed.');
 if(reason)excuse=reason;
 if(excuse&&excuse!=='unspecified'&&(!c.excuses.some(e=>e.id===excuse&&e.active)||(!c.excuseTypes&&excuse!==excuseFor(p))))throw new ValidationError('This Excuse Type Is Unavailable.');
 if(choice&&!choice.allowExcuse&&excuse&&!restoring)throw new ValidationError('This status cannot be combined with an excuse.');
 if(!status&&excuse)status=excuseStatus(excuse);
 p.status=status;p.excuse=excuse;
}
function chooseAttendance(p:Participant,status:Status|null,c:AttendanceSettings){
 const reason=excuseFor(p),next=reasonFromStatus(status),choice=c.statuses.find(s=>s.id===status);
 if(next)setAttendance(p,unexcusedStatus(p.status,c)?p.status:status,next,c);
 else if(status===null)setAttendance(p,null,!reasonFromStatus(p.status)?reason:null,c);
 else setAttendance(p,status,choice?.allowExcuse?reason:null,c);
}
export function counts(event:Event){const p=event.participants.filter(p=>!p.removed);return {total:p.length,unmarked:p.filter(p=>!p.status).length,values:STATUSES.map(s=>p.filter(p=>statusMatches(p,s)).length)};}
export type ExcuseType=string;
export function attendanceFiltersMatch(p:Participant,filters:string[],excuseTypes:ExcuseType[]=[],c:AttendanceSettings=attendanceSettings()):boolean {
 return !filters.length||filters.some(status=>statusMatches(p,status,c)&&(status!=='Excused'||!excuseTypes.length||excuseTypes.includes(excuseFor(p) as ExcuseType)));
}
export function filteredPeople(event:Event,search:string,filter:string|string[],unmarked:boolean,excuseTypes:ExcuseType[]=[],config:AttendanceSettings=attendanceSettings(),uidFor?:(person:Participant)=>string|undefined){return event.participants.filter(p=>!p.removed && matchesPersonSearch(p,search,uidFor?.(p)) && (!unmarked||!p.status) && (Array.isArray(filter)?attendanceFiltersMatch(p,filter,excuseTypes,config):(filter==='All'||(filter==='Present + late'?['Present','Bit Late','Tardy'].includes(p.status||''):filter==='Other'?['Absent','Excused (work)','Excused (Academic)','Excused (Other)'].includes(p.status||''):filter==='Unmarked'?!p.status:statusMatches(p,filter)))));}
function required(value:unknown,label:string,max=200):string{if(typeof value!=='string'||!value.trim()||value.length>max)throw new ValidationError(label+' is required (up to '+max+' characters).');return value.trim();}
function text(value:unknown,max=2000):string {if(typeof value!=='string'||value.length>max)throw new ValidationError('Text is too long.');return value;}
export function normalizeAttendanceData(data:Data):Data {
 const next=structuredClone(data);
 for(const event of next.events)for(const person of event.participants){
  if(person.status){const status=renameStatusText(person.status);person.status=status==='Unmarked'?null:status as Status;if(!person.status)person.excuse=null;}
  for(const h of person.history)if(h.kind.includes('Status')){h.from=renameStatusText(h.from);h.to=renameStatusText(h.to);}
 }
 if(next.reportSettings)next.reportSettings=reportSettings(next.reportSettings);
 return withPersonIds(next);
}
export function reorderSubset<T extends {id:string}>(people:T[],ids:unknown):T[]{
 if(!Array.isArray(ids)||ids.length>500||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw new ValidationError('Invalid list order.');
 const byId=new Map(people.map(p=>[p.id,p]));
 if(ids.some(id=>!byId.has(id)))throw new ValidationError('The list changed. Refresh and try again.');
 const selected=new Set(ids);let index=0;
 return people.map(p=>selected.has(p.id)?byId.get(ids[index++])!:p);
}
export function applyAction(data:Data,action:any,at=new Date().toISOString(),actor?:ChangeActor):Data {
 action={...action};
 if(typeof action.status==='string')action.status=renameStatusText(action.status)==='Unmarked'?null:renameStatusText(action.status);
 if(Array.isArray(action.changes))action.changes=action.changes.map((c:any)=>({...c,status:typeof c.status==='string'?(renameStatusText(c.status)==='Unmarked'?null:renameStatusText(c.status)):c.status}));
 const next:Data=normalizeAttendanceData(data);
 const targetEvent=next.events.find(e=>e.id===action.eventId);
 const config=attendanceSettings(effectiveEventSettings(next,targetEvent));
 const writableConfig=action.historyIntent==='undo'||action.historyIntent==='redo'?{...config,excuseTypes:true}:config;
 const attendanceChange=(kind:string,from:string,p:Participant):Change=>({...change(kind,from,attendanceLabel(p,config)),statusId:p.status,excuseId:excuseFor(p)});
 const clearRemovedMarks=(e:Event,beforeConfig:AttendanceSettings,incoming:AttendanceSettings)=>{
  const statusIds=new Set(incoming.statuses.filter(s=>s.active).map(s=>s.id)),excuseIds=new Set(incoming.excuses.filter(e=>e.active).map(e=>e.id));
  for(const p of e.participants){const before=attendanceLabel(p,beforeConfig),reason=excuseFor(p),standalone=reasonFromStatus(p.status);
   if(p.status&&!standalone&&!statusIds.has(p.status)&&beforeConfig.statuses.some(s=>s.id===p.status)){p.status=null;p.excuse=null;}
   else if(reason&&reason!=='unspecified'&&!excuseIds.has(reason)&&beforeConfig.excuses.some(e=>e.id===reason)){p.excuse=null;if(standalone)p.status=null;}
   const after=attendanceLabel(p,incoming);if(before!==after&&(p.status===null||reason!==excuseFor(p))){p.history.push({...change('Status',before,after),statusId:p.status,excuseId:excuseFor(p)});p.updatedAt=at;e.updatedAt=at;}
  }
 };
 const roster=()=>{const r=next.rosters.find(r=>r.id===action.rosterId);if(!r)throw new ValidationError('Roster no longer exists.');return r;};
 const event=()=>{const e=next.events.find(e=>e.id===action.eventId);if(!e)throw new ValidationError('Event no longer exists.');if(e.subeventDeleted&&!['restore-subevent','rename-event','update-event-settings','archive-event','restore-event','delete-archived-event','duplicate-event'].includes(action.type))throw new ValidationError('Subevent No Longer Exists.');const parent=e.parentEventId&&next.events.find(item=>item.id===e.parentEventId);if((e.archivedAt||parent&&parent.archivedAt)&&!['archive-event','restore-event','delete-archived-event','duplicate-event'].includes(action.type))throw new ValidationError('This Event Is Archived. Restore It Before Making Changes.');return e;};
 const change=(kind:string,from:string,to:string):Change=>({id:id(),at,kind:(action.historyIntent==='undo'?'Undo · ':action.historyIntent==='redo'?'Redo · ':'')+kind,from,to,...(actor?{actor:{...actor}}:{})});
 switch(action.type){
 case 'restore-and-edit-people':{
  if(!['set-statuses','set-person-field'].includes(action.edit?.type)||action.edit.eventId!==action.eventId||!Array.isArray(action.edit.changes)||!Array.isArray(action.personIds)||!action.personIds.length||action.personIds.length>500||new Set(action.personIds).size!==action.personIds.length||action.personIds.some((personId:string)=>!action.edit.changes.some((c:any)=>c.personId===personId)))throw new ValidationError('Invalid Restored Attendance.');
  let restored=next;const e=event();for(const personId of action.personIds){const p=e.participants.find(p=>p.id===personId);if(!p)throw new ValidationError('This Person No Longer Exists In The Event.');if(p.removed)restored=applyAction(restored,{type:'restore-event-person',eventId:e.id,personId},at,actor);}
  return applyAction(restored,action.edit,at,actor);
 }
 case 'restore-and-edit-person':{
  const allowed=['status','excuse','attendance-state','person-note','person-flag'];
  if(!action.edit||!allowed.includes(action.edit.type)||action.edit.eventId!==action.eventId||action.edit.personId!==action.personId)throw new ValidationError('Invalid Restored Edit.');
  const e=event(),p=e.participants.find(p=>p.id===action.personId);if(!p)throw new ValidationError('This Person No Longer Exists In The Event.');
  const restored=p.removed?applyAction(next,{type:'restore-event-person',eventId:e.id,personId:p.id},at,actor):next;
  return applyAction(restored,action.edit,at,actor);
 }
 case 'save-report-preset':{const presets=next.reportPresets??defaultReportPresets();if(presets.length>=50)throw new ValidationError('Use at most 50 presets.');next.reportPresets=[...presets,{id:id(),name:required(action.name,'Preset name',60),settings:reportSettings(action.settings,config)}];break;}
 case 'delete-report-preset':{next.reportPresets=(next.reportPresets??defaultReportPresets()).filter(p=>p.id!==action.presetId);break;}
 case 'create-subevent':{const source=event();const parent=next.events.find(e=>e.id===(source.parentEventId||source.id))!;if(parent.archivedAt)throw new ValidationError('Restore this event before adding subevents.');const family=next.events.filter(e=>!e.subeventDeleted&&(e.id===parent.id||e.parentEventId===parent.id));if(family.length>=100)throw new ValidationError('Use at most 100 subevents.');const name=required(action.name,'Subevent name');const date=required(action.date,'Date',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new ValidationError('Choose a valid date.');parent.subeventName=parent.subeventName||'Day 1';parent.updatedAt=at;next.events.push({...source,id:id(),parentEventId:parent.id,settings:undefined,subeventSlug:undefined,subeventName:name,name:parent.name+' — '+name,slug:undefined,date,note:'',archivedAt:null,createdAt:at,updatedAt:at,history:[change('Subevent','Not Created',name)],participants:source.participants.filter(p=>!p.removed).map(p=>({...p,addedAt:at,status:null,excuse:null,flag:null,note:'',updatedAt:null,removed:false,history:[]}))});break;}
 case 'rename-subevent':{const e=event();const name=required(action.name,'Subevent name');if(name!==(e.subeventName||'Day 1'))e.history.push(change('Subevent Name',e.subeventName||'Day 1',name));e.subeventName=name;e.updatedAt=at;break;}
 case 'delete-subevent':{
  const e=event(),parent=next.events.find(x=>x.id===(e.parentEventId||e.id))!;
  if(e.subeventDeleted)throw new ValidationError('Subevent No Longer Exists.');
  if(next.events.filter(x=>!x.subeventDeleted&&(x.id===parent.id||x.parentEventId===parent.id)).length<=1)throw new ValidationError('Keep At Least One Subevent.');
  const restoreId=required(action.restoreId,'Undo Identifier',80);if(!/^[a-zA-Z0-9-]+$/.test(restoreId))throw new ValidationError('Invalid Undo Identifier.');
  parent.subeventDeletions={...parent.subeventDeletions,[e.id]:restoreId};
  parent.history.push({...change('Subevent Deleted',e.subeventName||'Day 1','Deleted'),subeventName:e.subeventName||'Day 1'});parent.updatedAt=at;
  if(e.id===parent.id){parent.subeventDeleted=true;parent.participants=[];parent.note='';}
  else next.events=next.events.filter(x=>x.id!==e.id);
  break;
 }
 case 'restore-subevent':{
  const parent=event(),snapshot=action.snapshot as Event;
  if(parent.parentEventId||!snapshot||typeof snapshot.id!=='string'||snapshot.id!==action.subeventId||parent.subeventDeletions?.[snapshot.id]!==action.restoreId)throw new ValidationError('This Subevent Can No Longer Be Restored.');
  if(snapshot.id!==parent.id&&next.events.some(x=>x.id===snapshot.id))throw new ValidationError('Subevent Already Exists.');
  if(snapshot.id===parent.id&&!parent.subeventDeleted)throw new ValidationError('Subevent Already Exists.');
  const restored=structuredClone(snapshot);delete restored.subeventDeleted;delete restored.subeventDeletions;
  for(const p of restored.participants){const reason=excuseFor(p),standalone=reasonFromStatus(p.status);
   if(p.status&&!standalone&&!config.statuses.some(s=>s.active&&s.id===p.status)){p.status=null;p.excuse=null;}
   else if(reason&&reason!=='unspecified'&&!config.excuses.some(e=>e.active&&e.id===reason)){p.excuse=null;if(standalone)p.status=null;}
  }
  if(restored.id===parent.id){parent.participants=restored.participants;parent.note=restored.note;parent.date=restored.date;parent.subeventName=restored.subeventName;parent.subeventSlug=restored.subeventSlug;delete parent.subeventDeleted;}
  else{restored.parentEventId=parent.id;restored.name=parent.name+' — '+(restored.subeventName||'Day 1');
   if(next.events.some(x=>x.subeventSlug===restored.subeventSlug&&(x.id===parent.id||x.parentEventId===parent.id)))restored.subeventSlug=undefined;
   next.events.push(restored);
  }
  delete parent.subeventDeletions![restored.id];parent.updatedAt=at;
  parent.history.push({...change('Subevent Deleted','Deleted',restored.subeventName||'Day 1'),subeventName:restored.subeventName||'Day 1'});
  break;
 }
 case 'archive-event':case 'restore-event':{const e=event(),root=e.parentEventId||e.id;for(const item of next.events.filter(item=>item.id===root||item.parentEventId===root)){const archived=action.type==='archive-event';if(!!item.archivedAt!==archived)item.history.push(change('Archive',item.archivedAt?'Archived':'Active',archived?'Archived':'Active'));item.archivedAt=archived?at:null;item.updatedAt=at;}break;}
 case 'delete-archived-event':{const e=event(),root=e.parentEventId||e.id;if(!e.archivedAt)throw new ValidationError('Only archived events can be permanently deleted.');next.events=next.events.filter(item=>item.id!==root&&item.parentEventId!==root);break;}
 case 'duplicate-event':{const source=event(),root=next.events.find(e=>e.id===(source.parentEventId||source.id))!;const rootId=id();const family=next.events.filter(e=>e.id===root.id||e.parentEventId===root.id);const copies=family.map(e=>({...e,id:e.id===root.id?rootId:id(),parentEventId:e.id===root.id?undefined:rootId,slug:undefined,name:e.id===root.id?root.name.slice(0,193)+' (Copy)':e.name,archivedAt:null,createdAt:at,updatedAt:at,history:[],participants:e.participants.filter(p=>!p.removed).map(p=>({...p,addedAt:at,status:null,excuse:null,flag:null,note:'',updatedAt:null,removed:false,history:[]}))}));next.events.push(...copies.filter(e=>e.parentEventId),copies.find(e=>e.id===rootId)!);break;}
 case 'update-profile':{next.profile=validateProfile(action.profile);break;}
 case 'update-organization':{
  // Freeze legacy custom events against the previous globals before those globals change.
  for(const root of next.events)if(!root.parentEventId&&root.settings&&root.settings.useGlobal===undefined&&Object.keys(root.settings).length)root.settings={...eventSettingsSnapshot(effectiveEventSettings(next,root)),useGlobal:false};
  next.organization=validateOrganization({...action.organization,attendance:action.organization?.attendance??next.organization?.attendance});
  if(next.organization.attendance){
   const incoming=next.organization.attendance;
   incoming.statuses=incoming.statuses.filter(s=>s.active);incoming.excuses=incoming.excuses.filter(e=>e.active);
   next.organization.attendance=validateAttendance(incoming);
   // Clear inherited removals across records; explicit event choice lists stay independent.
   // Audit text remains evidence; it never makes a deleted choice selectable again.
   if(next.reportSettings)next.reportSettings=reportSettings(next.reportSettings,incoming);
   if(next.reportPresets)next.reportPresets=next.reportPresets.map(p=>({...p,settings:reportSettings(p.settings,incoming)}));
   for(const e of next.events){
    const incoming=attendanceSettings(effectiveEventSettings(next,e)),beforeConfig=attendanceSettings(effectiveEventSettings(data,data.events.find(old=>old.id===e.id)));
    clearRemovedMarks(e,beforeConfig,incoming);
   }
  }
  break;
 }
 case 'update-event-settings':{
  const source=event(),root=next.events.find(e=>e.id===(source.parentEventId||source.id))!;
  const previous=attendanceSettings(effectiveEventSettings(next,root)),global=organizationSettings(next.organization);
  const previousLocal=attendanceSettings(mergeEventSettings(global,{...root.settings,useGlobal:false}));
  const settings=validateEventOverrides(typeof action.settings?.useGlobal==='boolean'?{...root.settings,...action.settings}:action.settings,global);
  if(JSON.stringify(root.settings??{})===JSON.stringify(settings))break;
  root.settings=settings;root.updatedAt=at;
  const incoming=attendanceSettings(effectiveEventSettings(next,root));
  // Switching modes retains marks; only actual local choice removal clears them.
  const removalBefore=settings.useGlobal===undefined?previous:previousLocal;
  const removalAfter=settings.useGlobal===undefined?incoming:attendanceSettings(mergeEventSettings(global,{...settings,useGlobal:false}));
  for(const member of next.events.filter(e=>e.id===root.id||e.parentEventId===root.id))clearRemovedMarks(member,removalBefore,removalAfter);
  root.history.push(change('Event Settings','Previous Settings',settings.useGlobal===true||!Object.keys(settings).length?'Global Settings':'Custom Settings'));
  break;
 }
 case 'update-preferences':{next.preferences=validatePreferences({...next.preferences,...action.preferences});break;}
 case 'report-settings':{next.reportSettings=reportSettings(action.settings,config);break;}
 case 'create-roster':{const rows=parseRosterCSV(text(action.csv,500000));if(!rows.length)throw new ValidationError('Paste at least one person in CSV format.');next.rosters.push({id:id(),name:required(action.name,'Roster name'),people:autoLinkNewPeople(next,'',rows.map(fields=>({...personFromFields(fields),addedAt:at,updatedAt:at}))),createdAt:at,updatedAt:at});break;}
 case 'reorder-roster':{const r=roster();r.people=reorderSubset(r.people,action.personIds);r.updatedAt=at;break;}
 case 'reorder-event':{const e=event();const before=e.participants.findIndex(p=>p.id===action.personId);e.participants=reorderSubset(e.participants,action.personIds);const after=e.participants.findIndex(p=>p.id===action.personId);const name=e.participants[after]?displayName(e.participants[after]):'List';e.history.push(change('Order',before>=0?'Position '+(before+1):'Previous order',after>=0?name+' · Position '+(after+1):'Reordered list'));e.updatedAt=at;break;}
 case 'delete-roster':{const r=roster();next.rosters=next.rosters.filter(item=>item.id!==r.id);break;}
 case 'rename-roster':{const r=roster();r.name=required(action.name,'Roster name');r.updatedAt=at;break;}
 case 'link-matching-people':return withPersonIds(linkMatchingPeople(next,at));
 case 'link-person-identity':{const r=roster(),p=r.people.find(p=>p.id===action.personId),target=personForUid(next,required(action.uid,'Person ID',7));if(!p||!target)throw new ValidationError('Person Not Found.');return withPersonIds(linkPersonIdentity(next,personIdentity(next,p.id,r.id),target.id,at));}
 case 'unlink-roster-person':return withPersonIds(unlinkRosterIdentity(next,action.rosterId,action.personId,id()));
 case 'link-roster-person':{const r=roster(),source=personForUid(next,required(action.uid,'Person ID',7));if(!source)throw new ValidationError('Person ID Not Found In This Workspace.');if(r.people.some(p=>samePerson(next,p.id,source.id,r.id)))throw new ValidationError('This Person Is Already In The Roster.');if(r.removedPeople?.some(p=>samePerson(next,p.id,source.id,r.id)))throw new ValidationError('Restore This Person From Removed Names Instead.');if(r.people.length>=500)throw new ValidationError('Use At Most 500 People Per Roster.');const recordId=personIdentity(next,source.id,r.id)===source.id?source.id:id();if(recordId!==source.id)next.personLinks={...next.personLinks,[recordId]:source.id};r.people.push({...personFromFields(personFields(source),recordId),addedAt:at,updatedAt:at});r.updatedAt=at;break;}
 case 'add-roster-people':{const r=roster();const rows=parseRosterCSV(text(action.csv,500000));if(!rows.length)throw new ValidationError('Paste at least one person in CSV format.');if(r.people.length+rows.length>500)throw new ValidationError('Use at most 500 people per roster.');r.people.push(...autoLinkNewPeople(next,r.id,rows.map(fields=>({...personFromFields(fields),addedAt:at,updatedAt:at}))));r.updatedAt=at;break;}
 case 'replace-roster-csv':{const r=roster();const rows=parseRosterCSV(text(action.csv,500000)),people=replaceRosterPeople(r.people,rows,at),included=new Set(people.map(p=>p.id));removeRosterPeople(r,new Set(r.people.filter(p=>!included.has(p.id)).map(p=>p.id)),at);const existing=new Set(r.people.map(p=>p.id)),fresh=people.filter(p=>!existing.has(p.id)),linked=autoLinkNewPeople(next,r.id,fresh),replacements=new Map(fresh.map((p,i)=>[p.id,linked[i]]));r.people=people.map(p=>replacements.get(p.id)??p);r.updatedAt=at;break;}
 case 'roster-person-note':{const r=roster();const p=r.people.find(p=>p.id===action.personId);if(!p)throw new ValidationError('Person No Longer Exists In This Roster.');const note=text(action.note),identity=personIdentity(next,p.id,r.id);next.personNotes={...next.personNotes};if(note)next.personNotes[identity]=note;else delete next.personNotes[identity];r.updatedAt=at;break;}
 case 'edit-person':{const r=roster();const p=r.people.find(p=>p.id===action.personId);if(!p)throw new ValidationError('Person not found.');const previousKey=identityName(p);if(action.fields){const f=action.fields;const fields:PersonFields={firstName:required(f.firstName,'First name'),lastName:text(f.lastName,200).trim(),firstPronunciation:text(f.firstPronunciation,200).trim(),lastPronunciation:text(f.lastPronunciation,200).trim(),preferredFirstName:text(f.preferredFirstName,200).trim()};Object.assign(p,personFromFields(fields,p.id));}else{p.name=required(action.name,'Name');p.pronunciation=text(action.pronunciation,200);delete p.firstName;delete p.lastName;delete p.firstPronunciation;delete p.lastPronunciation;delete p.preferredFirstName;}p.updatedAt=at;r.updatedAt=at;Object.assign(next,autoLinkEditedPerson(next,r.id,p.id,previousKey,at));break;}
 case 'remove-roster-person':{const r=roster();if(!r.people.some(p=>p.id===action.personId))throw new ValidationError('Person No Longer Exists In This Roster.');removeRosterPeople(r,new Set([action.personId]),at);break;}
 case 'remove-person-from-all-rosters':{roster();const targets=rosterRemovalTargets(next,action.rosterId,action.personId);if(!targets.length)throw new ValidationError('Person No Longer Exists In This Roster.');for(const r of next.rosters)removeRosterPeople(r,new Set(targets.filter(t=>t.rosterId===r.id).map(t=>t.person.id)),at);break;}
 case 'restore-roster-person':{const r=roster(),removed=r.removedPeople?.find(p=>p.id===action.personId);if(!removed)throw new ValidationError('Removed Person No Longer Exists.');if(r.people.some(p=>p.id===removed.id))throw new ValidationError('This Person Is Already In The Roster.');if(r.people.length>=500)throw new ValidationError('Use At Most 500 People Per Roster.');const {removedAt,removedIndex,...person}=removed;r.people.splice(Math.min(Math.max(removedIndex??r.people.length,0),r.people.length),0,{...person,updatedAt:at});r.removedPeople=r.removedPeople!.filter(p=>p.id!==person.id);r.updatedAt=at;break;}
 case 'delete-roster-person':{const r=roster();if(!r.removedPeople?.some(p=>p.id===action.personId))throw new ValidationError('Remove This Person Before Permanently Deleting Them.');r.removedPeople=r.removedPeople.filter(p=>p.id!==action.personId);r.updatedAt=at;break;}
 case 'create-event':{const r=roster();const date=required(action.date,'Date',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||(!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date))throw new ValidationError('Choose a valid event date.');if(!r.people.length)throw new ValidationError('Add people to the roster first.');next.events.push({id:id(),name:required(action.name,'Event name'),date,rosterId:r.id,rosterName:r.name,note:text(action.note||''),participants:r.people.map(p=>({...p,addedAt:at,status:null,note:'',updatedAt:null,removed:false,history:[]})),createdAt:at,updatedAt:at,history:[change('Event','Not Created',required(action.name,'Event name'))]});break;}
 case 'status':case 'excuse':case 'attendance-state':{const e=event();const p=e.participants.find(p=>p.id===action.personId&&!p.removed);if(!p)throw new ValidationError('Person not found.');const before=attendanceLabel(p,config);
  if(action.type==='status')chooseAttendance(p,action.status,writableConfig);
  else if(action.type==='attendance-state')setAttendance(p,action.status,action.excuse??null,writableConfig,!!action.historyIntent);
  else{if(p.status&&!reasonFromStatus(p.status)&&!unexcusedStatus(p.status,config)&&action.excuse)throw new ValidationError('Choose A Status That Allows Excuses before adding an excuse.');const base=unexcusedStatus(p.status,config)?p.status:null;setAttendance(p,base,action.excuse,writableConfig);}
  p.history.push(attendanceChange(action.type==='excuse'?'Excuse':'Status',before,p));p.updatedAt=at;e.updatedAt=at;break;}
 case 'clear-person-history':{event();throw new ValidationError('Clearing change history is no longer available.');}
 case 'person-flag':{const e=event();const p=e.participants.find(p=>p.id===action.personId&&!p.removed);if(!p)throw new ValidationError('Person not found.');if(action.flag!==null&&action.flag!=='flagged'&&action.flag!=='complete')throw new ValidationError('Unknown flag state.');const before=p.flag??null;if(before!==action.flag){const label=(value:string|null)=>value==='flagged'?'Flagged':value==='complete'?'Complete':'None';p.history.push(change('Flag',label(before),label(action.flag)));p.flag=action.flag;p.updatedAt=at;e.updatedAt=at;}break;}
 case 'person-note':{const e=event();const p=e.participants.find(p=>p.id===action.personId&&!p.removed);if(!p)throw new ValidationError('Person not found.');const note=text(action.note);if(note!==p.note){p.history.push(change('Note',p.note,note));p.note=note;p.updatedAt=at;e.updatedAt=at;}break;}
 case 'event-note':{const e=event();const note=text(action.note);if(note!==e.note){e.history.push(change('Event note',e.note,note));e.note=note;e.updatedAt=at;}break;}
 case 'rename-event':{const e=event();const name=required(action.name,'Event name');if(e.name!==name)e.history.push(change('Event name',e.name,name));e.name=name;e.updatedAt=at;break;}
 case 'mark-remaining':{const e=event();const status=action.status??'Absent';e.participants.filter(p=>!p.removed&&!p.status).forEach(p=>{chooseAttendance(p,status,writableConfig);p.updatedAt=at;p.history.push(attendanceChange('Status','Unmarked',p));});e.updatedAt=at;break;}
 case 'set-person-field':{
  const e=event(),field=action.field;
  if(!['note','flag','removed'].includes(field)||!Array.isArray(action.changes)||!action.changes.length||action.changes.length>500)throw new ValidationError('Invalid person changes.');
  const seen=new Set<string>();for(const c of action.changes){if(!c||typeof c.personId!=='string'||seen.has(c.personId))throw new ValidationError('Invalid or duplicate person.');seen.add(c.personId);const p=e.participants.find(p=>p.id===c.personId);if(!p||p.removed&&field!=='removed')throw new ValidationError('Person not found.');
   if(field==='note'){const note=text(c.value);if(note!==p.note){p.history.push(change('Note',p.note,note));p.note=note;}}
   else if(field==='flag'){if(c.value!==null&&c.value!=='flagged'&&c.value!=='complete')throw new ValidationError('Unknown flag state.');const label=(v:unknown)=>v==='flagged'?'Flagged':v==='complete'?'Complete':'None';if((p.flag??null)!==c.value)p.history.push(change('Flag',label(p.flag),label(c.value)));p.flag=c.value;}
   else{if(typeof c.value!=='boolean')throw new ValidationError('Invalid removal state.');if(p.removed!==c.value)p.history.push(change('Membership',p.removed?'Removed':'Included',c.value?'Removed':'Included'));p.removed=c.value;}
   p.updatedAt=at;
  }e.updatedAt=at;break;
 }
 case 'set-statuses':{const e=event();if(!Array.isArray(action.changes)||action.changes.length>500)throw new ValidationError('Invalid attendance changes.');const seen=new Set<string>();for(const c of action.changes){if(seen.has(c.personId))throw new ValidationError('Duplicate attendance change.');seen.add(c.personId);const p=e.participants.find(p=>p.id===c.personId&&!p.removed);if(!p)throw new ValidationError('Person not found.');const before=attendanceLabel(p,config);if(Object.hasOwn(c,'excuse'))setAttendance(p,c.status,c.excuse,writableConfig,!!action.historyIntent);else chooseAttendance(p,c.status,writableConfig);p.history.push(attendanceChange('Status',before,p));p.updatedAt=at;}e.updatedAt=at;break;}
 case 'set-family-memberships':{const e=event(),root=e.parentEventId||e.id,family=next.events.filter(item=>item.id===root||item.parentEventId===root);
  if(!Array.isArray(action.changes)||!action.changes.length||action.changes.length>50000)throw new ValidationError('Invalid subevent memberships.');
  const seen=new Set<string>();for(const c of action.changes){if(!c||typeof c.personId!=='string'||typeof c.removed!=='boolean'||seen.has(c.eventId+'|'+c.personId))throw new ValidationError('Invalid or duplicate membership.');seen.add(c.eventId+'|'+c.personId);const item=family.find(item=>item.id===c.eventId),p=item?.participants.find(p=>p.id===c.personId);if(!item||!p||item.archivedAt)throw new ValidationError('Person or editable subevent not found.');if(p.removed===c.removed)continue;const before=p.removed;p.removed=c.removed;p.history.push(change('Membership',before?'Removed':'Included',p.removed?'Removed':'Included'));p.updatedAt=at;item.updatedAt=at;}break;}
 case 'remove-family-person':case 'set-family-membership':{const e=event(),root=e.parentEventId||e.id;const family=next.events.filter(item=>item.id===root||item.parentEventId===root);if(!family.some(item=>item.participants.some(p=>p.id===action.personId)))throw new ValidationError('Person not found.');const changes=action.type==='remove-family-person'?family.filter(item=>item.participants.some(p=>p.id===action.personId&&!p.removed)).map(item=>({eventId:item.id,removed:true})):action.changes;if(!Array.isArray(changes)||changes.length>100||changes.some(c=>typeof c.removed!=='boolean'||!family.some(item=>item.id===c.eventId)))throw new ValidationError('Invalid subevent membership.');for(const c of changes){const item=family.find(item=>item.id===c.eventId)!;const p=item.participants.find(p=>p.id===action.personId);if(!p)throw new ValidationError('Person not found in subevent.');if(p.removed===c.removed)continue;const before=p.removed;p.removed=c.removed;p.history.push(change('Membership',before?'Removed':'Included',p.removed?'Removed':'Included'));p.updatedAt=at;item.updatedAt=at;}break;}
 case 'remove-event-person':case 'restore-event-person':{const e=event();const p=e.participants.find(p=>p.id===action.personId);if(!p)throw new ValidationError('Person not found.');p.removed=action.type==='remove-event-person';p.history.push(change('Membership',p.removed?'Included':'Removed',p.removed?'Removed':'Included'));p.updatedAt=at;e.updatedAt=at;break;}
 case 'delete-event-person':{const e=event();const p=e.participants.find(p=>p.id===action.personId);if(!p)throw new ValidationError('Person No Longer Exists.');if(!p.removed)throw new ValidationError('Remove This Person Before Permanently Deleting Them.');e.participants=e.participants.filter(person=>person.id!==p.id);e.updatedAt=at;break;}
 case 'add-event-people':{const e=event();const people=action.csv!==undefined?parseRosterCSV(text(action.csv,500000)).map(fields=>personFromFields(fields)):parseNames(text(action.names,50000)).map(name=>({id:id(),name:required(name,'Name'),pronunciation:''}));if(action.csv!==undefined&&!people.length)throw new ValidationError('Add At Least One Person.');if(action.scope!==undefined&&!['this','all'].includes(action.scope))throw new ValidationError('Choose A Valid Subevent Scope.');const root=e.parentEventId||e.id,targets=action.scope==='all'?next.events.filter(item=>!item.subeventDeleted&&(item.id===root||item.parentEventId===root)):[e];if(targets.some(item=>item.archivedAt))throw new ValidationError('Restore All Subevents Before Adding People.');if(targets.some(item=>item.participants.length+people.length>500))throw new ValidationError('Use at most 500 people per event.');for(const target of targets){target.participants.push(...people.map(person=>({...person,addedAt:at,status:null,note:'',updatedAt:at,removed:false,history:[change('Membership','Not included','Included')]})));target.updatedAt=at;}break;}
 default:throw new ValidationError('Unknown action.');
 }
 return withPersonIds(next);
}
export function spreadsheetCell(value:string):string{return /^[\s\u0000-\u0020]*[=+@\-]/.test(value)||/^[\t\r\n]/.test(value)?"'"+value:value;}
export function csv(rows:(string|number)[][]):string {return '\uFEFF'+rows.map(row=>row.map(v=>{const s=spreadsheetCell(String(v));return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
export function rollCallCSV(event:Event,config:AttendanceSettings=attendanceSettings()){return csv([['Event','Event date','Roster','Name','Pronunciation','Status','Note','Last changed (UTC)','Event note'],...event.participants.filter(p=>!p.removed).map(p=>[event.name,formatDay(event.date),event.rosterName,displayName(p),displayPronunciation(p),attendanceLabel(p,config),config.comments?p.note:'',p.updatedAt?formatTimestamp(p.updatedAt,'UTC'):'',config.eventNote?event.note:''])]);}
export function historyCSV(event:Event){return csv([['Event','Date','Name','Change','From','To','Timestamp (UTC)','Currently removed'],...event.participants.flatMap(p=>p.history.map(h=>[event.name,formatDay(event.date),displayName(p),h.kind,h.from,h.to,formatTimestamp(h.at,'UTC'),p.removed?'Yes':'No'])),...event.history.map(h=>[event.name,formatDay(event.date),'Event',h.kind,h.from,h.to,formatTimestamp(h.at,'UTC'),''])]);}

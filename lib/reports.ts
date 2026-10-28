import {attendanceSettings,excuseStatus,choiceLabel,type AttendanceSettings} from './attendance-settings.ts';
import {formatDay,formatTimestamp} from './dates.ts';
import type {Preferences} from './workspace-settings';
import {displayName,displayPronunciation,personFields,statusLabel,statusMatches,excuseFor,type Event,type Participant} from './model.ts';
import {reportSettings,REPORT_GROUPS,type ReportGroup,type ReportSettings} from './report-settings.ts';
export function reportPeople(event:Event,settings:ReportSettings,visibleIds:string[],config:AttendanceSettings=attendanceSettings()):Participant[]{
 const visible=new Set(visibleIds);
 const people=event.participants.filter(p=>(settings.removed||!p.removed)&&(settings.scope==='all'||visible.has(p.id))&&settings.groups.some(group=>group==='Unmarked'?!p.status:statusMatches(p,group,config)));
 if(settings.sort!=='roster')people.sort((a,b)=>{const A=personFields(a),B=personFields(b);const value=(f:typeof A)=>settings.sort==='last'?[f.lastName,f.firstName].join(' '):[f.firstName,f.lastName].join(' ');return value(A).localeCompare(value(B),undefined,{sensitivity:'base',numeric:true});});
 return people;
}
export function generateReport(event:Event,input:unknown,visibleIds:string[]=[],generatedAt=new Date().toISOString(),config:AttendanceSettings=attendanceSettings(),preferences?:Preferences):string{
 const s=reportSettings(input,config),people=reportPeople(event,s,visibleIds,config);const markdown=s.format==='markdown';
 s.notes=s.notes&&config.comments;s.history=s.history&&config.history;s.eventHistory=s.eventHistory&&config.history;s.eventNote=s.eventNote&&config.eventNote;
 const escape=(text:string)=>markdown?text.replace(/([\\`*_{}\[\]<>#|])/g,'\\$1'):text;
 const label=(group:ReportGroup)=>group==='Unmarked'?'Unmarked':choiceLabel(group,config);
 const date=(value:string)=>formatTimestamp(value,preferences);
 const eventDate=formatDay(event.date,preferences);
 const groupFor=(p:Participant):ReportGroup|null=>{if(!p.status)return s.groups.includes('Unmarked')?'Unmarked':null;if(s.groups.includes(p.status))return p.status;const reason=excuseFor(p),group=reason?excuseStatus(reason):null;return group&&s.groups.includes(group)?group:null;};
 const heading=(text:string,level=2)=>markdown?'#'.repeat(level)+' '+escape(text):text;
 const sections:string[]=[];const metadata:string[]=[];
 if(s.header)metadata.push(heading(s.title.trim()||event.name,1));
 if(s.eventDate)metadata.push('Date: '+eventDate);
 if(s.roster)metadata.push('Roster: '+escape(event.rosterName));
 if(s.generatedAt)metadata.push('Generated: '+date(generatedAt));
 if(metadata.length)sections.push(metadata.join('\n'));
 if(s.intro.trim())sections.push(escape(s.intro.trim()));
 if(s.eventNote&&event.note)sections.push(heading('Event note')+'\n'+escape(event.note));
 if(s.summary){const all=event.participants.filter(p=>!p.removed),marked=all.filter(p=>p.status).length;const lines=[heading('Attendance summary'),`Event total: ${all.length} · Marked: ${marked} · Unmarked: ${all.length-marked}`,`Included in this report: ${people.length}${s.scope==='visible'?' (current view)':''}${s.removed?' · Removed entries included':''}`];for(const group of s.groups){const count=people.filter(p=>group==='Unmarked'?!p.status:statusMatches(p,group,config)).length;if(count||s.emptyGroups)lines.push(`${label(group)}: ${count}${s.percentages?` (${people.length?Math.round(count/people.length*100):0}% of included people)`:''}`);}sections.push(lines.join('\n'));}
 if(s.names){for(const group of s.groups){const members=people.filter(p=>groupFor(p)===group);if(!members.length&&!s.emptyGroups)continue;const lines=[heading(`${label(group)} (${members.length})`)];if(!members.length)lines.push('None.');members.forEach((p,i)=>{const f=personFields(p);const name=s.nameStyle==='full'?displayName(p):s.nameStyle==='preferred'?[f.preferredFirstName||f.firstName,f.lastName].filter(Boolean).join(' '):[f.firstName,f.lastName].filter(Boolean).join(' ');lines.push(`${s.numbering?`${i+1}. `:markdown?'- ':'• '}${escape(name)}${p.removed?' [removed]':''}`);const detail=(text:string)=>lines.push('  '+text);if(s.excuses&&excuseFor(p))detail('Excuse: '+(config.excuses.find(e=>e.id===excuseFor(p))?.name??config.excusedLabel));if(group!==p.status&&p.status)detail('Attendance: '+choiceLabel(p.status,config));if(s.pronunciations&&displayPronunciation(p))detail('Pronunciation: '+escape(displayPronunciation(p)));if(s.notes&&p.note)detail('Note: '+escape(p.note).replaceAll('\n','\n  '));if(s.timestamps&&p.updatedAt)detail('Last changed: '+date(p.updatedAt));if(s.history&&p.history.length){const entries=p.history.slice().reverse();const shown=s.historyLimit?entries.slice(0,s.historyLimit):entries;detail(`Change history (${shown.length} of ${entries.length}, newest first):`);for(const h of shown)detail(`  ${date(h.at)} · ${h.kind}: ${escape(h.from||'(empty)')} → ${escape(h.to||'(empty)')}`);}});sections.push(lines.join('\n'));}}
 if(s.eventHistory&&event.history.length){const entries=event.history.slice().reverse(),shown=s.historyLimit?entries.slice(0,s.historyLimit):entries;sections.push([heading(`Event change history (${shown.length} of ${entries.length})`),...shown.map(h=>`${date(h.at)} · ${h.kind}: ${escape(h.from||'(empty)')} → ${escape(h.to||'(empty)')}`)].join('\n'));}
 if(s.footer.trim())sections.push(escape(s.footer.trim()));
 return sections.join('\n\n')||'No report content selected. Choose at least one section or status.';
}

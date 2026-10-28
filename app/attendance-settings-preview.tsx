'use client';
import {useState} from 'react';
import {NotebookPen} from 'lucide-react';
import {AttendanceRow} from './attendance-row';
import {NamePreferences} from './name-preferences';
import AttendanceSummary from './attendance-summary';
import {flagStyle} from './attendance-style';
import {applyAction,personFromFields,type Event} from '../lib/model';
import {type AttendanceSettings,reasonFromStatus} from '../lib/attendance-settings';
import type {OrganizationSettings} from '../lib/workspace-settings';
function example():Event{return {id:'preview',name:'Preview',date:'2026-10-22',rosterId:'preview',rosterName:'Staff',note:'Training Room · 9 AM',createdAt:'',updatedAt:'',history:[],participants:[{...personFromFields({firstName:'Alexandra',lastName:'Rivera',preferredFirstName:'Alex',firstPronunciation:'al-ig-ZAN-druh',lastPronunciation:'ree-VAIR-uh'},'preview-person'),status:null,excuse:null,flag:'flagged',note:'',updatedAt:null,removed:false,history:[]}]};}
export function previewEvent(sample:Event,c:AttendanceSettings):Event{return {...sample,participants:sample.participants.map(p=>{const reason=reasonFromStatus(p.status)||p.excuse,validReason=reason==='unspecified'||c.excuses.some(e=>e.active&&e.id===reason);return {...p,status:p.status&&(reasonFromStatus(p.status)?!validReason:!c.statuses.some(s=>s.active&&s.id===p.status))?null:p.status,excuse:reason&&!validReason?null:p.excuse};})};}
export default function AttendancePreview({config:c,organization}:{config:AttendanceSettings;organization:OrganizationSettings}){
 const [sample,setSample]=useState(example);
 // Choice removal immediately updates the sample without touching any workspace records.
 const event=previewEvent(sample,c);
 const change=async(action:any)=>{setSample(current=>applyAction({rosters:[],events:[previewEvent(current,c)],organization:{...organization,attendance:c}},{...action,eventId:current.id,personId:current.participants[0]?.id},undefined,{name:'You',email:'preview@example.test'}).events[0]);return true;};
 return <NamePreferences settings={{...organization,attendance:c}}><div className="settings-attendance-preview app-shell" data-comments={c.comments} data-history={c.history} role="group" aria-label="Roll Call Preview" style={flagStyle(c)} onKeyDownCapture={e=>{if(e.key==='Enter'&&(e.target as Element).matches('input'))e.preventDefault();}}><AttendanceSummary event={event} filter={[]} onToggle={()=>{}} interactive={false}/>{c.eventNote&&<div className="inline-event-note"><NotebookPen size={16}/><span className="event-note-label">Event Note</span><input aria-label="Preview Event Note" value={event.note} onChange={e=>setSample({...sample,note:e.target.value})}/></div>}<div className="roll-call-panel"><div className="attendance-table-scroll"><div className="table-label">{['#','Full Name',...(c.comments?['Notes']:[]),'Attendance',...(c.history?['Last Changed']:[])].map(label=><span key={label} data-column={label}>{label}</span>)}<span/></div><div className="people-list">{event.participants.map((person,i)=><AttendanceRow key={person.id} preview person={person} index={i+1} duplicate={false} duplicateNumber={1} busy={false} onAction={change}/>)}</div></div></div></div></NamePreferences>;
}

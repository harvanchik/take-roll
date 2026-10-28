'use client';
import {useEffect,useRef,useState,useId} from 'react';
import {nextUnmarkedId,adjacentPersonId,keyboardSelection,keyboardStatus,contiguousSelection,clickPersonSelection,mergeSelection,boundaryPersonSelection,type AttendanceSelectionRange,type BoundarySelection} from '../lib/attendance-keyboard';
import {reducedMotion} from '../lib/motion';
import {NOTE_SETTLE_MS} from '../lib/text-draft';
import type {Participant} from '../lib/model';
type Field='note'|'flag';
type Change={personId:string;value:string|null};
type NoteSession={ids:string[];active:string;before:Array<{personId:string;value:string;removed:boolean}>;draft?:string;dirty:boolean;composing:boolean;save:(changes:Change[],before:unknown)=>Promise<unknown>};
type Options={available:boolean;eventId:string;people:Participant[];statuses:Array<{id:string;name:string}>;busy:boolean;notesEnabled:boolean;flagsEnabled:boolean;onStatuses:(ids:string[],status:string|null)=>Promise<unknown>;onExcuses:(ids:string[])=>Promise<unknown>;onFields:(field:Field,changes:Change[],before?:unknown)=>Promise<unknown>;onRemove:(ids:string[])=>void;onList:()=>void};
export default function useAttendanceKeyboard(options:Options){
 const {available,eventId,people,statuses,busy,onStatuses,onList}=options;
 const [enabled,setEnabled]=useState(false),[active,setActive]=useState(''),[selected,setSelected]=useState<string[]>([]),[announcement,setAnnouncement]=useState(''),[skipHelp,setSkipHelp]=useState(false),[noteEditor,setNoteEditor]=useState<{ids:string[];draft?:string}|null>(null);
 const frame=useRef(0),saving=useRef(false),activeRef=useRef(''),selectedRef=useRef<string[]>([]),range=useRef<AttendanceSelectionRange>({anchor:'',offset:0,base:[]}),boundary=useRef<BoundarySelection|null>(null),notes=useRef<NoteSession|null>(null),noteTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),draftKey=useId();
 const latest=useRef(options);latest.current=options;
 const announceDirty=(dirty:boolean)=>window.dispatchEvent(new CustomEvent('attendance:text-dirty',{detail:{key:draftKey,dirty}}));
 const clearTimer=()=>{clearTimeout(noteTimer.current);noteTimer.current=undefined;};
 const commitNotes=(close=false)=>{const session=notes.current;if(!session)return;clearTimer();if(session.composing&&!close)return;
  if(session.dirty&&session.draft!==undefined){const value=session.draft,before=session.before;session.dirty=false;session.before=session.ids.map(personId=>({personId,value,removed:false}));announceDirty(false);void session.save(session.ids.map(personId=>({personId,value})),before);}
  if(close){notes.current=null;setNoteEditor(null);announceDirty(false);}
 };
 const commitRef=useRef(commitNotes);commitRef.current=commitNotes;
 const setSelection=(ids:string[])=>{selectedRef.current=ids;setSelected(ids);};
 const focus=(id:string,ids=[id])=>{if(!id)return;commitNotes(true);activeRef.current=id;setActive(id);setSelection(ids);onList();cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>{const row=Array.from(document.querySelectorAll<HTMLElement>('[data-roll-person]')).find(row=>row.dataset.rollPerson===id);row?.focus({preventScroll:true});row?.scrollIntoView({block:'nearest',inline:'nearest',behavior:reducedMotion()?'auto':'smooth'});});};
 const resetFocus=(id:string)=>{boundary.current=null;range.current={anchor:id,offset:0,base:[]};focus(id);};
 const exit=()=>{boundary.current=null;commitNotes(true);setEnabled(false);activeRef.current='';setActive('');setSelection([]);range.current={anchor:'',offset:0,base:[]};};
 const jump=(direction=1)=>{if(!enabled)setSkipHelp(false);const id=nextUnmarkedId(people,activeRef.current,direction);if(id){setEnabled(true);resetFocus(id);}else setAnnouncement('No unmarked people in this view.');};
 const toggle=()=>{if(enabled)exit();else{setSkipHelp(false);setEnabled(true);resetFocus(people.some(p=>p.id===activeRef.current)?activeRef.current:people[0]?.id||'');}};
 const controls=useRef({enabled,jump,focus,resetFocus,exit});controls.current={enabled,jump,focus,resetFocus,exit};
 async function mark(status:string|null,toggleStatus=false){
  const state=latest.current;if(!state.available||!controls.current.enabled||state.busy||saving.current)return false;
  const rows=state.people.filter(p=>!p.removed&&selectedRef.current.includes(p.id));if(!rows.length)return false;
  saving.current=true;
  try{if(status==='Excused')return await state.onExcuses(rows.map(p=>p.id));const next=toggleStatus&&rows.every(p=>p.status===status)?null:status;if(rows.every(p=>p.status===next))return true;
   const result=await state.onStatuses(rows.map(p=>p.id),next);if(result)setAnnouncement(`${rows.length===1?rows[0].name:rows.length+' people'}: ${next===null?'Unmarked':state.statuses.find(s=>s.id===next)?.name||next}`);return result;
  }finally{saving.current=false;}
 }
 const markRef=useRef(mark);markRef.current=mark;
 const startNotes=()=>{const state=latest.current;if(!state.notesEnabled||state.busy)return;const rows=state.people.filter(p=>!p.removed&&selectedRef.current.includes(p.id));if(!rows.length)return;
  notes.current={ids:rows.map(p=>p.id),active:activeRef.current,before:rows.map(p=>({personId:p.id,value:p.note,removed:false})),dirty:false,composing:false,save:(changes,before)=>state.onFields('note',changes,before)};setNoteEditor({ids:rows.map(p=>p.id)});
  cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>{const row=Array.from(document.querySelectorAll<HTMLElement>('[data-roll-person]')).find(row=>row.dataset.rollPerson===activeRef.current),input=row?.querySelector<HTMLTextAreaElement>('[data-keyboard-note]');input?.focus();input?.select();});
 };
 const notesRef=useRef({startNotes});notesRef.current={startNotes};
 useEffect(()=>{exit();setAnnouncement('');saving.current=false;},[eventId,available]);
 const peopleKey=people.map(p=>p.id).join('|');
 useEffect(()=>{if(!enabled)return;const ids=new Set(people.map(p=>p.id));if(!ids.has(activeRef.current)||selectedRef.current.some(id=>!ids.has(id))){const next=ids.has(activeRef.current)?activeRef.current:people[0]?.id||'';if(next)resetFocus(next);else{commitNotes(true);activeRef.current='';setActive('');setSelection([]);}}},[peopleKey,enabled]);
 useEffect(()=>{const flush=()=>commitRef.current(false),hidden=()=>{if(document.visibilityState==='hidden')flush();},discard=()=>{clearTimer();notes.current=null;setNoteEditor(null);announceDirty(false);};window.addEventListener('attendance:flush-drafts',flush);window.addEventListener('beforeunload',flush);window.addEventListener('pagehide',flush);window.addEventListener('attendance:discard-drafts',discard);document.addEventListener('visibilitychange',hidden);return()=>{commitRef.current(true);cancelAnimationFrame(frame.current);window.removeEventListener('attendance:flush-drafts',flush);window.removeEventListener('beforeunload',flush);window.removeEventListener('pagehide',flush);window.removeEventListener('attendance:discard-drafts',discard);document.removeEventListener('visibilitychange',hidden);};},[]);
 useEffect(()=>{const keydown=(e:KeyboardEvent)=>{
  const state=latest.current,control=controls.current,target=e.target as Element|null;
  if(!state.available||e.defaultPrevented||e.isComposing||document.querySelector('dialog[open],[role=dialog],[role=listbox],[role=menu],details[open],.keyboard-remove-confirm,.row-confirm'))return;
  if(target?.closest('[data-keyboard-note]')&&notes.current){if((e.key==='Tab'||e.key==='Enter')&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!notes.current.composing){e.preventDefault();const {active,ids}=notes.current;commitRef.current(true);control.focus(active,ids);}return;}
  if(target?.closest('input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox],[role=combobox]'))return;
  if((e.ctrlKey||e.metaKey)&&e.shiftKey&&!e.altKey&&control.enabled&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();const result=boundaryPersonSelection(state.people,{active:activeRef.current,ids:selectedRef.current,range:range.current},boundary.current,e.key==='ArrowDown'?1:-1);boundary.current=result.boundary;range.current=result.range;if(result.active)control.focus(result.active,result.ids);setAnnouncement(`${result.ids.length} ${result.ids.length===1?'person':'people'} selected.`);return;}
  if(!['Control','Meta','Shift','Alt'].includes(e.key))boundary.current=null;
  if(e.ctrlKey||e.metaKey)return;
  if(e.altKey&&e.key.toLowerCase()==='n'){e.preventDefault();if(!e.repeat)control.jump(e.shiftKey?-1:1);return;}if(e.altKey||!control.enabled)return;
  if(target?.closest('a,button,[data-drag-handle]')&&!target.closest('[data-roll-person] .status-options,[data-keyboard-control]'))return;
  if(e.key==='Escape'){e.preventDefault();control.exit();return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const direction=e.key==='ArrowDown'?1:-1;if(!e.shiftKey){control.resetFocus(adjacentPersonId(state.people,activeRef.current,direction));return;}
   if(!range.current.anchor||!state.people.some(p=>p.id===range.current.anchor))range.current={anchor:activeRef.current||state.people[0]?.id||'',offset:0,base:[]};range.current.offset=Math.max(-(state.people.length-1),Math.min(state.people.length-1,range.current.offset+direction));const currentRange=keyboardSelection(state.people,range.current.anchor,range.current.offset),ids=mergeSelection(state.people,currentRange,range.current.base);if(currentRange.length){control.focus(currentRange[currentRange.length-1],ids);setAnnouncement(`${ids.length} ${ids.length===1?'person':'people'} selected.`);}return;
  }
  if(e.shiftKey)return;
  if(e.key==='Tab'&&state.notesEnabled){e.preventDefault();notesRef.current.startNotes();return;}
  if(e.key==='Delete'){e.preventDefault();if(!e.repeat&&!state.busy)state.onRemove(state.people.filter(p=>!p.removed&&selectedRef.current.includes(p.id)).map(p=>p.id));return;}
  if(e.key.toLowerCase()==='f'&&state.flagsEnabled){e.preventDefault();if(!e.repeat&&!state.busy){const changes=state.people.filter(p=>!p.removed&&selectedRef.current.includes(p.id)).map(p=>({personId:p.id,value:p.flag==='flagged'?'complete':p.flag==='complete'?null:'flagged'}));if(changes.length)void state.onFields('flag',changes);}return;}
  const status=keyboardStatus(e.key,state.statuses);if(status===undefined)return;e.preventDefault();if(!e.repeat)void markRef.current(status);
 };window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);},[]);
 return {enabled:available&&enabled,skipHelp,active:available&&people.some(p=>p.id===active)?active:'',selected:available&&enabled?selected.filter(id=>people.some(p=>p.id===id)):[],noteEditor,
  changeNote:(value:string)=>{const session=notes.current;if(!session)return;clearTimer();session.draft=value;session.dirty=session.before.some(p=>p.value!==value);setNoteEditor({ids:session.ids,draft:value});announceDirty(session.dirty);if(session.dirty&&!session.composing)noteTimer.current=setTimeout(()=>commitRef.current(false),NOTE_SETTLE_MS);},
  composeNote:(active:boolean)=>{if(notes.current){notes.current.composing=active;clearTimer();if(!active&&notes.current.dirty)noteTimer.current=setTimeout(()=>commitRef.current(false),NOTE_SETTLE_MS);}},
  blurNote:()=>{queueMicrotask(()=>{if(!document.activeElement?.matches('[data-keyboard-note]'))commitRef.current(true);});},
  selectRow:(id:string,extend:boolean,add:boolean)=>{if(!available)return;if(!enabled){if(!add||!people.some(p=>p.id===id&&!p.removed))return;setSkipHelp(true);setEnabled(true);resetFocus(id);setAnnouncement('1 person selected.');return;}boundary.current=null;const result=clickPersonSelection(people,range.current,selectedRef.current,id,extend,add);range.current=result.range;focus(id,result.ids);setAnnouncement(`${result.ids.length} ${result.ids.length===1?'person':'people'} selected.`);},
  activate:(id:string,preserveSelection=false)=>{if(!enabled||id===activeRef.current||preserveSelection&&selectedRef.current.includes(id))return;commitNotes(true);boundary.current=null;activeRef.current=id;setActive(id);range.current={anchor:id,offset:0,base:[]};setSelection([id]);},jump,toggle,announcement,mark:(status:string)=>markRef.current(status,true),resume:()=>{if(activeRef.current)focus(activeRef.current,selectedRef.current);}};
}
